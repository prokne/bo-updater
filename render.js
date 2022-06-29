//const customTitlebar = require("custom-electron-titlebar");
//const { domContentLoaded } = require("custom-electron-titlebar/common/dom");

// new customTitlebar.Titlebar({
//   backgroundColor: customTitlebar.Color.fromHex("#444"),
// });

const audio = document.querySelector("#audio");
const audioBtn = document.querySelector(".audio-btn");
const progressBar = document.querySelector(".progress");
const progressNum = document.querySelector(".progress-num");
const info = document.querySelector(".download-info");
const button = document.querySelector(".play-btn");

audioBtn.addEventListener("click", () => {
  if (audio.muted === false) {
    audio.muted = true;
    audioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
  } else {
    audio.muted = false;
    audioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
  }
});

button.addEventListener("click", () => {
  window.api.closeApp();
});

window.api.checkPatche((event, patchName) => {
  console.log(event);
  document.querySelector(
    `.${patchName}`
  ).innerHTML = `<i class="fa-solid fa-check"></i>`;
});

window.api.downloadProgress((event, percent) => {
  progressBar.style.width = `${percent}%`;
  progressNum.textContent = `${percent}%`;
});

window.api.infoMessage((event, message) => {
  info.textContent = `${message}`;
});

window.api.isPlayable((event, playable) => {
  if (playable) {
    button.disabled = false;
  }
});
