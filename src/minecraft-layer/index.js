import {Layer, assembleShaders} from 'deck.gl';
import {GL, Model, CubeGeometry, loadTextures, Matrix4} from 'luma.gl';
import {readFileSync} from 'fs';
import {join} from 'path';

const defaultProps = {
  // max Y level to show
  sliceY: 256,
  // accessors
  getPosition: d => d.position,
  getBlockId: d => d.blockId,
  getBlockData: d => d.blockData,
  getTemperature: d => d.temperature,
  getHumidity: d => d.humidity,
  getLighting: d => d.lighting
};

export default class MinecraftLayer extends Layer {

  initializeState() {
    const {attributeManager} = this.state;
    const {gl} = this.context;

    attributeManager.addInstanced({
      instancePositions: {size: 3, accessor: 'getPosition', update: this.calculateInstancePositions},
      instanceBlockIds: {size: 1, accessor: 'getBlockId', update: this.calculateInstanceBlockIds},
      instanceBlockData: {size: 4, type: gl.UNSIGNED_BYTE, accessor: ['getBlockData', 'getTemperature', 'getHumidity', 'getLighting'], update: this.calculateInstanceBlockData},
      instanceVisibilities: {size: 1, type: gl.UNSIGNED_BYTE, accessor: ['getPosition', 'getIsBlockOpaque'], update: this.calculateInstanceVisibilities},
      instancePickingColors: {size: 3, type: gl.UNSIGNED_BYTE, update: this.calculateInstancePickingColors},
    });

    this.setState({
      model: this.getModel(gl)
    });

    this.setUniforms({
      uAmbientLightCoefficient: 0.1,
      uPointLight1Location: [0, 10, -10],
      uPointLight1Attenuation: 0.7,
      uPointLight2Location: [10, -10, -10],
      uPointLight2Attenuation: 0.3
    })

    loadTextures(gl, {
      urls: [
        './data/blocks.png', 
        './data/textures.png', 
        './data/foliage.png'
      ]
    })
    .then(([blockDefsTexture, atlasTexture, biomeTexture]) => {
      this.setUniforms({
        blockDefsTexture,
        blockDefsTextureDim: [blockDefsTexture.width, blockDefsTexture.height],

        atlasTexture,
        atlasTextureDim: [atlasTexture.width, atlasTexture.height],
        
        biomeTexture
      });
    });
  }

  getShaders() {
    return {
      vs: readFileSync(join(__dirname, './vertex.glsl'), 'utf8'),
      fs: readFileSync(join(__dirname, './fragment.glsl'), 'utf8')
    };
  }

  getModel(gl) {
    const shaders = assembleShaders(gl, this.getShaders());

    return new Model({
      gl,
      id: this.props.id,
      vs: shaders.vs,
      fs: shaders.fs,
      geometry: new CubeGeometry(),
      isInstanced: true
    });
  }
  
  draw({uniforms}) {
    const {sliceY} = this.props;

    this.state.model.render({
      ...uniforms,
      sliceY
    });
  }

  calculateInstancePositions(attribute) {
    const {data, getPosition} = this.props;
    const {value} = attribute;

    let i = 0;
    for (const object of data) {
      const pos = getPosition(object);
      value[i++] = pos[0];
      value[i++] = pos[1];
      value[i++] = pos[2];
    }
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

  calculateInstanceBlockIds(attribute) {
    const {data, getBlockId} = this.props;
    const {value} = attribute;

    let i = 0;
    for (const object of data) {
      value[i++] = getBlockId(object);
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

  calculateInstancePickingColors(attribute) {
    const {data} = this.props;
    const {value} = attribute;

    let i = 0;
    data.forEach((d, index) => {
      const pickingColor = this.encodePickingColor(d.index || index);
      value[i++] = pickingColor[0];
      value[i++] = pickingColor[1];
      value[i++] = pickingColor[2];
    });
  }

}

MinecraftLayer.layerName = 'MinecraftLayer';
MinecraftLayer.defaultProps = defaultProps;
