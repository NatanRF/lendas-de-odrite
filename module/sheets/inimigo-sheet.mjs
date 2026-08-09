import { ODRITE } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class OdriteInimigoSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["odrite", "sheet", "actor", "inimigo"],
    tag: "form",
    position: { width: 700, height: 750 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: OdriteInimigoSheet.#editImage,
      rollAtributo: OdriteInimigoSheet.#rollAtributo,
      rollManobra: OdriteInimigoSheet.#rollManobra,
      itemCreate: OdriteInimigoSheet.#itemCreate,
      itemEdit: OdriteInimigoSheet.#itemEdit,
      itemDelete: OdriteInimigoSheet.#itemDelete
    }
  };

  static PARTS = {
    form: { template: "systems/odrite/templates/actor/inimigo-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.listaAtributos = Object.entries(ODRITE.atributos).map(([chave, label]) => ({
      chave,
      label: game.i18n.localize(label),
      value: this.actor.system.atributos[chave].value
    }));

    context.manobras = this.actor.items.filter((i) => i.type === "manobra");
    context.habilidadesInimigo = this.actor.items.filter((i) => i.type === "habilidadeInimigo");
    context.armaduras = this.actor.items.filter((i) => i.type === "armadura");
    context.escudos = this.actor.items.filter((i) => i.type === "escudo");
    context.condicoes = this.actor.items
      .filter((i) => i.type === "condicao")
      .map((c) => ({
        id: c.id,
        nome: c.name,
        valorFormatado: c.system.valor >= 0 ? `+${c.system.valor}` : `${c.system.valor}`,
        negativa: c.system.valor < 0,
        permanente: c.system.permanente,
        duracaoRodadas: c.system.duracaoRodadas
      }));

    return context;
  }

  static #editImage(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path })
    });
    return fp.browse();
  }

  static #rollAtributo(event, target) {
    this.actor.rollAtributo(target.dataset.atributo);
  }

  static #rollManobra(event, target) {
    this.actor.rollManobra(target.closest("[data-item-id]").dataset.itemId);
  }

  static #itemCreate(event, target) {
    const type = target.dataset.type;
    return this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.localize(`ODRITE.NovoItem.${type}`), type }
    ]);
  }

  static #itemEdit(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    item?.sheet.render(true);
  }

  static #itemDelete(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    return this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }
}
