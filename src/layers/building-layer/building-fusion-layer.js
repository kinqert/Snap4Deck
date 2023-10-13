import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import { project32, picking, fp64LowPart } from '@deck.gl/core';
import { pbr } from '@luma.gl/shadertools';
import {
    ScenegraphNode,
    createGLTFObjects
} from '@luma.gl/experimental';

import { shouldComposeModelMatrix } from '../utils/matrix';
import { waitForGLTFAssets } from '../cached-glb-layer/cached-glb-layer';
import vs from './building-layer-vs';
import fs from './building-layer-fs';
import { WorkersPoolManager } from '../../workers/worker-manager';
import { instrumentGLContext } from '@luma.gl/gltools';

const defaultProps = {
    ...ScenegraphLayer.defaultProps,
    glb: { type: 'array', value: null, async: true },
    getScenegraph: { type: 'function', value: null, compare: false},
    setScenegraph: { type: 'function', value: null, compare: false},
    removeScenegraph: { type: 'function', value: null, compare: false},
}

export class BuildingFusionLayer extends ScenegraphLayer {
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

        this.setState({ lastIndexBuilding: 0 });
        if (props.data !== oldProps.data) {
            let index = 0;
            for (let d of props.data) {
                this._updateScenegraph(d.scenegraph, index);
                delete d.scenegraph;
                index++;
            }
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
            // this._deleteScenegraph(index);
            this._applyAllAttributes(scenegraphElab, index);
            const key = this.props.data[index].key;
            this.props.setScenegraph(key, scenegraphElab)
            // const { scenegraphs } = this.state;
            // scenegraphs[index] = scenegraphElab;
            // this.setState({ scenegraphs });
        } else if (scenegraphElab !== null) {
            console.warn("invalid scenegraph:", scenegraphElab)();
        }
    }

    _applyAllAttributes(scenegraph, index) {
        const uPositions = [];
        const uPositions64Low = [];
        var d = this.props.data[index];

        let i = 0;
        for (let pos of this.props.getPosition(d)) {
            uPositions.push(pos - fp64LowPart(pos));
            uPositions64Low.push(fp64LowPart(pos));
        }
        scenegraph.traverse(model => {
            model.model.setAttributes({ instancePositions: uPositions, instancePositions64Low: uPositions64Low, aPicked: [0] });
        });
        const mainNode = scenegraph.children[0];
        let buildingsNode = mainNode.children;
        for (let node of buildingsNode) {
            node.traverse((model, { worldMatrix }) => {
                const uPickingColor = this.encodePickingColor(i);
                model.setUniforms({
                    uPickingColor
                });
            });
            i++;
        }
    }

    getLastIndexBuilding(index) {
        var lastIndexBuilding = 0;
        let j = 0;
        for (let d of this.props.data) {
            if (j >= index)
                break;
            lastIndexBuilding += d.buildings.length;
            j++;
        }
        return lastIndexBuilding;
    }

    _deleteScenegraph(index) {
        const key = this.props.data[index].key;
        this.props.removeScenegraph(key);
    }

    _deleteScenegraphs() {
        for (let d of this.props.data) {
            const key = d.key;
            console.log('deleting scenegraph', key)
            this.props.removeScenegraph(key);
        }
    }

    finalizeState(context) {
        // super.finalizeState(context);
        console.log('finalizing state');
        this._deleteScenegraphs();
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
        // for (let d of this.props.data) {
        // for (let scenegraph of scenegraphs) {
        for (let d of this.props.data) {
            // if (d.scenegraph) {
            const scenegraph = this.props.getScenegraph(d.key);

            if (scenegraph) {
                // PRINT SCENEGRAPH
                scenegraph.traverse((model, {worldMatrix}) => {
                    model.model.setInstanceCount(1);
                    model.updateModuleSettings(moduleParameters);
                    model.draw({
                        parameters,
                        uniforms: {
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


                // PRINT PER BUILDINGS
                // const mainNode = scenegraph.children[0];
                // let buildingsNodes = mainNode.children;

                // // TODO: probabilmente da cambiare
                // for (let node of buildingsNodes) {
                //     let picked = false;
                //     for (let building of this.props.data[i].buildings) {
                //         if (node.id === `model_${building.ID}`) {
                //             picked = building.picked || false;
                //             break;
                //         }
                //     }
                //     node.traverse((model, { worldMatrix }) => {
                //         model.model.setInstanceCount(numInstances);
                //         model.updateModuleSettings(moduleParameters);
                //         model.draw({
                //             parameters,
                //             uniforms: {
                //                 picked: picked || false,
                //                 sizeScale,
                //                 opacity,
                //                 sizeMinPixels,
                //                 sizeMaxPixels,
                //                 composeModelMatrix: shouldComposeModelMatrix(viewport, coordinateSystem),
                //                 sceneModelMatrix: worldMatrix,
                //                 u_Camera: model.model.getUniforms().project_uCameraPosition
                //             }
                //         });
                //     });
                // }
            }
            // i++;
        }
    }
}