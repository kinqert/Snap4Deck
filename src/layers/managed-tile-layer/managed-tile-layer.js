import { TileLayer } from "@deck.gl/geo-layers";

import { getURLFromTemplate } from "../../utils/url-template";

export class ManagedTileLayer extends TileLayer {
    getTileData(tile) {
        const {
            data,
            getTileData,
            fetch
        } = this.props;
        const {
            signal
        } = tile;

        tile.url = getURLFromTemplate(data, tile);

        if (getTileData) {
            return getTileData(tile);
        }
        if (tile.url) {
            return fetch(tile.url, {
                propName: 'data',
                layer: this,
                signal
            });
        }
        return null;
    }
}