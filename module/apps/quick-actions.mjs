const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

const METODO_POR_TIPO = {
  arma: "rollAtaque",
  magia: "rollMagia",
  habilidade: "rollHabilidade",
  manobra: "rollManobra"
};

export default class OdriteQuickActions extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "odrite-quick-actions",
    classes: ["odrite", "quick-actions"],
    tag: "div",
    position: { width: 260, height: "auto" },
    window: { resizable: true },
    actions: {
      rolar: OdriteQuickActions.#rolar
    }
  };

  static PARTS = {
    body: { template: "systems/odrite/templates/apps/quick-actions.hbs" }
  };

  get title() {
    return this.actor?.name ?? game.i18n.localize("ODRITE.QuickActions.Titulo");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
    context.grupos = actor ? construirGrupos(actor) : [];
    return context;
  }

  static #rolar(event, target) {
    const metodo = METODO_POR_TIPO[target.dataset.tipo];
    this.actor?.[metodo]?.(target.dataset.itemId);
  }
}

function construirGrupos(actor) {
  if (actor.type === "character") {
    return [
      {
        titulo: "ODRITE.Armas",
        itens: actor.items
          .filter((i) => i.type === "arma")
          .map((i) => ({ id: i.id, nome: i.name, tipo: "arma", rolavel: true }))
      },
      {
        titulo: "ODRITE.Magias",
        itens: actor.items
          .filter((i) => i.type === "magia")
          .map((i) => ({ id: i.id, nome: i.name, tipo: "magia", rolavel: true }))
      },
      {
        titulo: "ODRITE.Habilidades",
        itens: actor.items
          .filter((i) => i.type === "habilidade")
          .map((i) => ({ id: i.id, nome: i.name, tipo: "habilidade", rolavel: i.system.tipo !== "passiva" }))
      }
    ];
  }

  if (actor.type === "inimigo") {
    return [
      {
        titulo: "ODRITE.ManobrasDeCombate",
        itens: actor.items
          .filter((i) => i.type === "manobra")
          .map((i) => ({ id: i.id, nome: i.name, tipo: "manobra", rolavel: i.system.ofensiva }))
      },
      {
        titulo: "ODRITE.Habilidades",
        itens: actor.items
          .filter((i) => i.type === "habilidadeInimigo")
          .map((i) => ({ id: i.id, nome: i.name, tipo: "habilidadeInimigo", rolavel: false }))
      }
    ];
  }

  return [];
}

let painel = null;

function obterPainel() {
  if (!painel) painel = new OdriteQuickActions();
  return painel;
}

Hooks.on("controlToken", () => {
  const selecionados = canvas.tokens?.controlled ?? [];
  const app = obterPainel();

  if (!selecionados.length) {
    if (app.rendered) app.close();
    return;
  }

  const alvo = selecionados[selecionados.length - 1];
  if (!alvo.actor?.isOwner) {
    if (app.rendered) app.close();
    return;
  }

  app.actor = alvo.actor;
  app.render(true);
});

function atualizarSeAtorAtual(actorId) {
  if (painel?.rendered && painel.actor?.id === actorId) painel.render();
}

Hooks.on("updateActor", (actor) => atualizarSeAtorAtual(actor.id));
Hooks.on("createItem", (item) => atualizarSeAtorAtual(item.parent?.id));
Hooks.on("updateItem", (item) => atualizarSeAtorAtual(item.parent?.id));
Hooks.on("deleteItem", (item) => atualizarSeAtorAtual(item.parent?.id));
