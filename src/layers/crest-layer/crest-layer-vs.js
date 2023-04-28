export const vs = `#version 300 es
    #define SHADER_NAME crest-layer-vertex-shader;

    in vec3 positions;
    in vec3 startPositions;
    in vec3 startPositions64Low;
    in vec3 middlePositions;
    in vec3 middlePositions64Low;
    in vec3 endPositions;
    in vec3 endPositions64Low;
    in vec3 instancePickingColors;

    in float startDensity;
    in float middleDensity;
    in float endDensity;

    in vec3 startColor;
    in vec3 middleColor;
    in vec3 endColor;

    out vec4 vColor;
    out vec3 vPositions;
    out float vTime;
    out float vDensity;

    vec3 calcPositions(vec3 usedPositions, float density) {
        float maxHeight = 40.;
        float minHeight = 5.;

        if (positions.z > 0.0)
            return vec3(usedPositions.xy, usedPositions.z + ((maxHeight - minHeight) * density) + minHeight);
        return vec3(usedPositions.xyz);
    }

    void main() {
        geometry.worldPosition = middlePositions;
        bool chart = false;

        vec3 usedPositions = vec3(0.0, 0.0, 0.0);
        vColor = vec4(0.);
        vColor.a = 0.2;
        if (positions.x == -1.0) {
            vColor.rgb = startColor.rgb;
            if (chart == false) {
                usedPositions = calcPositions(startPositions, 1.);
                // usedPositions = calcPositions(startPositions, startDensity);

            }
            else {
                usedPositions = startPositions;
            }
        }
        if (positions.x == 0.0) {
            vColor.rgb = middleColor.rgb;
            if (chart == false) {
                // usedPositions = calcPositions(middlePositions, middleDensity);
                usedPositions = calcPositions(middlePositions, 1.);
            }
            else {
                usedPositions = middlePositions;
            }
        }
        if (positions.x == 1.0) {
            vColor.rgb = endColor.rgb;
            if (chart == false) {
                // usedPositions = calcPositions(endPositions, endDensity);
                usedPositions = calcPositions(endPositions, 1.);
            }
            else {
                usedPositions = endPositions;
            }
        }
        if (positions.z > 0.0)
            vColor.a = 1.;

        vColor.a = 0.;
        vec3 usedPositions64Low = middlePositions64Low;

        gl_Position = project_position_to_clipspace(usedPositions, usedPositions64Low, vec3(0.), geometry.position);
        DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
        vPositions = positions;
        vDensity = middleDensity;

        geometry.pickingColor = instancePickingColors;
        DECKGL_FILTER_COLOR(vColor, geometry);
    }
`;
