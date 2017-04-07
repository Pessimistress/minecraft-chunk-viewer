import React, {PureComponent} from 'react';

const fromCamelCase = name => {
  const words = name.match(/[A-Z]?[a-z0-9]+/g) || [];
  return words.map(w => `${w[0].toUpperCase()}${w.slice(1)}`).join(' ');
}

export default class SummaryPanel extends PureComponent {

  _renderStats(stats) {
    return Object.keys(stats)
      .map(key => (
        <tr key={key}>
          <td><b>{fromCamelCase(key)}</b></td>
          <td>{stats[key]}</td>
        </tr>
      ));
  }

  _renderHoverInfo() {
    const {hoveredBlock} = this.props;
    if (!hoveredBlock) {
      return null;
    }
    const {blockId, blockData, position, biome, block} = hoveredBlock;

    return this._renderStats({
      blockName: block.name,
      blockId: `${blockId}:${blockData}`,
      coordinates: `X ${position[0]} Y ${position[1]} Z ${position[2]}`,
      biome: biome.name
    });
  }

  _renderSummary() {
    const {chunks, data, blockCount} = this.props.data;

    if (!data) {
      return null;
    }
    return this._renderStats({
      chunksLoaded: chunks.length,
      blocksRendered: blockCount
    });
  }

  render() {
    return (
      <div className="summary-panel">
        <table>
          <tbody>
            { this._renderSummary() }
            { this._renderHoverInfo() }
          </tbody>
        </table>
      </div>);
  }
}
