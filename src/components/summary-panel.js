import React, {PureComponent} from 'react';

/*
 * Displays the metadata of the selected chunks and the hovered block
 */
export default class SummaryPanel extends PureComponent {

  _renderStats(stats) {
    return Object.keys(stats)
      .map(key => (
        <tr key={key}>
          <td><b>{key}</b></td>
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
      'Block Name': block.name,
      'Block Id': `${blockId}:${blockData}`,
      'Coordinates': `X ${position[0]} Y ${position[1]} Z ${position[2]}`,
      'Biome': biome.name
    });
  }

  _renderSummary() {
    const {chunks, data, blockCount} = this.props.data;

    if (!data) {
      return null;
    }
    return this._renderStats({
      'Chunks Loaded': chunks.length,
      'Blocks Rendered': blockCount
    });
  }

  render() {
    return (<div className="summary-panel">
      <table>
        <tbody>
          { this._renderSummary() }
          { this._renderHoverInfo() }
        </tbody>
      </table>
    </div>);
  }
}
