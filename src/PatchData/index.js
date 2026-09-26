const fs = require("fs");
const path = require('path');

let saveTimer = null;

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

//Schedule save of patche.json so if multuple saves are triggerd at the same time, it will save only once
function scheduleSave(path, localDataObject, sync=false) {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeFile(path, JSON.stringify(localDataObject), sync);
  }, 300);
}

module.exports = {
  readFile,
  scheduleSave,
};
