module.exports = function readBlocks(models, blocks) {

  models = mergeModelProps(models);
  var data = {};
  var textureIds = {};

  var addBlock = function(blockId, dataValue, props) {
    var id = blockId + ':' + dataValue;
    var blockInfo = resolveProps(models, props);
    if (blockInfo) {
      blockInfo.blockId = blockId;
      blockInfo.dataValue = dataValue;
      data[id] = blockInfo;
    }
  };

  for (var blockId in blocks) {
    var block = blocks[blockId];
    var baseProps = Object.assign({}, block);
    
    addBlock(blockId, 0, baseProps);

    var option = block.option || {};
    var dataValueProps = option.data;

    if (option.data_bitmap) {
      dataValueProps = Object.keys(option.data_bitmap).reduce((acc, bitMask) => {
        var bitMap = option.data_bitmap[bitMask];
        for (var dataValue in acc) {
          for (var maskValue in bitMap) {
            acc[dataValue * 1 + maskValue * 1] = Object.assign({}, acc[dataValue], bitMap[maskValue]);
          }
        }
        return acc;
      }, {'0': {}});
    }

    if (dataValueProps) {
      for (var dataValue in dataValueProps) {
        addBlock(blockId, dataValue,
          Object.assign({}, baseProps, dataValueProps[dataValue]));
      }
    }
  }

  // generate unique texture ids
  var textureIds = {};
  var textureId = 0;

  for (var key in data) {
    var d = data[key];
    d.textures.forEach(t => {
      var path = t.path;
      if (!path) {
        path = null;
      }
      if (textureIds[path] === undefined) {
        textureIds[path] = textureId++;
      }
      t.id = textureIds[path];
    });
  }

  return data;
};

// take the first arg that is not undefined
function fallback() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined) {
      return arguments[i];
    }
  }
  return undefined;
}

// format models
function mergeModelProps(models) {
  var result = {};

  for (var key in models) {
    var modelName = key;
    var modelProps = {};

    // walk up the inheritence chain
    while (modelName in models) {
      var model = models[modelName];
      modelProps = Object.assign({}, model, modelProps);
      modelProps.name = modelName;
      modelName = model.base_model;
    }

    var textures;
    
    switch (modelProps.name) {
    case 'block':
    case 'stairs':
      var side = modelProps.side || {};
      textures = [
        fallback(modelProps.bottom, modelProps.ends, modelProps.all), // bottom
        fallback(modelProps.top, modelProps.ends, modelProps.all), // top
        fallback(side[0], modelProps.sides, modelProps.all), // N
        fallback(side[1], modelProps.sides, modelProps.all), // E
        fallback(side[2], modelProps.sides, modelProps.all), // S
        fallback(side[3], modelProps.sides, modelProps.all) // W
      ].map(function(path) {
        return {
          path: path,
          useBiomeShading: false
        };
      });
      break;
    default:
      textures = null;
    }

    modelProps.textures = textures;
    result[key] = modelProps;
  }

  return result;
}

// apply props to model
function resolveProps(models, props) {
  if (!props.model_type) {
    return null;
  }

  var modelProps = models[props.model_type];
  if (!modelProps || !modelProps.textures) {
    // geometry is not defined
    return null;
  }

  props = Object.assign({}, modelProps, props);

  var textures = modelProps.textures.map((t, i) => {
    t = Object.assign({}, t);

    var path = t.path;
    if (path && path[0] === '$') {
      t.path = props[path.slice(1)];
    }

    switch(props.use_biome_shading) {
    case 'all':
      t.useBiomeShading = true;
      break;
    case 'top':
      t.useBiomeShading = (i === 1);
      break;
    default:
      t.useBiomeShading = false;
    }

    return t;
  });

  var size_x = fallback(props.size_x, 16),
    size_y = fallback(props.size_y, 16)

  return {
    model: modelProps.name,
    name: props.name,
    transparent: props.transparent,
    transform: {
      rotate_x: fallback(props.rotate_x, 0),
      rotate_y: fallback(props.rotate_y, 0),
      size_x: fallback(props.size_x, 16),
      size_y: fallback(props.size_y, 16),
      translate_x: fallback(props.translate_x, 0),
      translate_y: fallback(props.translate_y, 0),
      shrink_x: fallback(props.shrink_x, 0),
      shrink_y: fallback(props.shrink_y, 0)
    },
    textures: textures
  };
}