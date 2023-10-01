import { FusionTileLayer } from "../fusion-tile-layer/fusion-tile-layer";

const defaultProps = {
    fusionTopDown: (parent, current, index, getFusionCoords) => {
        let json = [];
        json = json.concat(...parent);
        return jsonFusionTopDown(json, current, index, getFusionCoords);
    },
    fusionBottomUP: (parent, current, getFusionCoords) => {
        let json = [];
        json = json.concat(...parent);
        return jsonFusionBottomUp(json, current, getFusionCoords);
    },
}

export class BuildingFusionLayer extends FusionTileLayer {
    
}