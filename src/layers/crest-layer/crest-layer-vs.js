export const vs = `#version 300 es
    #define SHADER_NAME crest-layer-vertex-shader;

    in vec3 positions;
    in vec3 startPositions;
    in vec3 startPositions64Low;
    in vec3 middlePositions;
    in vec3 middlePositions64Low;
    in vec3 endPositions;
    in vec3 endPositions64Low;

    in float startDensity;
    in float middleDensity;
    in float endDensity;

    in vec3 startColor;
    in vec3 middleColor;
    in vec3 endColor;

    out vec4 vColor;

    void main() {
        geometry.worldPosition = middlePositions;
        float maxHeight = 40.;

        vec3 usedPositions = vec3(0.0, 0.0, 0.0);
        vColor = vec4(0.);
        vColor.a = 0.2;
        if (positions.x == -1.0) {
            usedPositions = vec3(startPositions.xyz);
            vColor.rgb = startColor.rgb;
            if (positions.z > 0.0)
                usedPositions = vec3(usedPositions.xy, usedPositions.z + (maxHeight * startDensity));
        }
        if (positions.x == 0.0) {
            usedPositions = vec3(middlePositions.xyz);
            vColor.rgb = middleColor.rgb;
            if (positions.z > 0.0)
                usedPositions = vec3(usedPositions.xy, usedPositions.z + (maxHeight * middleDensity));
        }
        if (positions.x == 1.0) {
            usedPositions = vec3(endPositions.xyz);
            vColor.rgb = endColor.rgb;
            if (positions.z > 0.0)
                usedPositions = vec3(usedPositions.xy, usedPositions.z + (maxHeight * endDensity));
        }
        if (positions.z > 0.0)
            vColor.a = 1.;
        vec3 usedPositions64Low = middlePositions64Low;
        gl_Position = project_position_to_clipspace(usedPositions, usedPositions64Low, vec3(0.), geometry.position);
        DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
    }
`;
