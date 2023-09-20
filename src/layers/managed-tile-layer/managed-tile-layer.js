import { TileLayer } from "@deck.gl/geo-layers";

import { getURLFromTemplate } from "../../utils/url-template";
import { Tileset2D, Tileset2DCentered } from "../tileset-2d/tileset-2d";

const defaultProps = {
    ...TileLayer.defaultProps,
    TilesetClass: Tileset2DCentered,
}

export class ManagedTileLayer extends TileLayer {
    static defaultProps = defaultProps;

    getTileData(tile) {
        const { data, getTileData, fetch } = this.props;
        const { signal } = tile;

        tile.url =
            typeof data === 'string' || Array.isArray(data) ? getURLFromTemplate(data, tile) : null;

        if (getTileData) {
            return getTileData(tile);
        }
        if (fetch && tile.url) {
            return fetch(tile.url, { propName: 'data', layer: this, signal });
        }
        return null;
    }
}