export const vs = `#version 300 es
    #define SHADER_NAME crest-layer-vertex-shader;

    in vec3 positions;
    in vec3 startPositions;
    in vec3 startPositions64Low;
    in vec3 endPositions;
    in vec3 endPositions64Low;
    in vec3 instancePickingColors;

    in float startDensity;
    in float middleDensity;
    in float endDensity;

    in vec3 startColor;
    in vec3 middleColor;
    in vec3 endColor;

    uniform bool isAnimated;
    uniform float minHeight;
    uniform float maxHeight;
    uniform float arrowSize;

    out vec4 vColor;
    out vec3 vPositions;
    out float vTime;
    out float vDensity;
    out float avgDensity;
    out float vMetersDistance;
    out float sDensity;
    out float mDensity;
    out float eDensity;
    out float nArrows;

    vec3 calcPositions(vec3 usedPositions) {
        if (positions.z > 0.0)
            return vec3(usedPositions.xy, usedPositions.z + (maxHeight - minHeight) + minHeight);
        return vec3(usedPositions.xyz);
    }

    float calcDistance() {
        float earthRadius = 6371000.0; // Earth's radius in meters
        vec2 latLong1 = vec2(radians(startPositions.xy)); // First point's latitude and longitude in radians
        vec2 latLong2 = vec2(radians(endPositions.xy)); // Second point's latitude and longitude in radians

        float dLat = latLong2.x - latLong1.x;
        float dLon = latLong2.y - latLong1.y;

        float a = sin(dLat/2.0)*sin(dLat/2.0) + cos(latLong1.x)*cos(latLong2.x)*sin(dLon/2.0)*sin(dLon/2.0);
        float c = 2.0*atan(sqrt(a)/sqrt(1.0-a));
        return earthRadius*c;
    }

    void main() {
        geometry.worldPosition = startPositions;
        geometry.worldPositionAlt = endPositions;
        bool chart = false;

        vec3 usedPositions = vec3(0.0, 0.0, 0.0);
        vec3 usedPositions64Low = vec3(0., 0., 0.);
        vColor = vec4(0.);
        vColor.a = 1.;

        // float height = isAnimated ? max(maxHeight, arrowSize) : maxHeight;
        float height = maxHeight;

        if (positions.x == 0.0) {
            vColor.rgb = startColor.rgb;
            usedPositions = vec3(startPositions.xy, startPositions.z + (positions.z * height));
            vec3 usedPositions64Low = startPositions64Low;
            vDensity = startDensity;
        }
        if (positions.x == 1.0) {
            vColor.rgb = endColor.rgb;
            vec3 usedPositions64Low = endPositions64Low;
            usedPositions = vec3(endPositions.xy, endPositions.z + (positions.z * height));
            vDensity = endDensity;
        }

        vec3 commonStart = project_position(startPositions, startPositions64Low);
        vec3 commonEnd = project_position(endPositions, endPositions64Low);
        float distance = calcDistance();
        nArrows = distance / arrowSize;

        gl_Position = project_position_to_clipspace(usedPositions, usedPositions64Low, vec3(0.), geometry.position);
        DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

        vPositions = positions;
        avgDensity = (startDensity + endDensity) / 2.;
        sDensity = startDensity;
        mDensity = middleDensity;
        eDensity = endDensity;

        geometry.pickingColor = instancePickingColors;
        DECKGL_FILTER_COLOR(vColor, geometry);
    }
`;
