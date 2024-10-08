import { CompositeLayer } from '@deck.gl/core';

import { getSubTiles, tile2lng, tile2lat } from '../../utils/tile-utils';
import { BuildingLayer } from '../building-layer/building-layer';
import { FusionTileLayer, jsonFusionBottomUp, jsonFusionTopDown } from '../fusion-tile-layer/fusion-tile-layer';
import { getURLFromTemplate } from '../../utils/url-template';
import { fetchFile } from '@loaders.gl/core';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import GL from '@luma.gl/constants';
import { Tileset2D, Tileset2DCentered } from '../tileset-2d/tileset-2d';
import { TileLayer } from '@deck.gl/geo-layers';

const defaultProps = {
    ...FusionTileLayer.defaultProps,
    includedTiles: { type: 'array', value: null, async: true }
}

export class BuildingTileLayer extends CompositeLayer {
    static defaultProps = defaultProps;
    worker = new Worker('../widgets/layers/worker.js');

    getTiledBuildingData(tile) {
        const { data, fetch, includedTiles } = this.props;
        let dataPromised = [];
        let tilePromised = [];
        let tiles = [];
        const { x, y, z } = tile.index;
        if (z > 16)
            console.log('z: ', z)
        const subIndices = getSubTiles(x, y, z, 16);
        const { signal } = tile;
        let buildingUrl = data.split('/').slice(0, -1).join('/');
        for (let subIndex of subIndices) {
            const s_x = subIndex[0];
            const s_y = subIndex[1];
            if (includedTiles) {
                let founded = false;
                let x_included = includedTiles[s_x];
                if (x_included) {
                    for (let y_included of x_included) {
                        if (y_included === `${s_y}`) {
                            founded = true;
                            break;
                        }
                    }
                }
                if (!founded) {
                    continue;
                }
            }

            let tile = {
                index: {
                    x: s_x,
                    y: s_y,
                    z: 16
                }
            }
            const modelUrl = getURLFromTemplate(buildingUrl, tile);
            tiles.push(
                {
                    glb: `${modelUrl}/tile.glb`,
                    coord: [tile2lng(s_x, 16), tile2lat(s_y, 16)]
                }
            );
            let promise = fetch(getURLFromTemplate(data, tile),
                { propName: 'data', layer: this, loaders: [], signal }).then((json) => {
                    const modelUrl = getURLFromTemplate(buildingUrl, tile);
                    let buildings = [];
                    for (let d of json) {
                        d.tileUrl = modelUrl;
                    }
                    buildings.push(
                        {
                            buildings: json,
                            glb: `${modelUrl}/tile.glb`,
                            coord: json[0].models[0].coords,
                        }
                    );
                    json = buildings;
                    return buildings;
                }).then((buildings) => {
                    const domains = ['https://www.snap4city.org', 'https://www.snap4solutions.org', 'https://www.snap4industry.org'];
                    let url = buildings[0].glb;
                    if (url.includes('https://www.snap4city.org')) {
                        url = url.replace('https://www.snap4city.org', domains[Math.floor(Math.random() * 10 % 3)]);
                    }
                    return fetchFile(url, { signal })
                        .then(response => response.arrayBuffer())
                        .then(async (arrayBuffer) => {
                            return new Promise((resolve, reject) => {
                                if (window.Worker) {
                                    const worker = new Worker('../widgets/layers/worker.js');
                                    worker.postMessage(arrayBuffer);
                                    worker.onmessage = (message) => {
                                        buildings[0].scenegraph = message.data;
                                        resolve(buildings);
                                    };
                                }
                            });
                        });
                });
            dataPromised.push(promise);
        }
        return Promise.all(dataPromised);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', BuildingLayer);
        const { data } = props;
        const { tile } = props;
        const { x, y, z } = tile.index;

        if (!data)
            return;
        let json = [];
        json = json.concat(...data);

        return new SubLayerClass(props, {
            data: json,
            pickable: true,
            id: `building-layer-${z}-${x}-${y}`,
            getPosition: d => {
                if (Array.isArray(d.coord) && d.coord.length == 2)
                    return [...d.coord, -47.79]
                return [0, 0, 0];
            },
            _lighting: 'pbr',
            // parameters: {
            //     [GL.CULL_FACE]: true,
            // },
            onClick: (info, event) => {
                console.log('sub building clicked', info, event);
            }
        });
    }

    renderLayers() {
        const {
            tileSize,
            maxTiles,
            maxZoom,
            minZoom,
            minTileZoom,
            extent,
            maxRequests,
            onTileLoad,
            onTileUnload,
            onTileError,
            maxCacheSize,
            maxCacheByteSize,
            refinementStrategy,
            maxOffsetZoom,
        } = this.props;
        const { jsonTiles } = this.state;

        return new FusionTileLayer(
            {
                // pickable: true,
                id: `${this.props.id}-tiles`,
                getTileData: this.getTiledBuildingData.bind(this),
                renderSubLayers: this.renderSubLayers.bind(this),
                getFusionCoords: d => d.coord,
                fusionTopDown: (parent, current, index, getFusionCoords) => {
                    let json = [];
                    json = json.concat(...parent);
                    return jsonFusionTopDown(json, current, index, getFusionCoords);
                },
                fusionBottomUP: (child, current, getFusionCoords) => {
                    let json = [];
                    json = json.concat(...child);
                    return jsonFusionBottomUp(json, current, getFusionCoords);
                },
                TilesetClass: Tileset2DCentered,
                tileSize,
                extent,
                maxRequests,
                maxOffsetZoom,
                maxTileZoom: 16,
                minTileZoom,
                maxTiles,
                maxZoom,
                minZoom,
                onTileLoad,
                onTileUnload,
                onTileError,
                maxCacheSize,
                maxCacheByteSize,
                refinementStrategy,
            }
        );
    }
}