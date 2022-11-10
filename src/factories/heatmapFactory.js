import ManagedTileLayer from "../layers/ManagedTileLayer";
import GL from "@luma.gl/constants";

export default function createHeatmapLayer(props) {
	var { type = "heatmap", url } = props;
	if (type == "heatmap") {
		gifWms.isAnimated = false;
	} else if ((type = "traffic")) {
		gifWmsTraffic.isAnimated = false;
	}
	const blurredParams = {
		[GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
		[GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
		[GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
		[GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
	};
	const pixelParams = {
		[GL.TEXTURE_MIN_FILTER]: GL.NEAREST,
		[GL.TEXTURE_MAG_FILTER]: GL.NEAREST,
	};
	const selectedParams = type == "heatmap" ? blurredParams : pixelParams;
	return new ManagedTileLayer({
		id: "heatmap-layer",
		type: "heatmap",
		tileSize: 256,
		// tileSize: 512,
		opacity: 0.2,
		minZoom: 0,
		maxZoom: 18,
		pickable: false,
		wmsUrl: url,
		parameters: {
			depthTest: false,
		},
		renderSubLayers: (props) => {
			const {
				bbox: { west, south, east, north },
			} = props.tile;

			return new deck.BitmapLayer(props, {
				data: null,
				image: props.data,
				// image: url + `&bbox=${west},${south},${east},${north}`,
				// textureParameters: pixelParams,
				textureParameters: selectedParams,
				bounds: [west, south, east, north],
				parameters: {
					depthTest: false,
				},
			});
		},
		updateTriggers: {
			renderSubLayers: wmsBlurred,
		},
		...props,
	});
}
