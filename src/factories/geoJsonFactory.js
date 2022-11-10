import { GeoJsonLayer } from "@deck.gl/layers";

export default function createGeoJSONLayer(props) {
    const { callback = () => {} } = props;

    return new GeoJsonLayer({
        id: 'geojson-layer',
        extruded: true,
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthScale: 20,
        lineWidthMinPixels: 2,
        getFillColor: [255, 0, 0, 200],
        getLineColor: [0, 0, 255],
        getElevation: f => f.properties.height,
        autoHighlight: true,
        highlightColor: [255, 0, 0, 200],
        getRadius: 100,
        getLineWidth: 1,
        onClick: (event, info) => callback(event, info),
        ...props
    });
}