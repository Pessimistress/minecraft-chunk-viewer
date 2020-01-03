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
#define SHADER_NAME minecraft-layer-fragment-shader

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D atlasTexture;

varying float isVisible;
varying vec4 vColorScale;
varying vec2 vTextureCoords;

void main(void) {
  if (isVisible == 0.) {
    discard;
  }

  vec4 color = texture2D(atlasTexture, vTextureCoords);

  if (color.a == 0.) {
    discard;
  }
  geometry.uv = vTextureCoords;

  gl_FragColor = color * vColorScale;
  DECKGL_FILTER_COLOR(gl_FragColor, geometry);
}
`;
