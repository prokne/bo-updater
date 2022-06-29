const { ifError } = require("assert");
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { resolve } = require("path");
const { spawn } = require("child_process");
const rootPath = require("electron-root-path").rootPath;

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
function writeFile(fileName, data) {
  fs.writeFile(fileName, data, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("JSON data has been saved");
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    backgroundColor: "#16213e",
    width: 900,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname + "/preload.js"),
    },
    icon: __dirname + "/icons/bo.ico",
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

const URL = "https://bradavice-online.cz/patches/";
let patcheInfoData = { "patch-H": 0, "patch-S": 0, "patch-P": 0, "patch-T": 0 };
let serverPatcheInfoData = {
  "patch-H": 0,
  "patch-S": 0,
  "patch-P": 0,
  "patch-T": 0,
};

//Compares local patche.json vs serverPatche.json and returns list of patches, which needs to be downloaded
async function isUpToDate() {
  let localPatcheData = await readFile("patche.json");
  let serverPatcheData = await getServerPatcheInfo();

  patcheInfoData = localPatcheData;
  serverPatcheInfoData = serverPatcheData;

  const list = [];

  Object.keys(localPatcheData).forEach((key, index) => {
    console.log("checkuju pathe");
    if (localPatcheData[key] < serverPatcheData[key]) {
      list.push(key);
    }
    if (localPatcheData[key] === serverPatcheData[key]) {
      win.webContents.on("did-finish-load", () => {
        console.log(key);
        win.webContents.send("check-patche", key);
      });
    }
  });

  return list;
}

//Downloads out-of-date patches
async function downloadPatches(downloadList) {
  for (let i = 0; i < downloadList.length; i++) {
    let filename = downloadList[i] + ".MPQ";
    win.webContents.on("did-finish-load", () => {
      win.webContents.send("info", "Stahuji " + downloadList[i]);
    });
    await downloadFile(URL + `${filename}`, downloadList[i] + ".MPQ").then(
      () => {
        console.log("File downloaded!");
        win.webContents.send("check-patche", downloadList[i]);
        patcheInfoData[downloadList[i]] = serverPatcheInfoData[downloadList[i]];
        let dataToSave = JSON.stringify(patcheInfoData);
        writeFile("patche.json", dataToSave);
      }
    );
  }
  win.webContents.send("info", "Vaše patche jsou aktuální");
  win.webContents.send("playable", true);

  //delete Cache
  fs.rmdir("../Cache", { recursive: true }, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Deleted Cache");
    }
  });
}

let patchestToDownload = [];

if (!fs.existsSync("patche.json")) {
  writeFile("patche.json", JSON.stringify(patcheInfoData));
}

isUpToDate().then((downloadList) => {
  console.log(downloadList.length);
  if (downloadList.length === 0) {
    win.webContents.on("did-finish-load", () => {
      win.webContents.send("info", "Vaše patche jsou aktuální");
      win.webContents.send("playable", true);
    });
  } else {
    downloadPatches(downloadList);
  }
});

ipcMain.on("close-me", (event, args) => {
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
