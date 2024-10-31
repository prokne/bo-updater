const progressBar = document.querySelector(".progress");
const progressNum = document.querySelector(".progress-num");
const closeBtn = document.querySelector(".close");

window.api.downloadProgress((event, percent) => {
  progressBar.style.width = `${percent}%`;
  progressNum.textContent = `${percent}%`;
});

closeBtn.addEventListener("click", () =>{
  console.log("click")
  window.api.closeApp();
})
