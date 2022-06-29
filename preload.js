const { contextBridge, ipcRenderer, ipcMain } = require("electron");

const API = {
  checkPatche: (callback) => {
    ipcRenderer.on("check-patche", callback);
  },
  downloadProgress: (callback) => {
    ipcRenderer.on("download-progress", callback);
  },
  infoMessage: (callback) => {
    ipcRenderer.on("info", callback);
  },
  isPlayable: (callback) => {
    ipcRenderer.on("playable", callback);
  },
  closeApp: () => {
    ipcRenderer.send("close-me");
  },
};

contextBridge.exposeInMainWorld("api", API);
