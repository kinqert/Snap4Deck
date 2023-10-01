import { TileLayer, _Tileset2D } from "@deck.gl/geo-layers";
import { _GlobeViewport, _flatten as flatten } from "@deck.gl/core";
import { getTileIndices } from "../tileset-2d/utils";


// const DEFAULT_CACHE_SCALE = 1000;

export class GLBTileSet extends _Tileset2D {
	rifViewport;

	getTileIndices({ viewport, maxZoom, minZoom, zRange, modelMatrix, modelMatrixInverse }) {
        const { tileSize, extent, zoomOffset, maxTiles, minTileZoom } = this.opts
        if (minTileZoom > viewport.zoom)
            return [];
        const indices = getTileIndices({
            viewport,
            maxZoom,
            minZoom,
            zRange,
            tileSize,
            extent: extent,
            modelMatrix,
            modelMatrixInverse,
			zoomOffset: 18 - parseInt(viewport.zoom),
        });
        // if (maxTiles && maxTiles >= 0) {
        //     return indices.slice(0, maxTiles);
        // }
        return indices;
	}
}

const defaultProps = {
	...TileLayer.defaultProps,
	maxTiles: 200,
};

export class GLBTileLayer extends TileLayer {
	static defaultProps = defaultProps;
	updateState({ props, changeFlags }) {
		let { tileset } = this.state;
		const propsChanged = changeFlags.propsOrDataChanged || changeFlags.updateTriggersChanged;
		const dataChanged = changeFlags.dataChanged || (changeFlags.updateTriggersChanged && (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getTileData));

		if (!tileset) {
			tileset = new GLBTileSet({
				...this._getTilesetOptions(),
				maxTiles: props.maxTiles,
			});
			this.setState({ tileset });
		} else if (propsChanged) {
			tileset.setOptions({
				...this._getTilesetOptions(),
				maxTiles: props.maxTiles,
			});

			if (dataChanged) {
				// reload all tiles
				// use cached layers until new content is loaded
				tileset.reloadAll();
			} else {
				// some render options changed, regenerate sub layers now
				this.state.tileset.tiles.forEach((tile) => {
					tile.layers = null;
				});
			}
		}

		this._updateTileset();
	}

	renderLayers() {
		const tiles = this.state.tileset.tiles
			.map((tile) => {
				const subLayerProps = this.getSubLayerPropsByTile(tile);
				// cache the rendered layer in the tile
				if (!tile.isLoaded && !tile.content) {
					// nothing to show
				} else if (!tile.layers) {
					const layers = this.renderSubLayers({
						...this.props,
						id: `${this.id}-${tile.id}`,
						data: tile.content,
						_offset: 0,
						tile,
					});
					tile.layers = flatten(layers, Boolean).map((layer) =>
						layer.clone({
							tile,
							...subLayerProps,
						})
					);
				} else if (subLayerProps && tile.layers[0] && Object.keys(subLayerProps).some((propName) => tile.layers[0].props[propName] !== subLayerProps[propName])) {
					tile.layers = tile.layers.map((layer) => layer.clone(subLayerProps));
				}
				return tile.layers;
			});
		return tiles;
	}
}
