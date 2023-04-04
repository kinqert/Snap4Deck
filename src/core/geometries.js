import { Point } from "./point";
import { unitsPerMeter } from "@math.gl/web-mercator";

export function createCircleFromPointRadius(point, radius, resolution) {
    const deltaAngle = 2 * Math.PI / resolution;
    const points = [];
    for (let i = 0; i < resolution; i++) {
        const p = Point.createFlatPointFromAngularCoords(radius, deltaAngle * i).translate(point);
        points.push(p.toArray2());
    }
    return points;
}

export function createCircleFromWorldCoord(lngLat, radius, resolution) {
    const points = createCircleFromPointRadius(Point.createPointFromWorldCoords(lngLat), radius * unitsPerMeter(lngLat[1]), resolution);
    return points.map((value) => {
        const p = new Point({xyz: value})
        return p.toLatLng();
    });
}