export const projectionVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const projectionFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uGlitch;
  uniform float uGamma;
  uniform float uBrightness;
  uniform vec3 uTint;
  uniform float uAlpha;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 uv = vUv;

    float g = uGlitch;

    // Horizontal band displacement — many thin strips
    if (g > 0.0) {
      float bandSeed = floor(uv.y * 40.0) + floor(uTime * 30.0);
      float bandRand = hash(bandSeed);
      if (bandRand > 0.6) {
        float shift = (hash(bandSeed + 1.0) - 0.5) * 0.05 * g;
        uv.x += shift;
      }
    }

    // Stacked layout (flipY=true): texture top = video top = RGB, texture bottom = alpha
    vec2 rgbUv = vec2(uv.x, uv.y * 0.5 + 0.5);
    vec2 alphaUv = vec2(uv.x, uv.y * 0.5);

    // RGB separation
    float sep = g * 0.018;
    vec3 rgb;
    float a;
    if (g > 0.0) {
      rgb.r = texture2D(uMap, rgbUv + vec2(sep, 0.0)).r;
      rgb.g = texture2D(uMap, rgbUv).g;
      rgb.b = texture2D(uMap, rgbUv - vec2(sep, 0.0)).b;
    } else {
      rgb = texture2D(uMap, rgbUv).rgb;
    }
    a = texture2D(uMap, alphaUv).r;
    // Undo sRGB decode on alpha mask, then remap YUV limited range (16-235)
    a = pow(a, 1.0 / 2.2);
    a = clamp((a - 0.063) / 0.859, 0.0, 1.0);

    rgb = pow(rgb, vec3(uGamma)) * uBrightness * uTint;

    // Brightness spike during glitch
    rgb *= 1.0 + g * 1.0;

    // Scanlines: thin horizontal lines, slowly drifting upward
    float scanline = sin((uv.y * 1400.0) + uTime * 2.5) * 0.5 + 0.5;
    scanline = smoothstep(0.42, 0.58, scanline);
    rgb -= scanline * 0.01;

    a *= (1.0 - g * 0.3) * uAlpha;
    if (a < 0.05) discard;
    gl_FragColor = vec4(rgb, a);
  }
`;
