import { moduleName } from "./fog-drawings.js";


export class FogDrawingsLayer extends DrawingsLayer {

    _playerView = false;

    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, {
            name: "fogDrawings",
            zIndex: game.settings.get(moduleName, "showTokensOverDrawings") ? 25 : 1050
        });
    };

    getDocuments() {
        return this.documentCollection.filter(d => d.data.flags[moduleName]?.fogDrawing);
    }

    _getNewDrawingData(origin) {
        const data = super._getNewDrawingData(origin);
        mergeObject(data, game.settings.get(moduleName, "fogDrawingDefaultData"));
        data.strokeWidth = 10;
        data.fillType = 1;
        data.flags[moduleName] = { fogDrawing: true };

        return data;
    }
}
