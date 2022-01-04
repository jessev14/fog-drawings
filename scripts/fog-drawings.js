import { libWrapper } from "../lib/shim.js";
import { FogDrawingsLayer } from "./FogDrawingsLayer.js";


export const moduleName = "fog-drawings";
let FG;


Hooks.on("init", () => {
    game.modules.get(moduleName).api = {
        FogDrawings: FogDrawings
    };
    FG = game.modules.get(moduleName).api.FogDrawings;

    FG.registerSettings();
    FG.registerLayer();
    FG.registerWrappers();
});

Hooks.once("setup", () => {
    FG.registerSetupHooks();
});


class FogDrawings {

    static registerSettings() {
        game.settings.registerMenu(moduleName, "fogDrawingDefaultDataMenu", {
            name: `${moduleName}.settings.fogDrawingDefaultDataMenu.name`,
            label: `${moduleName}.settings.fogDrawingDefaultDataMenu.label`,
            icon: "fas fa-paint-brush",
            type: FogDrawingDefaultDataMenu,
            restricted: true
        });

        game.settings.register(moduleName, "fogDrawingDefaultData", {
            name: "",
            hint: "",
            scope: "world",
            type: Object,
            default: {
                fillColor: "#e6cf3d",
                fillAlpha: 0.3,
                strokeColor: "#4669d2",
                strokeAlpha: 1
            },
            config: false
        });

        game.settings.register(moduleName, "showTokensOverDrawings", {
            name: `${moduleName}.settings.showTokensOverDrawings.name`,
            hint: `${moduleName}.settings.showTokensOverDrawings.hint`,
            scope: "world",
            type: Boolean,
            default: false,
            config: true,
            onChange: () => window.location.reload()
        });

        game.settings.register(moduleName, "blurFogDrawings", {
            name: `${moduleName}.settings.blurFogDrawings.name`,
            hint: `${moduleName}.settings.blurFogDrawings.hint`,
            scope: "world",
            type: Boolean,
            default: true,
            config: true,
            onChange: () => window.location.reload()
        });

        game.settings.register(moduleName, "playerViewToggle", {
            name: "",
            hint: "",
            scope: "client",
        })
    }

    static registerLayer() {
        CONFIG.Canvas.layers["fogDrawings"] = {
            layerClass: FogDrawingsLayer,
            group: game.settings.get(moduleName, "showTokensOverDrawings") ? "primary" : "interface"
        };
    }

    static registerWrappers() {
        // Drawings flagged as Fog Drawings are assigned to fogDrawings layer
        libWrapper.register(moduleName, "DrawingDocument.prototype.layer", function getLayer() {
            return this.data.flags[moduleName]?.fogDrawing ? canvas?.fogDrawings : canvas?.drawings;
        }, "OVERRIDE");

        // fogDrawings layer gets drawing documents with fogDrawing flag
        libWrapper.register(moduleName, "DrawingsLayer.prototype.getDocuments", function getDocuments(wrapped) {
            return wrapped().filter(d => !d.data.flags[moduleName]?.fogDrawing);
        }, "WRAPPER");

        // DrawingsLayer.deleteAll only deletes non-fog drawings
        libWrapper.register(moduleName, "DrawingsLayer.prototype.deleteAll", this.deleteAllDrawings.bind(this, false), "OVERRIDE");

        // Fog drawings are drawn differently for GMs and non-GMs
        libWrapper.register(moduleName, "Drawing.prototype.refresh", function fogRefresh(wrapped) {
            if (!this.document.getFlag(moduleName, "fogDrawing")) return wrapped();
            let isGM = game.user.isGM;
            if (this.layer._playerView) isGM = false;

            if (isGM && !this.data.hidden) {
                wrapped();
                this.shape.filters = null;
                return;
            };

            if (this._destroyed || this.shape._destroyed) return;
            this.shape.clear();

            const sc = foundry.utils.colorStringToHex("#000000");
            const sw = 10;
            this.shape.lineStyle(sw, isGM ? foundry.utils.colorStringToHex(this.data.strokeColor) : sc, isGM ? this.data.strokeAlpha : 1);

            const fc = foundry.utils.colorStringToHex("#000000");
            this.shape.beginFill(fc, isGM ? 0 : 1);

            switch (this.data.type) {
                case CONST.DRAWING_TYPES.RECTANGLE:
                    this._drawRectangle();
                    break;
                case CONST.DRAWING_TYPES.ELLIPSE:
                    this._drawEllipse();
                    break;
                case CONST.DRAWING_TYPES.POLYGON:
                    this._drawPolygon();
                    break;
            }

            this.shape.lineStyle(0x000000, 0.0).closePath();
            this.shape.endFill();

            this.shape.pivot.set(this.data.width / 2, this.data.height / 2);
            this.shape.position.set(this.data.width / 2, this.data.height / 2);
            this.shape.rotation = Math.toRadians(this.data.rotation || 0);

            const bounds = this.drawing.getLocalBounds();
            if (this.id && this._controlled) this._refreshFrame(bounds);
            else this.frame.visible = false;

            // Apply blur filter
            if (!isGM && game.settings.get(moduleName, "blurFogDrawings") && this.data.flags[moduleName].blur) {
                const blurFilter = new PIXI.filters.BlurFilter();
                blurFilter.padding = 10;
                blurFilter.blur = 15 * canvas.scene._viewPosition.scale;
                blurFilter.quality = 20; // make this a module setting
                this.shape.filters = [blurFilter];
            }

            this.position.set(this.data.x, this.data.y);
            this.drawing.hitArea = bounds;
            this.alpha = isGM ? 0.5 : this.data.hidden ? 0 : 1.0;
            this.visible = !this.data.hidden || game.user.isGM;
        }, "MIXED");
    }

