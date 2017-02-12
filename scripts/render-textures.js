var utils = require('./utils'),
    joinPath = require('path').join;

var assetDir = '../assets/textures';

/*
 * render texture atlas to canvas
 */
module.exports = function renderTextures(data) {

  var textureSize = 16;
  var spriteWidth = 256;
  var renderSize = textureSize + 2;

  var textures = [];

  for (var key in data) {
    data[key].textures.forEach(t => {
      textures[t.id] = t.path;
    })
  }

  var colCount = Math.floor(spriteWidth / renderSize);
  var rowCount = Math.ceil(textures.length / colCount);
  var canvas = utils.createImage(spriteWidth, fitSize(rowCount * renderSize));

  return Promise.all(
    textures.map((path, id) => {
      if (path) {
        return drawImage(path, id % colCount, Math.floor(id / colCount));
      }
      return Promise.resolve(null);
    })
  ).then(() => canvas);

  function fitSize(x) {
    return Math.pow(2, Math.ceil(Math.log2(x)));
  }

  function copyImage(
    source, target, 
    width, height,
    fromX, fromY, toX, toY
  ) {
    for (var x = 0; x < width; x++) {

      for (var y = 0; y < height; y++) {
        for (var i = 0; i < 4; i++) {
          var c = source.get(fromX + x, fromY + y, i);
          target.set(toX + x, toY + y, i, c);
        }
      }
    }
  }

  function drawImage(url, col, row) {
    var x = col * renderSize;
    var y = row * renderSize;

    return utils.readImage(joinPath(assetDir, url))
    .then(function(image) {
      if (image) {
        // apply 1px bleeding around the texture
        // protection against glsl texture2D's precision issue

        // top left
        copyImage(image, canvas, 1, 1, 0, 0, x, y);
        // top right
        copyImage(image, canvas, 1, 1, textureSize - 1, 0, x + textureSize + 1, y);
        // bottom left
        copyImage(image, canvas, 0, textureSize - 1, x, y + textureSize + 1);
        // bottom right
        copyImage(image, canvas, 1, 1, textureSize - 1, textureSize - 1, x + textureSize + 1, y + textureSize + 1);

        // left
        copyImage(image, canvas, 1, textureSize, 0, 0, x, y + 1);
        // top
        copyImage(image, canvas, textureSize, 1, 0, 0, x + 1, y);
        // right
        copyImage(image, canvas, 1, textureSize, textureSize - 1, 0, x + textureSize + 1, y + 1);
        // bottom
        copyImage(image, canvas, textureSize, 1, 0, textureSize - 1, x + 1, y + textureSize + 1);

        // body
        copyImage(image, canvas, 16, 16, 0, 0, x + 1, y + 1);
      } else {
        console.warn(url + ' could not be loaded');
      }
    });

  }

};
