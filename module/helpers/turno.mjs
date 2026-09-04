import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "./dice.mjs";
import { condicaoNomeada } from "./condicoes.mjs";

/**
 * Rolagem de Morte: d6 no início de cada turno enquanto o personagem estiver
 * inconsciente. 1 devolve 1 Ponto de Vitalidade e a consciência (desde que
 * ele não esteja no Limiar de Exaustão), 6 mata definitivamente, 2-5 não
 * mudam nada.
 * @param {Actor} actor
 */
export async function rolagemDeMorte(actor) {
  const roll = await new Roll("1d6").evaluate();
  let texto;

  if (roll.total === 6) {
    await actor.update({ "system.morto": true });
    texto = game.i18n.format("ODRITE.Morte.RolagemFalha", { nome: actor.name });
  } else if (roll.total === 1) {
    // O livro cita "Fadiga inferior a 10", que é exatamente o Limiar de
    // Exaustão — usar o estágio derivado mantém a regra coerente quando o
    // limite de Fadiga do personagem foi reduzido por Ferimento Permanente.
    if (actor.system.fadiga.drenaVitalidade) {
      texto = game.i18n.format("ODRITE.Morte.RolagemBloqueada", { nome: actor.name });
    } else {
      await actor.update({ "system.vitalidade.value": 1 });
      texto = game.i18n.format("ODRITE.Morte.RolagemSucesso", { nome: actor.name });
    }
  } else {
    texto = game.i18n.format("ODRITE.Morte.RolagemNada", { nome: actor.name });
  }

  return ChatMessage.create({
    content: `<p><strong>${game.i18n.localize("ODRITE.Morte.RolagemTitulo")} (${roll.total})</strong><br>${texto}</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll]
  });
}

/**
 * Limiar de Exaustão: com 10 ou mais Pontos de Fadiga o personagem perde
 * 1 Ponto de Vitalidade no início de cada turno até se recuperar ou cair
 * inconsciente.
 * @param {Actor} actor
 */
async function drenarExaustao(actor) {
  const novo = Math.max(0, actor.system.vitalidade.value - 1);
  await actor.update({ "system.vitalidade.value": novo });

  const chave = novo <= 0 ? "ODRITE.Exaustao.DrenoInconsciente" : "ODRITE.Exaustao.Dreno";
  return ChatMessage.create({
    content: `<p>${game.i18n.format(chave, { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Efeitos que acontecem no INÍCIO do turno do combatente: Rolagem de Morte
 * se estiver inconsciente, ou dreno do Limiar de Exaustão.
 * @param {Combatant} combatant
 */
export async function processarInicioTurno(combatant) {
  const actor = combatant?.actor;
  if (!actor || actor.type !== "character" || actor.system.morto) return;

  if (actor.system.vitalidade.value <= 0) return rolagemDeMorte(actor);
  if (actor.system.fadiga.drenaVitalidade) return drenarExaustao(actor);
}

/**
 * Tick de Sangrando: perde `intensidade` Pontos de Vitalidade (1 por
 * aplicação acumulada, até 5).
 * @param {Actor} actor
 * @param {Item} condicao
 */
async function tickSangrando(actor, condicao) {
  const perda = condicao.system.intensidade ?? 1;
  await actor.update({ "system.vitalidade.value": Math.max(0, actor.system.vitalidade.value - perda) });
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Combate.SangramentoTick", { alvo: actor.name, valor: perda })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Tick de Envenenado: teste de Resistência; a falha custa 1 Ponto de Fadiga.
 * @param {Actor} actor
 */
async function tickEnvenenado(actor) {
  if (actor.type !== "character") return;

  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Condicao.TesteEnvenenado"),
    alvo: actor.system.atributos.resistencia.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.resistencia),
    modificadores: actor._modificadoresBase("resistencia"),
    tipoTeste: "atributo",
    atributoChave: "resistencia",
    actor
  });

  if (resultado.sucesso) return;

  await actor.update({ "system.fadiga.value": actor.system.fadiga.value + 1 });
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Condicao.EnvenenadoFadiga", { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Efeitos que acontecem no FIM do turno do combatente: Sangrando e Envenenado.
 * @param {Combatant} combatant
 */
export async function processarFimTurno(combatant) {
  const actor = combatant?.actor;
  if (!actor || actor.system.morto) return;

  const sangrando = condicaoNomeada(actor, "sangrando");
  if (sangrando) await tickSangrando(actor, sangrando);

  if (condicaoNomeada(actor, "envenenado")) await tickEnvenenado(actor);
}
