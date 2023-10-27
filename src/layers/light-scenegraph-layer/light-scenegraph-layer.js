import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import fs from './light-scenegraph-layer-fs';

export class LightScenegraphLayer extends ScenegraphLayer {
    getShaders() {
        return {
            ...super.getShaders(), 
            fs
        };
    }
}