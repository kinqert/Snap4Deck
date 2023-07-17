export function lon2tile(lon, zoom) {
	return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat, zoom) {
	return Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom));
}

export function tile2lng(x, z) {
	return (x / Math.pow(2, z)) * 360 - 180;
}

export function tile2lat(y, z) {
	var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tile2BB(x, y, z) {
	const bb = [];
	bb.push(tile2lng(x, z), tile2lat(y + 1, z));
	bb.push(tile2lng(x + 1, z), tile2lat(y, z));
	return bb;
}

export function tile2Bbox(x, y, z) {
	return {
		west: tile2lng(x, z),
		south: tile2lat(y + 1, z),
		east: tile2lng(x + 1, z),
		north: tile2lat(y, z)
	}
}

export function getMeterDistanceFromCoords(coord1, coord2) {
	return getMeterDistance(coord1[1], coord1[0], coord2[1], coord2[0]);
}

export function getMeterDistance(lat1, lon1, lat2, lon2) {
	const R = 6371e3; // metres
	const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // in metres
}

export function getSubTiles2(tile_x, tile_y, z, z1) {
	var subTiles = [];

}

export function getParentTile(tile_x, tile_y, z, z1) {
	return [Math.floor(tile_x / Math.pow(2, z1 - z)), Math.floor(tile_y / Math.pow(2, z1 - z))];
}

export function getSubTiles(tile_x, tile_y, z, z1) {
	var subTiles = [];
	for (var sub_x = tile_x * Math.pow(2, (z1 - z)); sub_x < (tile_x + 1) * Math.pow(2, (z1 - z)); sub_x++) {
		for (var sub_y = tile_y * Math.pow(2, (z1 - z)); sub_y < (tile_y + 1) * Math.pow(2, (z1 - z)); sub_y++) {
			subTiles.push([sub_x, sub_y]);
		}
	}
	return subTiles;
}