/* global document */
import GL from '@luma.gl/constants';
import { Texture2D, copyToTexture } from '@luma.gl/core';
import { load } from '@loaders.gl/core';
import { createIterable } from '@deck.gl/core';

const DEFAULT_CANVAS_WIDTH = 1024;
const DEFAULT_BUFFER = 4;

const noop = () => { };

const DEFAULT_TEXTURE_PARAMETERS = {
    [GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
    // GL.LINEAR is the default value but explicitly set it here
    [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
    // for texture boundary artifact
    [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
    [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE
};

function nextPowOfTwo(number) {
    return Math.pow(2, Math.ceil(Math.log2(number)));
}

// update comment to create a new texture and copy original data.
function resizeImage(
    ctx,
    imageData,
    width,
    height
) {
    if (width === imageData.width && height === imageData.height) {
        return imageData;
    }

    ctx.canvas.height = height;
    ctx.canvas.width = width;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
    ctx.drawImage(imageData, 0, 0, imageData.width, imageData.height, 0, 0, width, height);

    return ctx.canvas;
}

function getIconId(icon) {
    return icon && (icon.id || icon.url);
}

// resize texture without losing original data
function resizeTexture(
    texture,
    width,
    height,
    parameters
) {
    const oldWidth = texture.width;
    const oldHeight = texture.height;

    const newTexture = new Texture2D(texture.gl, { width, height, parameters });
    copyToTexture(texture, newTexture, {
        targetY: 0,
        width: oldWidth,
        height: oldHeight
    });

    texture.delete();
    return newTexture;
}

// traverse icons in a row of icon atlas
// extend each icon with left-top coordinates
function buildRowMapping(
    mapping,
    columns,
    yOffset
) {
    for (let i = 0; i < columns.length; i++) {
        const { icon, xOffset } = columns[i];
        const id = getIconId(icon);
        mapping[id] = {
            ...icon,
            x: xOffset,
            y: yOffset
        };
    }
}

/**
 * Generate coordinate mapping to retrieve icon left-top position from an icon atlas
 */
export function buildMapping({
    icons,
    buffer,
    mapping = {},
    xOffset = 0,
    yOffset = 0,
    rowHeight = 0,
    canvasWidth
}) {
    let columns = [];
    mapping = mapping ? mapping : {};
    // Strategy to layout all the icons into a texture:
    // traverse the icons sequentially, layout the icons from left to right, top to bottom
    // when the sum of the icons width is equal or larger than canvasWidth,
    // move to next row starting from total height so far plus max height of the icons in previous row
    // row width is equal to canvasWidth
    // row height is decided by the max height of the icons in that row
    // mapping coordinates of each icon is its left-top position in the texture
    for (let i = 0; i < icons.length; i++) {
        const icon = icons[i];
        const id = getIconId(icon);

        if (!mapping[id]) {
            const { height, width } = icon;

            // fill one row
            if (xOffset + width + buffer > canvasWidth) {
                buildRowMapping(mapping, columns, yOffset);

                xOffset = 0;
                yOffset = rowHeight + yOffset + buffer;
                rowHeight = 0;
                columns = [];
            }

            columns.push({
                icon,
                xOffset
            });

            xOffset = xOffset + width + buffer;
            rowHeight = Math.max(rowHeight, height);
        }
    }

    if (columns.length > 0) {
        buildRowMapping(mapping, columns, yOffset);
    }

    return {
        mapping,
        rowHeight,
        xOffset,
        yOffset,
        canvasWidth,
        canvasHeight: nextPowOfTwo(rowHeight + yOffset + buffer)
    };
}

// extract icons from data
// return icons should be unique, and not cached or cached but url changed
export function getDiffIcons(
    data,
    getIcon,
    cachedIcons
) {
    if (!data || !getIcon) {
        return null;
    }

    cachedIcons = cachedIcons || {};
    const icons = {};
    const { iterable, objectInfo } = createIterable(data);
    for (const object of iterable) {
        objectInfo.index++;
        const icon = getIcon(object, objectInfo);
        const id = getIconId(icon);

        if (!icon) {
            throw new Error('Icon is missing.');
        }

        if (!icon.url) {
            throw new Error('Icon url is missing.');
        }

        if (!icons[id] && (!cachedIcons[id] || icon.url !== cachedIcons[id].url)) {
            icons[id] = { ...icon, source: object, sourceIndex: objectInfo.index };
        }
    }
    return icons;
}

export default class IconManager {
    gl;

    onUpdate;
    onError;
    _loadOptions = null;
    _texture = null;
    _externalTexture = null;
    _mapping = null;
    _textureParameters = null;

    /** count of pending requests to fetch icons */
    _pendingCount = 0;

    _autoPacking = false;

    // / internal state used for autoPacking

    _xOffset = 0;
    _yOffset = 0;
    _rowHeight = 0;
    _buffer = DEFAULT_BUFFER;
    _canvasWidth = DEFAULT_CANVAS_WIDTH;
    _canvasHeight = 0;
    _canvas = null;
    _iconsData = {};

    constructor(
        gl,
        {
            onUpdate = noop,
            onError = noop
        }) {
        this.gl = gl;
        this.onUpdate = onUpdate;
        this.onError = onError;
    }

    finalize() {
        this._texture?.delete();
    }

    getTexture() {
        return this._texture || this._externalTexture;
    }

    getIconsData() {
        return this._iconsData;
    }

    getIconMapping(icon) {
        const id = this._autoPacking ? getIconId(icon) : (icon);
        return this._mapping[id] || {};
    }

    setProps({
        loadOptions,
        autoPacking,
        iconAtlas,
        iconMapping,
        iconsData,
        textureParameters
    }) {
        if (loadOptions) {
            this._loadOptions = loadOptions;
        }

        if (autoPacking !== undefined) {
            this._autoPacking = autoPacking;
        }

        if (iconMapping) {
            this._mapping = iconMapping;
        }

        if (iconsData) { 
            this._iconsData = iconsData;
        }

        if (iconAtlas) {
            this._texture?.delete();
            this._texture = null;
            this._externalTexture = iconAtlas;
        }

        if (textureParameters) {
            this._textureParameters = textureParameters;
        }
    }

    get isLoaded() {
        return this._pendingCount === 0;
    }

    packIcons(data, getIcon, iconsData) {
        if (!this._autoPacking || typeof document === 'undefined') {
            return;
        }

        iconsData = iconsData ? iconsData : {};

        const icons = Object.values(getDiffIcons(data, getIcon, {}) || {});
        // const icons = Object.values(getDiffIcons(data, getIcon, this._mapping) || {});

        if (icons.length > 0) {
            // generate icon mapping
            const { mapping, xOffset, yOffset, rowHeight, canvasHeight } = buildMapping({
                icons,
                buffer: this._buffer,
                canvasWidth: this._canvasWidth,
                mapping: this._mapping,
                rowHeight: this._rowHeight,
                xOffset: this._xOffset,
                yOffset: this._yOffset
            });

            this._rowHeight = rowHeight;
            this._mapping = mapping;
            this._xOffset = xOffset;
            this._yOffset = yOffset;
            this._canvasHeight = canvasHeight;

            // create new texture
            if (!this._texture) {
                this._texture = new Texture2D(this.gl, {
                    width: this._canvasWidth,
                    height: this._canvasHeight,
                    parameters: this._textureParameters || DEFAULT_TEXTURE_PARAMETERS
                });
            }

            if (this._texture.height !== this._canvasHeight) {
                this._texture = resizeTexture(
                    this._texture,
                    this._canvasWidth,
                    this._canvasHeight,
                    this._textureParameters || DEFAULT_TEXTURE_PARAMETERS
                );
            }

            // this.onUpdate();

            // load images
            this._canvas = this._canvas || document.createElement('canvas');
            this._loadIcons(icons, iconsData);
        }
    }

    _loadIcons(icons, iconsData) {
        // This method is only called in the auto packing case, where _canvas is defined
        const ctx = this._canvas.getContext('2d', {
            willReadFrequently: true
        });

        for (const icon of icons) {
            this._pendingCount++;
            const id = getIconId(icon);
            // if (this._iconsData.hasOwnProperty(id)) {
            //     this._texture.setSubImageData({
            //         ...this._iconsData[id]
            //     });
            if (iconsData.hasOwnProperty(id)) {
                const { x, y, width, height } = this._mapping[id];

                const data = resizeImage(ctx, iconsData[id], width, height);
                this._texture.setSubImageData({
                    data,
                    x,
                    y,
                    width,
                    height
                });

                // Call to regenerate mipmaps after modifying texture(s)
                this._texture.generateMipmap();

                this._pendingCount--;
                if (this._pendingCount == 0)
                    this.onUpdate(iconsData);
            } else {
                load(icon.url, this._loadOptions)
                    .then(imageData => {
                        iconsData[id] = imageData;
                        const { x, y, width, height } = this._mapping[id];

                        const data = resizeImage(ctx, imageData, width, height);
                        this._texture.setSubImageData({
                            data,
                            x,
                            y,
                            width,
                            height
                        });

                        // Call to regenerate mipmaps after modifying texture(s)
                        this._texture.generateMipmap();

                        this._pendingCount--;
                        if (this._pendingCount == 0)
                            this.onUpdate(iconsData);
                        // this.onUpdate(iconsData);
                    })
                    .catch(error => {
                        this._pendingCount--;
                        this.onError({
                            url: icon.url,
                            source: icon.source,
                            sourceIndex: icon.sourceIndex,
                            loadOptions: this._loadOptions,
                            error
                        });
                    });
                    // .finally(() => {
                    //     this._pendingCount--;
                    // });
            }

        }
    }
}
