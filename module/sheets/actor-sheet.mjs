import { ODRITE } from "../config.mjs";
import OdriteCharacterAdvancement from "../apps/character-advancement.mjs";
import { estancarSangramento, recarregarArma } from "../helpers/combate.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const MUTILACAO_LABELS = {
  traumaColuna: "ODRITE.Mutilacao.TraumaColuna",
  maoDecepada: "ODRITE.Mutilacao.MaoDecepada",
  bracoDecepado: "ODRITE.Mutilacao.BracoDecepado",
  peDecepado: "ODRITE.Mutilacao.PeDecepado"
};

export default class OdriteCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["odrite", "sheet", "actor", "character"],
    tag: "form",
    position: { width: 900, height: 900 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: OdriteCharacterSheet.#editImage,
      switchTab: OdriteCharacterSheet.#switchTab,
      rollAtributo: OdriteCharacterSheet.#rollAtributo,
      rollAtaque: OdriteCharacterSheet.#rollAtaque,
      rollMagia: OdriteCharacterSheet.#rollMagia,
      rollHabilidade: OdriteCharacterSheet.#rollHabilidade,
      itemCreate: OdriteCharacterSheet.#itemCreate,
      itemEdit: OdriteCharacterSheet.#itemEdit,
      itemDelete: OdriteCharacterSheet.#itemDelete,
      toggleFadiga: OdriteCharacterSheet.#toggleFadiga,
      setNivelTreinamento: OdriteCharacterSheet.#setNivelTreinamento,
      abrirEvolucao: OdriteCharacterSheet.#abrirEvolucao,
      estancarSangramento: OdriteCharacterSheet.#estancarSangramento,
      recarregarArma: OdriteCharacterSheet.#recarregarArma
    }
  };

  static PARTS = {
    form: { template: "systems/odrite/templates/actor/character-sheet.hbs" }
  };

  _tabAtiva = "principal";

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    context.tabAtiva = this._tabAtiva;
    context.racas = ODRITE.racas;
    context.classes = ODRITE.classes;
    context.fontesArcanas = ODRITE.fontesArcanas;
    context.caminhosConjuracao = ODRITE.caminhosConjuracao;
    context.listaAtributos = Object.entries(ODRITE.atributos).map(([chave, label]) => ({
      chave,
      label: game.i18n.localize(label),
      value: this.actor.system.atributos[chave].value
    }));

    context.fadigaBoxes = Array.fromRange(12, 1).map((indice) => ({
      indice,
      marcado: indice <= this.actor.system.fadiga.value,
      grupo: indice <= 3 ? "normal" : indice <= 6 ? "penalidade2" : indice <= 9 ? "penalidade4" : "exaustao"
    }));

    context.nivelTreinamentoPips = Array.fromRange(5, 1).map((indice) => ({
      indice,
      marcado: indice <= this.actor.system.nivelTreinamento
    }));

    context.armas = this.actor.items.filter((i) => i.type === "arma");
    context.armaPrincipal = context.armas[0] ?? null;
    context.armaSecundaria = context.armas[1] ?? null;
    context.armaduras = this.actor.items.filter((i) => i.type === "armadura");
    context.escudos = this.actor.items.filter((i) => i.type === "escudo");
    context.magias = this.actor.items.filter((i) => i.type === "magia");
    context.habilidades = this.actor.items.filter((i) => i.type === "habilidade");
    context.mochila = this.actor.items.filter((i) => i.type === "item" && !i.system.slotEspecial);
    context.aljavas = this.actor.items.filter((i) => i.type === "item" && i.system.slotEspecial === "aljava");
    context.cantis = this.actor.items.filter((i) => i.type === "item" && i.system.slotEspecial === "cantil");
    context.algibeiras = this.actor.items.filter((i) => i.type === "item" && i.system.slotEspecial === "algibeira");

    context.ferimentosPermanentes = this.actor.system.ferimentosPermanentes ?? [];
    context.mutilacoes = (this.actor.system.mutilacoes ?? []).map((chave) =>
      game.i18n.localize(MUTILACAO_LABELS[chave] ?? chave)
    );

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

    const combatant = game.combat?.combatants.find((c) => c.actorId === this.actor.id);
    context.sangrando = !!combatant?.getFlag("odrite", "sangrando")?.ativo;

    const conjuracoesAtivas = this.actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
    context.manutencaoAtivaIds = conjuracoesAtivas.map((a) => a.itemId);

    return context;
  }

  static #editImage(event, target) {
    const current = this.actor.img;
    const fp = new FilePicker({
      type: "image",
      current,
      callback: (path) => this.actor.update({ img: path })
    });
    return fp.browse();
  }

  static #switchTab(event, target) {
    const tab = target.dataset.tab;
    this._tabAtiva = tab;
    for (const el of this.element.querySelectorAll(".aba-conteudo")) {
      el.hidden = el.dataset.tab !== tab;
    }
    for (const nav of this.element.querySelectorAll(".abas a")) {
      nav.classList.toggle("active", nav.dataset.tab === tab);
    }
  }

  static #rollAtributo(event, target) {
    this.actor.rollAtributo(target.dataset.atributo);
  }

  static #rollAtaque(event, target) {
    this.actor.rollAtaque(target.closest("[data-item-id]").dataset.itemId);
  }

  static #rollMagia(event, target) {
    this.actor.rollMagia(target.closest("[data-item-id]").dataset.itemId);
  }

  static #rollHabilidade(event, target) {
    this.actor.rollHabilidade(target.closest("[data-item-id]").dataset.itemId);
  }

  static #itemCreate(event, target) {
    const type = target.dataset.type;
    const slot = target.dataset.slot;

    if (type === "arma" && this.actor.items.filter((i) => i.type === "arma").length >= 2) {
      return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.MaximoArmas"));
    }

    const data = { name: game.i18n.localize(`ODRITE.NovoItem.${slot ?? type}`), type };
    if (slot) data.system = { slotEspecial: slot };

    return this.actor.createEmbeddedDocuments("Item", [data]);
  }

  static #itemEdit(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    item?.sheet.render(true);
  }

  static #itemDelete(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    return this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  static #toggleFadiga(event, target) {
    const indice = Number(target.dataset.indice);
    const atual = this.actor.system.fadiga.value;
    const novoValor = indice === atual ? indice - 1 : indice;
    return this.actor.update({ "system.fadiga.value": novoValor });
  }

  static #setNivelTreinamento(event, target) {
    const indice = Number(target.dataset.indice);
    return this.actor.update({ "system.nivelTreinamento": indice });
  }

  static #abrirEvolucao(event, target) {
    new OdriteCharacterAdvancement(this.actor).render(true);
  }

  static #estancarSangramento(event, target) {
    return estancarSangramento(this.actor);
  }

  static #recarregarArma(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    if (item) return recarregarArma(this.actor, item);
  }
}
