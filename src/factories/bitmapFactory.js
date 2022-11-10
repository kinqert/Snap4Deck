import {BitmapLayer} from '@deck.gl/layers';

export default function createBitmapLayer(image, bounds, id="bitmap-layer") {
	return new BitmapLayer({
		id,
        bounds,
        image
	});
}
