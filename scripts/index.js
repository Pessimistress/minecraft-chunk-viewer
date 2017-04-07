/*
 * Generate sprite sheet from models.csv
 * % node sprite-generator
 */

var utils = require('./utils'),
    readBlocks = require('./read-blocks'),
    getBlockMeta = require('./get-block-meta'),
    renderTextures = require('./render-textures'),
    renderBlockDefs = require('./render-block-defs');

var outputImageDir = '../static/data';
var outputJsonDir = '../src/constants';

var input_models = utils.readJSON('./models.json');
var input_blocks = utils.readJSON('./blocks.json');

var blocks = readBlocks(input_models, input_blocks);

utils.writeJSON(outputJsonDir + '/blocks.json', getBlockMeta(blocks));

utils.writeImage(outputImageDir + '/blocks.png', renderBlockDefs(blocks));

renderTextures(blocks).then(
  image => utils.writeImage(outputImageDir + '/textures.png', image)
);
