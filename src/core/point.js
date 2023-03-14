import { WebMercatorViewport } from '@deck.gl/core';

export class Point {
    x;
    y;
    z;

    constructor(opt) {
        if (Array.isArray(opt.xyz)) {
            this.x = opt.xyz[0] || 0;
            this.y = opt.xyz[1] || 0;
            this.z = opt.xyz[2] || 0;
        } else {
            this.x = opt.x || 0;
            this.y = opt.y || 0;
            this.z = opt.z || 0;
        }
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    toLatLng() {
        const viewport = new WebMercatorViewport();
        return viewport.unproject([this.x, this.y]);
    }

    inverse2() {
        return new Point({ xyz: [-this.x, -this.y, this.z] });
    }


    inverse3() {
        return new Point({ xyz: [-this.x, -this.y, -this.z] });
    }

    translate(delta) {
        const deltaX = delta[0] || delta.x || 0;
        const deltaY = delta[1] || delta.y || 0;
        const deltaZ = delta[2] || delta.z || 0;

        return new Point({
            x: this.x + deltaX,
            y: this.y + deltaY,
            z: this.z + deltaZ,
        });
    }

    getAngleXYFromOrigin() {
        return Math.atan2(this.y, this.x);
    }

    getAngleXZFromOrigin() {
        return Math.atan2(this.z, this.x);
    }

    getAngleYZFromOrigin() {
        return Math.atan2(this.z, this.y);
    }

    static createFlatPointFromAngularCoords(radius, angle) {
        return new Point({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
        });
    }

    static createPointFromWorldCoords(coords) {
        const viewport = new WebMercatorViewport();
        return new Point({
            xyz: viewport.project(coords),
        });
    }

    static getDistance(p1, p2) {
        const deltaX = p1.x - p2.x;
        const deltaY = p1.y - p2.y;
        const deltaZ = p1.z - p2.z;

        return Math.sqrt((deltaX ** 2) + (deltaY ** 2) + (deltaZ ** 2));
    }

    static getCentralPoint(p1, p2) {
        const [xmin, xmax] = p1.x <= p2.x ? [p1.x, p2.x] : [p2.x, p1.x];
        const [ymin, ymax] = p1.y <= p2.y ? [p1.y, p2.y] : [p2.y, p1.y];
        const [zmin, zmax] = p1.z <= p2.z ? [p1.z, p2.z] : [p2.z, p1.z];

        return new Point({
            x: (xmax - xmin) / 2 + xmin,
            y: (ymax - ymin) / 2 + ymin,
            z: (zmax - zmin) / 2 + zmin,
        });
    }
}