import { CompositeLayer } from '@deck.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { load } from '@loaders.gl/core';
import { fetchFile } from '@loaders.gl/core';
import GL from '@luma.gl/constants';

import { lon2tile, lat2tile, getSubTiles, tile2lng, tile2lat } from '../../utils/tile-utils';
import { BuildingLayer } from '../building-layer/building-layer';
import { GLBTileLayer } from '../glb-tile-layer/glb-tileset';
import { FusionTileLayer, geojsonFusionBottomUp, geojsonFusionTopDown, jsonFusionBottomUp, jsonFusionTopDown } from '../fusion-tile-layer/fusion-tile-layer';
import { getURLFromTemplate } from '../../utils/url-template';
import { TileLayer } from '@deck.gl/geo-layers';

const defaultProps = {
    ...FusionTileLayer.defaultProps,
    includedTiles: { type: 'array', value: null, async: true }
}

export class BuildingTileLayer extends CompositeLayer {
    static defaultProps = defaultProps;

    getTiledBuildingData(tile) {
        const { data, fetch, includedTiles } = this.props;
        let dataPromised = [];
        let tilePromised = [];
        let tiles = [];
        const { x, y, z } = tile.index;
        const subIndices = getSubTiles(x, y, z, 18);
        const { signal } = tile;
        let buildingUrl = data.split('/').slice(0, -1).join('/');
        // buildingUrl = buildingUrl.replace('https://www.snap4city.org', 'http://dashboard');
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
                    z: 18
                }
            }
            const modelUrl = getURLFromTemplate(buildingUrl, tile);
            tiles.push(
                {
                    glb: `${modelUrl}/tile.glb`,
                    coord: [tile2lng(s_x, 18), tile2lat(s_y, 18)]
                }
            );
            // let promise = fetch(getURLFromTemplate(data.replace('https://www.snap4city.org', 'http://dashboard'), tile),
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
                            // coord: [tile2lng(s_x, 18), tile2lat(s_y, 18)]
                        }
                    );
                    json = buildings;
                    return buildings;
                });
            dataPromised.push(promise);
        }
        return Promise.all(dataPromised);
        // return Promise.all(dataPromised).then((res) => {
        //     let tiles = [];
        //     for (let i = 0; i < res.length; i++) {
        //         const subIndex = subIndices[i];
        //         const s_x = subIndex[0];
        //         const s_y = subIndex[1];
        //         let tile = {
        //             index: {
        //                 x: s_x,
        //                 y: s_y,
        //                 z: 18
        //             }
        //         }
        //         const modelUrl = getURLFromTemplate(buildingUrl, tile);
        //         console.log('getting tile building')
        //         tiles.push(
        //             {
        //                 buildings: res[i],
        //                 glb: `${modelUrl}/tile.glb`,
        //                 coord: [tile2lng(s_x, 18), tile2lat(s_y, 18)]
        //             }
        //         );
        //     }
        //     return tiles;
        // });
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', BuildingLayer);
        const { data } = props;
        if (!data)
            return;
        let json = [];
        json = json.concat(...data);

        const { tile } = props;
        const { x, y, z } = tile.index;

        // if (z == 17 && json.length > 4) {
        //     console.warn('error in layer');
        //     console.warn('parent tile ', x, y, z);

        //     for (let d of json) {
        //         console.warn('child tile 18 ', lon2tile(d.coord[0], 18), lat2tile(d.coord[1], 18))
        //         console.warn('child tile 17 ', lon2tile(d.coord[0], 17), lat2tile(d.coord[1], 17))
        //     }
        // }

        return new SubLayerClass(props, {
            data: json,
            pickable: true,
            id: `building-layer-${z}-${x}-${y}`,
            getPosition: d => {
                if (Array.isArray(d.coord) && d.coord.length == 2)
                    return [...d.coord, -47.79]
                // if (Array.isArray(d.usedModel.coords) && d.usedModel.coords.length == 2)
                //     return [...d.usedModel.coords, -47.79]
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
            extent,
            maxRequests,
            onTileLoad,
            onTileUnload,
            onTileError,
            maxCacheSize,
            maxCacheByteSize,
            refinementStrategy
        } = this.props;
        const { jsonTiles } = this.state;

        return new FusionTileLayer(
            // this.getSubLayerProps({
            //     id: 'tiles'
            // }),
            {
                // pickable: true,
                id: `${this.props.id}-tiles`,
                getTileData: this.getTiledBuildingData.bind(this),
                renderSubLayers: this.renderSubLayers.bind(this),
                getFusionCoords: d => d.coord,
                // getFusionCoords: d => d.usedModel.coords,
                fusionTopDown: (parent, current, index, getFusionCoords) => {
                    let json = [];
                    json = json.concat(...parent);
                    return jsonFusionTopDown(json, current, index, getFusionCoords);
                },
                fusionBottomUP: (parent, current, getFusionCoords) => {
                    let json = [];
                    json = json.concat(...parent);
                    return jsonFusionBottomUp(json, current, getFusionCoords);
                },
                tileSize,
                // maxTiles,
                // maxZoom,
                // minZoom,
                // minZoom: 18,
                minTileZoom: 14,
                extent,
                maxRequests,
                onTileLoad,
                onTileUnload,
                onTileError,
                maxCacheSize,
                maxCacheByteSize,
                refinementStrategy,
                // deepLoad: 18
            }
        );
    }
}