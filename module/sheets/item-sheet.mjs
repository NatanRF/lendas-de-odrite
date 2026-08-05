import { ODRITE } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export default class OdriteItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["odrite", "sheet", "item"],
    tag: "form",
    position: { width: 480, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: OdriteItemSheet.#editImage
    }
  };

  static PARTS = {
    form: { template: "systems/odrite/templates/item/item-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.tipo = this.item.type;
    context.empunhaduras = ODRITE.empunhaduras;
    context.classes = ODRITE.classes;
    return context;
  }

  static #editImage(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.item.img,
      callback: (path) => this.item.update({ img: path })
    });
    return fp.browse();
  }
}