    static registerSetupHooks() {
        // Add control button for new layer
        Hooks.on("getSceneControlButtons", controls => {
            if (!game.user.isGM) return;

            const fogDrawingControl = mergeObject(controls.find(c => c.name === "drawings"), {
                name: "fogDrawings",
                layer: "fogDrawings",
                title: game.i18n.localize(`${moduleName}.controls.title`),
                icon: "fas fa-smog",
                activeTool: "select"
            }, { inplace: false });
            fogDrawingControl.tools.splice(4, 3);
            fogDrawingControl.tools.splice(1, 0, {
                "name": "fogDrawingPlayerViewToggle",
                "title": `${moduleName}.controls.toolTitle`,
                "icon": "fas fa-eye",
                "toggle": true,
                "active": canvas.fogDrawings?._playerView || false,
                onClick: toggle => {
                    canvas.fogDrawings._playerView = toggle;
                    canvas.fogDrawings.placeables.forEach(d => d.refresh())
                }
            });
            fogDrawingControl.tools.find(t => t.name === "clear").onClick = () => this.deleteAllDrawings(true);
            controls.splice(controls.findIndex(c => c.name === "lighting"), 0, fogDrawingControl);
        });

        // Re-scale blur strength based on canvas zoom
        if (game.settings.get(moduleName, "blurFogDrawings")) {
            Hooks.on('canvasPan', (canvas, dimensions) => {    
                const fogDrawings = canvas.fogDrawings.placeables;
                fogDrawings.forEach(d => {
                    const blurFilter = d.shape.filters?.[0];
                    if (blurFilter && d.data.flags[moduleName]?.blur) blurFilter.blur = 15 * dimensions.scale;
                });
            });

            Hooks.on("preCreateDrawing", async (document, data, options, userID) => {
                if (!data.flags[moduleName]?.fogDrawing) return;
                
                await document.data.update({
                    flags: {
                        [moduleName]: {
                            blur: true
                        }
                    }
                });
            });
        }

        
    }

    static deleteAllDrawings(fogDrawingsTrue) {
        const type = "Drawing";
        if (!game.user.isGM) {
            throw new Error(`You do not have permission to delete ${type} objects from the Scene.`);
        }
        return Dialog.confirm({
            title: game.i18n.localize("CONTROLS.ClearAll"),
            content: `<p>${game.i18n.format("CONTROLS.ClearAllHint", { type })}</p>`,
            yes: () => {
                const drawingIDs = canvas.scene.drawings.contents
                    .filter(d => (d.getFlag(moduleName, "fogDrawing") || false) === fogDrawingsTrue)
                    .map(d => d.id);
                canvas.scene.deleteEmbeddedDocuments(type, drawingIDs);
            }
        });

    }
}

class FogDrawingDefaultDataMenu extends FormApplication {

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: game.i18n.localize(`${moduleName}.menu.title`),
            template: `modules/${moduleName}/templates/FogDrawingDefaultDataMenu.hbs`,
            width: 480,
            height: 200
        };
    }

    getData() {
        return game.settings.get(moduleName, "fogDrawingDefaultData");
    }

    async _updateObject(event, formData) {
        await game.settings.set(moduleName, "fogDrawingDefaultData", formData);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(`button[name="reset"]`).click(() => {
            const defaultData = game.settings.settings.get("fog-drawings.fogDrawingDefaultData").default;

            html.find(`input[name="strokeColor"]`).val(defaultData.strokeColor);
            html.find(`input[data-edit="strokeColor"]`).val(defaultData.strokeColor);

            html.find(`input[name="strokeAlpha"]`).val(defaultData.strokeAlpha);
            html.find(`input[name="strokeAlpha"]`).next(`span`).text(defaultData.strokeAlpha);
            
            html.find(`input[name="fillColor"]`).val(defaultData.fillColor);
            html.find(`input[data-edit="fillColor"]`).val(defaultData.fillColor);

            html.find(`input[name="fillAlpha"]`).val(defaultData.fillAlpha);
            html.find(`input[name="fillAlpha"]`).next(`span`).text(defaultData.fillAlpha);
        });
    }

}
