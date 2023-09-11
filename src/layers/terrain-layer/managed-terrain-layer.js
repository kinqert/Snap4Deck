import { COORDINATE_SYSTEM } from "@deck.gl/core";
import { TerrainLayer } from "@deck.gl/geo-layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { OBJLoader } from "@loaders.gl/obj";
import { TerrainWorkerLoader } from "@loaders.gl/terrain";

import { getURLFromTemplate, urlTemplateToUpdateTrigger } from "../../utils/url-template";
import { ManagedTerrainTileLayer } from "./managed-terrain-tileset";
import { TerrainMeshLayer } from "../terrain-mesh-layer/terrain-mesh-layer";
import { WebMercatorViewport } from "@math.gl/web-mercator";
import { FusionTileLayer } from "../fusion-tile-layer/fusion-tile-layer";

const defaultProps = {
    ...TileLayer.defaultProps,
    // Martini error tolerance in meters, smaller number -> more detailed mesh
    meshMaxError: { type: 'number', value: 4.0 },
    // Bounding box of the terrain image, [minX, minY, maxX, maxY] in world coordinates
    bounds: { type: 'array', value: null, optional: true, compare: true },
    // Color to use if texture is unavailable
    color: { type: 'color', value: [255, 255, 255] },
    // Object to decode height data, from (r, g, b) to height in meters
    elevationDecoder: {
        type: 'object',
        value: {
            rScaler: 1,
            gScaler: 0,
            bScaler: 0,
            offset: 0
        }
    },
    // Supply url to local terrain worker bundle. Only required if running offline and cannot access CDN.
    workerUrl: { type: 'string', value: null },
    // Same as SimpleMeshLayer wireframe
    wireframe: false,
    material: true,
    heatmapOpacity: { type: 'number', min: 0, max: 1, value: 0.25 },
    trafficOpacity: { type: 'number', min: 0, max: 1, value: 1 },

    loaders: [TerrainWorkerLoader]
};

const DUMMY_DATA = [1];

export class ProxyTerrain {

    getDataElevation(elevationUrl) {

    }
}

export class ManagedTerrainLayer extends TerrainLayer {
    static defaultProps = defaultProps;
    updateState({
        props,
        oldProps
    }) {
        const elevationDataChanged = props.elevationData !== oldProps.elevationData ||
            props.elevations != oldProps.elevations;
        if (elevationDataChanged) {
            const {
                elevationData,
                elevations
            } = props;
            const isTiled =
                elevationData &&
                (Array.isArray(elevationData) ||
                    (elevationData.includes('{x}') && elevationData.includes('{y}')) ||
                    elevationData.includes('{bbox}')) || elevations;
            this.setState({
                isTiled,
                loadingTileRemaining: 0
            });
        }
        this.setState({
            loadingTileRemaining: 0
        });

        // Reloading for single terrain mesh
        const shouldReload =
            elevationDataChanged ||
            props.meshMaxError !== oldProps.meshMaxError ||
            props.elevationDecoder !== oldProps.elevationDecoder ||
            props.elevations != oldProps.elevations ||
            props.bounds !== oldProps.bounds;

        if (!this.state.isTiled && shouldReload) {
            const terrain = this.loadTerrain(props);
            this.setState({
                terrain
            });
        }

        // TODO - remove in v9
        if (props.workerUrl) {
            log.removed('workerUrl', 'loadOptions.terrain.workerUrl')();
        }
    }

    loadTerrain({
        elevationData,
        bounds,
        elevationDecoder,
        meshMaxError,
        signal
    }) {
        if (!elevationData) {
            return null;
        }
        let loadOptions = this.getLoadOptions();
        loadOptions = {
            ...loadOptions,
            terrain: {
                skirtHeight: this.state.isTiled ? meshMaxError * 2 : 0,
                ...loadOptions.terrain,
                bounds,
                meshMaxError,
                elevationDecoder
            }
        };
        const { fetch } = this.props;
        return fetch(elevationData, { propName: 'elevationData', layer: this, loadOptions, signal });
    }

    getCurrentElevation(elevations, tile) {
        for (let elevation of elevations) {
            if (elevation.bbox == null ||
                elevation.bbox.north > tile.bbox.north &&
                elevation.bbox.east > tile.bbox.east &&
                elevation.bbox.south < tile.bbox.south &&
                elevation.bbox.west < tile.bbox.west
            )
                return elevation
        }
        return null;
    }

    getTiledTerrainData(tile) {
        const {
            elevationData,
            elevations,
            fetch,
            texture,
            elevationDecoder,
            meshMaxError,
            heatmap,
            traffic
        } = this.props;
        const {
            viewport
        } = this.context;
        const {
            loadingTileRemaining
        } = this.state;
        this.setState({ loadingTileRemaining: loadingTileRemaining + 1 });
        const elevation = this.getCurrentElevation(elevations, tile);
        const dataUrl = getURLFromTemplate(elevation.query, tile);
        const textureUrl = getURLFromTemplate(texture, tile);
        const heatmapUrl = getURLFromTemplate(heatmap, tile);
        const trafficUrl = getURLFromTemplate(traffic, tile);

        const {
            bbox,
            signal
        } = tile;
        const bottomLeft = viewport.isGeospatial ?
            viewport.projectFlat([bbox.west, bbox.south]) : [bbox.left, bbox.bottom];
        const topRight = viewport.isGeospatial ?
            viewport.projectFlat([bbox.east, bbox.north]) : [bbox.right, bbox.top];
        const bounds = [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]];

