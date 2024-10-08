export default `\
#version 300 es

// Instance attributes
in vec3 instancePositions;
in vec3 instancePositions64Low;
// in vec4 instanceColors;
// in vec3 instancePickingColors;
// in mat3 instanceModelMatrix;
// in vec3 instanceTranslation;
in float INDICES;
in float aPicked;

// Uniforms
uniform float sizeScale;
uniform float sizeMinPixels;
uniform float sizeMaxPixels;
uniform mat4 sceneModelMatrix;
uniform bool composeModelMatrix;
// uniform vec3 uPositions;
// uniform vec3 uPositions64Low;
uniform vec3 uPickingColor;

// Attributes
in vec4 POSITION;

#ifdef HAS_UV
  in vec2 TEXCOORD_0;
#endif

#ifdef MODULE_PBR
  #ifdef HAS_NORMALS
    in vec4 NORMAL;
  #endif
#endif

// Varying
out vec4 vColor;
out float index;
out float vPicked;

// MODULE_PBR contains all the varying definitions needed
#ifndef MODULE_PBR
  #ifdef HAS_UV
    out vec2 vTEXCOORD_0;
  #endif
#endif

// Main
void main(void) {
    // v1
    mat3 instanceModelMatrix = mat3(1.);
  #if defined(HAS_UV) && !defined(MODULE_PBR)
    vTEXCOORD_0 = TEXCOORD_0;
    geometry.uv = vTEXCOORD_0;
  #endif

  vPicked = aPicked;

  // v1
//   geometry.worldPosition = uPositions;
//   geometry.pickingColor = uPickingColor;
  // v2
  geometry.worldPosition = instancePositions;
//   geometry.pickingColor = instancePickingColors;

  vec3 normal = vec3(0.0, 0.0, 1.0);
  #ifdef MODULE_PBR
    #ifdef HAS_NORMALS
      normal = instanceModelMatrix * (sceneModelMatrix * vec4(NORMAL.xyz, 0.0)).xyz;
    #endif
  #endif

  float originalSize = project_size_to_pixel(sizeScale);
  float clampedSize = clamp(originalSize, sizeMinPixels, sizeMaxPixels);

  vec3 pos = (instanceModelMatrix * (sceneModelMatrix * POSITION).xyz) * sizeScale * (clampedSize / originalSize);
// //   vec3 pos = (instanceModelMatrix * (sceneModelMatrix * POSITION).xyz) * sizeScale * (clampedSize / originalSize) + instanceTranslation;
  if(composeModelMatrix) {
    DECKGL_FILTER_SIZE(pos, geometry);
    // using instancePositions as world coordinates
    // when using globe mode, this branch does not re-orient the model to align with the surface of the earth
    // call project_normal before setting position to avoid rotation
    geometry.normal = project_normal(normal);
    geometry.worldPosition += pos;
    // v1
    // gl_Position = project_position_to_clipspace(pos + uPositions, uPositions64Low, vec3(0.0), geometry.position);
    // v2
    gl_Position = project_position_to_clipspace(pos + instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
  }
  else {
    pos = project_size(pos);
    DECKGL_FILTER_SIZE(pos, geometry);
    // gl_Position = project_position_to_clipspace(uPositions64Low, uPositions, pos, geometry.position);

    // v1
    // gl_Position = project_position_to_clipspace(uPositions, uPositions64Low, pos, geometry.position);
    // v2
    gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, pos, geometry.position);
    geometry.normal = project_normal(normal);
  }
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  #ifdef MODULE_PBR
    // set PBR data
    pbr_vPosition = geometry.position.xyz;
    #ifdef HAS_NORMALS
      pbr_vNormal = geometry.normal;
    #endif

    #ifdef HAS_UV
      pbr_vUV = TEXCOORD_0;
    #else
      pbr_vUV = vec2(0., 0.);
    #endif
    geometry.uv = pbr_vUV;
  #endif

  index = 0.;
  if (INDICES == 1.)
    index = 1.;
//v1
  vColor = vec4(1.);
  //v2
//   vColor = instanceColors;
  DECKGL_FILTER_COLOR(vColor, geometry);
  picking_setPickingColor(uPickingColor);
}
`;
