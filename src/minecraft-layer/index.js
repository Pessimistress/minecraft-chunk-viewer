import {Layer, assembleShaders} from 'deck.gl';
import {GL, Model, CubeGeometry, loadTextures} from 'luma.gl';
import {readFileSync} from 'fs';
import {join} from 'path';

const defaultProps = {
  lightSettings: {
    enabled: true,
    ambientLightCoefficient: 0.1,
    pointLight1Location: [0, 1000, -1000],
    pointLight1Attenuation: 0.7,
    pointLight2Location: [1000, -1000, -1000],
    pointLight2Attenuation: 0.3
  },
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

    const textures = {isLoaded: false, isSent: false};

    this.setState({
      model: this.getModel(gl),
      textures
    });

    loadTextures(gl, {
      urls: [
        './data/blocks.png', 
        './data/textures.png', 
        './data/foliage.png'
      ]
    })
    .then(([blockDefsTexture, atlasTexture, biomeTexture]) => {
      textures.isLoaded = true;
      textures.blocks = blockDefsTexture;
      textures.atlas = atlasTexture;
      textures.biomes = biomeTexture;
    });
  }

  updateState({props, oldProps, changeFlags}) {
    const {lightSettings, regionBounds} = props;
    if (lightSettings !== oldProps.lightSettings) {
      this.setUniforms({
        uLightingEnabled: lightSettings.enabled,
        uAmbientLightCoefficient: lightSettings.ambientLightCoefficient,
        uPointLight1Location: lightSettings.pointLight1Location,
        uPointLight1Attenuation: lightSettings.pointLight1Attenuation,
        uPointLight2Location: lightSettings.pointLight2Location,
        uPointLight2Attenuation: lightSettings.pointLight2Attenuation
      });
    }

    if (changeFlags.dataChanged && regionBounds) {
      const maxZoom = Math.max(
        regionBounds.maxX - regionBounds.minX,
        regionBounds.maxY - regionBounds.minY,
        regionBounds.maxZ - regionBounds.minZ,
        1
      );
      const regionCenter = [
        (regionBounds.minX + regionBounds.maxX) / 2,
        (regionBounds.minY + regionBounds.maxY) / 2,
        (regionBounds.minZ + regionBounds.maxZ) / 2
      ].map(Math.round);

      this.setState({maxZoom, regionCenter});
      this.state.attributeManager.invalidateAll();
    }
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
    const {textures} = this.state;
    const {regionBounds} = this.props;

    if (regionBounds && textures && textures.isLoaded) {
      const {maxZoom, regionCenter} = this.state;
      const {viewport: {width, height}} = this.context;
      const {rotateX, rotateY, translateX, translateY, zoom, sliceY} = this.props.viewport;

      if (!textures.isSent) {
        this.setUniforms({
          blockDefsTexture: textures.blocks,
          blockDefsTextureDim: [textures.blocks.width, textures.blocks.height],

          atlasTexture: textures.atlas,
          atlasTextureDim: [textures.atlas.width, textures.atlas.height],
          
          biomeTexture: textures.biomes
        });
        textures.isSent = true;
      }

      this.state.model.render({
        ...uniforms,
        rotation: [rotateX, rotateY],
        translation: [translateX, translateY],
        zoom: [zoom / maxZoom / width * height, zoom / maxZoom],
        sliceY: Math.floor(sliceY * (regionBounds.maxY - regionBounds.minY)) + regionBounds.minY - regionCenter[1]
      });
    }
  }

  calculateInstancePositions(attribute) {
    const {data, getPosition} = this.props;
    const {regionCenter} = this.state;
    const {value} = attribute;

    let i = 0;
    for (const object of data) {
      const pos = getPosition(object);
      value[i++] = pos[0] - regionCenter[0];
      value[i++] = pos[1] - regionCenter[1];
      value[i++] = pos[2] - regionCenter[2];
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
