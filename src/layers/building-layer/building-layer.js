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

    updateState(params) {
        super.updateState(params);
        const { props, oldProps } = params;

        if (props.data !== oldProps.data) {
            console.log('loading buildings');
            this._loadBuildings();
        }
    }

    _loadBuildings() {
        const totalBuildings = this.props.data.length;

        this.downloadBuildings(0, totalBuildings, 'http://dashboard');

        // this.downloadBuildings(0, Math.floor(totalBuildings / 3), 'www.snap4city.org');
        // this.downloadBuildings(Math.floor(totalBuildings / 3), Math.floor((totalBuildings / 3) * 2), 'www.snap4solutions.org');
        // this.downloadBuildings(Math.floor((totalBuildings / 3) * 2), totalBuildings, 'www.snap4industry.org');
    }

    downloadBuildings(index, end, domain) {
        let lastIndex = index;
        for (let i = index || 0; i < end; i++) {
            let d = this.props.data[i];
            d.index = i;
            if (d.glb && !d.scenegraph)
                fetchFile(d.glb.replace('https://www.snap4city.org', domain))
                    .then(response => response.arrayBuffer())
                    .then(arrayBuffer => {
                        load(arrayBuffer, GLTFLoader).then(scenegraph => {
                            d.scenegraph = this._updateScenegraph(scenegraph, d.index);
                        });
                    });
            // if (i != 0 && i % 50 == 0) {
            //     lastIndex = i + 1;
            //     break;
            // }
        }
        // if (lastIndex != index && lastIndex < this.props.data.length) {
        //     setTimeout(() => {
        //         this.downloadBuildings(lastIndex, end, domain);
        //     }, 10);
        // }
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
                mat.pbrMetallicRoughness.metallicFactor = 0;
                mat.pbrMetallicRoughness.roughnessFactor = 0.2;
                if (mat.pbrMetallicRoughness.baseColorFactor) {
                    mat.pbrMetallicRoughness.baseColorFactor[0] -= (Math.random()) / 10;
                    mat.pbrMetallicRoughness.baseColorFactor[1] -= (Math.random()) / 10;
                    mat.pbrMetallicRoughness.baseColorFactor[2] += (Math.random() * 2 - 1) / 10;
                }
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
            this._applyAllAttributes(scenegraphElab, index);
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

            scenegraph.traverse(model => {
                this._setModelAttributes(model.model, allAttributes);
            });
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
                const buildingsNode = mainNode.children;

                for (let buildingNode of buildingsNode) {
                    const uPickingColor = this.encodePickingColor(i);
                    // draw
                    buildingNode.traverse((model, { worldMatrix }) => {
                        const uPickingColor = this.encodePickingColor(i);
                        model.model.setInstanceCount(numInstances);
                        model.updateModuleSettings(moduleParameters);
                        model.draw({
                            parameters,
                            uniforms: {
                                picked: d.buildings[j].picked || false,
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