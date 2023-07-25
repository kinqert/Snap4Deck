import { IconLayer } from "@deck.gl/layers";
import { UNIT } from "@deck.gl/core";
import GL from '@luma.gl/constants';
import FusionIconManager from "./fusion-icon-manager";

const DEFAULT_COLOR = [0, 0, 0, 255];

const defaultProps = {
    ...IconLayer.defaultProps,
    commonState: { type: "object", value: null },
    updateCommonState: { type: "function", value: null, compare: false}
}

export class FusionIconLayer extends IconLayer {
    static defaultProps = defaultProps;

    initializeState() {
        this.state = {
            iconManager: new FusionIconManager(this.context.gl, {
                onUpdate: this._onUpdate.bind(this),
                onError: this._onError.bind(this)
            })
        };

        const attributeManager = this.getAttributeManager();
        attributeManager.addInstanced({
            instancePositions: {
                size: 3,
                type: GL.DOUBLE,
                fp64: this.use64bitPositions(),
                transition: true,
                accessor: 'getPosition'
            },
            instanceSizes: {
                size: 1,
                transition: true,
                accessor: 'getSize',
                defaultValue: 1
            },
            instanceOffsets: {
                size: 2,
                accessor: 'getIcon',
                transform: this.getInstanceOffset
            },
            instanceIconFrames: {
                size: 4,
                accessor: 'getIcon',
                transform: this.getInstanceIconFrame
            },
            instanceColorModes: {
                size: 1,
                type: GL.UNSIGNED_BYTE,
                accessor: 'getIcon',
                transform: this.getInstanceColorMode
            },
            instanceColors: {
                size: this.props.colorFormat.length,
                type: GL.UNSIGNED_BYTE,
                normalized: true,
                transition: true,
                accessor: 'getColor',
                defaultValue: DEFAULT_COLOR
            },
            instanceAngles: {
                size: 1,
                transition: true,
                accessor: 'getAngle'
            },
            instancePixelOffset: {
                size: 2,
                transition: true,
                accessor: 'getPixelOffset'
            }
        });
    }

    _onUpdate(iconsData) {
        if (iconsData && Object.keys(iconsData).length != 0) {
            this.props.updateCommonState(iconsData);
            this.setState({ iconsData, isUpdated: true });
        }
        this.setNeedsRedraw();
    }

    updateState(params) {
        // super.updateState(params);
        const { props, oldProps, changeFlags } = params;

        const attributeManager = this.getAttributeManager();
        const { iconAtlas, iconMapping, data, getIcon, textureParameters } = props;

        if (props.commonState) {
            this.setState({ 
                iconsData: props.commonState,
                isUpdated: false,
            });
        }

        const { iconManager, iconsData } = this.state;
        // internalState is always defined during updateState
        const prePacked = iconAtlas || this.internalState.isAsyncPropLoading('iconAtlas');
        iconManager.setProps({
            loadOptions: props.loadOptions,
            autoPacking: !prePacked,
            iconAtlas,
            iconMapping: prePacked ? (iconMapping) : null,
            iconsData,
            textureParameters
        });

        // prepacked iconAtlas from user
        if (prePacked) {
            if (oldProps.iconMapping !== props.iconMapping) {
                attributeManager.invalidate('getIcon');
            }
        } else if (
            (changeFlags.dataChanged ||
                (changeFlags.updateTriggersChanged &&
                    (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getIcon)))
        ) {
            // Auto packing - getIcon is expected to return an object
            iconManager.packIcons(data, getIcon, props.commonState);
        }

        if (changeFlags.extensionsChanged) {
            const { gl } = this.context;
            this.state.model?.delete();
            this.state.model = this._getModel(gl);
            attributeManager.invalidateAll();
        }
    }
    draw({ uniforms }) {
        const { sizeScale, sizeMinPixels, sizeMaxPixels, sizeUnits, billboard, alphaCutoff } = this.props;
        const { iconManager, isUpdated } = this.state;

        const iconsTexture = iconManager.getTexture();
        if (iconsTexture && isUpdated) {
            this.state.model
                .setUniforms(uniforms)
                .setUniforms({
                    iconsTexture,
                    iconsTextureDim: [iconsTexture.width, iconsTexture.height],
                    sizeUnits: UNIT[sizeUnits],
                    sizeScale,
                    sizeMinPixels,
                    sizeMaxPixels,
                    billboard,
                    alphaCutoff
                })
                .draw();
        }
    }
}