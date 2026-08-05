import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "../helpers/dice.mjs";

export default class OdriteActor extends Actor {
  /** @override */
  async _preUpdate(changes, options, user) {
    const result = await super._preUpdate(changes, options, user);
    if (result === false) return false;

    const novaFadiga = changes.system?.fadiga?.value;
    if (novaFadiga >= 12) {
      foundry.utils.setProperty(changes, "system.vitalidade.value", 0);
    }
  }

  /**
   * Penalidade total de d20 para um atributo: fadiga sempre conta, e a
   * penalidade de armadura/escudo conta apenas para testes de Agilidade.
   * @param {string} chave
   */
  _penalidadeAtributo(chave) {
    let penalidade = this.system.fadiga.penalidade;
    if (chave === "agilidade") penalidade -= this.system.penalidadeAgilidade;
    return penalidade;
  }

  /**
   * Rola um teste de atributo puro (ex: Resistência, Mente).
   * @param {string} chave Chave do atributo em system.atributos (ex: "resistencia").
   */
  async rollAtributo(chave) {
    const atributo = this.system.atributos?.[chave];
    if (!atributo) return ui.notifications.error(`Atributo "${chave}" não encontrado.`);

    const label = game.i18n.localize(ODRITE.atributos[chave] ?? chave);
    return rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteAtributo", { atributo: label }),
      alvo: atributo.value,
      atributoLabel: label,
      penalidade: this._penalidadeAtributo(chave),
      actor: this
    });
  }

  /**
   * Rola um teste de ataque com uma arma: d20 contra Força/Agilidade +
   * dado de treinamento (benefício em resultado 1).
   * @param {string} itemId
   */
  async rollAtaque(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "arma") return ui.notifications.error("Arma não encontrada.");

    const atributoChave = item.system.atributo;
    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave] ?? atributoChave);

    return rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteAtaque", { arma: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      penalidade: this.system.fadiga.penalidade,
      dadoSecundarioFaces: this.system.dadoTreinamento,
      dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoTreinamento"),
      testeDeAcerto: true,
      actor: this
    });
  }

  /**
   * Rola um teste de conjuração: d20 contra Conjuração + dado de refinamento
   * (1d6, benefício em resultado 1).
   * @param {string} itemId
   */
  async rollMagia(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "magia") return ui.notifications.error("Magia não encontrada.");

    const atributo = this.system.atributos?.conjuracao;
    const label = game.i18n.localize(ODRITE.atributos.conjuracao);

    return rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteMagia", { magia: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      penalidade: this.system.fadiga.penalidade,
      dadoSecundarioFaces: ODRITE.dadoRefinamentoMagia,
      dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoRefinamento"),
      actor: this
    });
  }

  /**
   * Rola o teste de ativação de uma habilidade: d20 contra Habilidade
   * (tipo ativa) ou Conjuração (tipo conjuração). Habilidades passivas
   * não possuem teste de ativação.
   * @param {string} itemId
   */
  async rollHabilidade(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "habilidade") return ui.notifications.error("Habilidade não encontrada.");

    const atributoChave = item.system.tipo === "conjuracao" ? "conjuracao" : "habilidade";
    if (item.system.tipo === "passiva") return;

    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave]);

    return rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteHabilidade", { habilidade: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      penalidade: this._penalidadeAtributo(atributoChave),
      actor: this
    });
  }
}
