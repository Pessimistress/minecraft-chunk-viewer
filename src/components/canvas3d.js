import React, {Component, PropTypes} from 'react';

function clamp(x, min, max) {
  if (x < min) {
    return min;
  }
  if (x > max) {
    return max;
  }
  return x;
}

const ua = typeof window.navigator !== 'undefined' ?
  window.navigator.userAgent.toLowerCase() : '';
const firefox = ua.indexOf('firefox') !== -1;

export default class Canvas3D extends Component {

  constructor(props) {
    super(props);
    this._dragStartPos = null;
  }

  _onDragStart = evt => {
    const {pageX, pageY} = evt;
    this._dragStartPos = [pageX, pageY];
    this.props.onViewportChange({isDragging: true});
  }

  _onDrag = evt => {
    if (this._dragStartPos) {
      const {pageX, pageY} = evt;
      const {rotateX, rotateY, translateX, translateY, zoom, width, height} = this.props;

      if (evt.altKey || evt.shiftKey || evt.ctrlKey) {
        const limit = zoom / 2;
        const newTransX = clamp(translateX + (pageX - this._dragStartPos[0]) / width * 2, -limit, limit);
        const newTransY = clamp(translateY - (pageY - this._dragStartPos[1]) / height * 2, -limit, limit);
        this.props.onViewportChange({
          translateX: newTransX,
          translateY: newTransY
        });
      } else {
        const newRotateX = clamp(rotateX - (pageY - this._dragStartPos[1]) / height * Math.PI, -Math.PI / 2, 0);
        const newRotateY = rotateY + (pageX - this._dragStartPos[0]) / width * Math.PI;
        this.props.onViewportChange({
          rotateX: newRotateX,
          rotateY: newRotateY
        });
      }

      this._dragStartPos = [pageX, pageY];
    }
  }

  _onDragEnd = () => {
    this._dragStartPos = null;
    this.props.onViewportChange({isDragging: false});
  }

  _onWheel = evt => {
    evt.preventDefault();
    let value = evt.deltaY;
    // Firefox doubles the values on retina screens...
    if (firefox && event.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) {
      value /= window.devicePixelRatio;
    }
    if (event.deltaMode === window.WheelEvent.DOM_DELTA_LINE) {
      value *= 40;
    }
    if (value !== 0 && value % 4.000244140625 === 0) {
      // This one is definitely a mouse wheel event.
      // Normalize this value to match trackpad.
      value = Math.floor(value / 4);
    }

    const {translateX, translateY, zoom, width, height} = this.props;
    const newZoom = clamp(zoom * Math.pow(1.01, -value), 1, 256);
    const {pageX, pageY} = evt;

    let newTransX = ((translateX + 1) * width / 2 - pageX) * newZoom / zoom + pageX;
    let newTransY = ((-translateY + 1) * height / 2 - pageY) * newZoom / zoom + pageY;

    const limit = newZoom / 2;
    newTransX = clamp(newTransX / width * 2 - 1, -limit, limit);
    newTransY = clamp(1 - newTransY / height * 2, -limit, limit);

    this.props.onViewportChange({
      zoom: newZoom,
      translateX: newTransX,
      translateY: newTransY
    });
  }

  render() {
    return (
      <div
        onMouseDown={this._onDragStart}
        onMouseMove={this._onDrag}
        onMouseLeave={this._onDragEnd}
        onMouseUp={this._onDragEnd}
        onWheel={this._onWheel} >

        {this.props.children}

      </div>);
  }
}

Canvas3D.propTypes = {
  // rotation around x axis in radian
  rotateX: PropTypes.number.isRequired,
  // rotation around y axis in radian
  rotateY: PropTypes.number.isRequired,
  // offset along x axis in clip space
  translateX: PropTypes.number.isRequired,
  // offset along y axis in clip space
  translateY: PropTypes.number.isRequired,
  // scale
  zoom: PropTypes.number.isRequired,
  // screen width in pixels
  width: PropTypes.number.isRequired,
  // screen height in pixels
  height: PropTypes.number.isRequired,
  // callback
  onViewportChange: PropTypes.func.isRequired
};
