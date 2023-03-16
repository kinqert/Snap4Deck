import { TileLayer, _Tileset2D } from "@deck.gl/geo-layers";
import { _GlobeViewport, _flatten as flatten } from "@deck.gl/core";

import { getTileIndices } from "../managed-tile-layer/managed-tileset";

const DEFAULT_CACHE_SCALE = 1000;

export class GLBTileSet extends _Tileset2D {
	rifViewport;

	getTileIndices({ viewport, maxZoom, minZoom, zRange, modelMatrix, modelMatrixInverse }) {
		const { tileSize, extent, zoomOffset } = this.opts;
		this.rifViewport = viewport;
		let indices = getTileIndices({
			viewport,
			maxZoom,
			minZoom,
			zRange,
			tileSize,
			maxTiles: 500,
			extent,
			modelMatrix,
			modelMatrixInverse,
			zoomOffset: 18 - parseInt(viewport.zoom),
		});
		return indices;
	}
	_resizeCache() {
		const { _cache, opts } = this;

		const maxCacheSize =
			opts.maxCacheSize ||
			// @ts-expect-error called only when selectedTiles is initialized
			(opts.maxCacheByteSize ? Infinity : DEFAULT_CACHE_SCALE * this.selectedTiles.length);
		const maxCacheByteSize = opts.maxCacheByteSize || Infinity;

		const overflown = _cache.size > maxCacheSize || this._cacheByteSize > maxCacheByteSize;

		if (overflown) {
			for (const [id, tile] of _cache) {
				if (!tile.isVisible) {
					// delete tile
					this._cacheByteSize -= opts.maxCacheByteSize ? tile.byteLength : 0;
					_cache.delete(id);
					this.opts.onTileUnload(tile);
				}
				if (_cache.size <= maxCacheSize && this._cacheByteSize <= maxCacheByteSize) {
					break;
				}
			}
			this._rebuildTree();
			this._dirty = true;
		}
		if (this._dirty) {
            this._tiles = Array.from(this._cache.values()).sort((t1, t2) => t1.zoom - t2.zoom);
			this._dirty = false;
		}
	}
}

export class GLBTileLayer extends TileLayer {
	updateState({ changeFlags }) {
		let { tileset } = this.state;
		const propsChanged = changeFlags.propsOrDataChanged || changeFlags.updateTriggersChanged;
		const dataChanged = changeFlags.dataChanged || (changeFlags.updateTriggersChanged && (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getTileData));

		if (!tileset) {
			tileset = new GLBTileSet(this._getTilesetOptions());
			this.setState({ tileset });
		} else if (propsChanged) {
			tileset.setOptions(this._getTilesetOptions());

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
