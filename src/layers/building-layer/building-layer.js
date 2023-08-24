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

    getShaders() {
        const modules = [project32, picking];

        if (this.props._lighting === 'pbr') {
            modules.push(pbr);
        }

        return { vs, fs, modules };
    }
    // calculatePosition(position) {
    //     return [11.2558136,43.7695604];
    // }
    // initializeState() {
    //     const attributeManager = this.getAttributeManager();
    //     // attributeManager is always defined for primitive layers
    //     attributeManager.addInstanced({
    //         instancePositions: {
    //             size: 3,
    //             type: GL.DOUBLE,
    //             fp64: this.use64bitPositions(),
    //             accessor: "getPosition",
    //             update: this.calculatePosition,
    //             transition: true
    //         },
    //         instanceColors: {
    //             type: GL.UNSIGNED_BYTE,
    //             size: this.props.colorFormat.length,
    //             accessor: 'getColor',
    //             normalized: true,
    //             defaultValue: [255,255,255,255],
    //             transition: true
    //         },
    //         instanceModelMatrix: MATRIX_ATTRIBUTES
    //     });
    // }

    updateState(params) {
        super.updateState(params);
        const { props, oldProps } = params;

        if (props.data !== oldProps.data) {
            this._loadBuildings();
        }
    }

    _loadBuildings() {
        const totalBuildings = this.props.data.length;

        this.downloadBuildings(0, totalBuildings);
        // this.downloadBuildings(0, totalBuildings, 'http://dashboard');

        // this.downloadBuildings(0, Math.floor(totalBuildings / 3), 'https://www.snap4city.org');
        // this.downloadBuildings(Math.floor(totalBuildings / 3), Math.floor((totalBuildings / 3) * 2), 'https://www.snap4solutions.org');
        // this.downloadBuildings(Math.floor((totalBuildings / 3) * 2), totalBuildings, 'https://www.snap4industry.org');
    }

    downloadBuildings(index, end, domain) {
        // const domains = ['https://www.snap4city.org', 'https://www.snap4solutions.org', 'https://www.snap4industry.org'];
        const domains = ['https://www.snap4city.org', 'https://www.snap4solutions.org', 'https://www.snap4industry.org'];
        let lastIndex = index;
        for (let i = index || 0; i < end; i++) {
            let d = this.props.data[i];
            d.index = i;
            // if (d.glb && !d.scenegraph)
            if (d.glb)
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
            }, 10);
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
            // for (let mat of gltf.materials) {
            //     mat.pbrMetallicRoughness.metallicFactor = 0.2;
            //     mat.pbrMetallicRoughness.roughnessFactor = 1;
            // }
            // gltf.materials[0].pbrMetallicRoughness.baseColorFactor = [0,0,0,1];
            for (let mat of gltf.materials) {
                mat.pbrMetallicRoughness.metallicFactor = 0.5;
                mat.pbrMetallicRoughness.roughnessFactor = 1;
                // if (mat.pbrMetallicRoughness.baseColorFactor) {
                //     mat.pbrMetallicRoughness.baseColorFactor[0] -= (Math.random()) / 10;
                //     mat.pbrMetallicRoughness.baseColorFactor[1] -= (Math.random()) / 10;
                //     mat.pbrMetallicRoughness.baseColorFactor[2] += (Math.random() * 2 - 1) / 10;
                // }
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
        // const animator = props.getAnimator(scenegraphData, options);

        if (scenegraphElab instanceof ScenegraphNode) {
            this._deleteScenegraph();
            // this._applyAllAttributes(scenegraphElab, index);
            // this._applyAnimationsProp(scenegraph, animator, props._animations);
            // this.setState({ scenegraph, animator });
            return scenegraphElab;
        } else if (scenegraphElab !== null) {
            console.warn("invalid scenegraph:", scenegraphElab)();
        }
    }

    _applyAllAttributes(scenegraph, index) {
        if (this.state.attributesAvailable) {
            const allAttributes = this.getAttributeManager().getAttributes();

            // const mainNode = scenegraph.children[0];
            // let buildingsNode = mainNode;

            console.log('applying attributes');
            delete allAttributes.instancePositions;
            scenegraph.traverse(model => {
                this._setModelAttributes(model.model, allAttributes);
            });
            // buildingsNode.traverse(model => {
            //     console.log('inside traverse');
            //     let attributes = Object.assign({}, allAttributes);
            //     for (let key in allAttributes) {
            //         // attributes[key] = {...allAttributes[key]};
            //         let value = [];
            //         for (let i = index; i < index + allAttributes[key].size; i++) 
            //             value.push(allAttributes[key].value[i]);
            //         attributes[key].value = new allAttributes[key].value.constructor(value);
            //         attributes.updateBuffer
            //     }
            //     attributes.update(this.props.data[index]);
            //     this.getAttributeManager().update({
            //         data: this.props.data[index],
            //         numInstance: 1,
            //         startIndices: [index],
            //         startIndex: index,
            //     });
            //     this.getAttributeManager().update({
            //         data: this.props.data[index],
            //         numInstances: 1,
            //         props: this.props,
            //         transitions: this.props.transitions,
            //         // @ts-ignore (TS2339) property attribute is not present on some acceptable data types
            //         buffers: this.props.data.attributes,
            //         context: this
            //     });
            //     let modelAttributes = this.getAttributeManager().getAttributes();
            //     this._setModelAttributes(model.model, modelAttributes);
            //     // this._setModelAttributes(model.model, allAttributes);
            // });
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
        // const numInstances = this.getNumInstances();
        const numInstances = 1;
        let i = 0;
        for (let d of this.props.data) {
            let j = 0;
            if (d.scenegraph) {
                const uPositions = [];
                const uPositions64Low = [];
                for (let pos of this.props.getPosition(d)) {
                    uPositions.push(pos - fp64LowPart(pos));
                    uPositions64Low.push(fp64LowPart(pos));
                }

                const mainNode = d.scenegraph.children[0];
                let buildingsNode = mainNode.children;

                if (!d.buildings) {
                    buildingsNode = [d.scenegraph];
                }
                // d.scenegraph.traverse((model, { worldMatrix }) => {
                //     // const uPickingColor = this.encodePickingColor(i);
                //     model.model.setInstanceCount(numInstances);
                //     model.updateModuleSettings(moduleParameters);
                //     model.draw({
                //         parameters,
                //         uniforms: {
                //             // picked: picked || false,
                //             sizeScale,
                //             opacity,
                //             sizeMinPixels,
                //             sizeMaxPixels,
                //             composeModelMatrix: shouldComposeModelMatrix(viewport, coordinateSystem),
                //             sceneModelMatrix: worldMatrix,
                //             u_Camera: model.model.getUniforms().project_uCameraPosition
                //         }
                //     });
                // });
                for (let buildingNode of buildingsNode) {
                    const uPickingColor = this.encodePickingColor(i);
                    const picked = d.buildings ? d.buildings[j].picked : d.picked;
                    // draw
                    buildingNode.traverse((model, { worldMatrix }) => {
                        // const uPickingColor = this.encodePickingColor(i);
                        model.model.setInstanceCount(numInstances);
                        model.updateModuleSettings(moduleParameters);
                        model.draw({
                            parameters,
                            uniforms: {
                                picked: picked || false,
                                uPositions,
                                uPositions64Low,
                                uPickingColor,
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
                    i++;
                    j++;
                }
            }
        }
    }
}