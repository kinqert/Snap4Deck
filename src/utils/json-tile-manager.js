import { lat2tile, lon2tile } from "./tile-utils";

export class JSONTileManager {
    static defaultProps = {
        getPosition: d => feature.geometry.coordinates,
        maxZoom: 18,
    };

    props = null;
    _jsonTiles = {};

    constructor(props) {
        this.props = {
            ...JSONTileManager.defaultProps,
            props
        };
        this.loadTiles();
    }

    loadTiles() {
        const {
            data,
            getPosition,
            maxZoom
        } = this.props;
        _jsonTiles = {};
        for (let d of data) {
            if (d.geometry.type !== "Point")
                continue
            const coord = getPosition(d);
            const x = lon2tile(coord[0], maxZoom);
            const y = lat2tile(coord[1], maxZoom);
            if (!_jsonTiles.hasOwnProperty(x)) {
                _jsonTiles[x] = {};
            }
            if (!_jsonTiles[x].hasOwnProperty(y)) {
                _jsonTiles[x][y] = [];
            }
            _jsonTiles[x][y].push({ ...d });
        }
        delete this.props.data;
    }

    getTileData(x, y, z) {
        const {
            maxZoom
        } = this.props;

    }

    static getSubIndices(x, y, z, targetZ) {
        if (targetZ <= z) {
            return [[x, y, z]];
        }
        let indices = [];

    }

    static getSubTiles(tile_x, tile_y, z, z1) {
        var subTiles = [];
        for (var sub_x = tile_x * Math.pow(2, (z1 - z)); sub_x < (tile_x + 1) * Math.pow(2, (z1 - z)); sub_x++) {
            for (var sub_y = tile_y * Math.pow(2, (z1 - z)); sub_y < (tile_y + 1) * Math.pow(2, (z1 - z)); sub_y++) {
                subTiles.push([sub_x, sub_y]);
            }
        }
        return subTiles;
    }
}