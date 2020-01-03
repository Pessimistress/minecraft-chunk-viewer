import React, {PureComponent} from 'react';
import {findChunkIndex} from '../utils/mca-parser';

/*
 * A component that visualizes the entire region and handles chunk selection
 * The terrain map is rendered with the max height information of each column
 * on a 2D canvas
 */
export default class Minimap extends PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      hoveredX: -1,
      hoveredZ: -1
    };
  }

  _onSelect = evt => {
    const {hoveredX, hoveredZ} = this.state;
    if (hoveredX < 0) {
      return;
    }

    if (evt.altKey || evt.shiftKey || evt.ctrlKey) {
      // Multiple selection mode
      const selectedChunks = this.props.selection.slice(0);
      const i = findChunkIndex(selectedChunks, hoveredX, hoveredZ);

      if (i < 0) {
        // Add to selection
        selectedChunks.push([hoveredX, hoveredZ]);
      } else if (selectedChunks.length > 1) {
        // Remove if already selected, but don't remove the last one
        selectedChunks.splice(i, 1);
      }
      this.props.onSelect(selectedChunks);
    } else {
      // Single selection mode
      this.props.onSelect([[hoveredX, hoveredZ]]);
    }
  }

  _onHover = evt => {
    const {hoveredX, hoveredZ} = this.state;
    const {offsetX, offsetY} = evt.nativeEvent;
    const x = offsetX >> 4;
    const z = offsetY >> 4;

    if (hoveredX !== x || hoveredZ !== z) {
      const {data: {availableChunks}} = this.props;
      if (findChunkIndex(availableChunks, x, z) >= 0) {
        this.setState({
          hoveredX: x,
          hoveredZ: z
        });
      } else {
        this._onUnhover();
      }
    }
  }

  _onUnhover = () => {
    this.setState({
      hoveredX: -1,
      hoveredZ: -1
    });
  }

  render() {
    const {data, selection, direction} = this.props;
    if (!data) {
      return null;
    }

    const {hoveredX, hoveredZ} = this.state;
    const hoverBoxStyle = {
      left: `${hoveredX * 16}px`,
      top: `${hoveredZ * 16}px`
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
          style={{transform: `rotate(${direction - 90}deg)` }} >
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
