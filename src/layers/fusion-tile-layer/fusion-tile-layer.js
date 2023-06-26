import { TileLayer } from "@deck.gl/geo-layers";
import { _GlobeViewport, _flatten as flatten } from "@deck.gl/core";

import { OrderedTileSet } from "../managed-tile-layer/managed-tileset";
import { getURLFromTemplate, getURLFromTemplates } from "../../utils/url-template";
import { lat2tile, lon2tile, tile2BB, tile2Bbox } from "../../utils/tile-utils";

const defaultProps = {
	...TileLayer.defaultProps,
	fusionBottomUP: {type: 'function', value: geojsonFusionBottomUp, compare: false},
	fusionTopDown: {type: 'function', value: geojsonFusionTopDown, compare: false},
	fusionPeer: {type: 'function', value: null, compare: false},
	deepLoad: {type: 'number', value: null, compare: false},
	offsetLoad: {type: 'number', value: null, compare: false},
	statePasstrough: {type: 'bool', value: false, compare: false},
	getFusionCoords: {type: 'function', value: null, compare: false},
}

export function geojsonFusionTopDown(parent, current, index) {
	// Controllare se è un geojson valido?
	const {x, y, z} = index;
	if (!current)
		current = {};
	if (!current.hasOwnProperty('features'))
		current.features = [];
	if (parent && parent.hasOwnProperty('features')) {
		for (let feature of parent.features) {
			const [lng, lat] = feature.geometry.coordinates.slice(0,2);
			const x1 = lon2tile(lng, z);
			const y1 = lat2tile(lat, z);
			if (x == x1, y == y1) {
				current.features.push(feature);
			}
		}
	}
	return current;
}

export function geojsonFusionBottomUp(child, current) {
	// Controllare se è un geojson valido?
	if (!current)
		current = {};
	if (!current.hasOwnProperty('features'))
		current.features = [];
	if (child && child.hasOwnProperty('features'))
		current.features.push(...child.features)
	return current;
}

export function jsonFusionTopDown(parent, current, index, getFusionCoords) {
	const {x, y, z} = index;
	if (!current || !Array.isArray(current))
		current = [];
	if (parent && Array.isArray(parent)) {
		for (let d of parent) {
			const [lng, lat] = getFusionCoords(d);
			const x1 = lon2tile(lng, z);
			const y1 = lat2tile(lat, z);
			if (x == x1, y == y1) {
				current.push(d);
			}
		}
	}
	return current;
}

export function jsonFusionBottomUp(child, current, getFusionCoords) {
	if (!current || !Array.isArray(current))
		current = [];
	if (child)
		current.push(...child)
	return current;
}

function geojsonFusionPeer(fusionedPeer, peer) {

}

export class FusionTileLayer extends TileLayer {
	static defaultProps = defaultProps;

