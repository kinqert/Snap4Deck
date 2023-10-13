import { CompositeLayer } from '@deck.gl/core';
import { getSubTiles, tile2lng, tile2lat } from '../../utils/tile-utils';
import { BuildingLayer } from '../building-layer/building-layer';
import { FusionTileLayer, jsonFusionBottomUp, jsonFusionTopDown } from '../fusion-tile-layer/fusion-tile-layer';
import { getURLFromTemplate } from '../../utils/url-template';
import { fetchFile } from '@loaders.gl/core';
import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import GL from '@luma.gl/constants';
import { Tileset2D, Tileset2DCentered, Tileset2DFixed } from '../tileset-2d/tileset-2d';
import { TileLayer } from '@deck.gl/geo-layers';
import { BuildingFusionLayer } from '../building-layer/building-fusion-layer';
import { WorkersPoolManager } from '../../workers/worker-manager';
import { reject } from 'underscore';
import { PathLayer, TextLayer } from '@deck.gl/layers';

const defaultProps = {
    ...FusionTileLayer.defaultProps,
    includedTiles: { type: 'array', value: null, async: true },
    updatingTileNumber: { type: 'function', value: null, compare: false }
}

export class BuildingFusionTileLayer extends CompositeLayer {
    static defaultProps = defaultProps;

    initializeState(context) {
        super.initializeState(context);
        const workerPool = WorkersPoolManager.initializePool('gltf-loader', 32, this.processUrl);
        this.setState({
            workerPool,
            scenegraphs: new Map(),
        });
    }

