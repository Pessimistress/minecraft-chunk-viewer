/* global window */
import React, {Component, PropTypes} from 'react';
import OrbitViewport from '../utils/orbit-viewport';
import {vec3} from 'gl-matrix';

/* Utils */

// constrain number between bounds
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

/* Interaction */

export default class OrbitController extends Component {

  static getViewport({width, height, lookAt, distance, rotationX, rotationY, fov, translationX, translationY, zoom}) {
    const cameraPos = vec3.add([], lookAt, [0, 0, distance]);
    vec3.rotateX(cameraPos, cameraPos, lookAt, rotationX / 180 * Math.PI);
    vec3.rotateY(cameraPos, cameraPos, lookAt, rotationY / 180 * Math.PI);

    return new OrbitViewport({
      width,
      height,
      lookAt,
      far: 10000,
      near: 1,
      fovy: fov,
      eye: cameraPos,
      translationX,
      translationY,
      zoom
    });
  }

  constructor(props) {
    super(props);
    this._dragStartPos = null;

    this._onDragStart = this._onDragStart.bind(this);
    this._onDrag = this._onDrag.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.bounds !== nextProps.bounds) {
      this._fitBounds(nextProps.bounds);
    }
  }

  _onChangeViewport(viewport) {
    this.props.onChangeViewport(viewport);
  }

  _onDragStart(evt) {
    const {pageX, pageY} = evt;
    const {width, height, bounds, lookAt} = this.props;

    this._dragStartPos = [pageX, pageY];

    if (bounds) {
      const viewport = OrbitController.getViewport(this.props);

      const pos0 = viewport.project(lookAt);
      const pos1 = viewport.project([lookAt[0], lookAt[1] + 1, lookAt[2]]);

      const dy = (height / 2 - pos0[1]) / (pos1[1] - pos0[1]);

      this._dragStartCenter = [lookAt[0], clamp(lookAt[1] + dy, bounds.minY, bounds.maxY), lookAt[2]];
    } else {
      this._dragStartCenter = null;
    }
  }

  _onDrag(evt) {
    if (this._dragStartPos) {
      const {pageX, pageY} = evt;
      const {width, height, translationX, translationY} = this.props;
      const dx = pageX - this._dragStartPos[0];
      const dy = pageY - this._dragStartPos[1];

      if (evt.shiftKey || evt.ctrlKey || evt.altKey || evt.metaKey) {
        // pan
        this._onChangeViewport({
          translationX: translationX + dx,
          translationY: translationY - dy
        });
      } else {
        // rotate
        const {rotationX, rotationY, lookAt} = this.props;
        const newRotationX = clamp(rotationX - dy / height * 180, -89.999, 89.999);
        const newRotationY = (rotationY - dx / width * 180) % 360;

        const viewport = OrbitController.getViewport(this.props);
        const newViewport = OrbitController.getViewport({...this.props, rotationX: newRotationX, rotationY: newRotationY});

        let tx = 0;
        let ty = 0;

        if (this._dragStartCenter) {
          const center = viewport.project(this._dragStartCenter);
          const newCenter = newViewport.project(this._dragStartCenter);

          tx = center[0] - newCenter[0];
          ty = center[1] - newCenter[1];
        }

        this._onChangeViewport({
          rotationX: newRotationX,
          rotationY: newRotationY,
          translationX: translationX + tx,
          translationY: translationY - ty
        });
      }

      this._dragStartPos = [pageX, pageY];
    }
  }

  _onDragEnd() {
    this._dragStartPos = null;
    this.props.onChangeViewport({isDragging: false});
  }

  _onWheel(evt) {
    evt.preventDefault();

    let value = evt.deltaY;
    // Firefox doubles the values on retina screens...
    if (firefox && evt.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) {
      value /= window.devicePixelRatio;
    }
    if (evt.deltaMode === window.WheelEvent.DOM_DELTA_LINE) {
      value *= 40;
    }
    if (value !== 0 && value % 4.000244140625 === 0) {
      // This one is definitely a mouse wheel event.
      // Normalize this value to match trackpad.
      value = Math.floor(value / 4);
    }

    const {pageX, pageY} = evt;
    const {zoom, minZoom, maxZoom, width, height, translationX, translationY} = this.props;
    const newZoom = clamp(zoom * Math.pow(1.01, -value), minZoom, maxZoom);
    const deltaZoom = newZoom / zoom;

    const cx = pageX - width / 2;
    const cy = height / 2 - pageY;

    const newTranslationX = cx - (cx - translationX) * newZoom / zoom;
    const newTranslationY = cy - (cy - translationY) * newZoom / zoom;

    this._onChangeViewport({
      zoom: newZoom,
      translationX: newTranslationX,
      translationY: newTranslationY
    });
  }

  // public API
  _fitBounds(bounds) {
    if (!bounds) {
      return;
    }

    const {minX, minY, minZ, maxX, maxY, maxZ} = bounds;
    const {fov} = this.props;
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const newDistance = size / Math.tan(fov / 180 * Math.PI / 2) / 2;

    this._onChangeViewport({
      lookAt: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      distance: newDistance,
      translationX: 0,
      translationY: 0,
      zoom: 0.75,
    });
  }

  render() {
    return (
      <div style={{position: 'relative', userSelect: 'none'}}
        onMouseDown={this._onDragStart}
        onMouseMove={this._onDrag}
        onMouseLeave={this._onDragEnd}
        onMouseUp={this._onDragEnd}
        onWheel={this._onWheel} >

        {this.props.children}

      </div>);
  }
}

OrbitController.propTypes = {
  // target position
  lookAt: PropTypes.arrayOf(PropTypes.number),
  // camera distance
  distance: PropTypes.number,
  // rotation
  rotationX: PropTypes.number,
  rotationY: PropTypes.number,
  // translation
  translationX: PropTypes.number,
  translationY: PropTypes.number,
  zoom: PropTypes.number,
  minZoom: PropTypes.number,
  maxZoom: PropTypes.number,
  // field of view
  fov: PropTypes.number,
  // viewport width in pixels
  width: PropTypes.number.isRequired,
  // viewport height in pixels
  height: PropTypes.number.isRequired,
  // bounds (optional)
  bounds: PropTypes.object,
  // callback
  onChangeViewport: PropTypes.func.isRequired
};

OrbitController.defaultProps = {
  lookAt: [0, 0, 0],
  rotationX: 0,
  rotationY: 0,
  translationX: 0,
  translationY: 0,
  distance: 10,
  zoom: 1,
  minZoom: 0,
  maxZoom: Infinity,
  fov: 50
};
