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
#define SHADER_NAME minecraft-layer-vertex-shader

attribute vec3 positions;
attribute vec3 normals;
attribute vec2 texCoords;

attribute vec3 instancePositions;
attribute float instanceBlockIds;
attribute vec4 instanceBlockData;
attribute float instanceVisibilities;
attribute vec3 instancePickingColors;

uniform float sliceY;

uniform vec2 blockDefsTextureDim;
uniform vec2 atlasTextureDim;
uniform sampler2D blockDefsTexture;
uniform sampler2D biomeTexture;
uniform vec3 selectedPickingColor;
uniform float renderPickingBuffer;

varying float isVisible;
varying vec4 vColorScale;
varying vec4 vColorOffset;
varying vec2 vTextureCoords;
varying vec4 vPickingColor;

// lighting
uniform float uAmbientLightCoefficient;
uniform vec3 uPointLight1Location;
uniform float uPointLight1Attenuation;
uniform vec3 uPointLight2Location;
uniform float uPointLight2Attenuation;

vec3 getLightWeight(vec3 position, vec3 normal) {
  vec3 position_viewspace = project_to_viewspace(vec4(position, 1.0)).xyz;
  vec3 normal_viewspace = project_to_viewspace(vec4(normal, 0.0)).xyz;

  vec3 ambient = vec3(uAmbientLightCoefficient + instanceBlockData.w / 15.0);

  vec3 light1Direction = normalize(uPointLight1Location - position_viewspace);
  vec3 light2Direction = normalize(uPointLight2Location - position_viewspace);

  float diffuse1 = uPointLight1Attenuation * max(dot(normal_viewspace, light1Direction), 0.0);
  float diffuse2 = uPointLight2Attenuation * max(dot(normal_viewspace, light2Direction), 0.0);

  return min(ambient + diffuse1 + diffuse2, vec3(1.0));
}

mat3 getXRotationMatrix(float rad) {
  float c = cos(rad);
  float s = sin(rad);
  return mat3(
      1.0, 0.0, 0.0,
      0.0, c, s,
      0.0, -s, c
  );
}

mat3 getYRotationMatrix(float rad) {
  float c = cos(rad);
  float s = sin(rad);
  return mat3(
      c, 0.0, -s,
      0.0, 1.0, 0.0,
      s, 0.0, c
  );
}

float round(float x) {
  return floor(x + 0.5);
}

vec4 getBlockDefAt(float faceIndex) {
  vec2 coords = vec2(instanceBlockData.x * 8.0 + faceIndex, instanceBlockIds);
  coords += vec2(0.5);
  coords /= blockDefsTextureDim;
  coords.y = 1.0 - coords.y;

  return texture2D(blockDefsTexture, coords);
}

float getFaceIndex(vec3 normal_modelspace) {
  vec3 index = normal_modelspace * vec3(-1.0, 0.5, 1.0) +
          abs(normal_modelspace) * vec3(4.0, 0.5, 3.0);
  return round(index.x + index.y + index.z);
}

vec4 getBiomeColor(float faceIndex) {
  // extreme altitude
  vec2 coords = vec2(1.0) - instanceBlockData.yz / 255.;
  return mix(
    texture2D(biomeTexture, coords),
    vec4(1.),
    step(95., instancePositions.y)
  );
}

bool getVisibility(float faceIndex) {
  float b = pow(2., 5. - faceIndex);
  return mod(instanceVisibilities, b * 2.) >= b;
}

// (scale, rotate, translate, textureOrigin)
vec4 formatTransform(vec4 t) {
  return vec4(
    round(t.x * 255.0) / 16.0 - 4.0,
    round(t.y * 255.0) / 6.0 * PI,
    round(t.z * 255.0) / 16.0 - 1.0,
    round(t.w * 255.0) / 16.0 - 1.0
  );
}

void main(void) {

  vec4 transformX = formatTransform(getBlockDefAt(6.0));
  vec4 transformY = formatTransform(getBlockDefAt(7.0));

  vec3 blockScale = vec3(transformX[0], transformY[0], 1.0);
  mat3 blockRotation = getYRotationMatrix(transformY[1]) * getXRotationMatrix(transformX[1]);
  vec3 blockTranslation = vec3(transformX[2], transformY[2], 0.0);
  vec3 blockShrink = vec3(transformX[3], transformY[3], transformX[3]);

  vec3 position_modelspace = instancePositions +
    blockRotation * (positions / 2. * blockScale - normals * blockShrink + blockTranslation);

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
  vTextureCoords.y = 1.0 - vTextureCoords.y;

  // discard empty faces and ones facing opaque blocks
  isVisible = float(
    textureSettings.xy != vec2(0.) &&
    (getVisibility(faceIndex_modelspace) ||
    (faceIndex_modelspace == 1.0) && instancePositions.y == sliceY)
  );

  // calculate position
  gl_Position = project_to_clipspace(vec4(position_modelspace, 1.));

  // calculate colors
  vec4 biomeColor = mix(vec4(1.), getBiomeColor(faceIndex), textureSettings.z);
  vec3 lightWeight = getLightWeight(position_modelspace, normal_modelspace);
  float isGhosted = float(instancePositions.y > sliceY);

  isVisible = isVisible * (1.0 - renderPickingBuffer * isGhosted);

  vColorScale = vec4(lightWeight, mix(1.0, 0.1, isGhosted)) * biomeColor;
  // highlight selected
  vColorOffset = vec4(0.5, 0.5, 0.0, 0.5) * float(instancePickingColors == selectedPickingColor);

  vPickingColor = vec4(instancePickingColors / 255., 1.0);

}