	updateState({ props, changeFlags }) {
		let { tileset } = this.state;
		const propsChanged = changeFlags.propsOrDataChanged || changeFlags.updateTriggersChanged;
		const dataChanged = changeFlags.dataChanged || (changeFlags.updateTriggersChanged && (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getTileData));

		if (!tileset) {
			tileset = new OrderedTileSet({
				...this._getTilesetOptions(),
			});
			this.setState({ tileset });
		} else if (propsChanged) {
			tileset.setOptions({
				...this._getTilesetOptions(),
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

	_fusionBottomUp(fusionedTile, x, y, z, deepLevel, signal) {
		const {data, fusionBottomUP, deepLoad, getTileData, offsetLoad, getFusionCoords} = this.props;
		const {tileset, commonState} = this.state;
		const [x1, y1, z1] = [x*2, y*2, z+1];
		const child1 = tileset._cache.get(`${x1}-${y1}-${z1}`);
		const child2 = tileset._cache.get(`${x1+1}-${y1}-${z1}`);
		const child3 = tileset._cache.get(`${x1}-${y1+1}-${z1}`);
		const child4 = tileset._cache.get(`${x1+1}-${y1+1}-${z1}`);
		if ((child1 && child1.content) || (child2 && child2.content) || (child3 && child3.content) || (child4 && child4.content) || deepLoad) { 
			let promised = [];
			if (child1 && child1.content) {
				fusionedTile = fusionBottomUP(child1.content, fusionedTile, getFusionCoords);
			} else {
				const tileProp = {
					index: {x: x1, y: y1, z: z1},
					bbox: tile2Bbox(x1, y1, z1),
				}
				if (offsetLoad) {
					promised.push(getTileData({url: getURLFromTemplates(data, {...tileProp, index: {...tileProp.index, z: offsetLoad}}), signal, ...tileProp}));
				} else if (deepLevel && deepLevel > z1) {
					promised.push(this._fusionBottomUp(fusionedTile, tileProp.index.x, tileProp.index.y, tileProp.index.z, deepLevel));
				} else {
					promised.push(getTileData({url: getURLFromTemplates(data, tileProp), signal, ...tileProp}));
				}
			}
			if (child2 && child2.content) {
				fusionedTile = fusionBottomUP(child2.content, fusionedTile, getFusionCoords);
	 		} else {
				const tileProp = {
					index: {x: x1+1, y: y1, z: z1},
					bbox: tile2Bbox(x1+1, y1, z1),
				}
				if (offsetLoad) {
					promised.push(getTileData({url: getURLFromTemplates(data, {...tileProp, index: {...tileProp.index, z: offsetLoad}}), signal, ...tileProp}));
				} else if (deepLevel && deepLevel > z1) {
					promised.push(this._fusionBottomUp(fusionedTile, tileProp.index.x, tileProp.index.y, tileProp.index.z, deepLevel));
				} else {
					promised.push(getTileData({url: getURLFromTemplates(data, tileProp), signal, ...tileProp}));
				}
			}
			if (child3 && child3.content) {
				fusionedTile = fusionBottomUP(child3.content, fusionedTile, getFusionCoords);
			} else {
				const tileProp = {
					index: {x: x1, y: y1+1, z: z1},
					bbox: tile2Bbox(x1, y1+1, z1),
				}
				if (offsetLoad) {
					promised.push(getTileData({url: getURLFromTemplates(data, {...tileProp, index: {...tileProp.index, z: offsetLoad}}), signal, ...tileProp}));
				} else if (deepLevel && deepLevel > z1) {
					promised.push(this._fusionBottomUp(fusionedTile, tileProp.index.x, tileProp.index.y, tileProp.index.z, deepLevel));
				} else {
					promised.push(getTileData({url: getURLFromTemplates(data, tileProp), signal, ...tileProp}));
				}
			}
			if (child4 && child4.content) {
				fusionedTile = fusionBottomUP(child4.content, fusionedTile, getFusionCoords);
			} else {
				const tileProp = {
					index: {x: x1+1, y: y1+1, z: z1},
					bbox: tile2Bbox(x1+1, y1+1, z1),
				}
				if (offsetLoad) {
					promised.push(getTileData({url: getURLFromTemplates(data, {...tileProp, index: {...tileProp.index, z: offsetLoad}}), signal, ...tileProp}));
				} else if (deepLevel && deepLevel > z1) {
					promised.push(this._fusionBottomUp(fusionedTile, tileProp.index.x, tileProp.index.y, tileProp.index.z, deepLevel));
				} else {
					promised.push(getTileData({url: getURLFromTemplates(data, tileProp), signal, ...tileProp}));
				}
			}
			if (promised.length > 0) {
				return Promise.all(promised).then((res) => {
					for (let data of res) {
						if (data)
							fusionedTile = fusionBottomUP(data, fusionedTile, getFusionCoords);
					}
					return fusionedTile;
				});
			} else {
				return fusionedTile;
			}
		}
		return null;
	}

    getTileData(tile) {
        const {data, getTileData, fetch, fusionBottomUP, fusionTopDown, statePasstrough, deepLoad, getFusionCoords, offsetLoad} = this.props;
		const {tileset, commonState, lastViewZoom} = this.state;
        const {signal} = tile;
		const {viewport} = this.context;

		let jumpZoom = 1;
		if (!lastViewZoom)
			this.setState({lastViewZoom: viewport.zoom});
		else {
			jumpZoom = Math.abs(lastViewZoom - viewport.zoom);
			this.setState({lastViewZoom: viewport.zoom});
		}	

		if (offsetLoad) {
			tile.url =
			typeof data === 'string' || Array.isArray(data) ? getURLFromTemplates(data, {...tile, index: {...tile.index, z: offsetLoad}}) : null;
		} else {
			tile.url =
			typeof data === 'string' || Array.isArray(data) ? getURLFromTemplates(data, tile) : null;
		}

		const {x, y, z} = tile.index;
		// TOP -> DOWN
		const parentTile = tileset._cache.get(`${Math.floor(x/2)}-${Math.floor(y/2)}-${z-1}`);
		if (parentTile && parentTile.content) {
			if (statePasstrough && !commonState && parentTile.state) {
				const newState = parentTile.state;
				this.setState({commonState: newState});
			}
			return fusionTopDown(parentTile.content, {}, {x, y, z}, getFusionCoords);
		}
		// BOTTOM -> UP
		const deepLevel = deepLoad ? deepLoad : z+1;
		let fusionedTile = {};
		fusionedTile = this._fusionBottomUp(fusionedTile, x, y, z, deepLevel, signal);
		if (fusionedTile)
			return fusionedTile;

        if (getTileData) {
        return getTileData(tile);
        }
        if (fetch && tile.url) {
        return fetch(tile.url, {propName: 'data', layer: this, signal});
        }
        return null;
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
					
					if (this.props.statePasstrough && this.state.commonState && layers) {
						layers.state = this.state.commonState;
					}
					tile.layers = flatten(layers, Boolean).map((layer) =>
						layer.clone({
							tile,
							...subLayerProps,
						})
					);
				} else if (subLayerProps && tile.layers[0] && Object.keys(subLayerProps).some((propName) => {
					if (subLayerProps && tile.layers[0].props)
						tile.layers[0].props[propName] !== subLayerProps[propName]
				})) {
					tile.layers = tile.layers.map((layer) => layer.clone(subLayerProps));
				}
				return tile.layers;
			});
		return tiles;
	}
}