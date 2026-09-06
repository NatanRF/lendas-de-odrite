import { ODRITE } from "../config.mjs";
import OdriteCharacterAdvancement from "../apps/character-advancement.mjs";
import {
  estancarSangramento,
  levantarSe,
  libertarSe,
  orcamentoAcoesLivres,
  recarregarArma
} from "../helpers/combate.mjs";
import { condicaoNomeada } from "../helpers/condicoes.mjs";
import { MACULA_MAXIMA } from "../helpers/macula.mjs";
import { abrirDescansoCompleto, abrirFadigaDeViagem } from "../helpers/descanso.mjs";

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
      marcarMacula: OdriteCharacterSheet.#marcarMacula,
      setNivelTreinamento: OdriteCharacterSheet.#setNivelTreinamento,
      abrirEvolucao: OdriteCharacterSheet.#abrirEvolucao,
      estancarSangramento: OdriteCharacterSheet.#estancarSangramento,
      levantarSe: OdriteCharacterSheet.#levantarSe,
      libertarSe: OdriteCharacterSheet.#libertarSe,
      limparEco: OdriteCharacterSheet.#limparEco,
      descansar: OdriteCharacterSheet.#descansar,
      fadigaViagem: OdriteCharacterSheet.#fadigaViagem,
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
    context.devocoes = Object.keys(ODRITE.devocoes);
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

    // A escada inteira fica visível: os níveis já alcançados acesos e os
    // próximos apagados, para o jogador ver o que ainda vem pela frente.
    const macula = this.actor.system.macula ?? 0;
    context.maculaPips = Array.fromRange(MACULA_MAXIMA, 1).map((indice) => ({
      indice,
      marcado: indice <= macula,
      titulo: game.i18n.format("ODRITE.Macula.PipTitulo", {
        nivel: indice,
        efeito: game.i18n.localize(`ODRITE.Macula.Efeito.${indice}`)
      })
    }));
    context.maculaNiveis = Array.fromRange(MACULA_MAXIMA, 1).map((nivel) => ({
      nivel,
      ativo: nivel <= macula,
      efeito: game.i18n.localize(`ODRITE.Macula.Efeito.${nivel}`)
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
        chave: c.system.chave,
        valor: c.system.valor,
        valorFormatado: c.system.valor >= 0 ? `+${c.system.valor}` : `${c.system.valor}`,
        negativa: c.system.valor < 0,
        permanente: c.system.permanente,
        duracaoRodadas: c.system.duracaoRodadas
      }));

    const sangrando = condicaoNomeada(this.actor, "sangrando");
    context.sangrando = sangrando ? { intensidade: sangrando.system.intensidade } : null;
    context.caido = !!condicaoNomeada(this.actor, "caido");
    context.imobilizado = !!condicaoNomeada(this.actor, "imobilizado");

    const conjuracoesAtivas = this.actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
    context.manutencaoAtivaIds = conjuracoesAtivas.map((a) => a.itemId);
    context.rodadaAtivaIds = (this.actor.getFlag("odrite", "conjuracoesRodada") ?? []).map((a) => a.itemId);
    context.ecosAtivos = this.#coletarEcosAtivos();

    // Saldo de ações livres da rodada, para o jogador conferir sem abrir cada
    // habilidade passiva.
    const orcamento = orcamentoAcoesLivres(this.actor);
    const usadas = game.combat?.combatants.find((c) => c.actorId === this.actor.id)
      ?.getFlag("odrite", "acoesLivresUsadas") ?? {};
    context.acoesLivres = Object.entries(orcamento).map(([tipo, total]) => ({
      label: game.i18n.localize(ODRITE.acoesLivres[tipo] ?? tipo),
      restantes: total - (usadas[tipo] ?? 0),
      total
    }));

    return context;
  }

  /**
   * Maldições persistentes dos Ecos da Conjuração. O sistema não rastreia
   * calendário, então cada uma guarda os dias rolados e o mestre a remove
   * pela ficha quando o prazo vence.
   */
  #coletarEcosAtivos() {
    const ativos = [];

    const chaves = [
      "conjurarCustaFadiga", "conjurarCustaVitalidade", "conjuracaoFalhaAutomatica",
      "semManobrasDefensivas", "descansoSempreDesconfortavel"
    ];
    for (const chave of chaves) {
      const dias = this.actor.getFlag("odrite", chave);
      if (dias) ativos.push({ chave, label: game.i18n.localize(`ODRITE.Ecos.Ativo.${chave}`), dias });
    }

    for (const caminho of this.actor.getFlag("odrite", "caminhosBloqueados") ?? []) {
      ativos.push({
        chave: "caminhosBloqueados",
        caminho,
        label: game.i18n.format("ODRITE.Ecos.Ativo.caminhoBloqueado", { caminho })
      });
    }

    return ativos;
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

  /**
   * Pontos de Mácula não podem ser removidos, então os marcadores só avançam.
   * Correções ficam a cargo do mestre pelo console.
   */
  static #marcarMacula(event, target) {
    const indice = Number(target.dataset.indice);
    if (indice <= (this.actor.system.macula ?? 0)) {
      return ui.notifications.warn(game.i18n.localize("ODRITE.Macula.NaoRemovivel"));
    }
    return this.actor.update({ "system.macula": indice });
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

  static #levantarSe(event, target) {
    return levantarSe(this.actor);
  }

  static #libertarSe(event, target) {
    return libertarSe(this.actor);
  }

  static #limparEco(event, target) {
    const { chave, caminho } = target.dataset;

    if (chave === "caminhosBloqueados") {
      const restantes = (this.actor.getFlag("odrite", "caminhosBloqueados") ?? []).filter((c) => c !== caminho);
      return this.actor.setFlag("odrite", "caminhosBloqueados", restantes);
    }

    return this.actor.unsetFlag("odrite", chave);
  }

  static #descansar(event, target) {
    return abrirDescansoCompleto(this.actor);
  }

  static #fadigaViagem(event, target) {
    return abrirFadigaDeViagem(this.actor);
  }

  static #recarregarArma(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    if (item) return recarregarArma(this.actor, item);
  }
}
