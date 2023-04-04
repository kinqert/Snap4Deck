import { unitsPerMeter } from "@math.gl/web-mercator";
import { Point } from "./point";

export function getPointTrilateration(A, B, r1, r2) {
    // Calculate the distance between the two known points
    let d = Math.sqrt(Math.pow(B[0] - A[0], 2) + Math.pow(B[1] - A[1], 2));

    // Calculate the coordinates of the intersection points
    let x1 = ((r1 * r1) - (r2 * r2) + (d * d)) / (2 * d);
    let y1 = Math.sqrt((r1 * r1) - (x1 * x1));
    let x2 = ((r1 * r1) - (r2 * r2) + (d * d)) / (2 * d);
    let y2 = -Math.sqrt((r1 * r1) - (x2 * x2));

    // Calculate the coordinates of P
    let P1 = [A[0] + x1 * ((B[0] - A[0]) / d) - y1 * ((B[1] - A[1]) / d), A[1] + x1 * ((B[1] - A[1]) / d) + y1 * ((B[0] - A[0]) / d)];
    let P2 = [A[0] + x2 * ((B[0] - A[0]) / d) - y2 * ((B[1] - A[1]) / d), A[1] + x2 * ((B[1] - A[1]) / d) + y2 * ((B[0] - A[0]) / d)];

    return [P1, P2];
}

function isPointInsidePolygon(point, polygon) {
    const [x, y] = point;
    let isInside = false;
    let j = polygon.length - 1;

    for (let i = 0; i < polygon.length; i++) {
        if ((polygon[i][1] < y && polygon[j][1] >= y ||
            polygon[j][1] < y && polygon[i][1] >= y) &&
            (polygon[i][0] <= x || polygon[j][0] <= x)) {
            if (polygon[i][0] + (y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) * (polygon[j][0] - polygon[i][0]) < x) {
                isInside = !isInside;
            }
        }
        j = i;
    }

    return isInside;
}

export function createSidedPath(path, width) {
    const redPath = [];
    const redTestPath = [];
    const greenTestPath = [];
    const greenPath = [];
    const rp1 = [];
    const rp2 = [];
    const gp1 = [];
    const gp2 = [];

    for (let i = 0; i < path.length; i++) {
        const A = Point.createPointFromWorldCoords(path[i]);
        const B = Point.createPointFromWorldCoords(path[(i + 1) % path.length]);
        const r1 = width * unitsPerMeter(path[i][1]);
        const distance = Point.getDistance(A, B);
        const r2 = Math.sqrt((r1 ** 2) + (distance ** 2));
        const [C, D] = getPointTrilateration(A.toArray2(), B.toArray2(), r1, r2);
        const cPoint = new Point({ xyz: C });
        const dPoint = new Point({ xyz: D });
        rp1.push(dPoint);
        gp1.push(cPoint);
    }

    for (let i = path.length - 1; i >= 0; i--) {
        const A = Point.createPointFromWorldCoords(path[i]);
        const B = Point.createPointFromWorldCoords(path[(i + path.length - 1) % path.length]);
        const r1 = width * unitsPerMeter(path[i][1]);
        const distance = Point.getDistance(A, B);
        const r2 = Math.sqrt((r1 ** 2) + (distance ** 2));
        const [C, D] = getPointTrilateration(A.toArray2(), B.toArray2(), r1, r2);
        const cPoint = new Point({ xyz: C });
        const dPoint = new Point({ xyz: D });
        rp2.push(cPoint);
        gp2.push(dPoint);
    }

    for (let i = 0; i < rp1.length; i++) {
        const r1 = width * unitsPerMeter(path[i][1]);
        const originalPoint = Point.createPointFromWorldCoords(path[i]);
        const redPoint = Point.getCentralPoint(rp1[i], rp2[rp1.length - 1 - i]);
        const redCentered = redPoint.translate(originalPoint.inverse2());
        const redAngle = redCentered.getAngleXYFromOrigin();
        const finalRed = Point.createFlatPointFromAngularCoords(r1, redAngle).translate(originalPoint);

        const greenPoint = Point.getCentralPoint(gp1[i], gp2[rp1.length - 1 - i]);
        const greenCentered = greenPoint.translate(originalPoint.inverse2());
        const greenAngle = greenCentered.getAngleXYFromOrigin();
        const finalGreen = Point.createFlatPointFromAngularCoords(r1, greenAngle).translate(originalPoint);

        redPath.push(finalRed.toLatLng());
        greenPath.push(finalGreen.toLatLng());
        redTestPath.push(finalRed.toArray2());
        greenTestPath.push(finalGreen.toArray2());
    }

    let isRedInsideGreen = true;
    let isGreenInsideRed = true;
    // check test
    for (let i = 0; i < redPath.length; i++) {
        const rp = Point.createPointFromWorldCoords(redPath[i]).toArray2();
        const isRedInside = isPointInsidePolygon(rp, greenTestPath);
        isRedInsideGreen = isRedInsideGreen && isRedInside;
        const gp = Point.createPointFromWorldCoords(greenPath[i]).toArray2();
        const isGreenInside = isPointInsidePolygon(gp, redTestPath);
        isGreenInsideRed = isGreenInsideRed && isGreenInside;
    }

    if (isRedInsideGreen && isGreenInsideRed || !isRedInsideGreen && !isGreenInsideRed)
        console.log('there are some mismatch in creating the polygon');

    return isRedInsideGreen ? [redPath, greenPath] : [greenPath, redPath];

}