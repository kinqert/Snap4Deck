import { CompositeLayer } from '@deck.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { load } from '@loaders.gl/core';
import { fetchFile } from '@loaders.gl/core';

import { lon2tile, lat2tile, getSubTiles } from '../../utils/tile-utils';
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
        const { x, y, z } = tile.index;
        const subIndices = getSubTiles(x, y, z, 18);
        const { signal } = tile;
        let buildingUrl = this.props.data.split('/').slice(0, -1).join('/');
        buildingUrl = buildingUrl.replace('https://www.snap4city.org', 'http://dashboard');
        for (let subIndex of subIndices) {
            const s_x = subIndex[0];
            const s_y = subIndex[1];
            if (!includedTiles ||
                (includedTiles.hasOwnProperty(s_x) && includedTiles[s_x].includes(`${s_y}`)
                )) {
                let tile = {
                    index: {
                        x: s_x,
                        y: s_y,
                        z: 18
                    }
                }
                let promise = fetch(getURLFromTemplate(data.replace('https://www.snap4city.org', 'http://dashboard'), tile),
                    { propName: 'data', layer: this, loaders: [], signal });
                promise.then((json) => {
                    const modelUrl = getURLFromTemplate(buildingUrl, tile);
                    let buildings = [];
                    for (let building of json) {
                        building.usedModel = building.models[0];
                        for (let model of building.models) {
                            if (!model.type.includes('LoD3')) {
                                building.usedModel = model;
                                break;
                            }
                        }
                        building.glb = modelUrl + '/' + building.usedModel.path;
                        buildings.push(building);
                    }
                    return buildings;
                });
                dataPromised.push(promise);
            }
        }
        return Promise.all(dataPromised);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', BuildingLayer);
        const { data } = props;
        if (!data)
            return;
        console.log('rendering sub layer');
        let json = [];
        json = json.concat(...data);

        const { tile } = props;
        const { x, y, z } = tile.index;

        return new SubLayerClass(props, {
            data: json,
            pickable: true,
            id: `building-layer-${z}-${x}-${y}`,
            getPosition: d => {
                if (Array.isArray(d.usedModel.coords) && d.usedModel.coords.length == 2)
                    return [...d.usedModel.coords, -47.79]
                return [0,0,0];
            },
            _lighting: 'pbr'
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

        console.log('creating fusion')
        return new FusionTileLayer(
            // this.getSubLayerProps({
            //     id: 'tiles'
            // }),
            {
                // pickable: true,
                id: `${this.props.id}-tiles`,
                getTileData: this.getTiledBuildingData.bind(this),
                renderSubLayers: this.renderSubLayers.bind(this),
                getFusionCoords: d => d.usedModel.coords,
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
                // minTileZoom: 14,
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