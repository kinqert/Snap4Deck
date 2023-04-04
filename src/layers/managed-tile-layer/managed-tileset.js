import { _Tileset2D } from "@deck.gl/geo-layers";
import { _GlobeViewport } from "@deck.gl/core";
import { WebMercatorViewport } from "@deck.gl/core";
import { CullingVolume, Plane, AxisAlignedBoundingBox, makeOrientedBoundingBoxFromPoints } from "@math.gl/culling";

import { tile2lng, tile2lat, getMeterDistance } from "../../utils/tile-utils";

const TILE_SIZE = 512;

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

function getOSMTileIndices(viewport, maxZ, zRange, bounds, maxTiles, minTileZoom) {
	if (viewport.zoom < minTileZoom)
		return [];
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
	const height = viewport.height;
	const width = viewport.width;
	const lat_rif = viewport.unproject([width/2, height])[1];
	const lng_rif = viewport.unproject([width/2, height])[0];

	let result = Array.from(root.getSelected()).sort((a, b) => {
	    const lat_a = tile2lat(a.y, 18);
	    const lng_a = tile2lng(a.x, 18);
	    const delta_a = getMeterDistance(lat_a, lng_a, lat_rif, lng_rif);
	    const lat_b = tile2lat(b.y, 18);
	    const lng_b = tile2lng(b.x, 18);
	    const delta_b = getMeterDistance(lat_b, lng_b, lat_rif, lng_rif);
	    return delta_a - delta_b;
	});

    if (maxTiles && maxTiles > 0)
        return result.slice(0, maxTiles);
    return result;
}

export function getTileIndices({ viewport, maxZoom, minZoom, zRange, extent, tileSize = TILE_SIZE, maxTiles, minTileZoom, modelMatrix, modelMatrixInverse, zoomOffset = 0 }) {
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
	return viewport.isGeospatial ? getOSMTileIndices(viewport, z, zRange, extent, maxTiles, minTileZoom) : getIdentityTileIndices(viewport, z, tileSize, transformedExtent || DEFAULT_EXTENT, modelMatrixInverse);
}