import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "../helpers/dice.mjs";
import {
  obterAlvo,
  processarAcerto,
  processarAcertoAbsoluto,
  processarAcertoFatal,
  processarFalhaAbsoluta,
  registrarUsoManobra,
  concederIsencaoProximoAtaque,
  escolherBeneficioTreinamento,
  perguntarRefazerAtaque,
  podeUsarManobra
} from "../helpers/combate.mjs";
import { resolverConjuracao } from "../helpers/conjuracao.mjs";
import {
  aplicarCondicao,
  acertoAutomaticoContra,
  modificadoresContraAlvo
} from "../helpers/condicoes.mjs";

export default class OdriteActor extends Actor {
  /** @override */
  async _preUpdate(changes, options, user) {
    const result = await super._preUpdate(changes, options, user);
    if (result === false) return false;

    // Precisa vir antes de tudo: um campo numérico esvaziado chega aqui como
    // null e envenenaria as regras abaixo.
    if (this._descartarNumerosVazios(changes)) {
      // A escrita descartada pode deixar o update vazio, e aí o Foundry não
      // redesenha — o campo continuaria em branco na tela, divergindo do
      // valor guardado. O render devolve o número anterior ao campo.
      this.render(false);
    }

    const novaFadiga = changes.system?.fadiga?.value;
    const limite = this.system.fadiga?.limite ?? 12;
    if (novaFadiga >= limite) {
      foundry.utils.setProperty(changes, "system.vitalidade.value", 0);
    }

    if (this.type === "character") await this._verificarMorteAtributo(changes);
  }

  /**
   * Descarta mudanças que esvaziariam um campo numérico.
   *
   * Os NumberField do sistema são nullable, e um `<input type="number">`
   * limpo na ficha envia string vazia, que o DataModel converte em null antes
   * de chegar aqui. Gravar esse null é pior do que ignorar a edição: um
   * atributo null faz `d20 <= null` ser sempre falso, então todo teste
   * daquele atributo passaria a falhar sem nenhum erro visível.
   *
   * Não dá para resolver com `nullable: false` — o campo vazio viraria 0, e
   * 0 num atributo mata o personagem pela regra geral. Aqui a edição
   * inválida simplesmente não acontece e o valor anterior permanece.
   *
   * @param {object} changes Dados da atualização, já limpos pelo DataModel.
   * @returns {boolean} Se alguma mudança foi descartada.
   */
  _descartarNumerosVazios(changes) {
    if (!changes.system) return false;
    let descartou = false;

    const limpar = (novos, atuais) => {
      for (const [chave, valor] of Object.entries(novos)) {
        const atual = atuais?.[chave];

        if (valor && typeof valor === "object" && !Array.isArray(valor)) {
          limpar(valor, atual);
          if (!Object.keys(valor).length) delete novos[chave];
        } else if (typeof atual === "number" && !Number.isFinite(valor)) {
          delete novos[chave];
          descartou = true;
        }
      }
    };

    limpar(changes.system, this.system);
    if (!Object.keys(changes.system).length) delete changes.system;
    return descartou;
  }

