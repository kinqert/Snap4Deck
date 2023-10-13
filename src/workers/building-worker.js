import { fp64LowPart } from '@deck.gl/core';
import {
    ScenegraphNode,
    createGLTFObjects
} from '@luma.gl/experimental';
import { instrumentGLContext } from '@luma.gl/gltools';

export async function waitForGLTFAssets(gltfObjects) {
    return new Promise(async (resolve, reject) => {
        const remaining = [];

        gltfObjects.scenes.forEach(scene => {
            scene.traverse((model) => {
            Object.values(model.model.getUniforms()).forEach((uniform) => {
                if (uniform.loaded === false) {
                remaining.push(uniform);
                }
            });
            });
        });

        await waitWhileCondition(() => remaining.some(uniform => !uniform.loaded));
        resolve();
    });
}

async function waitWhileCondition(condition) {
  while (condition()) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}

onmessage = (message) => {
    console.log(message.data);
    const canvas = new OffscreenCanvas(400, 400); // Replace with your desired dimensions
    const gl = instrumentGLContext(canvas.getContext('webgl2'));
    const [scenegraph, lastIndexBuilding, data] = message.data;
    console.log('inside worker', gl);
    createSceneGraphs(gl, scenegraph, lastIndexBuilding, data).then((scenegraph) => {
        console.log('scenegraph processed', scenegraph);
        postMessage(scenegraph);
    })

    // const gl = instrumentGLContext(canvas.getContext('webgl'));
    // const scenegraphElab = createSceneGraphs(gl, scenegraph, lastIndexBuilding, data);
    // postMessage(scenegraphElab);
}

async function createSceneGraphs(gl, scenegraph, lastIndexBuilding, data) {
    let scenegraphData = null;

    console.log('updating scenegraph');
    // const canvas = this.deck.canvas()
    if (scenegraph instanceof ScenegraphNode) {
        // Signature 1: props.scenegraph is a proper luma.gl Scenegraph
        scenegraphData = { scenes: [scenegraph] };
    } else if (scenegraph && !scenegraph.gltf) {
        // Converts loaders.gl gltf to luma.gl scenegraph using the undocumented @luma.gl/experimental function
        const gltf = scenegraph;
        // console.log('loading materials');
        for (let mat of gltf.materials) {
            mat.pbrMetallicRoughness.metallicFactor = 0.5;
            mat.pbrMetallicRoughness.roughnessFactor = 1;
        }
        const gltfObjects = createGLTFObjects(gl, gltf, {});
        // const gltfObjects = createGLTFObjects(gl, gltf, this._getModelOptions());
        scenegraphData = { gltf, ...gltfObjects };

        waitForGLTFAssets(gltfObjects); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else if (scenegraph) {
        // DEPRECATED PATH: Assumes this data was loaded through GLTFScenegraphLoader
        scenegraphData = scenegraph;
    }

    const options = { layer: this, gl };
    const scenegraphElab = scenegraphData.scenes[0];
    if (scenegraphElab instanceof ScenegraphNode) {
        _applyAllAttributes(scenegraphElab, lastIndexBuilding, data);
        return scenegraphElab;
    } else if (scenegraphElab !== null) {
        console.warn("invalid scenegraph:", scenegraphElab)();
    }
}

function _applyAllAttributes(scenegraph, lastIndexBuilding, data) {
    const uPositions = [];
    const uPositions64Low = [];

    for (let pos of [...data.coord, -47.79]) {
        uPositions.push(pos - fp64LowPart(pos));
        uPositions64Low.push(fp64LowPart(pos));
    }
    // scenegraph.traverse((model, { worldMatrix }) => {
    //     model.setUniforms({
    //         uPositions,
    //         uPositions64Low
    //     });
    // });
    scenegraph.traverse(model => {
        model.model.setAttributes({
            instancePositions: uPositions,
            instancePositions64Low: uPositions64Low
        });
    });
    const mainNode = scenegraph.children[0];
    let buildingsNode = mainNode.children;
    let i = 0;
    for (let node of buildingsNode) {
        node.traverse((model, { worldMatrix }) => {
            const uPickingColor = encodePickingColor(lastIndexBuilding + i);
            model.model.setAttributes({
                uPickingColor
            });
        });
        i++;
    }
}

function encodePickingColor(i, target = []) {
    target[0] = (i + 1) & 255;
    target[1] = ((i + 1) >> 8) & 255;
    target[2] = (((i + 1) >> 8) >> 8) & 255;
    return target;
  }
