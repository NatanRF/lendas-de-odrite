import { ODRITE } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

const VALORES_FIXOS = [14, 12, 10, 10, 8, 8, 6, 4];
const SLOTS_CAMINHO = ["um", "dois", "tres"];

function limitesConjuracaoPorCaminho(qtdCaminhos) {
  if (qtdCaminhos === 1) return [3];
  if (qtdCaminhos === 2) return [2, 1];
  if (qtdCaminhos === 3) return [1, 1, 1];
  return [];
}

function textoProficiencia(valor) {
  if (valor === "todas") return "Todas";
  if (valor === "todos") return "Todos";
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "Nenhuma";
  return "";
}

function formatarIdiomas(dadosRaca, mente) {
  const bonus = Math.max(0, mente - dadosRaca.idiomaLimiarMente);
  const partes = ["Comum"];
  if (dadosRaca.idiomaRacial) partes.push(dadosRaca.idiomaRacial);
  let texto = partes.join(", ");
  if (bonus > 0) texto += ` + ${bonus} idioma${bonus > 1 ? "s" : ""} à escolha`;
  return texto;
}

export default class OdriteCharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._etapa = "raca";
    this._dados = {
      raca: null,
      bonusAtributoAlvo: null,
      atributosSlot: {},
      classe: null,
      atributoPrincipal: null,
      categoriasArmaEscolhidas: [],
      habilidadesListaEscolhidas: [],
      devocao: null,
      caminhosEscolhidos: [],
      conjuracoesPorCaminho: {},
      dinheiro: { valor: 0, definido: false },
      equipamentoEscolhido: []
    };
    // estado puramente de UI (quais cards de descrição estão expandidos), não faz parte dos dados do personagem
    this._expandido = new Set();
  }

  static DEFAULT_OPTIONS = {
    id: "odrite-character-wizard-{id}",
    classes: ["odrite", "wizard"],
    tag: "div",
    position: { width: 640, height: 700 },
    window: { title: "ODRITE.Assistente.Titulo", resizable: true },
    actions: {
      escolherRaca: OdriteCharacterWizard.#escolherRaca,
      escolherBonusAtributo: OdriteCharacterWizard.#escolherBonusAtributo,
      atribuirValor: OdriteCharacterWizard.#atribuirValor,
      escolherClasse: OdriteCharacterWizard.#escolherClasse,
      escolherAtributoPrincipal: OdriteCharacterWizard.#escolherAtributoPrincipal,
      toggleCategoriaArma: OdriteCharacterWizard.#toggleCategoriaArma,
      toggleHabilidadeLista: OdriteCharacterWizard.#toggleHabilidadeLista,
      toggleDescricao: OdriteCharacterWizard.#toggleDescricao,
      escolherDevocao: OdriteCharacterWizard.#escolherDevocao,
      escolherCaminhoDevocao: OdriteCharacterWizard.#escolherCaminhoDevocao,
      toggleCaminho: OdriteCharacterWizard.#toggleCaminho,
      toggleConjuracao: OdriteCharacterWizard.#toggleConjuracao,
      rolarDinheiro: OdriteCharacterWizard.#rolarDinheiro,
      adicionarEquipamento: OdriteCharacterWizard.#adicionarEquipamento,
      decrementarEquipamento: OdriteCharacterWizard.#decrementarEquipamento,
      removerEquipamento: OdriteCharacterWizard.#removerEquipamento,
      avancar: OdriteCharacterWizard.#avancar,
      voltar: OdriteCharacterWizard.#voltar,
      confirmar: OdriteCharacterWizard.#confirmar,
      cancelar: OdriteCharacterWizard.#cancelar
    }
  };

  static PARTS = {
    form: { template: "systems/odrite/templates/apps/character-wizard.hbs" }
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    const inputMestre = this.element.querySelector(".input-dinheiro-mestre");
    inputMestre?.addEventListener("change", (event) => {
      const valor = Math.max(0, Number(event.target.value) || 0);
      this._dados.dinheiro = { valor, definido: true };
      this.render();
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const d = this._dados;

    context.etapa = this._etapa;
    context.dados = d;
    context.racas = ODRITE.racas;
    context.dadosRacas = ODRITE.dadosRacas;
    context.classes = ODRITE.classes;
    context.dadosClasses = ODRITE.dadosClasses;
    context.categoriasArma = ODRITE.categoriasArma;
    context.devocoes = Object.keys(ODRITE.devocoes);
    context.caminhosConjuracao = ODRITE.caminhosConjuracao;

    context.racaAtual = d.raca ? ODRITE.dadosRacas[d.raca] : null;
    context.classeAtual = d.classe ? ODRITE.dadosClasses[d.classe] : null;

    context.bonusAtributoOpcoes = context.racaAtual
      ? (context.racaAtual.bonusAtributo === "qualquer" ? Object.keys(ODRITE.atributos) : context.racaAtual.bonusAtributo)
      : [];

    const valoresFixosBase = VALORES_FIXOS.map((valor, indice) => ({
      indice,
      valor,
      ocupadoPor: Object.keys(d.atributosSlot).find((k) => d.atributosSlot[k] === indice) ?? null
    }));
    context.valoresFixos = valoresFixosBase;

    context.atributosLinhas = Object.keys(ODRITE.atributos).map((chave) => {
      const slot = Object.prototype.hasOwnProperty.call(d.atributosSlot, chave) ? d.atributosSlot[chave] : null;
      const ehPrincipal = chave === d.atributoPrincipal;
      return {
        chave,
        label: game.i18n.localize(ODRITE.atributos[chave]),
        slot,
        atribuido: slot !== null,
        valor: slot !== null ? VALORES_FIXOS[slot] : null,
        ehPrincipal,
        // o valor 14 (índice 0) fica travado no atributo principal da classe
        opcoesValor: ehPrincipal ? [] : valoresFixosBase.filter((vf) => vf.indice !== 0)
      };
    });
    context.todosAtributosAssinados = Object.keys(d.atributosSlot).length === 8;

    if (this._etapa === "classe" && d.classe) {
      context.atributoPrincipalOpcoes = context.classeAtual?.atributoPrincipal ?? [];
      const idx = await this._buscarHabilidadesLista(d.classe);
      context.habilidadesListaOpcoes = idx;
      context.qtdHabilidadesListaNecessarias = 1 + (context.racaAtual?.listaExtra ?? 0);
    }

    if (this._etapa === "conjuracao") {
      if (d.classe === "Canalizador") {
        context.limitesCaminho = limitesConjuracaoPorCaminho(d.caminhosEscolhidos.length);
        context.caminhosComOpcoes = [];
        for (let i = 0; i < d.caminhosEscolhidos.length; i++) {
          const caminho = d.caminhosEscolhidos[i];
          context.caminhosComOpcoes.push({
            caminho,
            limite: context.limitesCaminho[i],
            escolhidas: d.conjuracoesPorCaminho[caminho] ?? [],
            opcoes: await this._buscarConjuracoes(caminho)
          });
        }
      } else if (d.classe === "Combatente Sagrado" && d.caminhosEscolhidos.length) {
        const caminho = d.caminhosEscolhidos[0];
        context.caminhosComOpcoes = [{
          caminho,
          limite: 3,
          escolhidas: d.conjuracoesPorCaminho[caminho] ?? [],
          opcoes: await this._buscarConjuracoes(caminho)
        }];
      }
    }

    if (this._etapa === "equipamento") {
      context.equipamentoOpcoes = await this._buscarEquipamento();
      const gasto = d.equipamentoEscolhido.reduce((total, item) => total + item.preco * item.quantidade, 0);
      context.dinheiro = {
        valor: d.dinheiro.valor,
        definido: d.dinheiro.definido,
        gasto,
        restante: d.dinheiro.valor - gasto
      };
      context.limiteArmas = { atual: this._qtdArmasEscolhidas(), maximo: 2 };
      context.limiteCarga = { atual: this._qtdCargaEscolhida(), maximo: this._capacidadeCarga() };
    }

    if (this._etapa === "revisao") {
      context.resumo = await this._montarResumo();
    }

    return context;
  }

  async _buscarHabilidadesLista(classe) {
    const pack = game.packs.get("odrite.habilidades");
    const idx = await pack.getIndex({ fields: ["system.classe", "system.categoria", "system.origem", "system.tipo", "system.descricao"] });
    return idx
      .filter((i) => i.system.origem === "classe" && i.system.classe === classe && i.system.categoria === "lista")
      .map((i) => ({ ...i, expandido: this._expandido.has(i._id) }));
  }

  async _buscarConjuracoes(caminho) {
    const pack = game.packs.get("odrite.conjuracoes");
    const idx = await pack.getIndex({ fields: ["system.caminho", "system.duracao", "system.alcance", "system.descricao"] });
    return idx
      .filter((i) => i.system.caminho === caminho)
      .map((i) => ({ ...i, expandido: this._expandido.has(i._id) }));
  }

  async _buscarEquipamento() {
    const d = this._dados;
    const packsInfo = [
      { id: "odrite.armas", label: "ODRITE.Armas" },
      { id: "odrite.protecao", label: "ODRITE.Equipamento" },
      { id: "odrite.itens", label: "ODRITE.Mochila" }
    ];
    const resultado = [];
    for (const info of packsInfo) {
      const pack = game.packs.get(info.id);
      if (!pack) continue;
      const idx = await pack.getIndex({ fields: ["system.preco"] });
      const restante = this._dinheiroRestante();
      const itens = (idx.contents ?? Array.from(idx)).map((item) => {
        const escolhido = d.equipamentoEscolhido.find((e) => e.packId === info.id && e.id === item._id);
        const preco = item.system?.preco ?? 0;
        return {
          _id: item._id,
          name: item.name,
          tipo: item.type,
          preco,
          quantidadeEscolhida: escolhido?.quantidade ?? 0,
          semSaldo: preco > restante
        };
      });
      resultado.push({ packId: info.id, label: info.label, itens });
    }
    return resultado;
  }

  async _montarResumo() {
    const d = this._dados;
    const racaData = ODRITE.dadosRacas[d.raca];
    const classeData = ODRITE.dadosClasses[d.classe];
    const atributosFinais = this._atributosFinais();
    const gasto = d.equipamentoEscolhido.reduce((total, item) => total + item.preco * item.quantidade, 0);
    return {
      raca: d.raca,
      classe: d.classe,
      tamanho: racaData?.tamanho,
      deslocamento: racaData?.deslocamento,
      vitalidade: (racaData?.vitalidade ?? 0) + (classeData?.vitalidade ?? 0),
      atributos: atributosFinais,
      idiomas: racaData ? formatarIdiomas(racaData, atributosFinais.mente ?? 0) : "",
      categoriasArma: d.categoriasArmaEscolhidas,
      armaduras: classeData ? textoProficiencia(classeData.armaduras) : "",
      escudos: classeData ? textoProficiencia(classeData.escudos) : "",
      equipamento: d.equipamentoEscolhido,
      dinheiroInicial: d.dinheiro.valor,
      dinheiroGasto: gasto,
      dinheiroRestante: d.dinheiro.valor - gasto
    };
  }

  _capacidadeCarga() {
    const forca = this._atributosFinais().forca ?? 10;
    return Math.max(forca, 10);
  }

  _qtdArmasEscolhidas() {
    return this._dados.equipamentoEscolhido
      .filter((e) => e.tipo === "arma")
      .reduce((total, e) => total + e.quantidade, 0);
  }

  _qtdCargaEscolhida() {
    return this._dados.equipamentoEscolhido
      .filter((e) => e.tipo === "item")
      .reduce((total, e) => total + e.quantidade, 0);
  }

  _dinheiroRestante() {
    const gasto = this._dados.equipamentoEscolhido.reduce((total, e) => total + e.preco * e.quantidade, 0);
    return this._dados.dinheiro.valor - gasto;
  }

  _atributosFinais() {
    const d = this._dados;
    const finais = {};
    for (const [chave, slot] of Object.entries(d.atributosSlot)) {
      let valor = VALORES_FIXOS[slot];
      if (chave === d.bonusAtributoAlvo) valor = Math.min(valor + 1, 14);
      finais[chave] = valor;
    }
    return finais;
  }

  // ---- Etapa: Raça ----

  static #escolherRaca(event, target) {
    this._dados.raca = target.dataset.raca;
    this._dados.bonusAtributoAlvo = null;
    this.render();
  }

  static #escolherBonusAtributo(event, target) {
    this._dados.bonusAtributoAlvo = target.dataset.atributo;
    this.render();
  }

  // ---- Etapa: Atributos ----

  static #atribuirValor(event, target) {
    const atributo = target.dataset.atributo;
    const indice = Number(target.dataset.indice);
    if (indice === 0 || atributo === this._dados.atributoPrincipal) return;
    const slots = this._dados.atributosSlot;
    const outroAtributo = Object.keys(slots).find((k) => slots[k] === indice && k !== atributo);
    const slotAnterior = slots[atributo] ?? null;
    slots[atributo] = indice;
    if (outroAtributo) {
      if (slotAnterior !== null) slots[outroAtributo] = slotAnterior;
      else delete slots[outroAtributo];
    }
    this.render();
  }

  // ---- Etapa: Classe ----

  static #escolherClasse(event, target) {
    this._dados.classe = target.dataset.classe;
    this._dados.atributoPrincipal = null;
    this._dados.atributosSlot = {};
    this._dados.categoriasArmaEscolhidas = [];
    this._dados.habilidadesListaEscolhidas = [];
    this._dados.devocao = null;
    this._dados.caminhosEscolhidos = [];
    this._dados.conjuracoesPorCaminho = {};
    this.render();
  }

  static #escolherAtributoPrincipal(event, target) {
    const atributo = target.dataset.atributo;
    this._dados.atributoPrincipal = atributo;
    // o atributo principal sempre recebe o valor mais alto (14), travado
    this._dados.atributosSlot = { [atributo]: 0 };
    this.render();
  }

  static #toggleCategoriaArma(event, target) {
    const categoria = target.dataset.categoria;
    const d = this._dados;
    const limite = ODRITE.dadosClasses[d.classe]?.categoriasArma ?? 0;
    const indiceExistente = d.categoriasArmaEscolhidas.indexOf(categoria);
    if (indiceExistente >= 0) {
      d.categoriasArmaEscolhidas.splice(indiceExistente, 1);
    } else if (d.categoriasArmaEscolhidas.length < limite) {
      d.categoriasArmaEscolhidas.push(categoria);
    } else {
      ui.notifications.warn(game.i18n.format("ODRITE.Assistente.LimiteCategorias", { limite }));
    }
    this.render();
  }

  static #toggleHabilidadeLista(event, target) {
    const id = target.dataset.id;
    const d = this._dados;
    const racaData = d.raca ? ODRITE.dadosRacas[d.raca] : null;
    const limite = 1 + (racaData?.listaExtra ?? 0);
    const indiceExistente = d.habilidadesListaEscolhidas.indexOf(id);
    if (indiceExistente >= 0) {
      d.habilidadesListaEscolhidas.splice(indiceExistente, 1);
    } else if (d.habilidadesListaEscolhidas.length < limite) {
      d.habilidadesListaEscolhidas.push(id);
    } else {
      ui.notifications.warn(game.i18n.format("ODRITE.Assistente.LimiteHabilidades", { limite }));
    }
    this.render();
  }

  static #toggleDescricao(event, target) {
    const id = target.dataset.id;
    if (this._expandido.has(id)) this._expandido.delete(id);
    else this._expandido.add(id);
    this.render();
  }

  // ---- Etapa: Conjuração ----

  static #escolherDevocao(event, target) {
    const devocao = target.dataset.devocao;
    const d = this._dados;
    d.devocao = devocao;
    d.conjuracoesPorCaminho = {};
    const caminhoFixo = ODRITE.devocoes[devocao];
    d.caminhosEscolhidos = caminhoFixo ? [...caminhoFixo] : [];
    this.render();
  }

  static #escolherCaminhoDevocao(event, target) {
    this._dados.caminhosEscolhidos = [target.dataset.caminho];
    this._dados.conjuracoesPorCaminho = {};
    this.render();
  }

  static #toggleCaminho(event, target) {
    const caminho = target.dataset.caminho;
    const d = this._dados;
    const indiceExistente = d.caminhosEscolhidos.indexOf(caminho);
    if (indiceExistente >= 0) {
      d.caminhosEscolhidos.splice(indiceExistente, 1);
      delete d.conjuracoesPorCaminho[caminho];
    } else if (d.caminhosEscolhidos.length < 3) {
      d.caminhosEscolhidos.push(caminho);
    } else {
      ui.notifications.warn(game.i18n.localize("ODRITE.Assistente.LimiteCaminhos"));
    }
    this.render();
  }

  static #toggleConjuracao(event, target) {
    const caminho = target.dataset.caminho;
    const id = target.dataset.id;
    const d = this._dados;
    const indiceCaminho = d.caminhosEscolhidos.indexOf(caminho);
    const limite = limitesConjuracaoPorCaminho(d.caminhosEscolhidos.length)[indiceCaminho] ?? 0;
    const lista = d.conjuracoesPorCaminho[caminho] ?? (d.conjuracoesPorCaminho[caminho] = []);
    const indiceExistente = lista.indexOf(id);
    if (indiceExistente >= 0) {
      lista.splice(indiceExistente, 1);
    } else if (lista.length < limite) {
      lista.push(id);
    } else {
      ui.notifications.warn(game.i18n.format("ODRITE.Assistente.LimiteConjuracoes", { limite }));
    }
    this.render();
  }

  // ---- Etapa: Equipamento ----

  static async #rolarDinheiro(event, target) {
    const roll = await new Roll("3 + 1d6").evaluate();
    const valor = roll.total * 100;
    this._dados.dinheiro = { valor, definido: true };
    await roll.toMessage({
      flavor: game.i18n.localize("ODRITE.Assistente.DinheiroInicial"),
      speaker: ChatMessage.getSpeaker({ actor: this.actor })
    });
    ui.notifications.info(game.i18n.format("ODRITE.Assistente.DinheiroRolado", { valor }));
    this.render();
  }

  static #adicionarEquipamento(event, target) {
    const packId = target.dataset.pack;
    const id = target.dataset.id;
    const nome = target.dataset.nome;
    const preco = Number(target.dataset.preco) || 0;
    const tipo = target.dataset.tipo || this._dados.equipamentoEscolhido.find((e) => e.packId === packId && e.id === id)?.tipo;
    const d = this._dados;

    if (!d.dinheiro.definido) {
      return this._avisar("ODRITE.Assistente.Aviso.DefinaDinheiro");
    }
    if (tipo === "arma" && this._qtdArmasEscolhidas() >= 2) {
      return this._avisar("ODRITE.Assistente.Aviso.LimiteArmas");
    }
    if (tipo === "item" && this._qtdCargaEscolhida() >= this._capacidadeCarga()) {
      return this._avisar("ODRITE.Assistente.Aviso.LimiteCarga");
    }
    if (preco > this._dinheiroRestante()) {
      return this._avisar("ODRITE.Assistente.Aviso.DinheiroInsuficiente");
    }

    const existente = d.equipamentoEscolhido.find((e) => e.packId === packId && e.id === id);
    if (existente) existente.quantidade += 1;
    else d.equipamentoEscolhido.push({ packId, id, nome, preco, tipo, quantidade: 1 });
    this.render();
  }

  static #decrementarEquipamento(event, target) {
    const indice = Number(target.dataset.indice);
    const item = this._dados.equipamentoEscolhido[indice];
    if (!item) return;
    item.quantidade -= 1;
    if (item.quantidade <= 0) this._dados.equipamentoEscolhido.splice(indice, 1);
    this.render();
  }

  static #removerEquipamento(event, target) {
    const indice = Number(target.dataset.indice);
    this._dados.equipamentoEscolhido.splice(indice, 1);
    this.render();
  }

  // ---- Navegação ----

  static #voltar(event, target) {
    const ordem = this._ordemEtapas();
    const indiceAtual = ordem.indexOf(this._etapa);
    if (indiceAtual > 0) this._etapa = ordem[indiceAtual - 1];
    this.render();
  }

  static #avancar(event, target) {
    if (!this._validarEtapaAtual()) return;
    const ordem = this._ordemEtapas();
    const indiceAtual = ordem.indexOf(this._etapa);
    if (indiceAtual < ordem.length - 1) this._etapa = ordem[indiceAtual + 1];
    this.render();
  }

  _ordemEtapas() {
    const conjuradora = this._dados.classe ? ODRITE.dadosClasses[this._dados.classe]?.conjuradora : false;
    const etapas = ["raca", "classe", "atributos"];
    if (conjuradora) etapas.push("conjuracao");
    etapas.push("equipamento", "revisao");
    return etapas;
  }

  _validarEtapaAtual() {
    const d = this._dados;
    if (this._etapa === "raca") {
      if (!d.raca) return this._avisar("ODRITE.Assistente.Aviso.EscolhaRaca");
      if (!d.bonusAtributoAlvo) return this._avisar("ODRITE.Assistente.Aviso.EscolhaBonus");
    }
    if (this._etapa === "atributos") {
      if (Object.keys(d.atributosSlot).length < 8) return this._avisar("ODRITE.Assistente.Aviso.AtributosIncompletos");
    }
    if (this._etapa === "classe") {
      if (!d.classe) return this._avisar("ODRITE.Assistente.Aviso.EscolhaClasse");
      if (!d.atributoPrincipal) return this._avisar("ODRITE.Assistente.Aviso.EscolhaAtributoPrincipal");
      const limiteCategorias = ODRITE.dadosClasses[d.classe]?.categoriasArma ?? 0;
      if (d.categoriasArmaEscolhidas.length < limiteCategorias) return this._avisar("ODRITE.Assistente.Aviso.CategoriasIncompletas");
      const racaData = d.raca ? ODRITE.dadosRacas[d.raca] : null;
      const limiteHabilidades = 1 + (racaData?.listaExtra ?? 0);
      if (d.habilidadesListaEscolhidas.length < limiteHabilidades) return this._avisar("ODRITE.Assistente.Aviso.HabilidadesIncompletas");
    }
    if (this._etapa === "conjuracao") {
      if (!d.caminhosEscolhidos.length) return this._avisar("ODRITE.Assistente.Aviso.EscolhaCaminho");
      const limites = limitesConjuracaoPorCaminho(d.caminhosEscolhidos.length);
      for (let i = 0; i < d.caminhosEscolhidos.length; i++) {
        const caminho = d.caminhosEscolhidos[i];
        const escolhidas = d.conjuracoesPorCaminho[caminho] ?? [];
        if (escolhidas.length < limites[i]) return this._avisar("ODRITE.Assistente.Aviso.ConjuracoesIncompletas");
      }
    }
    return true;
  }

  _avisar(chave) {
    ui.notifications.warn(game.i18n.localize(chave));
    return false;
  }

  // ---- Finalização ----

  static async #cancelar(event, target) {
    this.close();
  }

  static async #confirmar(event, target) {
    const d = this._dados;
    const racaData = ODRITE.dadosRacas[d.raca];
    const classeData = ODRITE.dadosClasses[d.classe];
    const atributosFinais = this._atributosFinais();
    const vitalidadeTotal = (racaData?.vitalidade ?? 0) + (classeData?.vitalidade ?? 0);
    const gasto = d.equipamentoEscolhido.reduce((total, item) => total + item.preco * item.quantidade, 0);
    const drakeonsRestantes = Math.max(0, d.dinheiro.valor - gasto);

    const updateData = {
      "system.detalhes.raca": d.raca,
      "system.detalhes.classe": d.classe,
      "system.detalhes.tamanho": racaData?.tamanho ?? "",
      "system.detalhes.deslocamento": racaData?.deslocamento ?? 10,
      "system.vitalidade.max": vitalidadeTotal,
      "system.vitalidade.value": vitalidadeTotal,
      "system.nivelTreinamento": racaData?.nivelTreinamentoInicial ?? 1,
      "system.proficiencias.idiomas": racaData ? formatarIdiomas(racaData, atributosFinais.mente ?? 0) : "",
      "system.proficiencias.armas": d.categoriasArmaEscolhidas.join(", "),
      "system.proficiencias.armaduras": classeData ? textoProficiencia(classeData.armaduras) : "",
      "system.proficiencias.escudos": classeData ? textoProficiencia(classeData.escudos) : "",
      "system.recursos.drakeons": drakeonsRestantes
    };
    for (const [chave, valor] of Object.entries(atributosFinais)) {
      updateData[`system.atributos.${chave}.value`] = valor;
    }
    if (classeData?.fonteArcanaFixa) updateData["system.fonteArcana"] = classeData.fonteArcanaFixa;
    d.caminhosEscolhidos.forEach((caminho, i) => {
      updateData[`system.caminhosConjuracao.${SLOTS_CAMINHO[i]}`] = caminho;
    });

    await this.actor.update(updateData);

    const habilidadesPack = game.packs.get("odrite.habilidades");
    const idxHab = await habilidadesPack.getIndex({ fields: ["system.origem", "system.raca", "system.classe", "system.categoria"] });

    const paraImportar = [];
    idxHab
      .filter((i) => i.system.origem === "raca" && i.system.raca === d.raca)
      .forEach((i) => paraImportar.push({ pack: habilidadesPack, id: i._id }));
    idxHab
      .filter((i) => i.system.origem === "classe" && i.system.classe === d.classe && i.system.categoria === "basica")
      .forEach((i) => paraImportar.push({ pack: habilidadesPack, id: i._id }));
    d.habilidadesListaEscolhidas.forEach((id) => paraImportar.push({ pack: habilidadesPack, id }));

    const conjuracoesPack = game.packs.get("odrite.conjuracoes");
    for (const lista of Object.values(d.conjuracoesPorCaminho)) {
      for (const id of lista) paraImportar.push({ pack: conjuracoesPack, id });
    }

    const itensData = [];
    for (const { pack, id } of paraImportar) {
      if (!pack) continue;
      const doc = await pack.getDocument(id);
      if (doc) itensData.push(doc.toObject());
    }

    for (const equip of d.equipamentoEscolhido) {
      const pack = game.packs.get(equip.packId);
      if (!pack) continue;
      const doc = await pack.getDocument(equip.id);
      if (!doc) continue;
      if (doc.type === "item") {
        const objeto = doc.toObject();
        objeto.system.quantidade = equip.quantidade;
        itensData.push(objeto);
      } else {
        for (let i = 0; i < equip.quantidade; i++) itensData.push(doc.toObject());
      }
    }

    if (itensData.length) await this.actor.createEmbeddedDocuments("Item", itensData);

    ui.notifications.info(game.i18n.localize("ODRITE.Assistente.Concluido"));
    this.close();
  }
}
