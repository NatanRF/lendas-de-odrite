const CHAT_TEMPLATE = "systems/odrite/templates/chat/roll-card.hbs";

/**
 * Rola um teste "roll-under": 1d20 deve resultar em valor <= alvo para ser sucesso.
 * Opcionalmente rola um dado secundário (treinamento/refinamento) que concede
 * um benefício quando o resultado é exatamente 1.
 *
 * @param {object} options
 * @param {string} options.titulo        Título exibido no card de chat.
 * @param {number} options.alvo          Valor do atributo usado como alvo.
 * @param {string} [options.atributoLabel] Nome do atributo, para exibição.
 * @param {number} [options.penalidade]  Penalidade de fadiga aplicada ao alvo (ex: -2, -4).
 * @param {number} [options.dadoSecundarioFaces] Faces do dado secundário (ex: 6, 12).
 * @param {string} [options.dadoSecundarioLabel] Rótulo do dado secundário (Treinamento/Refinamento).
 * @param {boolean} [options.testeDeAcerto] Se true, marca resultado natural 1 no d20 como
 *   Acerto Absoluto e resultado natural 20 como Falha Absoluta.
 * @param {Actor} options.actor
 * @returns {Promise<ChatMessage>}
 */
export async function rolarTesteRollUnder({
  titulo,
  alvo,
  atributoLabel,
  penalidade = 0,
  dadoSecundarioFaces,
  dadoSecundarioLabel,
  testeDeAcerto = false,
  actor
}) {
  const alvoEfetivo = alvo + penalidade;
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
    penalidade,
    alvoEfetivo,
    resultadoPrincipal,
    sucesso,
    acertoAbsoluto,
    falhaAbsoluta,
    dadoSecundarioLabel,
    resultadoSecundario: rollSecundario?.total ?? null,
    beneficio
  });

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls,
    sound: CONFIG.sounds.dice
  });
}
