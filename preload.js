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
  handleAudioButton: (isMuted) => {
    ipcRenderer.send("mute", isMuted);
  },
  isMuted: (callback) => {
    ipcRenderer.on("is-muted", callback);
  },
  handleNightChecbox: (checked) => {
    ipcRenderer.send("night-check", checked);
  },
  isNight: (callback) => {
    ipcRenderer.on("is-night", callback);
  },
  isGmOn: (callback) => {
    ipcRenderer.on("is-gm-on", callback);
  },
  testik: (callback) => {
    ipcRenderer.on("testik", callback);
  },
};

contextBridge.exposeInMainWorld("api", API);
