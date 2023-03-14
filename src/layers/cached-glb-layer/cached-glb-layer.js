import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { ScenegraphNode, createGLTFObjects} from "@luma.gl/experimental";

export async function waitForGLTFAssets(gltfObjects) {
  const remaining = [];

  gltfObjects.scenes.forEach(scene => {
    scene.traverse((model) => {
      Object.values(model.model.getUniforms()).forEach((uniform) => {
        if (uniform.loaded === false) {
          remaining.push(uniform);
        }
      });
    });
  });

  return await waitWhileCondition(() => remaining.some(uniform => !uniform.loaded));
}

async function waitWhileCondition(condition) {
  while (condition()) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}


export class CachedGLBLayer extends ScenegraphLayer {
	_updateScenegraph() {
		console.log('updating scene graph');
		const props = this.props;
		const { gl } = this.context;
		let scenegraphData = null;
		if (props.scenegraph instanceof ScenegraphNode) {
			// Signature 1: props.scenegraph is a proper luma.gl Scenegraph
			scenegraphData = { scenes: [props.scenegraph] };
		} else if (props.scenegraph && !props.scenegraph.gltf) {
			// Converts loaders.gl gltf to luma.gl scenegraph using the undocumented @luma.gl/experimental function
			const gltf = props.scenegraph;
            for (let mat of gltf.materials) {
                mat.pbrMetallicRoughness.metallicFactor = 0.2;
                mat.pbrMetallicRoughness.roughnessFactor = 1;
            }
			const gltfObjects = createGLTFObjects(gl, gltf, this._getModelOptions());
			scenegraphData = { gltf, ...gltfObjects };

			waitForGLTFAssets(gltfObjects).then(() => this.setNeedsRedraw()); // eslint-disable-line @typescript-eslint/no-floating-promises
		} else if (props.scenegraph) {
			// DEPRECATED PATH: Assumes this data was loaded through GLTFScenegraphLoader
			log.deprecated("ScenegraphLayer.props.scenegraph", "Use GLTFLoader instead of GLTFScenegraphLoader")();
			scenegraphData = props.scenegraph;
		}

		const options = { layer: this, gl };
		const scenegraph = props.getScene(scenegraphData, options);
		const animator = props.getAnimator(scenegraphData, options);

		if (scenegraph instanceof ScenegraphNode) {
			this._deleteScenegraph();
			this._applyAllAttributes(scenegraph);
			this._applyAnimationsProp(scenegraph, animator, props._animations);
			this.setState({ scenegraph, animator });
		} else if (scenegraph !== null) {
			log.warn("invalid scenegraph:", scenegraph)();
		}
	}
}
