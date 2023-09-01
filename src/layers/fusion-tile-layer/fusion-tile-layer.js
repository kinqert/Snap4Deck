import { TileLayer } from "@deck.gl/geo-layers";
import { _GlobeViewport, _flatten as flatten } from "@deck.gl/core";

import { OrderedTileSet } from "../managed-tile-layer/managed-tileset";
import { getURLFromTemplate, getURLFromTemplates } from "../../utils/url-template";
import { getSubTiles, lat2tile, lon2tile, tile2BB, tile2Bbox, getParentTile } from "../../utils/tile-utils";

const defaultProps = {
    ...TileLayer.defaultProps,
    fusionBottomUP: { type: 'function', value: geojsonFusionBottomUp, compare: false },
    fusionTopDown: { type: 'function', value: geojsonFusionTopDown, compare: false },
    fusionPeer: { type: 'function', value: null, compare: false },
    deepLoad: { type: 'number', value: null, compare: false },
    offsetLoad: { type: 'number', value: null, compare: false },
    statePasstrough: { type: 'bool', value: false, compare: false },
    getFusionCoords: { type: 'function', value: null, compare: false },
    maxTiles: {type: 'number', value: null, compare: false},
    minTileZoom: {type: 'number', value: null, compare: false},
    maxOffsetZoom: {type: 'number', value: null, compare: false},
}

export function geojsonFusionTopDown(parent, current, index) {
    // Controllare se è un geojson valido?
    const { x, y, z } = index;
    const isArray = Array.isArray(parent);
    if (!current)
        current = isArray ? [] : {};
    if (!current.hasOwnProperty('features') && !isArray)
        current.features = [];
    if (parent) {
        const features = isArray ? parent : parent.features;
        for (let feature of features) {
            const geometry = feature.geometry;
            const coordinates = geometry.type === "Point" ? geometry.coordinates : geometry.coordinates[0];
            const [lng, lat] = coordinates.slice(0, 2);
            const x1 = lon2tile(lng, z);
            const y1 = lat2tile(lat, z);
            if (x == x1, y == y1) {
                isArray ? current.push(feature) : current.features.push(feature);
            }
        }
    }
    return current;
}

export function geojsonFusionBottomUp(child, current) {
    // Controllare se è un geojson valido?
    const isArray = Array.isArray(child);
    if (!current)
        current = isArray ? [] : {};
    if (!current.hasOwnProperty('features') && !isArray)
        current.features = [];
    if (child)
        isArray ? current.push(...child) : current.features.push(...child.features)
    return current;
}

export function jsonFusionTopDown(parent, current, index, getFusionCoords) {
    const { x, y, z } = index;
    if (!current || !Array.isArray(current))
        current = [];
    if (parent && Array.isArray(parent)) {
        for (let d of parent) {
            try {
                const [lng, lat] = getFusionCoords(d);
                const x1 = lon2tile(lng, z);
                const y1 = lat2tile(lat, z);
                if (x == x1, y == y1) {
                    current.push(d);
                }
            } catch {
                console.error('error parsing', d)
            }
        }
    }
    return current;
}

export function jsonFusionBottomUp(child, current, getFusionCoords) {
    if (!current || !Array.isArray(current))
        current = [];
    if (child)
        current.push(...child)
    return current;
}

export class FusionTileLayer extends TileLayer {
    static defaultProps = defaultProps;

    _getTilesetOptions() {
        const {
            tileSize,
            maxCacheSize,
            maxCacheByteSize,
            refinementStrategy,
            extent,
            maxZoom,
            minZoom,
            maxRequests,
            zoomOffset,
            maxTiles,
            minTileZoom,
            maxOffsetZoom
        } = this.props;

        return {
            maxCacheSize,
            maxCacheByteSize,
            maxZoom,
            minZoom,
            tileSize,
            refinementStrategy,
            extent,
            maxRequests,
            zoomOffset,
            maxTiles,
            minTileZoom,
            maxOffsetZoom,

            getTileData: this.getTileData.bind(this),
            onTileLoad: this._onTileLoad.bind(this),
            onTileError: this._onTileError.bind(this),
            onTileUnload: this._onTileUnload.bind(this)
        };
    }

