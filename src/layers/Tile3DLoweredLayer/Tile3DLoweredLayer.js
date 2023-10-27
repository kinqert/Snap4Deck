import { Tile3DLayer } from "@deck.gl/geo-layers";
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import {
    Accessor,
    Color,
    CompositeLayer,
    CompositeLayerProps,
    COORDINATE_SYSTEM,
    FilterContext,
    GetPickingInfoParams,
    Layer,
    LayersList,
    log,
    PickingInfo,
    UpdateParameters,
    Viewport,
    DefaultProps
} from '@deck.gl/core';
const SINGLE_DATA = [0];
export class Tile3DLoweredLayer extends Tile3DLayer {
    _make3DModelLayer(tileHeader) {
        const { gltf, instances, cartographicOrigin, modelMatrix } = tileHeader.content;
        const SubLayerClass = this.getSubLayerClass('scenegraph', ScenegraphLayer);

        return new SubLayerClass(
            {
                _lighting: 'pbr'
            },
            this.getSubLayerProps({
                id: 'scenegraph'
            }),
            {
                id: `${this.id}-scenegraph-${tileHeader.id}`,
                tile: tileHeader,
                data: instances || SINGLE_DATA,
                scenegraph: gltf,
                visible: this.checkIfTileIsVisible(tileHeader),
                coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
                coordinateOrigin: cartographicOrigin,
                modelMatrix,
                getTransformMatrix: instance => instance.modelMatrix,
                getPosition: [0,0,0],
                _offset: 0
            }
        );
    }

    checkIfTileIsVisible(tile) {
        const { viewport } = this.context;
        const d = tile.depth;
        const z = viewport.zoom;
        const dz = (z * 1.45) + 4;
        const delta = 6;
        if (d > dz - delta)
            return true;
        else
            return false;
    }

    renderLayers() {
        const { tileset3d, layerMap } = this.state;
        if (!tileset3d) {
            return null;
        }

        // loaders.gl doesn't provide a type for tileset3d.tiles
        const depthMaps = new Map();
        return tileset3d.tiles.map(tile => {
            const layerCache = (layerMap[tile.id] = layerMap[tile.id] || { tile });
            let { layer } = layerCache;
            if (tile.selected) {
                // render selected tiles
                if (!layer) {
                    // create layer
                    layer = this._getSubLayer(tile);
                } else if (layerCache.needsUpdate) {
                    // props have changed, rerender layer
                    layer = this._getSubLayer(tile, layer);
                    layerCache.needsUpdate = false;
                }
            }
            if (layer && layer.props.visible != this.checkIfTileIsVisible(tile))
                layer = this._getSubLayer(tile, layer);
            layerCache.layer = layer;

            return layer;
        })
            .filter(Boolean);
    }
}