    getTiledBuildingData(tile) {
        const { data, fetch, includedTiles } = this.props;
        const { workerPool } = this.state;
        const { x, y, z } = tile.index;
        var promises = [];
        const subIndices = getSubTiles(x, y, z, 16);
        const { signal } = tile;
        let buildingUrlTemplate = data.split('/').slice(0, -1).join('/');
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

            const tile = {
                index: {
                    x: s_x,
                    y: s_y,
                    z: 16
                }
            }

            const tileUrl = getURLFromTemplate(buildingUrlTemplate, tile);
            const promise = new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                    reject()
                })
                fetch(`${tileUrl}/models.json`, { propName: 'data', layer: this, loaders: [], signal })
                    .then((json) => {
                        for (let d of json) {
                            d.tileUrl = `${tileUrl}/models.json`;
                        }
                        var tileData = {
                            tile,
                            buildings: json,
                            glb: `${tileUrl}/tile.glb`,
                            coord: json[0].models[0].coords,
                        };
                        // json = tileData;
                        return tileData;
                    })
                    .then((tileData) => {
                        let url = tileData.glb;
                        if (url.includes('https://www.snap4city.org')) {
                            const domains = [
                                // 'https://www.snap4city.org',
                                'https://www.snap4solutions.org',
                                'https://www.snap4industry.org'
                            ];
                            url = url.replace('https://www.snap4city.org', domains[Math.floor(Math.random() * 10 % domains.length)]);
                        } else {
                            const domains = [
                                'http://a.dashboard/dashboardSmartCity/',
                                'http://b.dashboard/dashboardSmartCity/',
                            ];
                            url = url.replace('../', domains[Math.floor(Math.random() * 10 % domains.length)]);
                        }
                        fetchFile(url, { signal })
                            .then(response => response.arrayBuffer())
                            .then((arrayBuffer) => {
                                const index = WorkersPoolManager._searchFreeThread(workerPool.pool);
                                const worker = workerPool.pool[index];
                                signal.addEventListener('abort', () => {
                                    console.log('aborting');
                                    worker.postMessage({
                                        action: 'abort',
                                    });
                                    worker.busy = false;
                                })
                                worker.busy = true;
                                worker.postMessage({
                                    action: 'start',
                                    arrayBuffer
                                });
                                worker.onmessage = (message) => {
                                    tileData.scenegraph = message.data;
                                    const tileKey = `${tile.index.x}-${tile.index.y}-${tile.index.z}`;
                                    tileData.key = tileKey;
                                    worker.busy = false;
                                    resolve(tileData);
                                };
                            });
                    });
            });
            promises.push(promise)
        }

        return Promise.all(promises);
    }

    finalizeState(context) {
        super.finalizeState(context);
        WorkersPoolManager.terminatePool(this.state.workerPool);
    }

    renderSubLayers(props) {
        const SubLayerClass = this.getSubLayerClass('mesh', BuildingFusionLayer);
        const { data } = props;
        const { tile } = props;
        const { x, y, z } = tile.index;
        const {
            bbox: { west, south, east, north }
        } = props.tile;
        if (!data)
            return;
        let json = [];
        json = json.concat(...data);

        var sc = 0;
        for (let d of data) {
            if (this.state.scenegraphs.has(d.key))
                sc += 1;
            if (d.scenegraph)
                sc += 1;
        }

        var layers = [
            new SubLayerClass(props, {
                data: json,
                pickable: this.props.pickable,
                id: `building-layer-${z}-${x}-${y}`,
                getPosition: d => {
                    if (Array.isArray(d.coord) && d.coord.length == 2)
                        return [...d.coord, -47.79]
                    return [0, 0, 0];
                },
                _lighting: 'pbr',
                getScenegraph: (key) => {
                    const { scenegraphs } = this.state;
                    return scenegraphs.get(key);
                },
                setScenegraph: (key, scenegraph) => {
                    const { scenegraphs } = this.state;
                    if (scenegraphs.get(key)) {
                        console.warn('Deleting duplicate scenegraph', key);
                        scenegraph.delete();
                        return;
                    }
                    scenegraphs.set(key, scenegraph);
                    this.setState({ scenegraphs });
                },
                removeScenegraph: (key) => {
                    const { scenegraphs } = this.state;
                    console.log('removing scenegraph')
                    const [x, y, z] = key.split('-').map((str) => parseInt(str));
                    const cache = this.internalState.subLayers[0].state.tileset._cache;
                    var refX = x;
                    var refY = y;
                    var refZ = z;
                    var tileFound = false;
                    for (let i = z; i >= 0; i--) {
                        if (cache.has(`${refX}-${refY}-${refZ}`)) {
                            tileFound = true;
                            break;
                        }
                        refX = Math.floor(refX / 2);
                        refY = Math.floor(refY / 2);
                        refZ -= 1;
                    }

                    // if (tile > 0) {
                    if (!tileFound) {
                        const scenegraph = scenegraphs.get(key);
                        if (!scenegraph) {
                            console.warn('removing scenegraph not found', key);
                            return;
                        }
                        scenegraph.delete();
                        scenegraphs.delete(key);
                        this.setState({ scenegraphs });
                    }
                },
                // parameters: {
                //     [GL.CULL_FACE]: true,
                // },
                onClick: (info, event) => {
                    console.log('sub building clicked', info, event);
                }
            })
        ];

        if (this.context.deck.props.debugOutput)
            layers.push(
                new PathLayer({
                    id: `${props.id}-border`,
                    data: [
                        [
                            [west, north],
                            [west, south],
                            [east, south],
                            [east, north],
                            [west, north]
                        ]
                    ],
                    parameters: {
                        depthTest: false,
                    },
                    getPath: d => d,
                    getColor: [255, 0, 0],
                    widthMinPixels: 4
                }),
                new TextLayer({
                    id: `${props.id}-info`,
                    data: [{}],
                    background: true,
                    getPosition: () => [(east - west) / 2 + west, (north - south) / 2 + south, 60],
                    getText: () => `dl: ${data.length}\nsc: ${sc}`,
                    getColor: [0, 0, 0],
                    getSize: 24,
                    getAngle: 0,
                    getTextAnchor: 'middle',
                    getAlignmentBaseline: 'top',
                })
            )

        return layers
    }

    updateTileNumber() {
        const tileset = this.internalState.subLayers[0].state.tileset;
        var loadedTile = 0;
        var loadedTile16 = 0;
        var loadedBuildings = 0;
        var visibleTile = 0;
        var visibleTile16 = 0;
        var visibleBuildings = 0;

        for (const tile of tileset._tiles) {
            if (tile._isLoaded) {
                loadedTile += 1;
                const zoomDiff = 16 - tile.zoom;
                loadedTile16 += 1 * (4 ** zoomDiff);
                for (let d of tile.data)
                    loadedBuildings += d.buildings.length;
                if (tile.isVisible) {
                    visibleTile += 1;
                    const zoomDiff = 16 - tile.zoom;
                    visibleTile16 += 1 * (4 ** zoomDiff);
                    for (let d of tile.data)
                        visibleBuildings += d.buildings.length;
                }
            }
        }

        if (this.context.deck.props.debugOutput)
            this.props.updatingTileNumber(loadedTile, loadedTile16, loadedBuildings, visibleTile, visibleTile16, visibleBuildings);
        else
            this.props.updatingTileNumber(null, null, null, null, null, visibleBuildings);
    }

    onTileLoad(tile) {
        this.updateTileNumber();
    }

    onTileUnload(tile) {
        this.updateTileNumber();
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

        return [
            new FusionTileLayer(
                {
                    pickable: this.props.pickable,
                    id: `${this.props.id}-tiles`,
                    getTileData: this.getTiledBuildingData.bind(this),
                    renderSubLayers: this.renderSubLayers.bind(this),
                    statePasstrough: true,
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
                    // maxRequests: 12,
                    TilesetClass: Tileset2D,
                    tileSize,
                    extent,
                    maxOffsetZoom,
                    maxTileZoom: 16,
                    minTileZoom,
                    maxTiles,
                    onTileLoad: this.onTileLoad.bind(this),
                    onTileUnload: this.onTileUnload.bind(this),
                    onTileError,
                    maxCacheSize,
                    maxCacheByteSize,
                    refinementStrategy,
                }
            )
        ];
    }
}