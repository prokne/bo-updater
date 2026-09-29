const { app, BrowserWindow, ipcMain, dialog, powerSaveBlocker  } = require("electron");
const fs = require("fs");
const fsp = require("fs").promises;
const https = require("https");
const path = require("path");
const { spawn } = require("child_process");
const rootPath = require("electron-root-path").rootPath;
const { autoUpdater } = require("electron-updater")
const yauzl = require('yauzl');
const { getGameSize, ensureEnoughDiskSpace, filePartSize, defaultGameInstallDir, rarPath } = require('./src/utils/index.js');
const {readFile, scheduleSave, writeFile} = require("./src/launcher-data/index.js")

const config  = require('./config');


if (process.env.IS_DEV){
  autoUpdater.forceDevUpdateConfig = true;
}

const userDataPath = app.getPath("userData");

autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

let GM_ON = false;
let activeReq = null;

const URL = "https://bradavice-online.cz/patches/";
const URL_CLOUDFLARE = "https://bo-updater-worker.prokop-n.workers.dev/";
const GAME_URL = 'https://bo-updater-worker.prokop-n.workers.dev/bradavice-online.zip';
const LAUNCHER_PATH = app.isPackaged ? path.dirname(app.getPath("exe")): rootPath;

let localDataObject;

GM_ON
  ? (localDataObject = {
      patches: {
        "patch-H": 0,
        "patch-S": 0,
        "patch-P": 0,
        "patch-T": 0,
      },
      options: {
        muted: false,
        night: true,
        gameIsDownloading: false,
        forceAskDownload: true,
        gamePath: path.join(LAUNCHER_PATH, "../"),
      },
    })
  : (localDataObject = {
      patches: {
        "patch-H": 0,
        "patch-S": 0,
        "patch-P": 0,
        "patch-T": 0,
      },
      options: {
        muted: false,
        night: true,
        gameIsDownloading: false,
        forceAskDownload: true,
        gamePath: path.join(LAUNCHER_PATH, "../"),
      },
    });

let serverPatcheInfoData = {
  "patch-H": 0,
  "patch-S": 0,
  "patch-P": 0,
  "patch-T": 0,
};
let isFinishedUpdating = false;

function isGameInstalled() {
  if (localDataObject.options.gamePath && localDataObject.options.gamePath > 0){
    if (fs.existsSync(path.join(localDataObject.options.gamePath, "Wow.exe")));
    win.webContents.send("check-patche", "client");
    return true;
  }

  if (fs.existsSync("../Wow.exe")) { //manualni instalace
    localDataObject.options.gamePath = path.join(LAUNCHER_PATH, "../");
    scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
    win.webContents.send("check-patche", "client");
    return true;
  }

  return false;
}

//Gets serverPatche.json from server to find out whether there are any new updates
function getServerPatcheInfo() {
  return new Promise((resolve, reject) => {
    https.get("https://bradavice-online.cz/patches/patche.json", (res) => {
      const path = `serverPatche.json`;
      const filePath = fs.createWriteStream(path);
      console.log(path);
      res.pipe(filePath);
      filePath.on("finish", function () {
        // the file is done downloading
        filePath.close();
        console.log("serverPatche.json downloaded!");
        fs.readFile("serverPatche.json", (err, data) => {
          if (err) {
            reject(err);
          } else {
            const object = JSON.parse(data);
            resolve(object);
          }
        });
      });
    });
  });
}

// shows the themed overlay, waits for the user to confirm a path
function askInstallLocation() {
  return new Promise((resolve) => {
    win.webContents.send('show-path-picker', {
      defaultPath: defaultGameInstallDir(),
    });

    ipcMain.once('install-location-chosen', (event, chosenPath) => {
      localDataObject.options.forceAskDownload = false;
      resolve(chosenPath);
    });
  });
}

// handles the "Zvolit jiné umístění" button — opens the native picker,
// returns the result back to the renderer to update the displayed text
ipcMain.handle('browse-install-location', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Zvol umístění pro instalaci hry',
    defaultPath: 'C:\\Games',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Vybrat',
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return path.join(result.filePaths[0], 'Bradavice Online');
});

