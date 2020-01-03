import {Layer, gouraudLighting, picking, project32} from '@deck.gl/core';
import {Model, CubeGeometry, Texture2D} from '@luma.gl/core';
import GL from '@luma.gl/constants';
import {loadImage} from '@loaders.gl/images';

import vs from './vertex.glsl';
import fs from './fragment.glsl';

function loadTexture(gl, url) {
  return loadImage(url).then(data => new Texture2D(gl, {
    data,
    parameters: {
      [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
      [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
      [GL.TEXTURE_MIN_FILTER]: GL.NEAREST,
      [GL.TEXTURE_MAG_FILTER]: GL.NEAREST
    },
    mipmaps: false
  }));
}

const defaultProps = {
  // max Y level to show
  sliceY: 256,
  // accessors
  getPosition: {type: 'accessor', value: d => d.position},
  getBlockId: {type: 'accessor', value: d => d.blockId},
  getBlockData: {type: 'accessor', value: d => d.blockData},
  getTemperature: {type: 'accessor', value: d => d.temperature},
  getHumidity: {type: 'accessor', value: d => d.humidity},
  getLighting: {type: 'accessor', value: d => d.lighting},
  getIsBlockOpaque: {type: 'accessor', value: (x, y, z) => false},
  // lighting
  material: {}
};

export default class MinecraftLayer extends Layer {

  initializeState() {
    const {gl} = this.context;

    this.getAttributeManager().addInstanced({
      instancePositions: {size: 3, type: GL.DOUBLE, accessor: 'getPosition'},
      instanceBlockIds: {size: 1, accessor: 'getBlockId'},
      instanceBlockData: {size: 4, type: gl.UNSIGNED_BYTE, accessor: ['getBlockData', 'getTemperature', 'getHumidity', 'getLighting'], update: this.calculateInstanceBlockData},
      instanceVisibilities: {size: 1, type: gl.UNSIGNED_BYTE, accessor: ['getPosition', 'getIsBlockOpaque'], update: this.calculateInstanceVisibilities},
      instancePickingColors: {
        size: 3,
        type: gl.UNSIGNED_BYTE,
        accessor: (object, {index, target: value}) => this.encodePickingColor(object.index || index, value)
      },
    });

    this.setState({model: this.getModel(gl)});

    this.loadAssets();
  }

  getShaders() {
    return {vs, fs, modules: [project32, picking, gouraudLighting]};
  }

  getModel(gl) {
    return new Model(gl, {
      ...this.getShaders(),
      id: this.props.id,
      geometry: new CubeGeometry(),
      isInstanced: true
    });
  }
  
  draw({uniforms}) {
    if (this.state.texturesLoaded) {
      const {sliceY} = this.props;
      this.state.model.setUniforms({
        ...uniforms,
        sliceY
      }).draw();
    }
  }

  loadAssets() {
    const {gl} = this.context;
    const {model} = this.state;

    Promise.all([
      loadTexture(gl, './data/blocks.png'),
      loadTexture(gl, './data/textures.png'),
      loadTexture(gl, './data/foliage.png')
    ]).then(([blockDefsTexture, atlasTexture, biomeTexture]) => {
      model.setUniforms({
        blockDefsTexture,
        blockDefsTextureDim: [blockDefsTexture.width, blockDefsTexture.height],

        atlasTexture,
        atlasTextureDim: [atlasTexture.width, atlasTexture.height],

        biomeTexture
      });

      this.setState({texturesLoaded: true})
    });
  }

  calculateInstanceBlockData(attribute) {
    const {data, getBlockData, getTemperature, getHumidity, getLighting} = this.props;
    const {value} = attribute;

    let i = 0;
    for (const object of data) {
      value[i++] = getBlockData(object);
      value[i++] = getTemperature(object) / 2 * 255;
      value[i++] = getHumidity(object) * 255;
      value[i++] = getLighting(object);
    }
  }

  calculateInstanceVisibilities(attribute) {
    const {data, getPosition, getIsBlockOpaque} = this.props;
    const {value} = attribute;

    let i = 0;
    for (const object of data) {
      const [x, y, z] = getPosition(object);
      if (getIsBlockOpaque(x, y, z)) {
        const neighbors = [
          getIsBlockOpaque(x, y - 1, z), // bottom
          getIsBlockOpaque(x, y + 1, z), // top
          getIsBlockOpaque(x, y, z - 1), // N
          getIsBlockOpaque(x + 1, y, z), // E
          getIsBlockOpaque(x, y, z + 1), // S
          getIsBlockOpaque(x - 1, y, z)  // W
        ];
        // compress Boolean[6] into a single float using binary flags
        value[i++] = neighbors.reduce((acc, n) => (acc << 1) + !n, 0);
      } else {
        value[i++] = 0b111111;
      }
    }
  }
}

MinecraftLayer.layerName = 'MinecraftLayer';
MinecraftLayer.defaultProps = defaultProps;
