import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "./dice.mjs";
import { obterAlvo, registrarUsoManobra, processarAcerto } from "./combate.mjs";
import { aplicarCondicao } from "./condicoes.mjs";

const REFAZER_TEMPLATE = "systems/odrite/templates/chat/refazer-prompt.hbs";
const MANUTENCAO_TEMPLATE = "systems/odrite/templates/chat/manutencao-prompt.hbs";

function destinatarios(actor) {
  const donos = game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  const gms = game.users.filter((u) => u.isGM).map((u) => u.id);
  return [...new Set([...donos, ...gms])];
}

async function atualizarVitalidade(actor, dano) {
  if (dano <= 0) return;
  await actor.update({ "system.vitalidade.value": Math.max(0, actor.system.vitalidade.value - dano) });
}

/**
 * Ponto de entrada: resolve um cast de Conjuração inteiro, incluindo a
 * mecânica própria de Bênção Divina / Pacto Amaldiçoado e Dado de
 * Refinamento — substitui o sistema genérico de Acerto/Falha Absoluta
 * usado por armas e manobras.
 * @param {Actor} actor
 * @param {Item} item
 */
export async function resolverConjuracao(actor, item) {
  const alvo = obterAlvo();
  if (!alvo) return;

  await registrarUsoManobra(actor, "conjurar");

  if (actor.getFlag("odrite", "conjuracaoSucessoGarantido")) {
    await actor.unsetFlag("odrite", "conjuracaoSucessoGarantido");
    await ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.SucessoGarantidoUsado", { nome: actor.name, magia: item.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return finalizarConjuracaoSucesso(actor, item, alvo);
  }

  const resultado = await rolarConjuracao(actor, item);
  return processarResultadoConjuracao(actor, item, alvo, resultado);
}

async function rolarConjuracao(actor, item) {
  const facil = !!actor.getFlag("odrite", "conjuracaoFacil");
  if (facil) await actor.unsetFlag("odrite", "conjuracaoFacil");

  const modificadores = actor._modificadoresBase("conjuracao");
  if (facil) modificadores.push({ label: game.i18n.localize("ODRITE.Conjuracao.FacilLabel"), valor: 2 });

  const atributo = actor.system.atributos.conjuracao;
  return rolarTesteRollUnder({
    titulo: game.i18n.format("ODRITE.Rolagem.TesteMagia", { magia: item.name }),
    alvo: atributo.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.conjuracao),
    modificadores,
    tipoTeste: "conjuracao",
    atributoChave: "conjuracao",
    dadoSecundarioFaces: ODRITE.dadoRefinamentoMagia,
    dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoRefinamento"),
    testeDeAcerto: true,
    actor
  });
}