  /**
   * Qualquer atributo reduzido a 0, por qualquer meio, mata o personagem.
   * Roda dentro do _preUpdate para que a morte entre na mesma escrita que
   * zerou o atributo.
   * @param {object} changes
   */
  async _verificarMorteAtributo(changes) {
    const atributos = changes.system?.atributos;
    if (!atributos || this.system.morto) return;

    // Number.isFinite evita que um campo limpo na ficha (null/NaN, que o JS
    // compararia como 0) mate o personagem por acidente.
    const zerado = Object.entries(atributos).find(
      ([, dados]) => Number.isFinite(dados?.value) && dados.value <= 0
    );
    if (!zerado) return;

    foundry.utils.setProperty(changes, "system.morto", true);
    foundry.utils.setProperty(changes, "system.vitalidade.value", 0);

    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Morte.AtributoZerado", {
        nome: this.name,
        atributo: game.i18n.localize(ODRITE.atributos[zerado[0]] ?? zerado[0])
      })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor: this })
    });
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
   * @param {object} [opcoes]
   * @param {boolean} [opcoes.semManobra] Não consome Manobra de Combate nem
   *   contabiliza Fadiga por repetição — usado pelo contra-ataque do Aparar
   *   e por habilidades que concedem ataques livres.
   */
  async rollAtaque(itemId, alvoExplicito = null, { semManobra = false } = {}) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "arma") return ui.notifications.error("Arma não encontrada.");

    if (item.system.usaMunicao && this.system.recursos.municao.value <= 0) {
      return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SemMunicao"));
    }

    if (item.system.exigeRecarga && !item.system.carregada) {
      return ui.notifications.warn(game.i18n.format("ODRITE.Aviso.ArmaDescarregada", { arma: item.name }));
    }

    // Um alvo Imobilizado só pode gastar Manobras tentando se libertar; um
    // ataque livre (contra-ataque do Aparar) não passa por essa restrição.
    if (!semManobra && !podeUsarManobra(this)) return;

    const alvo = alvoExplicito ?? obterAlvo();
    if (!alvo) return;

    if (!semManobra) await registrarUsoManobra(this, "atacar", item.system.categoria);

    if (item.system.usaMunicao) {
      await this.update({ "system.recursos.municao.value": this.system.recursos.municao.value - 1 });
    }

    if (item.system.exigeRecarga) {
      await item.update({ "system.carregada": false });
    }

    return this._resolverTesteAtaque(item, alvo, "ataque");
  }

  /**
   * Rola o teste de acerto de uma arma ou manobra e resolve o resultado,
   * incluindo os efeitos do Dado de Treinamento. Separado de rollAtaque para
   * que uma rerrolagem concedida pelo Dado de Treinamento não volte a
   * consumir Manobra, munição ou carga da arma.
   * @param {Item} item
   * @param {Actor} alvo
   * @param {"ataque"|"manobra"} tipoTeste
   */
  async _resolverTesteAtaque(item, alvo, tipoTeste) {
    const atributoChave = item.system.atributo;
    const atributo = this.system.atributos?.[atributoChave];
    const label = game.i18n.localize(ODRITE.atributos[atributoChave] ?? atributoChave);
    const ehArma = item.type === "arma";
    const dano = item.system.dano;
    const tipoAtaque = item.system.tipoAtaque;

    // Ataque adjacente contra alvo Imobilizado acerta sem teste de Acerto —
    // sem rolagem não há Acerto/Falha Absoluta nem Dado de Treinamento.
    if (acertoAutomaticoContra(alvo, tipoAtaque)) {
      await ChatMessage.create({
        content: `<p>${game.i18n.format("ODRITE.Condicao.AcertoAutomatico", { atacante: this.name, alvo: alvo.name })}</p>`,
        speaker: ChatMessage.getSpeaker({ actor: this })
      });
      return processarAcerto({ atacante: this, alvo, dano, tipoAtaque });
    }

    const modificadores = ehArma
      ? (this.system.fadiga.penalidade
          ? [{ label: game.i18n.localize("ODRITE.Fadiga"), valor: this.system.fadiga.penalidade }]
          : [])
      : this._modificadoresBase(atributoChave);

    modificadores.push(...modificadoresContraAlvo(alvo, tipoAtaque));

    const resultado = await rolarTesteRollUnder({
      titulo: game.i18n.format(
        ehArma ? "ODRITE.Rolagem.TesteAtaque" : "ODRITE.Rolagem.TesteManobra",
        ehArma ? { arma: item.name } : { manobra: item.name }
      ),
      alvo: atributo.value,
      atributoLabel: label,
      modificadores,
      tipoTeste,
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
      if (ehArma) await concederIsencaoProximoAtaque(this);
      return processarAcertoAbsoluto({ atacante: this, alvo, item, dano, tipoAtaque });
    }
    if (resultado.falhaAbsoluta) {
      return processarFalhaAbsoluta(this);
    }

    // Dado de Treinamento 1: refaz a rolagem na falha, ou concede um
    // benefício à escolha do atacante no acerto.
    if (resultado.resultadoSecundario === 1) {
      if (!resultado.acertou) {
        if (await perguntarRefazerAtaque()) return this._resolverTesteAtaque(item, alvo, tipoTeste);
        return;
      }

      const escolha = await escolherBeneficioTreinamento(item);
      return processarAcerto({
        atacante: this,
        alvo,
        item,
        dano,
        tipoAtaque,
        aplicarPropriedadeArma: escolha === "propriedade",
        negarDefesa: escolha === "negarDefesa"
      });
    }

    if (resultado.acertou) {
      await processarAcerto({ atacante: this, alvo, dano, tipoAtaque });
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
   * não possuem teste de ativação.
   *
   * Custo de Fadiga: 1 no sucesso ou falha comum, 2 na Falha Absoluta e
   * nenhum no Sucesso Absoluto. O efeito (e a Condição concedida) só se
   * aplica quando o teste ativa a habilidade.
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
      testeDeAcerto: true,
      actor: this
    });

    const custoFadiga = resultado.acertoAbsoluto ? 0 : resultado.falhaAbsoluta ? 2 : 1;
    if (custoFadiga) {
      await this.update({ "system.fadiga.value": this.system.fadiga.value + custoFadiga });
      ChatMessage.create({
        content: `<p>${game.i18n.format("ODRITE.Combate.FadigaHabilidade", { nome: this.name, fadiga: custoFadiga })}</p>`,
        speaker: ChatMessage.getSpeaker({ actor: this })
      });
    }

    if (resultado.acertou && item.system.concedeCondicao) {
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
    if (!podeUsarManobra(this)) return;

    const alvo = alvoExplicito ?? obterAlvo();
    if (!alvo) return;

    return this._resolverTesteAtaque(item, alvo, "manobra");
  }
}
