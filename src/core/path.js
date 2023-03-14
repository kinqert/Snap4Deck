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


export function createSidedPath(path, width) {
    const redPath = [];
    const greenPath = [];
    const rp1 = [];
    const rp2 = [];
    const gp1 = [];
    const gp2 = [];
    // const r1 = width;

    for (let i = 0; i < path.length; i++) {
        console.log('calculating point');
        const A = Point.createPointFromWorldCoords(path[i]);
        const B = Point.createPointFromWorldCoords(path[(i + 1) % path.length]);
        const r1 = width * unitsPerMeter(path[i][1]);
        const distance = Point.getDistance(A, B);
        const r2 = Math.sqrt((r1 ** 2) + (distance ** 2));
        const [C, D] = getPointTrilateration(A.toArray(), B.toArray(), r1, r2);
        const cPoint = new Point({xyz: C});
        const dPoint = new Point({xyz: D});
        rp1.push(dPoint);
        gp1.push(cPoint);
    }

    for (let i = path.length - 1; i >= 0; i--) {
        const A = Point.createPointFromWorldCoords(path[i]);
        const B = Point.createPointFromWorldCoords(path[(i + path.length - 1) % path.length]);
        const r1 = width * unitsPerMeter(path[i][1]);
        const distance = Point.getDistance(A, B);
        const r2 = Math.sqrt((r1 ** 2) + (distance ** 2));
        const [C, D] = getPointTrilateration(A.toArray(), B.toArray(), r1, r2);
        const cPoint = new Point({xyz: C});
        const dPoint = new Point({xyz: D});
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
    }

    return [redPath, greenPath];
}