async function processarResultadoConjuracao(actor, item, alvo, resultado) {
  if (resultado.resultadoSecundario === 1) {
    if (resultado.acertou) {
      await actor.setFlag("odrite", "conjuracaoSucessoGarantido", true);
      ChatMessage.create({
        content: `<p>${game.i18n.format("ODRITE.Conjuracao.RefinamentoSucessoFuturo", { nome: actor.name })}</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    } else if (!resultado.falhaAbsoluta) {
      return postarPromptRefazer(actor, item, alvo);
    }
  }

  if (resultado.acertoAbsoluto) {
    await actor.setFlag("odrite", "conjuracaoFacil", true);
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.FacilConcedido", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  if (resultado.falhaAbsoluta) {
    return actor.system.fonteArcana === "Pacto Amaldiçoado"
      ? processarFalhaCriticaPacto(actor)
      : processarFalhaCriticaBencao(actor);
  }

  if (resultado.acertou) {
    return finalizarConjuracaoSucesso(actor, item, alvo);
  }

  return processarFalhaNormal(actor);
}

async function processarFalhaNormal(actor) {
  if (actor.system.fonteArcana === "Pacto Amaldiçoado") {
    await atualizarVitalidade(actor, 1);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.FalhaPacto", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  await actor.update({ "system.fadiga.value": actor.system.fadiga.value + 1 });
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.FalhaBencao", { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function processarFalhaCriticaBencao(actor) {
  const resistencia = actor.system.atributos.resistencia;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Conjuracao.TesteResistenciaBencao"),
    alvo: resistencia.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.resistencia),
    modificadores: actor._modificadoresBase("resistencia"),
    tipoTeste: "atributo",
    atributoChave: "resistencia",
    actor
  });

  if (resultado.sucesso) {
    await actor.update({ "system.vitalidade.value": 0 });
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.ResistenciaBencaoSucesso", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  const changes = {};
  let morreu = false;
  for (const chave of Object.keys(ODRITE.atributos)) {
    const atual = actor.system.atributos[chave].value;
    const novo = Math.max(0, atual - 2);
    changes[`system.atributos.${chave}.value`] = novo;
    if (novo <= 0) morreu = true;
  }
  if (morreu) changes["system.vitalidade.value"] = 0;
  await actor.update(changes);

  return ChatMessage.create({
    content: `<p>${game.i18n.format(
      morreu ? "ODRITE.Conjuracao.MorteBencao" : "ODRITE.Conjuracao.AtributosReduzidosBencao",
      { nome: actor.name }
    )}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function processarFalhaCriticaPacto(actor) {
  const mente = actor.system.atributos.mente;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Conjuracao.TesteMentePacto"),
    alvo: mente.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.mente),
    modificadores: actor._modificadoresBase("mente"),
    tipoTeste: "atributo",
    atributoChave: "mente",
    actor
  });

  if (resultado.sucesso) {
    await actor.update({ "system.vitalidade.value": 1 });
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.MenteSucessoPacto", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  const perda = await new Roll("1d4").evaluate();
  const reducaoAtual = actor.system.vitalidade.reducaoMaxima ?? 0;
  const novaReducao = reducaoAtual + perda.total;
  const maxEfetivo = Math.max(0, actor.system.vitalidade.max - novaReducao);

  const changes = { "system.vitalidade.reducaoMaxima": novaReducao };
  if (maxEfetivo <= 0) changes["system.transformadoMaldicao"] = true;
  await actor.update(changes);

  if (maxEfetivo <= 0) {
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.TransformaMaldicao", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.PerdaPermanentePacto", { nome: actor.name, perda: perda.total })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function finalizarConjuracaoSucesso(actor, item, alvo) {
  let dano = item.system.dano ?? 0;

  if (dano > 0 && actor.system.fonteArcana === "Pacto Amaldiçoado") {
    const bonus = await new Roll("1d4").evaluate();
    dano += bonus.total;
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.BonusDanoPacto", { dano: bonus.total })}</p>`
    });
  }

  if (dano > 0) {
    await processarAcerto({ atacante: actor, alvo, dano, tipoAtaque: "distancia" });
  }

  if (item.system.duracao === "manutencao") {
    await ativarManutencao(actor, item);
  }

  if (item.system.concedeCondicao) {
    const destinatario = item.system.condicaoAlvo === "alvo" ? alvo : actor;
    await aplicarCondicao(destinatario, {
      nome: item.system.condicaoNome || item.name,
      valor: item.system.condicaoValor,
      escopo: item.system.condicaoEscopo,
      atributoEspecifico: item.system.condicaoAtributoEspecifico,
      duracaoRodadas: item.system.condicaoDuracaoRodadas,
      permanente: item.system.condicaoPermanente
    });
  }
}

async function ativarManutencao(actor, item) {
  const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
  if (ativas.some((a) => a.itemId === item.id)) return;

  await actor.setFlag("odrite", "conjuracoesAtivas", [...ativas, { itemId: item.id, nome: item.name }]);
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.ManutencaoAtivada", { nome: actor.name, magia: item.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function postarPromptRefazer(actor, item, alvo) {
  const content = await foundry.applications.handlebars.renderTemplate(REFAZER_TEMPLATE, {
    nome: actor.name,
    magia: item.name
  });

  return ChatMessage.create({
    content,
    whisper: destinatarios(actor),
    flags: {
      odrite: {
        refazerPendente: {
          actorUuid: actor.uuid,
          itemUuid: item.uuid,
          alvoUuid: alvo.uuid,
          resolvida: false
        }
      }
    }
  });
}

export async function resolverRefazer(mensagem, escolha) {
  const pendente = mensagem.getFlag("odrite", "refazerPendente");
  if (!pendente || pendente.resolvida) return;

  const actor = fromUuidSync(pendente.actorUuid);
  if (!actor?.isOwner) return;

  await mensagem.setFlag("odrite", "refazerPendente", { ...pendente, resolvida: true });

  const item = fromUuidSync(pendente.itemUuid);
  const alvo = fromUuidSync(pendente.alvoUuid);

  if (escolha === "aceitar") {
    await mensagem.update({
      content: `<div class="odrite chat-card"><p>${game.i18n.format("ODRITE.Conjuracao.RefazerRecusado", { nome: actor.name })}</p></div>`
    });
    return processarFalhaNormal(actor);
  }

  await mensagem.update({
    content: `<div class="odrite chat-card"><p>${game.i18n.format("ODRITE.Conjuracao.RefezRolagem", { nome: actor.name })}</p></div>`
  });

  const resultado = await rolarConjuracao(actor, item);
  return processarResultadoConjuracao(actor, item, alvo, resultado);
}

export async function postarPromptManutencao(actor, ativas) {
  const content = await foundry.applications.handlebars.renderTemplate(MANUTENCAO_TEMPLATE, {
    nome: actor.name,
    ativas
  });

  return ChatMessage.create({
    content,
    whisper: destinatarios(actor),
    flags: { odrite: { manutencaoPendente: { actorUuid: actor.uuid } } }
  });
}

export async function resolverManutencao(actorUuid, itemId) {
  const actor = fromUuidSync(actorUuid);
  if (!actor?.isOwner) return;

  const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
  if (!ativas.some((a) => a.itemId === itemId)) return;

  const item = actor.items.get(itemId);
  const atributo = actor.system.atributos.conjuracao;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.format("ODRITE.Conjuracao.TesteManutencao", { magia: item?.name ?? "?" }),
    alvo: atributo.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.conjuracao),
    modificadores: actor._modificadoresBase("conjuracao"),
    tipoTeste: "conjuracao",
    atributoChave: "conjuracao",
    actor
  });

  if (!resultado.sucesso) {
    const restantes = ativas.filter((a) => a.itemId !== itemId);
    await actor.setFlag("odrite", "conjuracoesAtivas", restantes);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.ManutencaoFalhou", { nome: actor.name, magia: item?.name ?? "?" })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}
