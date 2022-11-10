import {BitmapLayer} from '@deck.gl/layers/';
import {TileLayer} from '@deck.gl/geo-layers/';

function createTileLayer(data, id = 'map-layer') {
    return new TileLayer({
        id: id,
        data: data,
        minZoom: 0,
        maxZoom: 18,
        tileSize: 256,
        opacity: 1,
        pickable: true,
        parameters: {
            depthTest: false
        },

        renderSubLayers: props => {
            const {
                bbox: { west, south, east, north }
            } = props.tile;

            return new BitmapLayer(props, {
                data: null,
                image: props.data,
                bounds: [west, south, east, north]
            });
        },
    });
}

export default createTileLayer;