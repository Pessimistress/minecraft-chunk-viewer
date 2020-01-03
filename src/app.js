import React, {Component} from 'react';
import {render} from 'react-dom';
import DeckGL, {
  LightingEffect, 
  AmbientLight,
  DirectionalLight,
  OrbitView
} from 'deck.gl';
import MinecraftLayer from './minecraft-layer';
import Minimap from './components/minimap';
import SummaryPanel from './components/summary-panel';
import About from './components/about';

import {loadMCA, readChunks, REGION_FILE_PATTERN,
  getBlockTemperature, getBlockHumidity, isBlockOpaque} from './utils/mca-parser';

const sampleFile = 'r.5.13.mca';

const INITIAL_VIEW_STATE = {
  target: [0, 0, 0],
  zoom: 0,
  orbitAxis: 'Y',
  rotationX: 30,
  rotationOrbit: 30,
  minZoom: -3,
  maxZoom: 10
};

const LIGHTING_EFFECT = new LightingEffect({
  ambient: new AmbientLight({
    color: [255, 255, 255],
    intensity: 0.6
  }),
  dir1: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 1.0,
    direction: [-3, -6, -1]
  }),
  dir2: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 0.5,
    direction: [3, -1, -0]
  })
});

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      viewState: INITIAL_VIEW_STATE,
      sliceY: 1,
      regionInfo: null,
      selection: {
        chunks: [],
        data: null
      },
      hoveredBlock: null
    };

    // load example region file
    fetch(`./samples/${sampleFile}`)
      .then(resp => resp.arrayBuffer())
      .then(data => this._onDataLoaded(sampleFile, data));

  }

  _onDataLoaded = (filename, data) => {
    const result = loadMCA(filename, data);

    if (result.error) {
      alert(`Error loading file: ${result.error}`);
      this.setState({
        regionInfo: null,
        selection: {
          chunks: [],
          data: null
        }
      });
    } else {
      this.setState({regionInfo: result});

      const {availableChunks} = result;
      const randomIndex = Math.floor(Math.random() * availableChunks.length);

      this._readChunks(result.availableChunks.slice(randomIndex, randomIndex + 1));
    }
  }

  _readChunks = chunks => {
    const selection = readChunks(chunks);
    const {bounds} = selection;

    const scale = Math.min(window.innerWidth, window.innerHeight) / Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    );

    const viewState = {
      ...INITIAL_VIEW_STATE,
      target: [
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        (bounds.minZ + bounds.maxZ) / 2
      ],
      zoom: Math.log2(scale)
    };

    this.setState({selection, viewState});
  }

  _onSliceY = e => {
    this.setState({
      sliceY: e.target.value
    });
  }

  _handleFileDrop = evt => {
    evt.preventDefault();

    const files = evt.dataTransfer.files;

    if (files.length) {
      const file = files[0];

      if (REGION_FILE_PATTERN.test(file.name)) {
        // is valid
        const fileReader = new FileReader();

        fileReader.onerror = err => {
          alert(`Reading ${file.name} Error: ${err}`);
        };
        fileReader.onload = ({target: {result}}) => {
          this._onDataLoaded(file.name, result);
        };
        fileReader.readAsArrayBuffer(file);
      } else {
        alert(`Cannot read ${file.name}. Please use an mca file.`);
      }
    }
  }

  _onHoverBlock = ({object}) => {
    this.setState({hoveredBlock: object});
  }

  _preventDefault(evt) {
    evt.preventDefault();
  }

  _onViewStateChange = ({viewState}) => {
    this.setState({viewState});
  }

  _onWebGLInitialized(gl) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
  }

  render() {

    const {viewState, sliceY, selection, regionInfo, hoveredBlock} = this.state;
    const {infoPanel} = this.refs;

    const layers = [
      selection.data && new MinecraftLayer({
        id: 'minecraft-layer',
        getTemperature: getBlockTemperature,
        getBlockHumidity: getBlockHumidity,
        getIsBlockOpaque: isBlockOpaque,
        data: selection.data,
        sliceY: Math.floor(sliceY * selection.bounds.maxY + (1 - sliceY) * selection.bounds.minY),
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 0, 128],
        onHover: this._onHoverBlock
      })
    ].filter(Boolean);

    return (
      <div onDragOver={this._preventDefault} onDrop={this._handleFileDrop} >
        <DeckGL
          views={new OrbitView()}
          viewState={viewState}
          controller={true}
          effects={[LIGHTING_EFFECT]}
          onViewStateChange={ this._onViewStateChange }
          onWebGLInitialized={ this._onWebGLInitialized }
          layers={layers} />

        <About />

        <input type="range" className="y-slicer"
          min={0.01} max={1} step={0.01} value={sliceY}
          onChange={this._onSliceY} />

        <Minimap data={regionInfo} selection={selection.chunks}
          direction={viewState.rotationOrbit}
          onSelect={this._readChunks}/>

        <SummaryPanel data={selection} hoveredBlock={hoveredBlock} />
      </div>
    );
  }

}

/* global document */
const root = document.createElement('div');
document.body.appendChild(root);
render(<Root />, root);
