var fs = require('fs'),
    path = require('path'),
    childProcess = require('child_process'),
    ndarray = require('ndarray'),
    savePixels = require('save-pixels'),
    getPixels = require('get-pixels');

function readJSON(filePath) {
  filePath = path.resolve(__dirname, filePath);

  try {
    var content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(err);
  }
}

function writeJSON(filePath, content) {
  filePath = path.resolve(__dirname, filePath);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

function createImage(width, height) {
  return ndarray(new Uint8ClampedArray(width * height * 4), [width, height, 4]);
}

function readImage(filePath) {
  filePath = path.resolve(__dirname, filePath);
  return new Promise(function(resolve, reject) {
    getPixels(filePath, function(err, pixels) {
      if(err) {
        resolve(null);
      } else {
        resolve(pixels);
      }
    })
  });
}

function writeImage(filePath, pixelArr) {
  filePath = path.resolve(__dirname, filePath);
  savePixels(pixelArr, "png").pipe(fs.createWriteStream(filePath));
}

module.exports = {
  readJSON,
  writeJSON,
  createImage,
  readImage,
  writeImage
};
