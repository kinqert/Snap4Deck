import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import { Layer, project32, picking, log, fp64LowPart } from '@deck.gl/core';
import { isWebGL2 } from '@luma.gl/core';
import { pbr } from '@luma.gl/shadertools';
import {
    ScenegraphNode,
    GroupNode,
    GLTFAnimator,
    GLTFEnvironment,
    createGLTFObjects
} from '@luma.gl/experimental';
import { load } from '@loaders.gl/core';
import { fetchFile } from '@loaders.gl/core';
import GL from '@luma.gl/constants';
import { GLTFLoader } from '@loaders.gl/gltf';

import { shouldComposeModelMatrix } from '../utils/matrix';
import { waitForGLTFAssets } from '../cached-glb-layer/cached-glb-layer';
import vs from './building-layer-vs';
import fs from './building-layer-fs';

// const RADIAN_PER_DEGREE = Math.PI / 180;
// const modelMatrix = new Float32Array(16);
// const valueArray = new Float32Array(12);
// export const MATRIX_ATTRIBUTES = {
//   size: 12,
//   accessor: ['getOrientation', 'getScale', 'getTranslation', 'getTransformMatrix'],
//   shaderAttributes: {
//     instanceModelMatrix__LOCATION_0: {
//       size: 3,
//       elementOffset: 0
//     },
//     instanceModelMatrix__LOCATION_1: {
//       size: 3,
//       elementOffset: 3
//     },
//     instanceModelMatrix__LOCATION_2: {
//       size: 3,
//       elementOffset: 6
//     },
//     instanceTranslation: {
//       size: 3,
//       elementOffset: 9
//     }
//   },

//   update(attribute, {startRow, endRow}) {
//     // @ts-expect-error: "this" will be bound to a layer when this function is called
//     const {data, getOrientation, getScale, getTranslation, getTransformMatrix} = this.props;

//     const arrayMatrix = Array.isArray(getTransformMatrix);
//     const constantMatrix = arrayMatrix && getTransformMatrix.length === 16;
//     const constantScale = Array.isArray(getScale);
//     const constantOrientation = Array.isArray(getOrientation);
//     const constantTranslation = Array.isArray(getTranslation);

//     const hasMatrix = constantMatrix || (!arrayMatrix && Boolean(getTransformMatrix(data[0])));

//     if (hasMatrix) {
//       attribute.constant = constantMatrix;
//     } else {
//       attribute.constant = constantOrientation && constantScale && constantTranslation;
//     }

//     const instanceModelMatrixData = attribute.value;

//     if (attribute.constant) {
//       let matrix;

//       if (hasMatrix) {
//         modelMatrix.set(getTransformMatrix);
//         matrix = getExtendedMat3FromMat4(modelMatrix);
//       } else {
//         matrix = valueArray;

//         const orientation = getOrientation;
//         const scale = getScale;

//         calculateTransformMatrix(matrix, orientation, scale);
//         matrix.set(getTranslation, 9);
//       }

//       attribute.value = new Float32Array(matrix);
//     } else {
//       let i = startRow * attribute.size;
//       const {iterable, objectInfo} = createIterable(data, startRow, endRow);
//       for (const object of iterable) {
//         objectInfo.index++;
//         let matrix;

//         if (hasMatrix) {
//           modelMatrix.set(
//             constantMatrix ? getTransformMatrix : getTransformMatrix(object, objectInfo)
//           );
//           matrix = getExtendedMat3FromMat4(modelMatrix);
//         } else {
//           matrix = valueArray;

//           const orientation = constantOrientation
//             ? getOrientation
//             : getOrientation(object, objectInfo);
//           const scale = constantScale ? getScale : getScale(object, objectInfo);

//           calculateTransformMatrix(matrix, orientation, scale);
//           matrix.set(constantTranslation ? getTranslation : getTranslation(object, objectInfo), 9);
//         }

//         instanceModelMatrixData[i++] = matrix[0];
//         instanceModelMatrixData[i++] = matrix[1];
//         instanceModelMatrixData[i++] = matrix[2];
//         instanceModelMatrixData[i++] = matrix[3];
//         instanceModelMatrixData[i++] = matrix[4];
//         instanceModelMatrixData[i++] = matrix[5];
//         instanceModelMatrixData[i++] = matrix[6];
//         instanceModelMatrixData[i++] = matrix[7];
//         instanceModelMatrixData[i++] = matrix[8];
//         instanceModelMatrixData[i++] = matrix[9];
//         instanceModelMatrixData[i++] = matrix[10];
//         instanceModelMatrixData[i++] = matrix[11];
//       }
//     }
//   }
// };



const defaultProps = {
    ...ScenegraphLayer.defaultProps,
    // glb: {type: 'object', value: null}
    glb: { type: 'array', value: null, async: true }
}

export class BuildingLayer extends ScenegraphLayer {
    static defaultProps = defaultProps;

    initializeState() {
    }

    getShaders() {
        const modules = [project32, picking];

        if (this.props._lighting === 'pbr') {
            modules.push(pbr);
        }

        return { vs, fs, modules };
    }

