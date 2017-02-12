/*
 * create metadata for blocks
 */
module.exports = function getBlockMeta(data) {

  var result = {};
  for (var key in data) {
    var b = data[key];
    var meta = {
      name: b.name
    };

    if (b.model !== 'block') {
      meta.model = b.model;
    }
    if (!b.transparent) {
      meta.opaque = true;
    }

    result[key] = meta;
  }

  return result;
};
