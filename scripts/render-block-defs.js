var utils = require('./utils');

/*
 * render biome color map to canvas
 */
module.exports = function renderBlockDefs(data) {

  var textureSize = 16;
  var spriteWidth = 256;
  var renderSize = textureSize + 2;
  var colCount = Math.floor(spriteWidth / renderSize);

  var maxBlockId = 0;
  for (var key in data) {
    maxBlockId = Math.max(maxBlockId, data[key].blockId);
  }

  // 8 x 4 x 8bit encoded data for each (blockId, dataValue) pair
  var canvas = utils.createImage(8 * 16, fitSize(maxBlockId + 1))

  for (var blockId = 0; blockId <= maxBlockId; blockId++) {
    var defaultDef = data[blockId + ':0'];
    if (defaultDef) {
      for (var blockData = 0; blockData < 16; blockData++) {
        var d = data[blockId + ':' + blockData] || defaultDef;
        d.textures.forEach((t, i) => {
          drawPoint(blockId, blockData, i, textureToColor(t));
        });
        
        drawPoint(blockId, blockData, 6, transformToColor(d.transform, 'x'));
        drawPoint(blockId, blockData, 7, transformToColor(d.transform, 'y'));
      }
    }
  }

  return canvas;

  function drawPoint(blockId, blockData, index, color) {
    var col = blockData * 8 + index;
    var row = blockId;
    for (var i = 0; i < 4; i++) {
      canvas.set(col, row, i, color[i]);
    }
  }

  function fitSize(x) {
    return Math.pow(2, Math.ceil(Math.log2(x)));
  }

  function transformToColor(t, key) {
    return [
      // pixels
      t['size_' + key] + 64,
      // degrees
      (t['rotate_' + key] / 360 + 1) * 12,
      // pixels
      t['translate_' + key] + 16,
      // pixels
      255 - t['shrink_' + key]
    ];
  }

  function textureToColor(t) {
    return [
      // col index
      t.id % colCount,
      // row index
      Math.floor(t.id / colCount),
      t.useBiomeShading ? 255 : 0,
      255
    ];
  }

  function makeColor(r, g, b, a) {
    // do not write alpha to 0! rgb will be lost
    a = (a || 255) / 255;
    return 'rgba(' + [r, g, b].map(Math.round).join(',') + ',' + a + ')';
  }
};