    getCachedTile(tile) {
        const { x, y, z } = tile.index;
        const { tileset } = this.state;
        const cache = tileset._cache.get(`${x}-${y}-${z}`);
        if (cache && cache.content)
            return cache;
        return null;
    }

    _fusionProcessChild(fusionedTile, tile, signal) {
        const { data, fusionBottomUP, deepLoad, getTileData, offsetLoad, getFusionCoords } = this.props;
        const { x, y, z } = tile.index;
        const { tileset } = this.state;
        const child = tileset._cache.get(`${x}-${y}-${z}`);

        let subTiles = [];
        if (!offsetLoad && deepLoad && deepLoad > z) {
            subTiles = getSubTiles(x, y, z, deepLoad);
        }
        if (child && child.content && Object.keys(child.content).length > 0) {
            return [fusionBottomUP(child.content, fusionedTile, getFusionCoords), true];
        } else {
            let promised = [];
            if (offsetLoad) {
                tile.index.z = offsetLoad;
                promised.push(getTileData({ url: getURLFromTemplates(data, tile), signal, ...tile }));
            } else if (subTiles.length > 0) {
                for (let subTile of subTiles) {
                    const subTileProp = {
                        index: { x: subTile[0], y: subTile[1], z: deepLoad },
                        bbox: tile2Bbox(subTile[0], subTile[1], deepLoad),
                    }
                    promised.push(getTileData({ url: getURLFromTemplates(data, subTileProp), signal, ...subTileProp }));
                }
            } else {
                promised.push(getTileData({ url: getURLFromTemplates(data, tile), signal, ...tile }));
            }
            return [promised, false];
        }
    }

    _fusionBottomUp(fusionedTile, x, y, z, deepLevel, signal) {
        const { fusionBottomUP, getFusionCoords, deepLoad } = this.props;
        const [x1, y1, z1] = [x * 2, y * 2, z + 1];
        let promised = [];

        const childProp1 = {
            index: { x: x1, y: y1, z: z1 },
            bbox: tile2Bbox(x1, y1, z1),
        };
        const childProp2 = {
            index: { x: x1 + 1, y: y1, z: z1 },
            bbox: tile2Bbox(x1 + 1, y1, z1),
        };
        const childProp3 = {
            index: { x: x1, y: y1 + 1, z: z1 },
            bbox: tile2Bbox(x1, y1 + 1, z1),
        };
        const childProp4 = {
            index: { x: x1 + 1, y: y1 + 1, z: z1 },
            bbox: tile2Bbox(x1 + 1, y1 + 1, z1),
        };
        if (!deepLoad &&
            !this.getCachedTile(childProp1) &&
            !this.getCachedTile(childProp2) &&
            !this.getCachedTile(childProp3) &&
            !this.getCachedTile(childProp4)
        )
            return null;

        let result, cached;
        [result, cached] = this._fusionProcessChild(fusionedTile, childProp1, signal);
        !cached ? promised.push(...result) : fusionedTile = result;
        [result, cached] = this._fusionProcessChild(fusionedTile, childProp2, signal);
        !cached ? promised.push(...result) : fusionedTile = result;
        [result, cached] = this._fusionProcessChild(fusionedTile, childProp3, signal);
        !cached ? promised.push(...result) : fusionedTile = result;
        [result, cached] = this._fusionProcessChild(fusionedTile, childProp4, signal);
        !cached ? promised.push(...result) : fusionedTile = result

        if (promised.length > 0) {
            return Promise.all(promised).then((res) => {
                for (let data of res) {
                    if (data)
                        fusionedTile = fusionBottomUP(data, fusionedTile, getFusionCoords);
                }
                return fusionedTile;
            });
        }
        if (Object.keys(fusionedTile).length > 0)
            return fusionedTile;
    }

