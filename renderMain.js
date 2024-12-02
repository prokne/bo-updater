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
const nightCheckbox = document.querySelector(".night-checbox");
const darkNightControl = document.querySelector(".dark-night-control");
const closeBtn = document.querySelector(".close");
const minimizeBtn = document.querySelector(".minimize");

window.api.isGmOn((event, GM_ON) => {
  if (!GM_ON) {
    darkNightControl.style.display = "none";
  }
});

nightCheckbox.addEventListener("click", (e) => {
  e.target.checked;
  window.api.handleNightChecbox(e.target.checked);
});

window.api.isNight((event, isNight) => {
  nightCheckbox.checked = isNight;
  if (isNight) {
    nightCheckbox.innerHTML =
      '<input class="night-checbox" type="checkbox" name="night" value="night" checked/>';
  } else {
    nightCheckbox.innerHTML =
      '<input class="night-checbox" type="checkbox" name="night" value="night" checked/>';
  }
});

audioBtn.addEventListener("click", () => {
  if (audio.muted === false) {
    audio.muted = true;
    audioBtn.innerHTML = '<img src="./images/audio/SPEAK_OFF.png" alt="">';
    window.api.handleAudioButton(true);
  } else {
    audio.muted = false;
    audioBtn.innerHTML = '<img src="./images/audio/SPEAK_ON.png" alt="">';
    window.api.handleAudioButton(false);
  }
});

window.api.isMuted((event, isMuted) => {
  audio.muted = isMuted;
  if (isMuted) {
    audioBtn.innerHTML = '<img src="./images/audio/SPEAK_OFF.png" alt="">';
  } else {
    audioBtn.innerHTML = '<img src="./images/audio/SPEAK_ON.png" alt="">';
  }
});

button.addEventListener("click", () => {
  window.api.launchGame();
});

closeBtn.addEventListener("click", () =>{
  window.api.closeApp();
})

minimizeBtn.addEventListener("click", () =>{
  window.api.minimizeApp();
})

window.api.checkPatche((event, patchName) => {
  console.log(event);
  document.querySelector(
    `.${patchName}`
  ).innerHTML = `<img class="checker" src="./images/checks/Patch_YES.png" alt=""/>`;
});

window.api.downloadProgress((event, percent) => {
  console.log("test")
  progressBar.style.width = `${percent}%`;
  progressNum.textContent = `${percent}%`;
});

window.api.infoMessage((event, message) => {
  info.textContent = `${message}`;
});

window.api.isPlayable((event, playable) => {
  if (playable) {
    button.disabled = false;
  } else {
    button.disabled = true;
  }
});

window.api.testik((event,string)=>{
  console.log(string)
})
