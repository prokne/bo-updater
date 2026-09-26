const checkDiskSpace = require('check-disk-space').default;
const fs = require("fs");
const path = require('path');
const https = require("https");

const config  = require('../../config');


function filePartSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

async function getFreeDiskSpace(targetPath) {
  // needs an existing path — if the folder doesn't exist yet, check its parent
  let checkPath = targetPath;
  while (!fs.existsSync(checkPath)) {
    checkPath = path.dirname(checkPath);
  }
  const { free } = await checkDiskSpace(checkPath);
  return free; // bytes
}

function getGameSize(gameUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      gameUrl,
      { method: 'HEAD', headers: { 'x-api-key': config.API_KEY } },
      (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HEAD failed: ${res.statusCode}`));
        resolve(Number(res.headers['content-length']));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function ensureEnoughDiskSpace(destDir, zipSize) {
  const SAFETY_MARGIN = 1.15;
  const required = zipSize * 2 * SAFETY_MARGIN;
  const free = await getFreeDiskSpace(destDir);

  if (free < required) {
    const requiredGB = (required / 1e9).toFixed(1);
    const freeGB = (free / 1e9).toFixed(1);

    throw new Error(
      `Nedostatek místa na disku. Potřeba ~${requiredGB} GB, dostupné pouze ${freeGB} GB.`
    );
  }
}

module.exports = {
  filePartSize,
  getFreeDiskSpace,
  getGameSize,
  ensureEnoughDiskSpace
};
