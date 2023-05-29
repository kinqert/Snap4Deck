import { CompositeLayer } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';

import { lon2tile, lat2tile } from '../../utils/tile-utils';
import { CachedGLBLayer, waitForGLTFAssets } from '../cached-glb-layer/cached-glb-layer';
import { urlTemplateToUpdateTrigger } from '../../utils/url-template';
import { GLBTileLayer, GLBTileSet } from '../glb-tile-layer/glb-tileset';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { GLTFLoader } from '@loaders.gl/gltf';

const defaultProps = {
    ...GLBTileLayer.defaultProps,
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

    // initializeState() {
    //     fetch(props.model, {
    //         propName: 'tree',
    //         layer: this,
    //         loaders: [GLTFLoader],
    //         signal
    //     }).then((gltf) => this.setState({gltf}));
    // }
    updateState({ props, oldProps, changeFlags }) {
        if (changeFlags.dataChanged) {
            // const json = [];
            // const features = props.data.features;
            // for (let feature of features) {
            //     json.push({ prop: feature.properties, geometry: feature.geometry });
            // }
            // this.setState({
            //     json
            // });

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

        // if (props.model !== oldProps.model) {
        //     const gltf = this.props.fetch(props.model, {
        //         propName: 'tree',
        //         layer: this,
        //         loaders: [GLTFLoader],
        //     }).then((gltf) => this.setState({gltf: Object.assign({}, gltf)}));
        //     // this.setState({gltf});
        // }
    }

    // getTiledTreeData(tile) {
    //     console.log('getTiledData');
    //     const { data, fetch, model } = this.props;
    //     const { signal } = tile;
    //     const json = loadJSONTile(tile, data);
    //     const gltf = this.state.gltf ? this.state.gltf : fetch(model, {
    //         propName: 'traffic',
    //         layer: this,
    //         loaders: [GLTFLoader],
    //         signal
    //     });
    //     return Promise.all([json, gltf]);
    // }

    getTiledTreeData(tile) {
        const { fetch, model } = this.props;
        const { signal } = tile;
        const { jsonTiles } = this.state;
        if (!jsonTiles.hasOwnProperty(tile.index.x))
            return;
        if (!jsonTiles[tile.index.x].hasOwnProperty(tile.index.y))
            return;
        const json = jsonTiles[tile.index.x][tile.index.y]
        const gltf = this.state.gltf ? Promise.resolve(Object.assign({}, this.state.gltf)) : fetch(model, {
            propName: 'tree',
            layer: this,
            loaders: [GLTFLoader],
            signal
        });
        // gltf.then((gltf) => this.setState({gltf}));
        // return Promise.all([json, this.state.gltf]);
        return Promise.all([json, gltf]);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', CachedGLBLayer);
        const { model } = this.props;
        if (!props.data)
            return;
        const [json, gltf] = props.data;
        // const [json, gltf] = props.data;
        if (!json)
            return;
        // if (!this.state.gltf) {
        //     console.log('glb not in state');
        //     // this.setState({ gltf });
        // }
        // else {
        //     console.log('gltf state already saved', gltf);
        //     // gltf = this.state.gltf;
        // }
        const { tile } = props;
        const { x, y, z } = tile.index;

        return new SubLayerClass(props, {
            data: json,
            id: `tree-layer-${z}-${x}-${y}`,
            // scenegraph: gltf,
            // scenegraph: JSON.parse(JSON.stringify(this.state.gltf)),
            scenegraph: Object.assign({}, gltf),
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

        return new GLBTileLayer(
            this.getSubLayerProps({
                id: 'tiles'
            }),
            {
                id: `${this.props.id}-tiles`,
                getTileData: this.getTiledTreeData.bind(this),
                renderSubLayers: this.renderSubLayers.bind(this),
                tileSize,
                maxTiles,
                maxZoom,
                minZoom,
                minTileZoom: 14,
                extent,
                maxRequests,
                onTileLoad,
                onTileUnload,
                onTileError,
                maxCacheSize,
                maxCacheByteSize,
                refinementStrategy
            }
        );
    }
}