//Downloads patches and sends progress to front-end
// function downloadFile(url, fileName) {
//   return new Promise((resolve, reject) => {
//     https.get(url, (res) => {
//       const path = `../Data/${fileName}`;
//       const filePath = fs.createWriteStream(path);
//       let len = 0;
//       res.on("data", function (chunk) {
//         filePath.write(chunk);
//         len += chunk.length;

//         // percentage downloaded is as follows
//         let percent = (len / res.headers["content-length"]) * 100;
//         win.webContents.send("download-progress", Math.floor(percent));
//       });
//       res.on("end", function () {
//         filePath.close();
//       });
//       filePath.on("close", function () {
//         // the file is done downloading
//         resolve(`Download completed - ${fileName}`);
//       });
//       res.on("error", (err) => {
//         reject(err);
//       });
//     });
//   });
// }

//Dowonload patch from cloudflare worket and show progress in front-end
async function downloadPatchFromCloudFlare(url, filename) {
    return new Promise(async (resolve, reject) => {
    const destPath = path.join(localDataObject.options.gamePath, "Data", filename);
    const patchName = filename.replace(".MPQ", "");
    let patchSize;
    try {
      patchSize = await getGameSize(url); // HEAD request, see earlier message
    } catch (err) {
      return reject(err);
    }

    let start = filePartSize(destPath);

    if ( start >= patchSize) {
      if (localDataObject.patches[patchName] !== serverPatcheInfoData[patchName]){ // file is fully downloaded but local patche.json is outdated, so we need to redownload it
        fs.rmSync(destPath, { force: true });
        start = filePartSize(destPath); // will be 0 now, since the file no longer exists
      } else { // already fully downloaded — nothing to do
        win.webContents.send('download-progress', 100);
        return resolve();
      }
    }

    const headers = { 'x-api-key': config.API_KEY };
    if (start > 0) headers.Range = `bytes=${start}-`;

    activeReq = https.get(url, { headers, agent: false }, (res) => {
      if (start > 0 && res.statusCode === 200) {
        // server ignored our Range — start over
        res.resume();
        fs.rmSync(destPath, { force: true });
        return reject(new Error('RANGE_IGNORED'));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }

      const total = start + Number(res.headers['content-length']);
      let len = start;
      let lastEmit = 0;

      const out = fs.createWriteStream(destPath, { flags: 'a' });

      // --- stall detection ---
      let stallTimer;
      const STALL_MS = 15000; // no data for 15s = treat as dead

      function resetStallTimer() {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          activeReq.destroy(new Error('STALLED'));
        }, STALL_MS);
      }
      resetStallTimer();
      // --- end stall detection ---

      res.on('data', (chunk) => {
        resetStallTimer();
        len += chunk.length;
        const now = Date.now();
        if (now - lastEmit > 1000) {
          lastEmit = now;
          let percent = (len / total) * 100;
          win.webContents.send('download-progress', Math.floor(percent));
        }
      });

      res.pipe(out);

      res.on('error', (err) => { out.destroy(); reject(err); });
      out.on('error', reject);
      out.on('finish', () => {
        clearTimeout(stallTimer);
        activeReq = null;
        if (filePartSize(destPath) < total) return reject(new Error('CONNECTION_LOST'));
        win.webContents.send('download-progress', 100);
        resolve();
      });
    });

    activeReq.on('error', (err) => {
      activeReq = null;
      reject(err);
    });
  });
}


//Delete Cache
function deleteCache() {
  fs.rmdir(path.join(localDataObject.options.gamePath, "Cache"), { recursive: true }, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Deleted Cache");
    }
  });
}


//Delete Night patch
async function deleteNightPatch() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(localDataObject.options.gamePath, "Data", "patch-U.MPQ"))) {
      console.log("No night patch to delete");
      resolve();
    } else {
      fs.rm(path.join(localDataObject.options.gamePath, "Data", "patch-U.MPQ"), { recursive: true }, (err) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log("Deleted patch-U");
          resolve();
        }
      });
    }
  });
}

