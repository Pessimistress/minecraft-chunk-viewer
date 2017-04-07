import 'babel-polyfill';

import React, {Component} from 'react';
import {render} from 'react-dom';
import DeckGL from 'deck.gl';
import MinecraftLayer from './minecraft-layer';
import OrbitController from './components/orbit-controller';
import Minimap from './components/minimap';
import SummaryPanel from './components/summary-panel';
import About from './components/about';

import {Matrix4} from 'luma.gl';
import {request} from 'd3-request';
import {loadMCA, readChunks, REGION_FILE_PATTERN,
  getBlockNeighbors, getBlockTemperature, getBlockHumidity, isBlockOpaque} from './utils';

const sampleFile = 'r.5.13.mca';

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        lookAt: [0, 0, 0],
        rotationX: -30,
        rotationY: 30,
        fov: 10,
        distance: 10,
        minZoom: 0.1,
        maxZoom: 1000,
        width: 500,
        height: 500
      },
      sliceY: 1,
      regionInfo: null,
      selection: {
        chunks: [],
        data: null
      },
      hoveredBlock: null
    };

    // load example region file
    request(`./samples/${sampleFile}`)
      .responseType('arraybuffer')
      .get(({response}) => this._onDataLoaded(sampleFile, response));

  }

  componentDidMount() {
    window.onresize = this._onResize;
    this._onResize();
  }

  componentWillUnmount() {
    window.onresize = null;
  }

  _onResize = () => {
    this._onChangeViewport({
      width: window.innerWidth,
      height: window.innerHeight
    });
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
    this.setState({selection});
  }

  _onChangeViewport = viewport => {
    this.setState({
      viewport: {...this.state.viewport, ...viewport}
    });
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

  _onWebGLInitialized(gl) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
  }

  render() {

    const {viewport, sliceY, selection, regionInfo, hoveredBlock} = this.state;
    const {infoPanel} = this.refs;

    const layers = [
      selection.data && new MinecraftLayer({
        id: 'minecraft-layer',
        getNeighbors: getBlockNeighbors,
        getTemperature: getBlockTemperature,
        getBlockHumidity: getBlockHumidity,
        getIsBlockOpaque: isBlockOpaque,
        regionBounds: selection.bounds,
        data: selection.data,
        sliceY: Math.floor(sliceY * selection.bounds.maxY + (1 - sliceY) * selection.bounds.minY),
        pickable: !viewport.isDragging,
        onHover: this._onHoverBlock
      })
    ].filter(Boolean);

    const perspectiveViewport = OrbitController.getViewport(viewport);

    return (
      <div onDragOver={this._preventDefault} onDrop={this._handleFileDrop} >
        <OrbitController
          {...viewport}
          bounds={selection.bounds}
          onChangeViewport={this._onChangeViewport} >
          <DeckGL
            width={viewport.width}
            height={viewport.height}
            viewport={perspectiveViewport}
            onWebGLInitialized={ this._onWebGLInitialized }
            layers={layers} />
        </OrbitController>

        <About />

        <input type="range" className="y-slicer"
          min={0.01} max={1} step={0.01} value={sliceY}
          onChange={this._onSliceY} />

        <Minimap data={regionInfo} selection={selection.chunks}
          direction={viewport.rotationY}
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
