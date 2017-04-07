/* global window */
import React, {Component, PropTypes} from 'react';
import OrbitViewport from '../utils/orbit-viewport';
import {vec3} from 'gl-matrix';

/* Math Utils */

// Whether number is between bounds
function inRange(x, min, max) {
  return x >= min && x <= max;
}
// Constrain number between bounds
function clamp(x, min, max) {
  return x < min ? min : (x > max ? max : x);
}
// Get ratio of x on domain
function interp(x, domain0, domain1) {
  if (domain0 === domain1) {
    return x === domain0 ? 0 : Infinity;
  }
  return (x - domain0) / (domain1 - domain0);
}

const ua = typeof window.navigator !== 'undefined' ?
  window.navigator.userAgent.toLowerCase() : '';
const firefox = ua.indexOf('firefox') !== -1;

/*
 * Maps mouse interaction to a deck.gl Viewport
 */
export default class OrbitController extends Component {

  // Returns a deck.gl Viewport instance, to be used with the DeckGL component
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

  /* Cast a ray into the screen center and take the average of all
   * intersections with the bounding box:
   *
   *                         (x=w/2)
   *                          .
   *                          .
   *   (bounding box)         .
   *           _-------------_.
   *          | "-_           :-_
   *         |     "-_        .  "-_
   *        |         "-------+-----:
   *       |.........|........C....|............. (y=h/2)
   *      |         |         .   |
   *     |         |          .  |
   *    |         |           . |
   *   |         |            .|
   *  |         |             |                      Y
   *   "-_     |             |.             Z       |
   *      "-_ |             | .              "-_   |
   *         "-------------"                    "-|_____ X
   */
  _getLocationAtCenter() {
    const {width, height, bounds} = this.props;

    if (!bounds) {
      return null;
    }

    const viewport = OrbitController.getViewport(this.props);

    const C0 = viewport.unproject([width / 2, height / 2, 0]);
    const C1 = viewport.unproject([width / 2, height / 2, 1]);
    const sum = vec3.fromValues(0, 0, 0);
    let count = 0;

    [
      // depth at intersection with X = minX
      interp(bounds.minX, C0[0], C1[0]),
      // depth at intersection with X = maxX
      interp(bounds.maxX, C0[0], C1[0]),
      // depth at intersection with Y = minY
      interp(bounds.minY, C0[1], C1[1]),
      // depth at intersection with Y = maxY
      interp(bounds.maxY, C0[1], C1[1]),
      // depth at intersection with Z = minZ
      interp(bounds.minZ, C0[2], C1[2]),
      // depth at intersection with Z = maxZ
      interp(bounds.maxZ, C0[2], C1[2])
    ].forEach(d => {
      // worldspace position of the intersection
      const C = vec3.lerp([], C0, C1, d);
      // check if position is on the bounding box
      if (inRange(C[0], bounds.minX, bounds.maxX) &&
          inRange(C[1], bounds.minY, bounds.maxY) &&
          inRange(C[2], bounds.minZ, bounds.maxZ)) {
        count++;
        vec3.add(sum, sum, C);
      }
    });

    return count > 0 ? vec3.scale([], sum, 1 / count) : null;
  }

  _onChangeViewport(viewport) {
    this.props.onChangeViewport(viewport);
  }

  _onDragStart(evt) {
    const {pageX, pageY} = evt;

    this._dragStartPos = [pageX, pageY];
    // Rotation center should be the worldspace position at the center of the
    // the screen. If not found, use the last one.
    this._dragRotateCenter = this._getLocationAtCenter() || this._dragRotateCenter;
  }

  _onDrag(evt) {
    if (this._dragStartPos) {
      const {pageX, pageY} = evt;
      const {width, height, translationX, translationY} = this.props;
      const dx = pageX - this._dragStartPos[0];
      const dy = pageY - this._dragStartPos[1];

      if (evt.shiftKey || evt.ctrlKey || evt.altKey || evt.metaKey) {
        // Pan
        this._onChangeViewport({
          translationX: translationX + dx,
          translationY: translationY - dy
        });
      } else {
        // Rotate
        const {rotationX, rotationY} = this.props;
        const newRotationX = clamp(rotationX - dy / height * 180, -89.999, 89.999);
        const newRotationY = (rotationY - dx / width * 180) % 360;

        let newTranslationX = translationX;
        let newTranslationY = translationY;

        if (this._dragRotateCenter) {
          // Keep rotation center at the center of the screen
          const viewport = OrbitController.getViewport(this.props);
          const newViewport = OrbitController.getViewport({...this.props, rotationX: newRotationX, rotationY: newRotationY});
          const center = viewport.project(this._dragRotateCenter);
          const newCenter = newViewport.project(this._dragRotateCenter);

          newTranslationX += center[0] - newCenter[0];
          newTranslationY -= center[1] - newCenter[1];
        }

        this._onChangeViewport({
          rotationX: newRotationX,
          rotationY: newRotationY,
          translationX: newTranslationX,
          translationY: newTranslationY
        });
      }

      this._dragStartPos = [pageX, pageY];
    }
  }

  _onDragEnd() {
    this._dragStartPos = null;
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

    // Zoom around the pointer position
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

  // Move camera to cover the entire bounding box
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
