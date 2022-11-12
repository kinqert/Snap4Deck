export const fs = `#version 300 es
    #define SHADER_NAME crest-layer-fragment-shader;

    in vec4 vColor;

    void main() {
        gl_FragColor = vColor;
    }
`;