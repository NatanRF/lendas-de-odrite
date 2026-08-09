import { coletarModificadores } from "./condicoes.mjs";

const CHAT_TEMPLATE = "systems/odrite/templates/chat/roll-card.hbs";

function combatantDoAtor(actor) {
  return game.combat?.combatants.find((c) => c.actorId === actor.id) ?? null;
}

function formatarSinal(valor) {
  return valor >= 0 ? `+${valor}` : `${valor}`;
}

/**
 * Rola um teste "roll-under": 1d20 deve resultar em valor <= alvo para ser sucesso.
 * Opcionalmente rola um dado secundário (treinamento/refinamento) que concede
 * um benefício quando o resultado é exatamente 1.
 *
 * @param {object} options
 * @param {string} options.titulo        Título exibido no card de chat.
 * @param {number} options.alvo          Valor do atributo usado como alvo.
 * @param {string} [options.atributoLabel] Nome do atributo, para exibição.
 * @param {{label: string, valor: number}[]} [options.modificadores] Modificadores já
 *   rotulados conhecidos pelo chamador (ex: Fadiga, Penalidade de Armadura).
 * @param {string} [options.tipoTeste] "atributo" | "ataque" | "manobra" | "conjuracao" —
 *   usado só para casar o escopo das Condições ativas do ator.
 * @param {string} [options.atributoChave] Chave do atributo testado (ex: "forca"),
 *   usada pro escopo "atributo" das Condições.
 * @param {number} [options.dadoSecundarioFaces] Faces do dado secundário (ex: 6, 12).
 * @param {string} [options.dadoSecundarioLabel] Rótulo do dado secundário (Treinamento/Refinamento).
 * @param {boolean} [options.testeDeAcerto] Se true, marca resultado natural 1 no d20 como
 *   Acerto Absoluto e resultado natural 20 como Falha Absoluta.
 * @param {Actor} options.actor
 * @returns {Promise<{chatMessage: ChatMessage, sucesso: boolean, acertoAbsoluto: boolean, falhaAbsoluta: boolean, acertou: boolean, resultadoSecundario: number|null}>}
 */
export async function rolarTesteRollUnder({
  titulo,
  alvo,
  atributoLabel,
  modificadores = [],
  tipoTeste,
  atributoChave,
  dadoSecundarioFaces,
  dadoSecundarioLabel,
  testeDeAcerto = false,
  actor
}) {
  const modificadoresFinais = [...modificadores];

  const combatant = actor ? combatantDoAtor(actor) : null;
  if (combatant?.getFlag("odrite", "debilitado")) {
    modificadoresFinais.push({ label: game.i18n.localize("ODRITE.Combate.Debilitado"), valor: -4 });
    await combatant.unsetFlag("odrite", "debilitado");
  }

  if (actor) {
    modificadoresFinais.push(...coletarModificadores(actor, { tipoTeste, atributoChave }));
  }

  const penalidadeTotal = modificadoresFinais.reduce((total, mod) => total + mod.valor, 0);
  const alvoEfetivo = alvo + penalidadeTotal;

  const rollPrincipal = await new Roll("1d20").evaluate();
  const resultadoPrincipal = rollPrincipal.total;
  const sucesso = resultadoPrincipal <= alvoEfetivo;
  const acertoAbsoluto = testeDeAcerto && resultadoPrincipal === 1;
  const falhaAbsoluta = testeDeAcerto && resultadoPrincipal === 20;

  const rolls = [rollPrincipal];
  let rollSecundario = null;
  let beneficio = false;

  if (dadoSecundarioFaces) {
    rollSecundario = await new Roll(`1d${dadoSecundarioFaces}`).evaluate();
    rolls.push(rollSecundario);
    beneficio = rollSecundario.total === 1;
  }

  const content = await foundry.applications.handlebars.renderTemplate(CHAT_TEMPLATE, {
    titulo,
    atributoLabel,
    alvo,
    modificadores: modificadoresFinais.map((mod) => ({ label: mod.label, sinal: formatarSinal(mod.valor) })),
    alvoEfetivo,
    resultadoPrincipal,
    sucesso,
    acertoAbsoluto,
    falhaAbsoluta,
    dadoSecundarioLabel,
    resultadoSecundario: rollSecundario?.total ?? null,
    beneficio
  });

  const chatMessage = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: CONFIG.sounds.dice
  });

  const acertou = testeDeAcerto ? (sucesso || acertoAbsoluto) && !falhaAbsoluta : sucesso;

  return {
    chatMessage,
    sucesso,
    acertoAbsoluto,
    falhaAbsoluta,
    acertou,
    resultadoSecundario: rollSecundario?.total ?? null
  };
}
