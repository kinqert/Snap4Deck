import { CompositeLayer } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';

import { lon2tile, lat2tile } from '../../utils/tile-utils';
import { CachedGLBLayer, waitForGLTFAssets } from '../cached-glb-layer/cached-glb-layer';
import { urlTemplateToUpdateTrigger } from '../../utils/url-template';
import { GLBTileLayer, GLBTileSet } from '../glb-tile-layer/glb-tileset';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { GLTFLoader } from '@loaders.gl/gltf';

const defaultProps = {
    ...TileLayer.defaultProps,
    model: { type: 'string', value: null },
}

async function loadJSONTile(tile, geojson) {
    console.log('loading json');
    const json = [];
    const features = geojson.features;
    for (let feature of features) {
        if (feature.geometry.type !== "Point")
            continue
        const coord = feature.geometry.coordinates;
        const x = lon2tile(coord[0], tile.index.z);
        const y = lat2tile(coord[1], tile.index.z);
        if (tile.index.x == x && tile.index.y == y)
            json.push({ prop: feature.properties, geometry: feature.geometry });
    }
    return json;
}

export class TreeLayer extends CompositeLayer {
    static defaultProps = defaultProps;

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

            console.log('loading json');
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
                jsonTiles[x][y].push({ prop: feature.properties, geometry: feature.geometry });
            }
            this.setState({ jsonTiles });
        }
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
        const gltf = this.state.gltf ? this.state.gltf : fetch(model, {
            propName: 'traffic',
            layer: this,
            loaders: [GLTFLoader],
            signal
        });
        return Promise.all([json, gltf]);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', CachedGLBLayer);
        const { model } = this.props;
        if (!props.data)
            return;
        const [json, gltf] = props.data;
        if (!json || !gltf)
            return;
        if (!this.state.gltf) {
            this.setState(gltf);
        }
        const { tile } = props;
        const { x, y, z } = tile.index;
        // const { jsonTiles } = this.state;
        // if (!jsonTiles.hasOwnProperty(x))
        //     return;
        // if (!jsonTiles[x].hasOwnProperty(y))
        //     return;
        // const json = jsonTiles[x][y]

        // return new SubLayerClass(props, {
        return new SubLayerClass(props, {
            data: json,
            id: `tree-layer-${z}-${x}-${y}`,
            scenegraph: gltf,
            getPosition: d => d.geometry.coordinates,
            _lighting: 'pbr'
        });
    }
    onViewportLoad(tiles) {
        if (!tiles) {
            return;
        }

        const { zRange } = this.state;
        const ranges = tiles
            .map(tile => tile.content)
            .filter(Boolean)
            .map(arr => {
                // @ts-ignore
                const bounds = arr[0].header.boundingBox;
                return bounds.map(bound => bound[2]);
            });
        if (ranges.length === 0) {
            return;
        }
        const minZ = Math.min(...ranges.map(x => x[0]));
        const maxZ = Math.max(...ranges.map(x => x[1]));

        if (!zRange || minZ < zRange[0] || maxZ > zRange[1]) {
            this.setState({ zRange: [minZ, maxZ] });
        }
    }

    renderLayers() {
        const {
            model,
            tileSize,
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
                // renderSubLayers: (props) => {
                //     const { model } = this.props;
                //     // if (!props.data)
                //     //     return;
                //     // const [json] = props.data;
                //     const { tile } = props;
                //     const { jsonTiles } = this.state;
                //     const {x,y,z} = tile.index;
                //     if (!jsonTiles.hasOwnProperty(x))
                //         return;
                //     if (!jsonTiles[x].hasOwnProperty(y))
                //         return;
                //     const json = jsonTiles[x][y]

                //     return new ScenegraphLayer({
                //         id: `tree-layer-${z}-${x}-${y}`,
                //         data: json,
                //         scenegraph: model,
                //         getPosition: d => d.geometry.coordinates,
                //         _lighting: 'pbr'
                //     });
                // },
                // updateTriggers: {
                //     // getTileData: {
                //     //     treeData: urlTemplateToUpdateTrigger(elevationData),
                //     // },
                //     renderSubLayers: {
                //         model,
                //     }
                // },
                // TilesetClass: GLBTileSet,
                // onViewportLoad: this.onViewportLoad.bind(this),
                // zRange: this.state.zRange || null,
                tileSize,
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
            }
        );
    }
}