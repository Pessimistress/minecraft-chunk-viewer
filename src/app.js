import 'babel-polyfill';

import React, {Component} from 'react';
import {render} from 'react-dom';
import DeckGL, {Layer} from 'deck.gl';
import MinecraftLayer from './minecraft-layer';
import Canvas3D from './components/canvas3d';
import Minimap from './components/minimap';
import SummaryPanel from './components/summary-panel';
import About from './components/about';

import {request} from 'd3-request';
import {loadMCA, readChunks, REGION_FILE_PATTERN,
  getBlockNeighbors, getBlockTemperature, getBlockHumidity, isBlockOpaque} from './utils';

const sampleFile = 'r.5.13.mca';

class Root extends Component {

  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        rotateX: -Math.PI / 6,
        rotateY: Math.PI / 4,
        translateX: 0,
        translateY: 0,
        zoom: 1,
        sliceY: 1
      },
      size: {
        width: 500,
        height: 500,
      },
      regionInfo: null,
      selection: {
        chunks: [],
        data: null
      }
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
    this.setState({
      size: {
        width: window.innerWidth,
        height: window.innerHeight
      }
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
    this.setState({
      selection: readChunks(chunks)
    });
  }

  _onChangeViewport = viewport => {
    this.setState({
      viewport: {...this.state.viewport, ...viewport}
    });
  }

  _onSliceY = e => {
    this._onChangeViewport({
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

  _onHoverBlock = info => {
    this.refs.infoPanel.onHover(info);
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

    const {viewport, size, selection, regionInfo} = this.state;
    const {infoPanel} = this.refs;

    const layers = [
      selection.data && new MinecraftLayer({
        id: 'minecraft-layer',
        viewport,
        getNeighbors: getBlockNeighbors,
        getTemperature: getBlockTemperature,
        getBlockHumidity: getBlockHumidity,
        getIsBlockOpaque: isBlockOpaque,
        regionBounds: selection.bounds,
        data: selection.data,
        pickable: !viewport.isDragging,
        onHover: this._onHoverBlock
      })
    ].filter(Boolean);

    return (
      <div onDragOver={this._preventDefault} onDrop={this._handleFileDrop} >
        <Canvas3D
          {...viewport}
          {...size}
          onViewportChange={this._onChangeViewport} >
          <DeckGL
            {...size}
            onWebGLInitialized={ this._onWebGLInitialized }
            layers={layers} />
        </Canvas3D>

        <About />

        <input type="range" className="y-slicer"
          min={0.01} max={1} step={0.01} value={viewport.sliceY}
          onChange={this._onSliceY} />

        <Minimap data={regionInfo} selection={selection.chunks}
          direction={viewport.rotateY}
          onSelect={this._readChunks}/>

        <SummaryPanel ref="infoPanel" data={selection} />
      </div>
    );
  }

}

/* global document */
const root = document.createElement('div');
document.body.appendChild(root);
render(<Root />, root);
