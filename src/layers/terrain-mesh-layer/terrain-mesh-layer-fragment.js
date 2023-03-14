export default `#version 300 es
#define SHADER_NAME simple-mesh-layer-fs

precision highp float;

uniform bool hasTexture;
uniform sampler2D sampler;
uniform bool hasHeatmap;
uniform sampler2D heatmapSampler;
uniform bool hasTraffic;
uniform sampler2D trafficSampler;
uniform bool flatShading;
uniform float opacity;
uniform float heatmapOpacity;
uniform float trafficOpacity;

in vec2 vTexCoord;
in vec3 cameraPosition;
in vec3 normals_commonspace;
in vec4 position_commonspace;
in vec4 vColor;

out vec4 fragColor;

vec4 mixTexture(vec4 color1, vec4 color2) {
  vec4 mix = vec4(0.0);
  mix.a = 1.0 - (1.0 - color2.a) * (1.0 - color1.a);
  mix.r = (color2.r * color2.a / mix.a) + (color1.r * color1.a * (1.0 - color2.a)) / mix.a;
  mix.g = (color2.g * color2.a / mix.a) + (color1.g * color1.a * (1.0 - color2.a)) / mix.a;
  mix.b = (color2.b * color2.a / mix.a) + (color1.b * color1.a * (1.0 - color2.a)) / mix.a;
  return mix;
}

void main(void) {
  geometry.uv = vTexCoord;

  vec3 normal;
  if (flatShading) {

#ifdef DERIVATIVES_AVAILABLE
    normal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
#else
    normal = vec3(0.0, 0.0, 1.0);
#endif
  } else {
    normal = normals_commonspace;
  }

  vec4 color = hasTexture ? texture(sampler, vTexCoord) : vColor;
  if (hasHeatmap) {
    vec4 hcolor = texture(heatmapSampler, vTexCoord);
    color = mixTexture(color, vec4(hcolor.rgb, hcolor.a * heatmapOpacity));
  }
  if (hasTraffic) {
    vec4 tcolor = texture(trafficSampler, vTexCoord);
    color = mixTexture(color, vec4(tcolor.rgb, tcolor.a * trafficOpacity));
  }
  DECKGL_FILTER_COLOR(color, geometry);

  vec3 lightColor = lighting_getLightColor(color.rgb, cameraPosition, position_commonspace.xyz, normal);
  fragColor = vec4(lightColor, color.a * opacity);
}
`;

