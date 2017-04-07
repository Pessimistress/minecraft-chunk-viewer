
import {Viewport} from 'deck.gl';
import {mat4} from 'gl-matrix';

const DEGREES_TO_RADIANS = Math.PI / 180;

export default class OrbitViewport extends Viewport {
  constructor({
    // viewport arguments
    width, // Width of viewport
    height, // Height of viewport
    // view matrix arguments
    eye, // Defines eye position
    lookAt = [0, 0, 0], // Which point is camera looking at, default origin
    up = [0, 1, 0], // Defines up direction, default positive y axis
    // projection matrix arguments
    fovy = 75, // Field of view covered by camera
    near = 1, // Distance of near clipping plane
    far = 100, // Distance of far clipping plane

    // screen space
    translationX = 0,
    translationY = 0,
    zoom = 1,

    // automatically calculated
    aspect = null // Aspect ratio (set to viewport widht/height)
  }) {
    const fovyRadians = fovy * DEGREES_TO_RADIANS;
    aspect = Number.isFinite(aspect) ? aspect : width / height;
    const perspectiveMatrix = mat4.perspective([], fovyRadians, aspect, near, far);
    const transformMatrix = mat4.fromTranslation([], [translationX / width * 2, translationY / height * 2, 0]);
    mat4.scale(transformMatrix, transformMatrix, [zoom, zoom, 1]);

    super({
      viewMatrix: mat4.lookAt([], eye, lookAt, up),
      projectionMatrix: mat4.multiply(transformMatrix, transformMatrix, perspectiveMatrix),
      width,
      height
    });
  }

  project(xyz, {topLeft = false} = {}) {
    const v = this.transformVector(this.pixelProjectionMatrix, [...xyz, 1]);

    const [x, y, z] = v;
    const y2 = topLeft ? this.height - y : y;
    return [x, y2, z];
  }

  unproject(xyz, {topLeft = false} = {}) {
    const [x, y, z] = xyz;
    const y2 = topLeft ? this.height - y : y;

    return this.transformVector(this.pixelUnprojectionMatrix, [x, y2, z, 1]);
  }
}