    updateState(params) {
        super.updateState(params);
        const { props, oldProps } = params;

        this.setState({lastIndexBuilding: 0});
        if (props.data !== oldProps.data) {
            let index = 0;
            for (let d of props.data) {
                d.scenegraph = this._updateScenegraph(d.scenegraph, index);
                index++;
            }
        }
    }

    _loadBuildings() {
        const totalBuildings = this.props.data.length;

        this.downloadBuildings(0, totalBuildings);
    }

    downloadBuildings(index, end, domain) {
        const domains = ['https://www.snap4city.org', 'https://www.snap4solutions.org', 'https://www.snap4industry.org'];
        let lastIndex = index;
        for (let i = index || 0; i < end; i++) {
            let d = this.props.data[i];
            d.index = i;
            if (d.glb && !d.scenegraph)
                fetchFile(d.glb.replace('https://www.snap4city.org', domains[i % 3]))
                    .then(response => response.arrayBuffer())
                    .then(arrayBuffer => {
                        load(arrayBuffer, GLTFLoader).then(scenegraph => {
                            d.scenegraph = this._updateScenegraph(scenegraph, d.index);
                        });
                    });
            if (i != 0 && i % 100 == 0) {
                lastIndex = i + 1;
                break;
            }
        }
        if (lastIndex != index && lastIndex < this.props.data.length) {
            setTimeout(() => {
                this.downloadBuildings(lastIndex, end, domain);
            }, 1);
        }
    }

    _updateScenegraph(scenegraph, index) {
        const props = this.props;
        const { gl } = this.context;
        let scenegraphData = null;

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
            const gltfObjects = createGLTFObjects(gl, gltf, this._getModelOptions());
            scenegraphData = { gltf, ...gltfObjects };

            waitForGLTFAssets(gltfObjects).then(() => this.setNeedsRedraw()); // eslint-disable-line @typescript-eslint/no-floating-promises
        } else if (scenegraph) {
            // DEPRECATED PATH: Assumes this data was loaded through GLTFScenegraphLoader
            scenegraphData = scenegraph;
        }

        const options = { layer: this, gl };
        const scenegraphElab = props.getScene(scenegraphData, options);

        if (scenegraphElab instanceof ScenegraphNode) {
            this._deleteScenegraph();
            this._applyAllAttributes(scenegraphElab, index);
            return scenegraphElab;
        } else if (scenegraphElab !== null) {
            console.warn("invalid scenegraph:", scenegraphElab)();
        }
    }

    _applyAllAttributes(scenegraph, index) {
        const uPositions = [];
        const uPositions64Low = [];
        var lastIndexBuilding = 0;
        let j = 0;
        for (let d of this.props.data) {
            if (j >= index)
                break;
            lastIndexBuilding += d.buildings.length;
            j++;
        }
        var d = this.props.data[index];
        
        let i = 0;
        for (let pos of this.props.getPosition(d)) {
            uPositions.push(pos - fp64LowPart(pos));
            uPositions64Low.push(fp64LowPart(pos));
        }
        scenegraph.traverse((model, { worldMatrix }) => {
            model.setUniforms({
                uPositions,
                uPositions64Low
            });
        });
        const mainNode = scenegraph.children[0];
        let buildingsNode = mainNode.children;
        for (let node of buildingsNode) {
            node.traverse((model, { worldMatrix }) => {
                const uPickingColor = this.encodePickingColor(lastIndexBuilding + i);
                model.setUniforms({
                    uPickingColor
                });
            });
            i++;
        }

    }

    _deleteScenegraph() {
        const { scenegraph } = this.state;
        if (scenegraph instanceof ScenegraphNode) {
            scenegraph.delete();
        }
    }

    draw({ moduleParameters = null, parameters = {}, context }) {

        if (this.props._animations && this.state.animator) {
            this.state.animator.animate(context.timeline.getTime());
            this.setNeedsRedraw();
        }

        const { viewport } = this.context;
        const { sizeScale, sizeMinPixels, sizeMaxPixels, opacity, coordinateSystem } = this.props;
        const numInstances = 1;
        let i = 0;
        for (let d of this.props.data) {
            let j = 0;
            if (d.scenegraph) {
                const mainNode = d.scenegraph.children[0];
                let buildingsNodes = mainNode.children;
                
                for (let node of buildingsNodes) {
                    let picked = false;
                    for (let building of d.buildings) {
                        if (node.id === `model_${building.ID}`) {
                            picked = building.picked || false;
                            break;
                        }
                    }
                    node.traverse((model, { worldMatrix }) => {
                        model.model.setInstanceCount(numInstances);
                        model.updateModuleSettings(moduleParameters);
                        model.draw({
                            parameters,
                            uniforms: {
                                picked: picked || false,
                                sizeScale,
                                opacity,
                                sizeMinPixels,
                                sizeMaxPixels,
                                composeModelMatrix: shouldComposeModelMatrix(viewport, coordinateSystem),
                                sceneModelMatrix: worldMatrix,
                                u_Camera: model.model.getUniforms().project_uCameraPosition
                            }
                        });
                    });
                }
            }
        }
    }
}