import * as deck_core from '@deck.gl/core';
import * as deck_extensions from '@deck.gl/extensions';
import * as deck_geolayers from '@deck.gl/geo-layers';
import * as deck_layers from '@deck.gl/layers';
import * as deck_meshlayers from '@deck.gl/mesh-layers';

export const deck = {};
Object.assign(deck, deck_core);
Object.assign(deck, deck_extensions);
Object.assign(deck, deck_geolayers);
Object.assign(deck, deck_layers);
Object.assign(deck, deck_meshlayers);

export * from './core/bundle';
export * from './layers/bundle';
export * from './factories/bundle';
export * from './utils/bundle';