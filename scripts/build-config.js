const fs = require('fs');

const config = `module.exports = { 
  API_KEY: '${process.env.DOWNLOAD_API_KEY}',
  ENHANCED_FILE: "${process.env.ENHANCED_FILE}"
};`;

fs.writeFileSync('./config.js', config);