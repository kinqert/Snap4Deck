export const fs = `#version 300 es
    #define SHADER_NAME crest-layer-fragment-shader;

    in vec4 vColor;
    in vec3 vPositions;
    in float vDensity;

    uniform float currentTime;
    
    out vec4 oColor;

    float modulo(float x, float y) {
        return x - (y * floor(x/y));
    }

    void main() {
        oColor = vColor;
        oColor.a = (vPositions.x + 1.) / 2.;

        // animations
        float maxTime = 12000.;
        float minTime = 500.;
        float time = ((maxTime - minTime) * vDensity) + minTime;
        // 0 -> 1000
        float relativeTime = modulo(currentTime, time);
        // 0 -> 1
        float timeDensity = relativeTime / time;
        // float deltaTime = (timeDensity * 0.8) + 0.2;
        oColor.a = modulo(oColor.a - timeDensity, 1.);

        if (oColor.a <= 0.) {
            discard;
        }

        DECKGL_FILTER_COLOR(oColor, geometry);
    }
`;