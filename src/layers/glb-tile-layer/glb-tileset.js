import { TileLayer, _Tileset2D } from "@deck.gl/geo-layers";
import { _GlobeViewport, _flatten as flatten } from "@deck.gl/core";
import { WebMercatorViewport } from "@deck.gl/core";
import { CullingVolume, Plane, AxisAlignedBoundingBox, makeOrientedBoundingBoxFromPoints } from "@math.gl/culling";
import viewport from "@deck.gl/core/dist/es5/viewports/viewport";

class OSMNode {
	x;
	y;
	z;

	childVisible;
	selected;

	_children;

	constructor(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	get children() {
		if (!this._children) {
			const x = this.x * 2;
			const y = this.y * 2;
			const z = this.z + 1;
			this._children = [new OSMNode(x, y, z), new OSMNode(x, y + 1, z), new OSMNode(x + 1, y, z), new OSMNode(x + 1, y + 1, z)];
		}
		return this._children;
	}

	update(params) {
		const { viewport, cullingVolume, elevationBounds, minZ, maxZ, bounds, offset, project } = params;
		const boundingVolume = this.getBoundingVolume(elevationBounds, offset, project);

		// First, check if this tile is visible
		if (bounds && !this.insideBounds(bounds)) {
			return false;
		}

		const isInside = cullingVolume.computeVisibility(boundingVolume);
		if (isInside < 0) {
			return false;
		}

		// Avoid loading overlapping tiles - if a descendant is requested, do not request the ancester
		if (!this.childVisible) {
			let { z } = this;
			if (z < maxZ && z >= minZ) {
				// Adjust LOD
				// If the tile is far enough from the camera, accept a lower zoom level
				const distance = (boundingVolume.distanceTo(viewport.cameraPosition) * viewport.scale) / viewport.height;
				z += Math.floor(Math.log2(distance));
			}
			if (z >= maxZ) {
				// LOD is acceptable
				this.selected = true;
				return true;
			}
		}

		// LOD is not enough, recursively test child tiles
		this.selected = false;
		this.childVisible = true;
		for (const child of this.children) {
			child.update(params);
		}
		return true;
	}

	getSelected(result = []) {
		if (this.selected) {
			result.push(this);
		}
		if (this._children) {
			for (const node of this._children) {
				node.getSelected(result);
			}
		}
		return result;
	}

	insideBounds([minX, minY, maxX, maxY]) {
		const scale = Math.pow(2, this.z);
		const extent = TILE_SIZE / scale;

		return this.x * extent < maxX && this.y * extent < maxY && (this.x + 1) * extent > minX && (this.y + 1) * extent > minY;
	}

	getBoundingVolume(zRange, worldOffset, project) {
		if (project) {
			// Custom projection
			// Estimate bounding box from sample points
			// At low zoom level we need more samples to calculate the bounding volume correctly
			const refPoints = this.z < 1 ? REF_POINTS_11 : this.z < 2 ? REF_POINTS_9 : REF_POINTS_5;

			// Convert from tile-relative coordinates to common space
			const refPointPositions = [];
			for (const p of refPoints) {
				const lngLat = osmTile2lngLat(this.x + p[0], this.y + p[1], this.z);
				lngLat[2] = zRange[0];
				refPointPositions.push(project(lngLat));

				if (zRange[0] !== zRange[1]) {
					// Account for the elevation volume
					lngLat[2] = zRange[1];
					refPointPositions.push(project(lngLat));
				}
			}

			return makeOrientedBoundingBoxFromPoints(refPointPositions);
		}

		// Use WebMercator projection
		const scale = Math.pow(2, this.z);
		const extent = TILE_SIZE / scale;
		const originX = this.x * extent + worldOffset * TILE_SIZE;
		// deck's common space is y-flipped
		const originY = TILE_SIZE - (this.y + 1) * extent;

		return new AxisAlignedBoundingBox([originX, originY, zRange[0]], [originX + extent, originY + extent, zRange[1]]);
	}
}
const TILE_SIZE = 512;
const DEFAULT_CACHE_SCALE = 1000;

function getOSMTileIndices(viewport, maxZ, zRange, bounds) {
	const project =
		viewport instanceof _GlobeViewport && viewport.resolution
			? // eslint-disable-next-line @typescript-eslint/unbound-method
			  viewport.projectPosition
			: null;

	// Get the culling volume of the current camera
	const planes = Object.values(viewport.getFrustumPlanes()).map(({ normal, distance }) => new Plane(normal.clone().negate(), distance));
	const cullingVolume = new CullingVolume(planes);

	// Project zRange from meters to common space
	const unitsPerMeter = viewport.distanceScales.unitsPerMeter[2];
	const elevationMin = (zRange && zRange[0] * unitsPerMeter) || 0;
	const elevationMax = (zRange && zRange[1] * unitsPerMeter) || 0;

	// Always load at the current zoom level if pitch is small
	const minZ = viewport instanceof WebMercatorViewport && viewport.pitch <= 90 ? maxZ : 0;

	// Map extent to OSM position
	if (bounds) {
		const [minLng, minLat, maxLng, maxLat] = bounds;
		const topLeft = lngLatToWorld([minLng, maxLat]);
		const bottomRight = lngLatToWorld([maxLng, minLat]);
		bounds = [topLeft[0], TILE_SIZE - topLeft[1], bottomRight[0], TILE_SIZE - bottomRight[1]];
	}

	const root = new OSMNode(0, 0, 0);
	const traversalParams = {
		viewport,
		project,
		cullingVolume,
		elevationBounds: [elevationMin, elevationMax],
		minZ,
		maxZ,
		bounds,
		// num. of worlds from the center. For repeated maps
		offset: 0,
	};

	root.update(traversalParams);

	if (viewport instanceof WebMercatorViewport && viewport.subViewports && viewport.subViewports.length > 1) {
		// Check worlds in repeated maps
		traversalParams.offset = -1;
		while (root.update(traversalParams)) {
			if (--traversalParams.offset < -MAX_MAPS) {
				break;
			}
		}
		traversalParams.offset = 1;
		while (root.update(traversalParams)) {
			if (++traversalParams.offset > MAX_MAPS) {
				break;
			}
		}
	}
    console.log('get osm indices');
	const height = viewport.height;
	const width = viewport.width;
	const lat_rif = viewport.unproject([width/2, height])[1];
	const lng_rif = viewport.unproject([width/2, height])[0];

	return Array.from(root.getSelected()).sort((a, b) => {
	    const lat_a = tile2lat(a.y, 18);
	    const lng_a = tile2lng(a.x, 18);
	    const delta_a = getMeterDistance(lat_a, lng_a, lat_rif, lng_rif);
	    const lat_b = tile2lat(b.y, 18);
	    const lng_b = tile2lng(b.x, 18);
	    const delta_b = getMeterDistance(lat_b, lng_b, lat_rif, lng_rif);
	    return delta_a - delta_b;
	}).slice(0, 500);
	// return root.getSelected();
}

function getTileIndices({ viewport, maxZoom, minZoom, zRange, extent, tileSize = TILE_SIZE, modelMatrix, modelMatrixInverse, zoomOffset = 0 }) {
	let z = viewport.isGeospatial ? Math.round(viewport.zoom + Math.log2(TILE_SIZE / tileSize)) + zoomOffset : Math.ceil(viewport.zoom) + zoomOffset;
	if (typeof minZoom === "number" && Number.isFinite(minZoom) && z < minZoom) {
		if (!extent) {
			return [];
		}
		z = minZoom;
	}
	if (typeof maxZoom === "number" && Number.isFinite(maxZoom) && z > maxZoom) {
		z = maxZoom;
	}
	let transformedExtent = extent;
	if (modelMatrix && modelMatrixInverse && extent && !viewport.isGeospatial) {
		transformedExtent = transformBox(extent, modelMatrix);
	}
	return viewport.isGeospatial ? getOSMTileIndices(viewport, z, zRange, extent) : getIdentityTileIndices(viewport, z, tileSize, transformedExtent || DEFAULT_EXTENT, modelMatrixInverse);
}

function lon2tile(lon, zoom) {
	return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
	return Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom));
}

function tile2lng(x, z) {
	return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y, z) {
	var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function getMeterDistanceFromCoords(coord1, coord2) {
	return getMeterDistance(coord1[1], coord1[0], coord2[1], coord2[0]);
}

function getMeterDistance(lat1, lon1, lat2, lon2) {
	const R = 6371e3; // metres
	const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // in metres
}

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
			// const height = this.rifViewport.height;
			// const width = this.rifViewport.width;
			// const lat_rif = this.rifViewport.unproject([width/2, height])[1];
			// const lng_rif = this.rifViewport.unproject([width/2, height])[0];

			// this._tiles = Array.from(this._cache.values()).sort((a, b) => {
			//     const lat_a = tile2lat(a.index.y, 18);
			//     const lng_a = tile2lng(a.index.x, 18);
			//     const delta_a = getMeterDistance(lat_a, lng_a, lat_rif, lng_rif);
			//     const lat_b = tile2lat(b.index.y, 18);
			//     const lng_b = tile2lng(b.index.x, 18);
			//     const delta_b = getMeterDistance(lat_b, lng_b, lat_rif, lng_rif);
			//     return delta_a - delta_b;
			// });

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
		return this.state.tileset.tiles
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
	}
}
