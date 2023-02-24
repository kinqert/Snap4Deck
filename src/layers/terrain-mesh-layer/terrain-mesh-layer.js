import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { Model, Geometry } from "@luma.gl/core";

import fs from './terrain-mesh-layer-fragment';

function validateGeometryAttributes(attributes, useMeshColors) {
  const hasColorAttribute = attributes.COLOR_0 || attributes.colors;
  const useColorAttribute = hasColorAttribute && useMeshColors;
  if (!useColorAttribute) {
    attributes.colors = { constant: true, value: new Float32Array([1, 1, 1]) };
  }
}

function getGeometry(data, useMeshColors) {
  if (data.attributes) {
    validateGeometryAttributes(data.attributes, useMeshColors);
    if (data instanceof Geometry) {
      return data;
    } else {
      return new Geometry(data);
    }
  } else if (data.positions || data.POSITION) {
    validateGeometryAttributes(data, useMeshColors);
    return new Geometry({
      attributes: data
    });
  }
  throw Error('Invalid mesh');
}

export class TerrainMeshLayer extends SimpleMeshLayer {

  static defaultProps = {
    heatmap: { type: 'image', value: null, async: true },
    heatmapOpacity: { type: 'number', min: 0, max: 1, value: 0.25 },
    traffic: { type: 'image', value: null, async: true },
    trafficOpacity: { type: 'number', min: 0, max: 1, value: 1 },
  }

  draw({ uniforms }) {
    if (!this.state.model) {
      return;
    }

    const { viewport } = this.context;
    const { sizeScale, coordinateSystem, _instanced, heatmapOpacity, trafficOpacity } = this.props;

    this.state.model
      .setUniforms(uniforms)
      .setUniforms({
        heatmapOpacity: Math.pow(heatmapOpacity, 1 / 2.2),
        trafficOpacity: Math.pow(trafficOpacity, 1 / 2.2),
        sizeScale,
        composeModelMatrix: !_instanced || shouldComposeModelMatrix(viewport, coordinateSystem),
        flatShading: !this.state.hasNormals
      })
      .draw();
  }

  getModel(mesh) {
    const model = new Model(this.context.gl, {
      ...this.getShaders(),
      id: this.props.id,
      geometry: getGeometry(mesh, this.props._useMeshColors),
      isInstanced: true
    });

    const { texture, heatmap, traffic } = this.props;
    const { emptyTexture } = this.state;
    model.setUniforms({
      sampler: texture || emptyTexture,
      heatmapSampler: heatmap || emptyTexture,
      trafficSampler: traffic || emptyTexture,
      hasTexture: Boolean(texture),
      hasHeatmap: Boolean(heatmap),
      hasTraffic: Boolean(traffic),
    });

    return model;
  }

  getShaders() {
    return Object.assign({}, super.getShaders(), {
      fs
    });
  }
}