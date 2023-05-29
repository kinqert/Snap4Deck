export const fs = `#version 300 es
    #define SHADER_NAME crest-layer-fragment-shader;

    in vec4 vColor;
    in vec3 vPositions;
    in float vDensity;
    in float avgDensity;
    in float sDensity;
    in float mDensity;
    in float eDensity;
    in float vMetersDistance;
    in float nArrows;

    uniform float currentTime;
    uniform bool isAnimated;
    uniform float arrowSize;
    uniform float minHeight;
    uniform float maxHeight;

    
    out vec4 oColor;

    float modulo(float x, float y) {
        return x - (y * floor(x/y));
    }

    void main() {
        oColor = vColor;

        if (isAnimated) {
            // animations
            float maxTime = 12500.;
            float minTime = 250.;
            // setting total time by density (speed)
            float time = ((maxTime - minTime) * avgDensity) + minTime;
            // 0 -> time
            float relativeTime = modulo(currentTime, time);
            // 0 -> 1
            float timeDensity = relativeTime / time;
            
            // making arrow
            float arrowPosition = modulo(vPositions.x * nArrows, 1.);
            float arrowTimedPosition = modulo(arrowPosition - timeDensity, 1.);
            float percentArrow = 1. - arrowTimedPosition;
            float remainingSpace = 1. - percentArrow;
            bool isInside = vPositions.z >= remainingSpace / 2. && vPositions.z <= remainingSpace / 2. + percentArrow;

            if (isInside) {
                oColor.a = pow(remainingSpace, 1. / 2.2);
            } else {
                discard;
            }
        } else {
            float startChart = vPositions.x < 0.5 ? 0. : 0.5;
            float endChart = vPositions.x < 0.5 ? 0.5 : 1.;
            float sSmt = 1. - smoothstep(startChart, endChart, vPositions.x);
            float eSmt = smoothstep(startChart, endChart, vPositions.x);
            float startDensity = vPositions.x < 0.5 ? sDensity : mDensity;
            float endDensity = vPositions.x < 0.5 ? mDensity : eDensity;
            float relativeSmt = sSmt * startDensity - (1. - eSmt) * endDensity;
            if (vPositions.z > relativeSmt + min(startDensity, endDensity) + (minHeight / maxHeight)) {
                discard;
            }
        }

        // Mostra le colonne divisorie tra una cresta e l'altra (solo per debug)
        // if (vPositions.x <= 0.05 || vPositions.x >= 0.95) {
        //     oColor = vec4(0.,0.,1.,1.);
        // }

        if (oColor.a <= 0.) {
            discard;
        }

        DECKGL_FILTER_COLOR(oColor, geometry);
    }
`;