        const terrain = this.loadTerrain({
            elevationData: dataUrl,
            bounds,
            elevationDecoder: elevation.elevationDecoder,
            // meshMaxError: 9,
            meshMaxError: 3,
            signal
        });
        const surface = textureUrl ?
            fetch(textureUrl, {
                propName: 'texture',
                layer: this,
                loaders: [],
                signal
            }).catch(_ => null) :
            Promise.resolve(null);
        const surfaceHeatmap = heatmapUrl ?
            fetch(heatmapUrl, {
                propName: 'heatmap',
                layer: this,
                loaders: [],
                signal
            }).catch(_ => null) :
            Promise.resolve(null);
        const surfaceTraffic = trafficUrl ?
            fetch(trafficUrl, {
                propName: 'traffic',
                layer: this,
                loaders: [],
                signal
            }).catch(_ => null) :
            Promise.resolve(null);

        return Promise.all([terrain, surface, surfaceHeatmap, surfaceTraffic]).then((result) => {
            const {
                loadingTileRemaining
            } = this.state;
            this.setState({ loadingTileRemaining: loadingTileRemaining - 1 });
            return result;
        });
    }

    async waitTileUntilFound(lngLat, resolve) {
        if (resolve) {
            let selectedTile = this.getTileFromLngLat(lngLat);
            if (selectedTile && selectedTile.layers)
                resolve(selectedTile);
            else
                setTimeout(() => this.waitTileUntilFound(lngLat, resolve), 100);
        }
        else 
            return new Promise((resolve) => {
                let selectedTile = this.getTileFromLngLat(lngLat);
                if (selectedTile && selectedTile.layers)
                    resolve(selectedTile);
                else
                    setTimeout(() => this.waitTileUntilFound(lngLat, resolve), 100);
            });
    }

    getTileFromLngLat(lngLat) {
        const tileLayer = this.getSubLayers()[0];
        const { tileset, } = tileLayer.state;
        const [lng, lat] = lngLat;
        for (let tile of tileset._tiles) {
            if (tile.bbox.north >= lat && tile.bbox.south <= lat
                && tile.bbox.east >= lng && tile.bbox.west <= lng) {
                return tile;
            }
        }
    }

    async getAltitude(lngLat, signal) {
        return new Promise(async (resolve, reject) => {
            signal.addEventListener('abort', () => {
                reject();
            });
            const tileLayer = this.getSubLayers()[0];
            const { tileset, } = tileLayer.state;
            const {
                loadingTileRemaining
            } = this.state;
            const viewport = this.context.viewport;
            const [lng, lat] = lngLat;
            const selectedTile = await this.waitTileUntilFound(lngLat);
            if (!selectedTile) {
                console.log('tile not found', tile, tileset);
                resolve(0);
                return;
            }
            if (!selectedTile.layers) {
                console.log('cant get layer', selectedTile);
                resolve(0);
                return;
            }
            const [x1, y1] = viewport.projectPosition(lngLat);
            const vertices = selectedTile.layers[0].props.mesh.attributes.POSITION.value;
            let minDistance;
            let nearestVertex;
            for (let i = 0; i < vertices.length; i += 3) {
                const deltaX = x1 - vertices[i];
                const deltaY = y1 - vertices[i + 1];
                const distance = Math.sqrt((deltaX ** 2) + (deltaY ** 2));
                if (!minDistance) {
                    minDistance = distance;
                    nearestVertex = i;
                } else if (minDistance > distance) {
                    minDistance = distance;
                    nearestVertex = i;
                }
            }
            resolve(vertices[nearestVertex + 2]);
        });
    }

    renderSubLayers(props) {
        // const SubLayerClass = this.getSubLayerClass('mesh', SimpleMeshLayer);
        const SubLayerClass = this.getSubLayerClass('mesh', TerrainMeshLayer);

        const { color, wireframe, material, heatmapOpacity, trafficOpacity } = this.props;
        const { data } = props;

        if (!data) {
            return null;
        }

        const [mesh, texture, heatmap, traffic] = data;

        return new SubLayerClass(props, {
            data: DUMMY_DATA,
            mesh,
            texture,
            heatmap,
            traffic,
            heatmapOpacity,
            trafficOpacity,
            _instanced: false,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            getPosition: d => [0, 0, 0],
            getColor: color,
            wireframe,
            material,
        });
    }

    renderLayers() {
        const {
            color,
            material,
            elevationData,
            elevations,
            texture,
            heatmap,
            traffic,
            heatmapOpacity,
            trafficOpacity,
            wireframe,
            meshMaxError,
            elevationDecoder,
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

        if (this.state.isTiled) {
            return new TileLayer(
                this.getSubLayerProps({
                    id: 'tiles'
                }),
                {
                    getTileData: this.getTiledTerrainData.bind(this),
                    renderSubLayers: this.renderSubLayers.bind(this),
                    updateTriggers: {
                        getTileData: {
                            elevationData: urlTemplateToUpdateTrigger(elevationData),
                            elevations: elevations,
                            texture: urlTemplateToUpdateTrigger(texture),
                            heatmap: urlTemplateToUpdateTrigger(heatmap),
                            traffic: urlTemplateToUpdateTrigger(traffic),
                            meshMaxError,
                            elevationDecoder,
                        },
                        renderSubLayers: {
                            heatmapOpacity,
                            trafficOpacity
                        }
                    },
                    onViewportLoad: this.onViewportLoad.bind(this),
                    zRange: this.state.zRange || null,
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
                    TilesetClass: snap4deck.OrderedTileSet,
                    refinementStrategy
                }
            );
        }

        const SubLayerClass = this.getSubLayerClass('mesh', SimpleMeshLayer);
        return new SubLayerClass(
            this.getSubLayerProps({
                id: 'mesh'
            }),
            {
                loaders: [OBJLoader],
                data: DUMMY_DATA,
                mesh: this.state.terrain,
                texture,
                _instanced: false,
                getPosition: d => [0, 0, 0],
                getColor: color,
                material,
                wireframe
            }
        );
    }
}