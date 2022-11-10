import { SimpleMeshLayer, ScenegraphLayer } from "@deck.gl/mesh-layers";
import {OBJLoader} from '@loaders.gl/obj';
import {GLBLoader} from '@loaders.gl/gltf';

export function createSceneGraphLayer(
	data,
	id,
	scenegraph,
	color = [255, 255, 255, 255],
	pickable = true
) {
	return new ScenegraphLayer({
		id: id,
		data: data,
		pickable: false,
        loaders: [GLBLoader],
		scenegraph: scenegraph,
		_lighting: "pbr",
		getPosition: (d) => d.position,
		getOrientation: (d) => [0, 0, 90],
		getColor: color,
	});
}

export default function createMeshLayer(data, id) {
	return new SimpleMeshLayer({
		id: "mesh-layer",
		// data,
		mesh: 'http://localhost:5500/data/center3d.obj',
        loaders: [OBJLoader],
		getPosition: (d) => d.position,
		// getColor: (d) => [0, 0, 255],
		// getOrientation: (d) => [0, 90, 0],
	});
}
