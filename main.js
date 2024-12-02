const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { resolve } = require("path");
const { spawn } = require("child_process");
const rootPath = require("electron-root-path").rootPath;
const { autoUpdater } = require("electron-updater")

if (process.env.IS_DEV){
  autoUpdater.forceDevUpdateConfig = true;
}

const userDataPath = app.getPath("userData");

autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

let GM_ON = false;

const URL = "https://bradavice-online.cz/patches/";

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
      },
    });

let serverPatcheInfoData = {
  "patch-H": 0,
  "patch-S": 0,
  "patch-P": 0,
  "patch-T": 0,
};
let isFinishedUpdating = false;

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
        console.log(rootPath);
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

//Downloads patches and sends progress to front-end
function downloadFile(url, fileName) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const path = `../Data/${fileName}`;
      const filePath = fs.createWriteStream(path);
      let len = 0;
      res.on("data", function (chunk) {
        filePath.write(chunk);
        len += chunk.length;

        // percentage downloaded is as follows
        let percent = (len / res.headers["content-length"]) * 100;
        win.webContents.send("download-progress", Math.floor(percent));
      });
      res.on("end", function () {
        filePath.close();
      });
      filePath.on("close", function () {
        // the file is done downloading
        resolve(`Download completed - ${fileName}`);
      });
      res.on("error", (err) => {
        reject(err);
      });
    });
  });
}

//Reads JSON files
function readFile(fileName) {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const object = JSON.parse(data);
        resolve(object);
      }
    });
  });
}

//Writes JSON files
function writeFile(fileName, data, sync=false) {
  if (sync){
    fs.writeFileSync(fileName, data);
  } else {
    fs.writeFile(fileName, data, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("JSON data has been saved");
      }
    });
  }
}

//Delete Cache
function deleteCache() {
  fs.rmdir("../Cache", { recursive: true }, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Deleted Cache");
    }
  });
}

//Compares local patche.json vs serverPatche.json and returns list of patches, which needs to be downloaded
async function isUpToDate() {
  const localPatcheData = await readFile(`../patche.json`);
  let serverPatcheData = await getServerPatcheInfo();

  localDataObject = localPatcheData;
  serverPatcheInfoData = serverPatcheData;

  win.webContents.send("is-muted", localPatcheData.options.muted);
  if (GM_ON) {
    win.webContents.send("is-night", localPatcheData.options.night);
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
    await downloadFile(URL + `${filename}`, downloadList[i] + ".MPQ").then(
      () => {
        console.log("File downloaded!");
        win.webContents.send("check-patche", downloadList[i]);
        localDataObject.patches[downloadList[i]] =
          serverPatcheInfoData[downloadList[i]];
        let dataToSave = JSON.stringify(localDataObject);
        console.log(localDataObject);
        writeFile(`../patche.json`, dataToSave);
      }
    );
  }
  win.webContents.send("info", "Vaše patche jsou aktuální");

  //delete Cache
  deleteCache();

  isFinishedUpdating = true;
  win.webContents.send("playable", true);
}

async function main () {
  GM_ON = fs.existsSync(`${userDataPath}/.enhanced-options`)
  
  win.webContents.send("is-gm-on", GM_ON);

  if (!fs.existsSync(`../patche.json`)) {
    writeFile(`../patche.json`, JSON.stringify(localDataObject), true);
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
    writeFile(`../patche.json`, JSON.stringify(localDataObject));
  });

  //When user checks or unchecks the night checkbox
  if (GM_ON) {
    ipcMain.on("night-check", (event, checked) => {
      localDataObject.options.night = checked;
      writeFile(`../patche.json`, JSON.stringify(localDataObject));
      win.webContents.send("playable", false);

      //if checkbox is checked -> delete patch-U
      if (checked) {
        fs.rm("../Data/patch-U.MPQ", { recursive: true }, (err) => {
          if (err) {
            console.log(err);
          } else {
            console.log("Deleted patch-U");
            if (isFinishedUpdating) {
              win.webContents.send("playable", true);
            }
          }
        });
      }
      //else download patch-U
      else {
        https.get(URL + "patch-U.MPQ", (res) => {
          const writeStream = fs.createWriteStream("../Data/patch-U.MPQ");
          res.pipe(writeStream);
          writeStream.on("finish", () => {
            writeStream.close();
            console.log("patch-U downloaded");
            if (isFinishedUpdating) {
              win.webContents.send("playable", true);
            }
          });
        });
      }
    });
  }

  ipcMain.on("launch-wow", (event, args) => {
    const subprocess = spawn(
      "../Wow.exe",
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
    resizable: true,
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