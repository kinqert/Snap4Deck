import { PolygonLayer } from "@deck.gl/layers";

export default function createPolygonLayer(data, id = 'polygon-layer') {
    return new PolygonLayer({
        id,
        data,
        stroked: true,
        filled: true,
        wireframe: true,
        lineWidthMinPixels: 1,
        getPolygon: d => d.position,
        getElevation: d => 10,
        getFillColor: d => [0, 90, 143],
        getLineColor: [0, 70, 133],
        opacity: 0.4,
        getLineWidth: 1
    });
}