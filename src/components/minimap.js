import React, {PureComponent} from 'react';
import {findChunkIndex} from '../utils';

export default class Minimap extends PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      xIndex: -1,
      zIndex: -1
    };
  }

  _onSelect = evt => {
    const {xIndex, zIndex} = this.state;
    if (xIndex < 0) {
      return;
    }

    if (evt.altKey || evt.shiftKey || evt.ctrlKey) {

      const selectedChunks = this.props.selection.slice(0);
      const i = findChunkIndex(selectedChunks, xIndex, zIndex);

      if (i >= 0) {
        selectedChunks.splice(i, 1);
      } else {
        selectedChunks.push([xIndex, zIndex]);
      }
      this.props.onSelect(selectedChunks);
    } else {
      this.props.onSelect([[xIndex, zIndex]]);
    }
  }

  _onHover = evt => {
    const {xIndex, zIndex} = this.state;
    const {offsetX, offsetY} = evt.nativeEvent;
    const x = offsetX >> 4;
    const z = offsetY >> 4;

    if (xIndex !== x || zIndex !== z) {
      const {data: {availableChunks}} = this.props;
      if (findChunkIndex(availableChunks, x, z) >= 0) {
        this.setState({
          xIndex: x,
          zIndex: z
        });
      } else {
        this._onUnhover();
      }
    }
  }

  _onUnhover = () => {
    this.setState({
      xIndex: -1,
      zIndex: -1
    });
  }

  render() {
    const {data, selection, direction} = this.props;
    if (!data) {
      return null;
    }

    const {xIndex, zIndex} = this.state;
    const hoverBoxStyle = {
      left: `${xIndex * 16}px`,
      top: `${zIndex * 16}px`
    };

    return (
      <div className="minimap"
        onMouseMove={this._onHover} onMouseLeave={this._onUnhover}
        onClick={this._onSelect} >
        <TerrainMap heightMap={data.heightMap}
          availableChunks={data.availableChunks}
          selectedChunks={selection} />
        
        <div className="hover" style={hoverBoxStyle} />

        <div className="dir"
          style={{transform: `rotate(${-direction - 90}deg)` }} >
          <div />
        </div>
      </div>
    );
  }
}

class TerrainMap extends PureComponent {

  componentDidMount() {
    this._updateMap();
  }

  componentDidUpdate() {
    this._updateMap();
  }

  _updateMap() {
    const {heightMap, availableChunks, selectedChunks} = this.props;
    const {canvas, map} = this.refs;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#fff';
    availableChunks.forEach(([chunkX, chunkZ]) => {
      ctx.fillRect(chunkX * 16, chunkZ * 16, 16, 16);
    });

    ctx.fillStyle = '#08d';
    selectedChunks.forEach(([chunkX, chunkZ]) => {
      ctx.fillRect(chunkX * 16, chunkZ * 16, 16, 16);
    });

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const {data} = imgData;

    let minH = 255;
    let maxH = 0;
    for (let i = 0; i < heightMap.length; i++) {
      const h = heightMap[i];
      if (h) {
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }

    for (let i = 0; i < heightMap.length; i++) {
      const h = (heightMap[i] - minH) / (maxH - minH);
      if (data[i * 4] === 255) {
        const grayscale = Math.round(128 * h);
        data[i * 4] = grayscale;
        data[i * 4 + 1] = grayscale;
        data[i * 4 + 2] = grayscale;
        data[i * 4 + 3] = grayscale + 127;
      } else {
        data[i * 4] = Math.round(data[i * 4] * h);
        data[i * 4 + 1] = Math.round(data[i * 4 + 1] * h);
        data[i * 4 + 2] = Math.round(data[i * 4 + 2] * h);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  render() {
    const {selectedChunks} = this.props;

    let minX = 31;
    let maxX = 0;
    let minZ = 31;
    let maxZ = 0;
    selectedChunks.forEach(([chunkX, chunkZ]) => {
      minX = Math.min(minX, chunkX);
      maxX = Math.max(maxX, chunkX);
      minZ = Math.min(minZ, chunkZ);
      maxZ = Math.max(maxZ, chunkZ);
    });

    const style = {
      marginLeft: `${-(minX + maxX + 1) / 2 * 16}px`,
      marginTop: `${-(minZ + maxZ + 1) / 2 * 16}px`
    };

    return (
      <canvas width="512" height="512" ref="canvas" style={style} />
    );
  }
}