//downloads directly patch-U from cloudfront
async function downloadNightPatch(destinationPath) {
  const response = await fetch('https://bo-updater-worker.prokop-n.workers.dev', {
    headers: {
      'x-api-key': config.API_KEY,
    },
  });

  console.log("Response from cloudflare", response);

  if (!response.ok) {
    console.log(response);
    throw new Error(`Download failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(buffer));
}


// Downloads game with resume support. Call again after a pause/failure
// and it picks up where it left off.
function downloadGame(destPath) {
  return new Promise(async (resolve, reject) => {
    win.webContents.send("info", `Stahuji hru`);
    const start = filePartSize(destPath);

    let gameSize;
    try {
      gameSize = await getGameSize(GAME_URL);
    } catch (err) {
      return reject(err);
    }

    if (start >= gameSize) {
      // already fully downloaded — nothing to do
      win.webContents.send('download-progress', 100);
      return resolve();
    }

    const headers = { 'x-api-key': config.API_KEY };
    if (start > 0) headers.Range = `bytes=${start}-`;

    activeReq = https.get(GAME_URL, { headers, agent: false}, (res) => {
      if (start > 0 && res.statusCode === 200) {
        // server ignored our Range — start over
        res.resume();
        fs.rmSync(destPath, { force: true });
        return reject(new Error('RANGE_IGNORED'));
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }

      const total = start + Number(res.headers['content-length']);
      let len = start;
      let lastEmit = 0;

      const out = fs.createWriteStream(destPath, { flags: 'a' });

      // --- stall detection ---
      let stallTimer;
      const STALL_MS = 15000; // no data for 15s = treat as dead

      function resetStallTimer() {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          if (activeReq){
          activeReq.destroy(new Error('STALLED'));
          }
        }, STALL_MS);
      }
      resetStallTimer();
      // --- end stall detection ---

      res.on('data', (chunk) => {
        resetStallTimer();
        len += chunk.length;
        const now = Date.now();
        if (now - lastEmit > 1000) {
          lastEmit = now;
          let percent = (len / total) * 100;
          win.webContents.send('download-progress', Math.floor(percent));
        }
      });

      res.pipe(out);

      res.on('error', (err) => { out.destroy(); reject(err); });
      out.on('error', reject);
      out.on('finish', () => {
        clearTimeout(stallTimer);
        activeReq = null;
        if (filePartSize(destPath) < total) return reject(new Error('CONNECTION_LOST'));
        win.webContents.send('download-progress', 100);
        resolve();
      });
    });

    activeReq.on('error', (err) => {
      activeReq = null;
      reject(err);
    });
  });
}

async function downloadGameWithRetry(destPath) {
  let attempt = 0;

  while (true){
    const sizeBefore = filePartSize(destPath);

    try {
      await downloadGame(destPath);
      return;
    } catch (err) {
      console.log(err)
      if (err.message === 'PAUSED') throw err;       // user action, don't retry
      if (filePartSize(destPath) > sizeBefore) attempt = 0;
      if (attempt >= 10){
        win.webContents.send("info", `Hru se nepodařilo stáhnout, zkus to později`);
        throw err;
      }
      const wait = Math.min(30000, 1000 * 2 ** attempt);
      win.webContents.send("info", `Spojení přerušeno, zkouším znovu...(pokus ${attempt + 1}/10)`);
      await new Promise((r) => setTimeout(r, wait)); //wait without continuing in the loop

      attempt++;
    }
  }
}

function extractGameWithProgress(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const ensuredDirs = new Set();
    function ensureDirOnce(dir) {
      if (ensuredDirs.has(dir)) return Promise.resolve();
      return fsp.mkdir(dir, { recursive: true }).then(() => ensuredDirs.add(dir));
    }

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      let done = 0;
      const total = zipfile.entryCount;

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const outPath = path.join(destDir, entry.fileName);

        if (/\/$/.test(entry.fileName)) {
          ensureDirOnce(outPath).then(() => {
            done++;
            win.webContents.send('download-progress', Math.floor((done / total) * 100));
            zipfile.readEntry();
          });
          return;
        }

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) return reject(err);
          ensureDirOnce(path.dirname(outPath)).then(() => {
            const writeStream = fs.createWriteStream(outPath);
            readStream.pipe(writeStream);
            writeStream.on('finish', () => {
              done++;
              win.webContents.send('download-progress', Math.floor((done / total) * 100));
              win.webContents.send("info", `Instaluji hru — ${path.basename(entry.fileName)} (${done}/${total})`);
              zipfile.readEntry();
            });
            writeStream.on('error', reject);
          });
        });
      });

      zipfile.on('end', () => {
        win.webContents.send("check-patche", "client");
        resolve();
      });
      zipfile.on('error', reject);
    });
  });
}

function shouldDownloadGame() {
  return new Promise((resolve, reject) => {
    win.webContents.send("show-modal", {
      title: "Herní klient nenalezen",
      message: "Chcete hru stáhnout a nainstalovat?",
      primaryButton: "Ano",
      secondaryButton: "Ne"
    });

    ipcMain.once('modal-response', (event, response) => {
      if (response === "primary") {
        localDataObject.options.gameIsDownloading = true;
        resolve(true);
      } else {
        localDataObject.options.gameIsDownloading = false;
        localDataObject.options.forceAskDownload = false;
        localDataObject.options.gamePath = path.join(LAUNCHER_PATH, "../");
        scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
        resolve(false);
      }
  });
})}

//Compares local patche.json vs serverPatche.json and returns list of patches, which needs to be downloaded
async function isUpToDate() {
  
  const localPatcheData = await readFile(path.join(userDataPath, "patche.json"));
  let serverPatcheData = await getServerPatcheInfo();

  localDataObject = localPatcheData;
  serverPatcheInfoData = serverPatcheData;

  if (localDataObject.options.forceAskDownload === undefined) {
    localDataObject.options.forceAskDownload = true;
  }

  win.webContents.send("is-muted", localPatcheData.options.muted);
  if (GM_ON) {
    win.webContents.send("is-night", localPatcheData.options.night);
  }

  // //Download and extract game if it is not installed yet
   if (!isGameInstalled()) {
    const shouldDownload =
      localDataObject.options.forceAskDownload === true
        && await shouldDownloadGame()

    if (shouldDownload){
      localDataObject.options.gamePath = await askInstallLocation();
      scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
    }

    if (localDataObject.options.gameIsDownloading) {
      try {
        await downloadAndExtractGame();
      } catch (err) {
        if (err.message.startsWith('Nedostatek místa na disku')) {
          await new Promise((resolve) => {
            win.webContents.send("show-modal", {
              title: "Nedostatek místa na disku",
              message: err.message,
              primaryButton: "OK",
            });

            ipcMain.once('modal-response', (event, response) => {
              resolve();
            });
          });
          app.quit();
          return [];
        }
        throw err; // some other unexpected error, let it surface normally
      }
    }
  }

  //delete night patch
  if (!GM_ON){
    console.log("GM is off, deleting night patch if exists");
    await deleteNightPatch();
  }

  const list = [];

  Object.keys(localPatcheData.patches).forEach((key, index) => {
    console.log("checkuju pathe");
    if (localPatcheData.patches[key] < serverPatcheData[key]) {
      list.push(key);
    }
    if (localPatcheData.patches[key] === serverPatcheData[key]) {
      console.log(key);
      win.webContents.send("check-patche", key);
    }
  });

  return list;
}

//Downloads out-of-date patches
async function downloadPatches(downloadList) {
  for (let i = 0; i < downloadList.length; i++) {
    let filename = downloadList[i] + ".MPQ";
    win.webContents.send("info", "Stahuji " + downloadList[i]);
    console.log("Stahuji " + downloadList[i]);
    //await downloadFile(URL + `${filename}`, downloadList[i] + ".MPQ").then(
    try {
      await downloadPatchFromCloudFlare(URL_CLOUDFLARE + `${filename}`, filename);
    } catch (err) {
      console.log(err);
      throw err;
    }
    console.log("File downloaded!");
    win.webContents.send("check-patche", downloadList[i]);
    localDataObject.patches[downloadList[i]] =
    serverPatcheInfoData[downloadList[i]];
    let dataToSave = JSON.stringify(localDataObject);
    console.log(localDataObject);
    scheduleSave(path.join(userDataPath, "patche.json"), dataToSave);
  }
  win.webContents.send("info", "Vaše patche jsou aktuální");

  //delete Cache
  deleteCache();

  isFinishedUpdating = true;
  win.webContents.send("playable", true);
}

async function downloadAndExtractGame() {
  const powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep");
  try {
    const gameSize = await getGameSize(GAME_URL);
    const RAR_PATH = rarPath(localDataObject.options.gamePath);
    await ensureEnoughDiskSpace(RAR_PATH, gameSize);
    await downloadGameWithRetry(RAR_PATH);
    await extractGameWithProgress(RAR_PATH, localDataObject.options.gamePath);
    fs.rmSync(RAR_PATH, { force: true });
    localDataObject.options.gameIsDownloading = false;
    localDataObject.options.forceAskDownload = true;
    scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
  } finally {
    powerSaveBlocker.stop(powerSaveBlockerId);
  }
}

async function main () {
  GM_ON = fs.existsSync(`${userDataPath}/${config.ENHANCED_FILE}`);
  
  win.webContents.send("is-gm-on", GM_ON);

  if (!fs.existsSync(path.join(userDataPath, "patche.json"))) {
    writeFile(path.join(userDataPath, "patche.json"), JSON.stringify(localDataObject), true);
  }

  await isUpToDate().then(async (downloadList) => {
    console.log(downloadList.length);
    if (downloadList.length === 0) {
      win.webContents.send("info", "Vaše patche jsou aktuální");
      deleteCache();
      isFinishedUpdating = true;
      win.webContents.send("playable", true);
    } else {
      await downloadPatches(downloadList);
    }
  });

  ipcMain.on("mute", (event, isMuted) => {
    localDataObject.options.muted = isMuted;
    scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
  });

  //When user checks or unchecks the night checkbox
  if (GM_ON) {
    ipcMain.on("night-check", async (event, checked) => {
      localDataObject.options.night = checked;
      scheduleSave(path.join(userDataPath, "patche.json"), localDataObject);
      win.webContents.send("playable", false);

      //if checkbox is checked -> delete patch-U
      if (checked) {
        await deleteNightPatch();
        if (isFinishedUpdating) {
          win.webContents.send("playable", true);
        }
      }
      //else download patch-U
      else {
        await downloadNightPatch(path.join(localDataObject.options.gamePath, "Data", "patch-U.MPQ"));
        console.log("patch-U downloaded");
        if (isFinishedUpdating) {
          win.webContents.send("playable", true);
        }
      }
    });
  }

  ipcMain.on("launch-wow", (event, args) => {
    const subprocess = spawn(
      path.join(localDataObject.options.gamePath, "Wow.exe"),
      [],
      { detached: true, stdio: "ignore" },
      (err, stdout, stderr) => {
        if (err) {
          console.log(err);
        } else {
          console.log(stdout);
        }
      }
    );
    subprocess.unref();
    app.quit();
  });
}

function createWindow(width, height) {
  return new BrowserWindow({
    backgroundColor: "#16213e",
    width,
    height,
    resizable: false,
    frame: false,
    maximizable: false,
    //titleBarStyle: 'hidden',
    //titleBarOverlay: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname + "/preload.js"),
    },
    icon: __dirname + "/icons/bo.ico",
  });
}

app.on("ready", () => {
  autoUpdater.checkForUpdatesAndNotify()
  // win = createWindow();
  // win.loadFile("index.html");
  // //win.webContents.openDevTools();
  // win.webContents.on("ready-to-show", () => {
  //   main();
  // });

});


autoUpdater.on('update-not-available', (info) => {
  win = createWindow(900,600);
  win.loadFile("index.html");
  //win.webContents.openDevTools();
  win.webContents.on("ready-to-show", async () => {
   await main();
  });

  ipcMain.on("close-me", (event, args)=>{
    app.exit(0);
  })

  ipcMain.on("minimize-me", (event, args)=>{
    win.minimize();
  })
})

autoUpdater.on('update-available', (info) => {
  win = createWindow(300,400);
  win.loadFile("updateWindow.html");
  //win.webContents.openDevTools();
  ipcMain.on("close-me", (event, args)=>{
    app.quit();
  })
})

autoUpdater.on('download-progress', (progressObj) => {
  console.log("progressObj", progressObj);
  win.webContents.send("download-progress", Math.floor(progressObj.percent));
})

autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.quitAndInstall(true,true);
})