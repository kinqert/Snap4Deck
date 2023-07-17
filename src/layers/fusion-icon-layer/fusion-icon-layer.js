import { IconLayer } from "@deck.gl/layers";

export class FusionIconLayer extends IconLayer {
    /* eslint-disable max-statements, complexity */
    updateState(params) {
        super.updateState(params);
        const { props, oldProps, changeFlags } = params;

        const attributeManager = this.getAttributeManager();
        const { iconAtlas, iconMapping, data, getIcon, textureParameters } = props;
        const { iconManager, iconsTexture } = this.state;

        // internalState is always defined during updateState
        const prePacked = iconAtlas || this.internalState.isAsyncPropLoading('iconAtlas');
        iconManager.setProps({
            loadOptions: props.loadOptions,
            autoPacking: !prePacked,
            iconAtlas,
            iconMapping: prePacked ? (iconMapping) : null,
            textureParameters
        });

        // prepacked iconAtlas from user
        if (prePacked) {
            console.log('pre pack');
            if (oldProps.iconMapping !== props.iconMapping) {
                console.log('invalidating get icon');
                attributeManager.invalidate('getIcon');
            }
        } else if (
            (changeFlags.dataChanged ||
                (changeFlags.updateTriggersChanged &&
                    (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getIcon)))
            && !iconsTexture
        ) {
            console.log('so many if');
            // Auto packing - getIcon is expected to return an object
            iconManager.packIcons(data, getIcon);
        }

        if (changeFlags.extensionsChanged) {
            console.log('ext change');
            const { gl } = this.context;
            this.state.model?.delete();
            this.state.model = this._getModel(gl);
            attributeManager.invalidateAll();
        }
        // if (!iconsTexture) {
        //     const newTextures = iconManager.getTexture();
        //     if (newTextures)
        //         this.setState({ iconsTexture: newTextures });
        // }
    }
    draw({ uniforms }) {
        const { sizeScale, sizeMinPixels, sizeMaxPixels, sizeUnits, billboard, alphaCutoff } = this.props;
        const { iconManager, iconsTexture } = this.state;

        let usedTextures = iconsTexture;
        if (!iconsTexture) {
            usedTextures = iconManager.getTexture();
            this.setState({iconsTexture: usedTextures});
        }
        if (iconsTexture) {
            this.state.model
                .setUniforms(uniforms)
                .setUniforms({
                    iconsTexture: usedTextures,
                    iconsTextureDim: [usedTextures.width, usedTextures.height],
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