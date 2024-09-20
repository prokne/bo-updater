const progressBar = document.querySelector(".progress");
const progressNum = document.querySelector(".progress-num");

window.api.downloadProgress((event, percent) => {
  console.log("test")
  progressBar.style.width = `${percent}%`;
  progressNum.textContent = `${percent}%`;
});

window.api.testik((event,string)=>{
  console.log(string)
})
