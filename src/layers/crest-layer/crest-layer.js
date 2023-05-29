import { Layer } from '@deck.gl/core';
import { picking, project32 } from '@deck.gl/core';
import { Model, Geometry } from '@luma.gl/core';
import {vs} from './crest-layer-vs'
import {fs} from './crest-layer-fs'

export class CrestLayer extends Layer {

	static defaultProps = {
		getStartPosition: {
			type: "attribute",
			value: (d) => d.startPosition,
		},
		getMiddlePosition: {
			type: "attribute",
			value: (d) => d.middlePosition,
		},
		getEndPosition: {
			type: "attribute",
			value: (d) => d.endPosition,
		},
		getStartDensity: {
			type: "attribute",
			value: (d) => d.startDensity,
		},
		getMiddleDensity: {
			type: "attribute",
			value: (d) => d.middleDensity,
		},
		getEndDensity: {
			type: "attribute",
			value: (d) => d.endDensity,
		},
		getStartColor: {
			type: "attribute",
			value: (d) => d.startColor.map((x) => x / 255),
		},
		getMiddleColor: {
			type: "attribute",
			value: (d) => d.middleColor.map((x) => x / 255),
		},
		getEndColor: {
			type: "attribute",
			value: (d) => d.endColor.map((x) => x / 255),
		},
		getIndex: {
			type: "attribute",
			value: (d) => d.index,
		},
		currentTime: {
			type: "float",
			value: 0,
		},
		isAnimated: {
			type: "bool",
			value: true
		},
		arrowSize: {
			type: "float",
			value: 30
		},
		minHeight: {
			type: "float",
			value: 5
		},
		maxHeight: {
			type: "float",
			value: 40
		}
	};

	initializeState() {
		const { gl } = this.context;
		const attributeManager = this.getAttributeManager();
		this.setState({
			model: this._getModel(gl),
		});
		attributeManager.addInstanced({
			startPositions: {
				size: 3,
				type: gl.DOUBLE,
				fp64: this.use64bitPositions(),
				transition: true,
				accessor: "getStartPosition",
			},
			endPositions: {
				size: 3,
				type: gl.DOUBLE,
				fp64: this.use64bitPositions(),
				transition: true,
				accessor: "getEndPosition",
			},
			startDensity: {
				size: 1,
				transition: true,
				accessor: "getStartDensity",
			},
			middleDensity: {
				size: 1,
				transition: true,
				accessor: "getMiddleDensity",
			},
			endDensity: {
				size: 1,
				transition: true,
				accessor: "getEndDensity",
			},
			startColor: {
				size: 3,
				transition: true,
				accessor: "getStartColor",
			},
			middleColor: {
				size: 3,
				transition: true,
				accessor: "getMiddleColor",
			},
			endColor: {
				size: 3,
				transition: true,
				accessor: "getEndColor",
			},
		});
	}

	updateState({ props, oldProps, changeFlags }) {
		if (changeFlags.extensionsChanged) {
			const { gl } = this.context;
			this.state.model.delete();
			this.state.model = this._getModel(gl);
			this.getAttributeManager().invalidateAll();
		}
		if (changeFlags.updateTriggersChanged) {
			for (let trigger of Object.keys(changeFlags.updateTriggersChanged))
				this.getAttributeManager().invalidate(trigger);
		}
	}

	_getDelta(a, b) {
		const diff = a >= b ? a - b : b - a;
		return (a >= b ? b : a) + diff;
	}

	getShaders() {
		return Object.assign({}, super.getShaders(), {
			vs,
			fs,
			modules: [project32, picking],
		});
	}

	static POSITIONS = [
		// top left
		0, 0, 1,
		// bottom left
		0, 0, 0,
		// top right
		1, 1, 1,
		// bottom right
		1, 1, 0,
	];

	_getModel(gl) {
		return new Model(gl, {
			...this.getShaders(),
			id: this.props.id,
			geometry: new Geometry({
				drawMode: gl.TRIANGLE_STRIP,
				attributes: {
					positions: new Float32Array(CrestLayer.POSITIONS),
				},
			}),
			isInstanced: true,
		});
	}

	draw(opt) {
		const { model } = this.state;
		const {
			currentTime,
			isAnimated,
			arrowSize,
			minHeight,
			maxHeight,
		} = this.props;

		if (model) 
			model.setUniforms({
				...opt.uniforms,
				currentTime,
				isAnimated,
				arrowSize,
				minHeight,
				maxHeight
			})
			.draw();
	}
}
