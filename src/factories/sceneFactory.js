import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { GLBTileSet } from "../layers/glb-tile-layer/glb-tileset";

export function createSceneGraphLayer(props) {
    const {position, scenegraph} = props;
    const name = scenegraph.split("/").pop();
    return new ScenegraphLayer({
        id: `${name.replace('.', '-')}-scene-layer`,
        data: [{
            position
        }],
        pickable: false,
        _lighting: 'pbr',
        getPosition: d => d.position,
        ...props,
    });
}

export function createGridBuildingLayer(props) {
    const {glb} = props;
    return new TileLayer({
        id: 'grid-building-layer',
        tileSize: 256,
        minZoom: 0,
        maxZoom: 18,
        pickable: false,
        renderSubLayers: props => {
            const {x, y, z} = props.tile.index;
            return createSceneGraphLayer({
                id: `grid-building-system-${z}-${x}-${y}`,
                scenegraph: `../widgets/layers/edificato/grid_low_res/${z}/${x}/${y}/model.glb`,
                ...glb
            });
        },
    });
}

const gridBuildingsProp = {
    position: [11.249009513574402, 43.7736035620886, -46.79],
    getOrientation: [0, 0, 0],
    getScale: [0.722, 0.722, 1],
}

export function createHighResGridBuildingLayer(props) {
    return new TileLayer({
        id: 'grid-high-res-building-layer',
        refinementStrategy: 'never',
        tileSize: 256,
        minZoom: 18,
        maxZoom: 18,
        maxCacheSize: 10,
        pickable: false,
        renderSubLayers: props => {
            const {x, y, z} = props.tile.index;
            return createSceneGraphLayer({
                id: `grid-high-res-building-system-${z}-${x}-${y}`,
                scenegraph: `http://localhost:8081/grid_high_res_new/${z}/${x}/${y}/model.glb`,
                ...gridBuildingsProp,
            });
        },
    });
}

export function createLowResGridBuildingLayer(props) {
    const {viewState} = props;
    return new TileLayer({
        id: 'grid-low-res-building-layer',
        minZoom: 15,
        maxZoom: 18,
        TilesetClass: GLBTileSet,
        pickable: false,
        renderSubLayers: props => {
            const {x, y, z} = props.tile.index;
            if (viewState.zoom >= 15)
                return null;
            return createSceneGraphLayer({
                id: `grid-low-res-building-system-${z}-${x}-${y}`,
                scenegraph: `http://localhost:8081/grid_low_res_new/${z}/${x}/${y}/model.glb`,
                ...gridBuildingsProp,
            });
        },
    });
}

export function createDynResGridBuildingLayer(props) {
    return new TileLayer({
        id: 'grid-dyn-res-building-layer',
        refinementStrategy: 'never',
        tileSize: 256,
        minZoom: 18,
        maxZoom: 18,
        pickable: false,
        TilesetClass: GLBTileSet,
        renderSubLayers: props => {
            const {x, y, z} = props.tile.index;
            if (z >= 18)
                return createSceneGraphLayer({
                    id: `grid-dyn-res-building-system-${z}-${x}-${y}`,
                    scenegraph: `http://localhost:8081/grid_high_res_new/${z}/${x}/${y}/model.glb`,
                    ...gridBuildingsProp,
                });
            else if (z >= 14)
                return createSceneGraphLayer({
                    id: `grid-building-system-${z}-${x}-${y}`,
                    scenegraph: `http://localhost:8081/grid_low_res_new/${z}/${x}/${y}/model.glb`,
                    ...gridBuildingsProp,
                });
            else
                return null;
        },
    });
}