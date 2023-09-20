import { CompositeLayer } from '@deck.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import { load } from '@loaders.gl/core';
import { fetchFile } from '@loaders.gl/core';

import { lon2tile, lat2tile } from '../../utils/tile-utils';
import { CachedGLBLayer } from '../cached-glb-layer/cached-glb-layer';
import { FusionTileLayer, geojsonFusionBottomUp, geojsonFusionTopDown } from '../fusion-tile-layer/fusion-tile-layer';
import { Tileset2D } from '../bundle';

const defaultProps = {
    ...FusionTileLayer.defaultProps,
    model: { type: 'string', value: null },
}

async function loadJSONTile(tile, geojson) {
    const json = [];
    const features = geojson.features;
    for (let feature of features) {
        if (feature.geometry.type !== "Point")
            continue
        const coord = feature.geometry.coordinates;
        const x = lon2tile(coord[0], tile.index.z);
        const y = lat2tile(coord[1], tile.index.z);
        if (tile.index.x == x && tile.index.y == y)
            json.push({ properties: feature.properties, geometry: feature.geometry });
    }
    return json;
}

export class TreeLayer extends CompositeLayer {
    static defaultProps = defaultProps;

    updateState({ props, oldProps, changeFlags }) {
        if (changeFlags.dataChanged) {
            const jsonTiles = {};
            const features = props.data.features;
            for (let feature of features) {
                if (feature.geometry.type !== "Point")
                    continue
                const coord = feature.geometry.coordinates;
                const x = lon2tile(coord[0], 18);
                const y = lat2tile(coord[1], 18);
                if (!jsonTiles.hasOwnProperty(x)) {
                    jsonTiles[x] = {};
                }
                if (!jsonTiles[x].hasOwnProperty(y)) {
                    jsonTiles[x][y] = [];
                }
                jsonTiles[x][y].push({ properties: feature.properties, geometry: feature.geometry });
            }
            this.setState({ jsonTiles });
        }
        if ((props.scenegraph != oldProps.scenegraph || !this.state.GLTFPromise) && props.model) {
            const gltfPromise = fetchFile(props.model)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => {
                    return arrayBuffer
                });

            this.setState({ GLTFPromise: gltfPromise });
        }
    }

    getTiledTreeData(tile) {
        const { fetch, model } = this.props;
        const { signal } = tile;
        const { jsonTiles } = this.state;
        if (!jsonTiles.hasOwnProperty(tile.index.x))
            return;
        if (!jsonTiles[tile.index.x].hasOwnProperty(tile.index.y))
            return;
        const json = jsonTiles[tile.index.x][tile.index.y]
        const gltf = this.state.GLTFPromise;
        return Promise.all([{ features: json }, gltf]);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', CachedGLBLayer);
        const { model } = this.props;
        const { data } = props;
        if (!data || !data[0] || !data[1])
            return;
        const [json, gltf] = data;
        if (!json || json.length == 0)
            return;

        const { tile } = props;
        const { x, y, z } = tile.index;

        const scenegraph = load(this.state.GLTFPromise, GLTFLoader);
        return new SubLayerClass(props, {
            ...this.props,
            data: json.features,
            id: `tree-layer-${z}-${x}-${y}`,
            pickable: true,
            scenegraph: scenegraph,
            getPosition: d => {
                const elevation = d.properties && d.properties.elevation ? d.properties.elevation : 0;
                return [...d.geometry.coordinates, this.props.getElevation(d) || 0];
            },
            _lighting: 'pbr'
        });
    }

    renderLayers() {
        const {
            tileSize,
            maxTiles,
            minTileZoom,
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
        console.log(this.props);

        return new FusionTileLayer(
            // this.getSubLayerProps({
            //     id: 'tiles'
            // }),
            {
                id: `${this.props.id}-tiles`,
                // data: jsonTiles,
                getTileData: this.getTiledTreeData.bind(this),
                renderSubLayers: this.renderSubLayers.bind(this),
                fusionTopDown: (parent, current, index) => {
                    if (!current)
                        current = [[], []];
                    if (!parent || !parent[0] || !parent[1])
                        return;
                    return [geojsonFusionTopDown(parent[0], current[0], index), parent[1]];
                },
                fusionBottomUP: (child, current) => {
                    if (!current)
                        current = [[], []];
                    if (!child || !child[0] || !child[1])
                        return;
                    return [geojsonFusionBottomUp(child[0], current[0]), child[1]];
                },
                tileSize,
                TilesetClass: Tileset2D,
                maxZoom,
                minZoom,
                maxTiles,
                minTileZoom,
                extent,
                maxRequests,
                onTileLoad,
                onTileUnload,
                onTileError,
                maxCacheSize,
                maxCacheByteSize,
                refinementStrategy,
                deepLoad: 18
            }
        );
    }
}