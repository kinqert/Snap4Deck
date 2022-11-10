import {TerrainLayer} from '@deck.gl/geo-layers';
import NewTerrainLayer from '../layers/NewTerrainLayer';

export function createTerrainLayer(elevation, bounds, texture, id = "terrain-layer") {
	return new TerrainLayer({
		elevationDecoder: {
			rScaler: 0.001,
			gScaler: 0.256,
			bScaler: 65.536,
			offset: 0,
		},
		elevationData: elevation,
		texture,
		bounds: bounds,
	});
}

export function createNewTerrainLayer(props) {
	var {
		elevationUrl
	} = props;
	elevationUrl = elevationUrl.replace('width=512', 'width=256');
	elevationUrl = elevationUrl.replace('height=512', 'height=256');
	return new NewTerrainLayer({
		id: 'terrain-layer',

		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		opacity: 1,
		elevationDecoder: {
			rScaler: 7.97 / 3,
			gScaler: 7.97 / 3,
			bScaler: 7.97 / 3,
			offset: -50.97
		},
		loadOptions: {
			terrain: {
				tesselator: 'martini',
				// tesselator: 'delatin',
				meshMaxError: 20,
			},
		},
		refinementStrategy: 'best-available',
		color: [255, 255, 255],
		elevationData: elevationUrl,
		...props,
	});
}