// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
export default `
#define SHADER_NAME minecraft-layer-vertex-shader

attribute vec3 positions;
attribute vec3 normals;
attribute vec2 texCoords;

attribute vec3 instancePositions;
attribute vec3 instancePositions64Low;
attribute float instanceBlockIds;
attribute vec4 instanceBlockData;
attribute float instanceVisibilities;
attribute vec3 instancePickingColors;

uniform float sliceY;

uniform vec2 blockDefsTextureDim;
uniform vec2 atlasTextureDim;
uniform sampler2D blockDefsTexture;
uniform sampler2D biomeTexture;

varying float isVisible;
varying vec4 vColorScale;
varying vec2 vTextureCoords;

mat3 getXYRotationMatrix(float radX, float radY) {
  float cx = cos(radX);
  float sx = sin(radX);
  float cy = cos(radY);
  float sy = sin(radY);

  return mat3(
    cy, 0.0, -sy,
    sx * sy, cx, sx * cy,
    cx * sy, -sx, cx * cy
  );
}

float round(float x) {
  return floor(x + 0.5);
}

vec4 getBlockDefAt(float faceIndex) {
  vec2 coords = vec2(instanceBlockData.x * 8.0 + faceIndex, instanceBlockIds);
  coords += vec2(0.5);
  coords /= blockDefsTextureDim;

  return texture2D(blockDefsTexture, coords);
}

float getFaceIndex(vec3 normal_modelspace) {
  vec3 index = normal_modelspace * vec3(-1.0, 0.5, 1.0) +
          abs(normal_modelspace) * vec3(4.0, 0.5, 3.0);
  return round(index.x + index.y + index.z);
}

vec4 getBiomeColor() {
  // extreme altitude
  vec2 coords = instanceBlockData.yz / 255.;
  coords.x = 1.0 - coords.x;

  return mix(
    texture2D(biomeTexture, coords),
    vec4(1.5),
    step(95., instancePositions.y)
  );
}

bool getVisibility(float faceIndex) {
  float b = pow(2., 5. - faceIndex);
  return mod(instanceVisibilities, b * 2.) >= b;
}

// (scale, rotate, translate, face offset)
vec4 getTransform(vec4 t) {
  return vec4(
    round(t.x * 255.0) / 16.0 - 4.0,
    round(t.y * 255.0) / 6.0 * PI,
    round(t.z * 255.0) / 16.0 - 1.0,
    round((1.0 - t.w) * 255.0) / 16.0
  );
}

void main(void) {
  geometry.pickingColor = instancePickingColors;

  vec4 transformX = getTransform(getBlockDefAt(6.0));
  vec4 transformY = getTransform(getBlockDefAt(7.0));

  vec3 blockScale = vec3(transformX[0], transformY[0], 1.0);
  mat3 blockRotation = getXYRotationMatrix(transformX[1], transformY[1]);
  vec3 blockTranslation = vec3(transformX[2], transformY[2], 0.0);
  vec3 faceOffset = vec3(transformX[3], transformY[3], transformX[3]);

  vec3 position_modelspace =
    blockRotation * (positions / 2. * blockScale - normals * faceOffset + blockTranslation);

  vec3 normal_modelspace = blockRotation * normals;
  vec2 texCoords_modelspace = texCoords * mix(
    vec2(1.0),
    blockScale.xy,
    1.0 - abs(normals.xy)
  );

  float faceIndex = getFaceIndex(normals);
  float faceIndex_modelspace = getFaceIndex(normal_modelspace);

  // textures mapping
  // returns [col, row, use_biome_shading, 1.0]
  vec4 textureSettings = getBlockDefAt(faceIndex);

  // texture size is 16x16 with 1px bleeding
  vec4 textureFrame = vec4(
    round(textureSettings.x * 255.) * 18.0 + 1.0,
    round(textureSettings.y * 255. + 1.0) * 18.0 - 1.0,
    16.0,
    -16.0
  );

  vTextureCoords = (textureFrame.xy + texCoords_modelspace * textureFrame.zw) / atlasTextureDim;

  // discard empty faces and ones facing opaque blocks
  isVisible = float(
    textureSettings.xy != vec2(0.) &&
    (getVisibility(faceIndex_modelspace) ||
    (faceIndex_modelspace == 1.0) && instancePositions.y == sliceY)
  );

  // calculate position
  gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, position_modelspace, geometry.position);

  // calculate colors
  vec4 biomeColor = mix(vec4(1.), getBiomeColor(), textureSettings.z);
  vec3 lightWeight = lighting_getLightColor(vec3(1.0), project_uCameraPosition, geometry.position.xyz, normal_modelspace);
  lightWeight += instanceBlockData.w / 15.0;

  float isGhosted = float(instancePositions.y > sliceY);

  if (picking_uActive) {
    isVisible *= 1.0 - isGhosted;
  }

  vColorScale = vec4(lightWeight, mix(1.0, 0.1, isGhosted)) * biomeColor;

  DECKGL_FILTER_COLOR(vColorScale, geometry);
}
`;
