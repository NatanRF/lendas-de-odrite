import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "../helpers/dice.mjs";
import {
  obterAlvo,
  processarAcerto,
  processarAcertoAbsoluto,
  processarAcertoFatal,
  processarFalhaAbsoluta,
  registrarUsoManobra,
  concederIsencaoProximoAtaque
} from "../helpers/combate.mjs";
import { resolverConjuracao } from "../helpers/conjuracao.mjs";
import { aplicarCondicao } from "../helpers/condicoes.mjs";

export default class OdriteActor extends Actor {
  /** @override */
  async _preUpdate(changes, options, user) {
    const result = await super._preUpdate(changes, options, user);
    if (result === false) return false;

    const novaFadiga = changes.system?.fadiga?.value;
    const limite = this.system.fadiga?.limite ?? 12;
    if (novaFadiga >= limite) {
      foundry.utils.setProperty(changes, "system.vitalidade.value", 0);
    }
  }

  /**
   * Modificadores base de d20 para um atributo: fadiga sempre conta, e a
   * penalidade de armadura/escudo conta apenas para testes de Agilidade.
   * @param {string} chave
   * @returns {{label: string, valor: number}[]}
   */
  _modificadoresBase(chave) {
    const modificadores = [];
    const fadiga = this.system.fadiga?.penalidade ?? 0;
    if (fadiga) modificadores.push({ label: game.i18n.localize("ODRITE.Fadiga"), valor: fadiga });

    if (chave === "agilidade") {
      const armadura = this.system.penalidadeAgilidade ?? 0;
      if (armadura) modificadores.push({ label: game.i18n.localize("ODRITE.PenalidadeArmadura"), valor: -armadura });
    }

    return modificadores;
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
      modificadores: this._modificadoresBase(chave),
      tipoTeste: "atributo",
      atributoChave: chave,
      actor: this
    });
  }

  /**
   * Rola um teste de ataque com uma arma: d20 contra Força/Agilidade +
   * dado de treinamento (benefício em resultado 1). Exige um alvo targetado
   * (ou explícito, usado pelo contra-ataque automático do Aparar); em caso
   * de acerto, aplica dano automaticamente (ou abre o prompt de defesa).
   * @param {string} itemId
   * @param {Actor} [alvoExplicito]
   */
  async rollAtaque(itemId, alvoExplicito = null) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "arma") return ui.notifications.error("Arma não encontrada.");

    if (item.system.usaMunicao && this.system.recursos.municao.value <= 0) {
      return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SemMunicao"));
    }

    if (item.system.exigeRecarga && !item.system.carregada) {
      return ui.notifications.warn(game.i18n.format("ODRITE.Aviso.ArmaDescarregada", { arma: item.name }));
    }

    const alvo = alvoExplicito ?? obterAlvo();
    if (!alvo) return;

    await registrarUsoManobra(this, "atacar", item.system.categoria);

    if (item.system.usaMunicao) {
      await this.update({ "system.recursos.municao.value": this.system.recursos.municao.value - 1 });
    }

    if (item.system.exigeRecarga) {
      await item.update({ "system.carregada": false });
    }

    const atributoChave = item.system.atributo;
    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave] ?? atributoChave);

    const modificadores = [];
    if (this.system.fadiga.penalidade) {
      modificadores.push({ label: game.i18n.localize("ODRITE.Fadiga"), valor: this.system.fadiga.penalidade });
    }

    const resultado = await rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteAtaque", { arma: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      modificadores,
      tipoTeste: "ataque",
      atributoChave,
      dadoSecundarioFaces: this.system.dadoTreinamento,
      dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoTreinamento"),
      testeDeAcerto: true,
      actor: this
    });

    if (resultado.acertoAbsoluto && resultado.resultadoSecundario === 1) {
      return processarAcertoFatal({ atacante: this, alvo });
    }
    if (resultado.acertoAbsoluto) {
      await concederIsencaoProximoAtaque(this);
      return processarAcertoAbsoluto({
        atacante: this,
        alvo,
        item,
        dano: item.system.dano,
        tipoAtaque: item.system.tipoAtaque
      });
    }
    if (resultado.falhaAbsoluta) {
      return processarFalhaAbsoluta(this);
    }
    if (resultado.acertou) {
      await processarAcerto({ atacante: this, alvo, dano: item.system.dano, tipoAtaque: item.system.tipoAtaque });
    }
  }

  /**
   * Rola um teste de conjuração: mecânica própria de Bênção Divina / Pacto
   * Amaldiçoado, Dado de Refinamento e Duração — não usa o sistema genérico
   * de Acerto/Falha Absoluta de armas e manobras.
   * @param {string} itemId
   */
  async rollMagia(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "magia") return ui.notifications.error("Magia não encontrada.");

    return resolverConjuracao(this, item);
  }

  /**
   * Rola o teste de ativação de uma habilidade: d20 contra Habilidade
   * (tipo ativa) ou Conjuração (tipo conjuração). Habilidades passivas
   * não possuem teste de ativação. Se a habilidade conceder uma Condição,
   * ela é aplicada ao próprio personagem após a rolagem.
   * @param {string} itemId
   */
  async rollHabilidade(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "habilidade") return ui.notifications.error("Habilidade não encontrada.");

    const atributoChave = item.system.tipo === "conjuracao" ? "conjuracao" : "habilidade";
    if (item.system.tipo === "passiva") return;

    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave]);

    const resultado = await rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteHabilidade", { habilidade: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      modificadores: this._modificadoresBase(atributoChave),
      tipoTeste: "atributo",
      atributoChave,
      actor: this
    });

    if (item.system.concedeCondicao) {
      await aplicarCondicao(this, {
        nome: item.system.condicaoNome || item.name,
        valor: item.system.condicaoValor,
        escopo: item.system.condicaoEscopo,
        atributoEspecifico: item.system.condicaoAtributoEspecifico,
        duracaoRodadas: item.system.condicaoDuracaoRodadas,
        permanente: item.system.condicaoPermanente
      });
    }

    return resultado;
  }

  /**
   * Rola um teste de ataque com uma manobra de combate de inimigo: d20
   * contra Força/Agilidade + dado de treinamento. Manobras não-ofensivas
   * não possuem teste de ataque. Exige um alvo targetado; em caso de
   * acerto, aplica dano automaticamente (ou abre o prompt de defesa).
   * @param {string} itemId
   * @param {Actor} [alvoExplicito]
   */
  async rollManobra(itemId, alvoExplicito = null) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "manobra") return ui.notifications.error("Manobra não encontrada.");
    if (!item.system.ofensiva) return;

    const alvo = alvoExplicito ?? obterAlvo();
    if (!alvo) return;

    const atributoChave = item.system.atributo;
    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave] ?? atributoChave);

    const resultado = await rolarTesteRollUnder({
      titulo: game.i18n.format("ODRITE.Rolagem.TesteManobra", { manobra: item.name }),
      alvo: atributo.value,
      atributoLabel: label,
      modificadores: this._modificadoresBase(atributoChave),
      tipoTeste: "manobra",
      atributoChave,
      dadoSecundarioFaces: this.system.dadoTreinamento,
      dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoTreinamento"),
      testeDeAcerto: true,
      actor: this
    });

    if (resultado.acertoAbsoluto && resultado.resultadoSecundario === 1) {
      return processarAcertoFatal({ atacante: this, alvo });
    }
    if (resultado.acertoAbsoluto) {
      return processarAcertoAbsoluto({
        atacante: this,
        alvo,
        item,
        dano: item.system.dano,
        tipoAtaque: item.system.tipoAtaque
      });
    }
    if (resultado.falhaAbsoluta) {
      return processarFalhaAbsoluta(this);
    }
    if (resultado.acertou) {
      await processarAcerto({ atacante: this, alvo, dano: item.system.dano, tipoAtaque: item.system.tipoAtaque });
    }
  }
}