    updateCommonState(tile) {
        const { statePasstrough } = this.props;
        let state = [];

        if (statePasstrough) {
            if (Array.isArray(tile.layers))
                for (let layer of tile.layers)
                    state.push(layer.state);
            else
                state = tile.state;
            this.setState({ commonState: state });
        }
    }

    getTileData(tile) {
        const { data, getTileData, fetch, fusionBottomUP, fusionTopDown, statePasstrough, deepLoad, getFusionCoords, offsetLoad } = this.props;
        const { tileset, commonState, lastViewZoom } = this.state;
        const { signal } = tile;
        const { viewport } = this.context;
        const { x, y, z } = tile.index;

        let jumpZoom = 1;
        if (!lastViewZoom)
            this.setState({ lastViewZoom: viewport.zoom });
        else {
            jumpZoom = Math.abs(Math.floor(lastViewZoom) - Math.floor(viewport.zoom));
            if (jumpZoom >= 1)
                console.log('need to jump');
            else if (jumpZoom == 0) {
                const dataTile = tileset._cache.get(`${x}-${y}-${z}`);
                if (dataTile && dataTile.content)
                    return dataTile;
                else
                    jumpZoom = 1;
            }
        }

        if (offsetLoad) {
            tile.url =
                typeof data === 'string' || Array.isArray(data) ? getURLFromTemplates(data, { ...tile, index: { ...tile.index, z: offsetLoad } }) : null;
        } else {
            tile.url =
                typeof data === 'string' || Array.isArray(data) ? getURLFromTemplates(data, tile) : null;
        }

        // TOP -> DOWN
        let [parent_x, parent_y] = getParentTile(x, y, z, z - jumpZoom);
        let parentTile = tileset._cache.get(`${parent_x}-${parent_y}-${z - jumpZoom}`);
        if (parentTile && parentTile.content) {
            return fusionTopDown(parentTile.content, {}, { x, y, z }, getFusionCoords);
        }

        // BOTTOM -> UP
        const deepLevel = deepLoad ? deepLoad : z + 1;
        let fusionedTile = {};
        fusionedTile = this._fusionBottomUp(fusionedTile, x, y, z, deepLevel, signal);
        if (fusionedTile)
            return fusionedTile;

        if (getTileData) {
            return getTileData(tile);
        }
        if (fetch && tile.url) {
            return fetch(tile.url, { propName: 'data', layer: this, signal });
        }
        return null;
    }

    renderLayers() {
        const { viewport } = this.context;
        this.setState({ lastViewZoom: viewport.zoom });
        const tiles = this.state.tileset.tiles
            .map((tile) => {
                const subLayerProps = this.getSubLayerPropsByTile(tile);
                // cache the rendered layer in the tile
                if (!tile.isLoaded && !tile.content) {
                    // nothing to show
                } else if (!tile.layers) {
                    const { commonState } = this.state;
                    const layers = this.renderSubLayers({
                        ...this.props,
                        id: `${this.id}-${tile.id}`,
                        data: tile.content,
                        _offset: 0,
                        tile,
                        commonState,
                        updateCommonState: (state) => {
                            this.setState({
                                commonState: {
                                    ...this.state.commonState,
                                    ...state
                                }
                            });
                        }
                    });

                    tile.layers = flatten(layers, Boolean).map((layer) =>
                        layer.clone({
                            tile,
                            ...subLayerProps,
                        })
                    );
                } else if (subLayerProps && tile.layers[0] && Object.keys(subLayerProps).some((propName) => {
                    if (subLayerProps && tile.layers[0].props)
                        tile.layers[0].props[propName] !== subLayerProps[propName]
                })) {
                    tile.layers = tile.layers.map((layer) => layer.clone(subLayerProps));
                }
                return tile.layers;
            });
        return tiles;
    }
}