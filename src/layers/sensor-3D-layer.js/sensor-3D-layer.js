import { CompositeLayer } from "@deck.gl/core";
import { ScatterplotLayer, ColumnLayer, TextLayer } from "@deck.gl/layers";

export class Sensor3DLayer extends CompositeLayer {
    static layerName = 'Sensor3DLayer';

    static defaultProps = {
        animated: {
            type: 'bool',
            value: false
        },
        selectedTimeframe: {
            type: 'int',
            value: 0
        },
        getFillColor: {
            type: 'accessor',
            value: [0, 0, 255]
        },
        getElevation: {
            type: "accessor",
            value: x => x.elevation
        },
    };

    getPickingInfo({
        info,
        sourceLayer
    }) {
        return info;
    }

    updateState({
        props,
        oldProps,
        changeFlags
    }) {
        if (changeFlags.extensionsChanged) {
            const {
                gl
            } = this.context;
            this.setNeedsRedraw();
        }
    }

    renderLayers() {
        return [
            new ScatterplotLayer({
                id: `${this.props.id}-circle-layer`,
                data: this.props.data,
                pickable: true,
                opacity: 1,
                stroked: true,
                filled: true,

                lineWidthMinPixels: 1,
                getPosition: d => d.geometry.coordinates,
                getRadius: d => 10,
                getFillColor: d => this.props.getFillColor,
                getLineColor: d => [0, 0, 0]
            }),
            new ColumnLayer({
                id: `${this.props.id}-column-layer`,
                data: this.props.data,
                diskResolution: 12,
                radius: 5,
                extruded: true,
                pickable: true,

                updateTriggers: {
                    getElevation: this.props.updateTriggers.getElevation,
                },

                getPosition: d => d.geometry.coordinates,
                getFillColor: this.props.getFillColor,
                getLineColor: [0, 0, 0],
                getElevation: this.props.getElevation,
            }),
            new TextLayer({
                id: `${this.props.id}-text-layer`,
                data: this.props.data,
                getPosition: d => [...d.geometry.coordinates, this.props.getElevation(d) + 7],
                updateTriggers: {
                    getPosition: this.props.updateTriggers.getPosition,
                    getText: this.props.updateTriggers.getText,
                },
                parameters: {
                    depthTest: false
                },
                getText: this.props.getText || "0",
                getSize: 32,
                getAngle: 0,
                getTextAnchor: 'middle',
                getAlignmentBaseline: 'center'
            }),
        ];
    }
}