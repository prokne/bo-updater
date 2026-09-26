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
  launchGame: () => {
    ipcRenderer.send("launch-wow");
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
  closeApp: () => {
    ipcRenderer.send("close-me");
  },
  minimizeApp: () => {
    ipcRenderer.send("minimize-me");
  },
  showModal: (callback) => {
    ipcRenderer.on("show-modal", callback);
  },
  modalResponse: (response) => {
    ipcRenderer.send("modal-response", response);
  },
  showPathPicker: (callback) => {
    ipcRenderer.on("show-path-picker", callback);
  },
  pathPickerResponse: (chosenPath) => {
    ipcRenderer.send("install-location-chosen", chosenPath);
  },
  browseLocation: () => {
    return ipcRenderer.invoke('browse-install-location');
  }
};

contextBridge.exposeInMainWorld("api", API);
