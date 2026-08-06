import { ODRITE } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

const CUSTOS = {
  vitalidade: 1,
  atributo: 1,
  conjuracao: 2,
  habilidade: 2,
  categoriaArma: 2,
  treinamento: 3,
  idioma: 3,
  protecao: 3
};

const TIERS_PROTECAO = ["Leve", "Média", "Pesada"];

function parseListaSimples(texto) {
  return texto ? texto.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function parseProtecao(texto) {
  if (texto === "Todas" || texto === "Todos") return { completo: true, lista: [...TIERS_PROTECAO] };
  if (!texto || texto === "Nenhuma") return { completo: false, lista: [] };
  return { completo: false, lista: texto.split(",").map((s) => s.trim()).filter(Boolean) };
}

function formatarProtecao(lista, rotuloCompleto) {
  if (!lista.length) return "Nenhuma";
  if (lista.length >= TIERS_PROTECAO.length) return rotuloCompleto;
  return lista.join(", ");
}

export default class OdriteCharacterAdvancement extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    // estado puramente de UI, não faz parte dos dados do personagem
    this._expandido = new Set();
    this._protecaoTipo = "armadura";
  }

  static DEFAULT_OPTIONS = {
    id: "odrite-advancement-{id}",
    classes: ["odrite", "wizard"],
    tag: "div",
    position: { width: 620, height: 720 },
    window: { title: "ODRITE.Evolucao.Titulo", resizable: true },
    actions: {
      comprarVitalidade: OdriteCharacterAdvancement.#comprarVitalidade,
      comprarAtributo: OdriteCharacterAdvancement.#comprarAtributo,
      comprarConjuracao: OdriteCharacterAdvancement.#comprarConjuracao,
      comprarHabilidade: OdriteCharacterAdvancement.#comprarHabilidade,
      comprarCategoriaArma: OdriteCharacterAdvancement.#comprarCategoriaArma,
      comprarTreinamento: OdriteCharacterAdvancement.#comprarTreinamento,
      comprarIdioma: OdriteCharacterAdvancement.#comprarIdioma,
      escolherTipoProtecao: OdriteCharacterAdvancement.#escolherTipoProtecao,
      comprarProtecao: OdriteCharacterAdvancement.#comprarProtecao,
      toggleDescricao: OdriteCharacterAdvancement.#toggleDescricao
    }
  };

  static PARTS = {
    form: { template: "systems/odrite/templates/apps/character-advancement.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const s = this.actor.system;

    context.custos = CUSTOS;
    context.experiencia = s.detalhes.experiencia;

    context.atributos = Object.entries(ODRITE.atributos).map(([chave, label]) => ({
      chave,
      label: game.i18n.localize(label),
      valor: s.atributos[chave].value,
      noMaximo: s.atributos[chave].value >= 14
    }));

    context.nivelTreinamento = s.nivelTreinamento;
    context.treinamentoNoMaximo = s.nivelTreinamento >= 5;

    context.categoriasArmaAtuais = parseListaSimples(s.proficiencias.armas);
    context.categoriasArmaDisponiveis = ODRITE.categoriasArma.filter((c) => !context.categoriasArmaAtuais.includes(c));

    context.protecaoTipo = this._protecaoTipo;
    const campoProtecao = this._protecaoTipo === "armadura" ? "armaduras" : "escudos";
    context.protecaoAtual = parseProtecao(s.proficiencias[campoProtecao]);
    context.protecaoTiersDisponiveis = TIERS_PROTECAO.filter((t) => !context.protecaoAtual.lista.includes(t));

    context.caminhosConhecidos = [s.caminhosConjuracao.um, s.caminhosConjuracao.dois, s.caminhosConjuracao.tres].filter(Boolean);
    context.conjuracoesDisponiveis = context.caminhosConhecidos.length
      ? await this._buscarConjuracoesDisponiveis(context.caminhosConhecidos)
      : [];

    context.habilidadesDisponiveis = await this._buscarHabilidadesDisponiveis();

    return context;
  }

  async _buscarConjuracoesDisponiveis(caminhos) {
    const pack = game.packs.get("odrite.conjuracoes");
    const idx = await pack.getIndex({ fields: ["system.caminho", "system.duracao", "system.alcance", "system.descricao"] });
    const nomesConhecidos = new Set(this.actor.items.filter((i) => i.type === "magia").map((i) => i.name));
    const grupos = [];
    for (const caminho of caminhos) {
      const opcoes = idx
        .filter((i) => i.system.caminho === caminho && !nomesConhecidos.has(i.name))
        .map((i) => ({ ...i, expandido: this._expandido.has(i._id) }));
      if (opcoes.length) grupos.push({ caminho, opcoes });
    }
    return grupos;
  }

  async _buscarHabilidadesDisponiveis() {
    const classe = this.actor.system.detalhes.classe;
    const pack = game.packs.get("odrite.habilidades");
    const idx = await pack.getIndex({ fields: ["system.classe", "system.categoria", "system.origem", "system.descricao"] });
    const nomesConhecidos = new Set(this.actor.items.filter((i) => i.type === "habilidade").map((i) => i.name));
    return idx
      .filter((i) => i.system.origem === "classe" && i.system.classe === classe && i.system.categoria === "lista" && !nomesConhecidos.has(i.name))
      .map((i) => ({ ...i, expandido: this._expandido.has(i._id) }));
  }

  _podeComprar(custo) {
    return this.actor.system.detalhes.experiencia >= custo;
  }

  async _gastarExperiencia(custo, updateExtra = {}) {
    const restante = this.actor.system.detalhes.experiencia - custo;
    await this.actor.update({ "system.detalhes.experiencia": restante, ...updateExtra });
  }

  _avisar(chave) {
    ui.notifications.warn(game.i18n.localize(chave));
  }

  // ---- Compras de 1 PE ----

  static async #comprarVitalidade(event, target) {
    if (!this._podeComprar(CUSTOS.vitalidade)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const s = this.actor.system;
    await this._gastarExperiencia(CUSTOS.vitalidade, {
      "system.vitalidade.max": s.vitalidade.max + 1,
      "system.vitalidade.value": s.vitalidade.value + 1
    });
    this.render();
  }

  static async #comprarAtributo(event, target) {
    const chave = target.dataset.atributo;
    if (!this._podeComprar(CUSTOS.atributo)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const atual = this.actor.system.atributos[chave].value;
    if (atual >= 14) return this._avisar("ODRITE.Evolucao.Aviso.AtributoNoMaximo");
    await this._gastarExperiencia(CUSTOS.atributo, { [`system.atributos.${chave}.value`]: atual + 1 });
    this.render();
  }

  // ---- Compras de 2 PE ----

  static async #comprarConjuracao(event, target) {
    const id = target.dataset.id;
    if (!this._podeComprar(CUSTOS.conjuracao)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const pack = game.packs.get("odrite.conjuracoes");
    const doc = await pack.getDocument(id);
    if (!doc) return;
    await this._gastarExperiencia(CUSTOS.conjuracao);
    await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
    this.render();
  }

  static async #comprarHabilidade(event, target) {
    const id = target.dataset.id;
    if (!this._podeComprar(CUSTOS.habilidade)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const pack = game.packs.get("odrite.habilidades");
    const doc = await pack.getDocument(id);
    if (!doc) return;
    await this._gastarExperiencia(CUSTOS.habilidade);
    await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
    this.render();
  }

  static async #comprarCategoriaArma(event, target) {
    const categoria = target.dataset.categoria;
    if (!this._podeComprar(CUSTOS.categoriaArma)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const atuais = parseListaSimples(this.actor.system.proficiencias.armas);
    if (atuais.includes(categoria)) return;
    atuais.push(categoria);
    await this._gastarExperiencia(CUSTOS.categoriaArma, { "system.proficiencias.armas": atuais.join(", ") });
    this.render();
  }

  // ---- Compras de 3 PE ----

  static async #comprarTreinamento(event, target) {
    if (!this._podeComprar(CUSTOS.treinamento)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const atual = this.actor.system.nivelTreinamento;
    if (atual >= 5) return this._avisar("ODRITE.Evolucao.Aviso.TreinamentoNoMaximo");
    await this._gastarExperiencia(CUSTOS.treinamento, { "system.nivelTreinamento": atual + 1 });
    this.render();
  }

  static async #comprarIdioma(event, target) {
    const input = this.element.querySelector(".input-novo-idioma");
    const idioma = input?.value.trim();
    if (!idioma) return this._avisar("ODRITE.Evolucao.Aviso.DigiteIdioma");
    if (!this._podeComprar(CUSTOS.idioma)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const atual = this.actor.system.proficiencias.idiomas;
    const novo = atual ? `${atual}, ${idioma}` : idioma;
    await this._gastarExperiencia(CUSTOS.idioma, { "system.proficiencias.idiomas": novo });
    this.render();
  }

  static #escolherTipoProtecao(event, target) {
    this._protecaoTipo = target.dataset.tipo;
    this.render();
  }

  static async #comprarProtecao(event, target) {
    const tier = target.dataset.tier;
    if (!this._podeComprar(CUSTOS.protecao)) return this._avisar("ODRITE.Evolucao.Aviso.SemExperiencia");
    const campo = this._protecaoTipo === "armadura" ? "armaduras" : "escudos";
    const rotuloCompleto = this._protecaoTipo === "armadura" ? "Todas" : "Todos";
    const atual = parseProtecao(this.actor.system.proficiencias[campo]);
    if (atual.completo || atual.lista.includes(tier)) return;
    const novaLista = [...atual.lista, tier];
    await this._gastarExperiencia(CUSTOS.protecao, {
      [`system.proficiencias.${campo}`]: formatarProtecao(novaLista, rotuloCompleto)
    });
    this.render();
  }

  static #toggleDescricao(event, target) {
    const id = target.dataset.id;
    if (this._expandido.has(id)) this._expandido.delete(id);
    else this._expandido.add(id);
    this.render();
  }
}
