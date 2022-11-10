import { COORDINATE_SYSTEM } from "@deck.gl/core";
import { PointCloudLayer } from "@deck.gl/layers";

export default function createPointCloudLayer(
	data,
	id = "pointCloudCartesian"
) {
	return new PointCloudLayer({
		data,
		id,
		coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
		pickable: false,
		pointSize: 2,
		getPosition: (d) => d.position,
		getColor: (d) => d.color,
	});
}