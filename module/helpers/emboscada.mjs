import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "./dice.mjs";

/**
 * Rola o teste de um lado da emboscada e devolve o resultado junto do valor
 * bruto do d20 — o desempate entre dois sucessos é pelo menor dado.
 * @param {Actor} actor
 * @param {"agilidade"|"sentidos"} chave
 */
async function testarLado(actor, chave) {
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize(
      chave === "agilidade" ? "ODRITE.Emboscada.TesteAtacante" : "ODRITE.Emboscada.TesteAlvo"
    ),
    alvo: actor.system.atributos[chave].value,
    atributoLabel: game.i18n.localize(ODRITE.atributos[chave]),
    modificadores: actor._modificadoresBase?.(chave) ?? [],
    tipoTeste: "atributo",
    atributoChave: chave,
    actor
  });

  return { actor, sucesso: resultado.sucesso, dado: resultado.resultadoPrincipal };
}

/**
 * Marca os combatentes surpreendidos: sem Manobras de Combate na primeira
 * rodada. Fora de combate a marca fica no ator até o combate começar.
 * @param {Actor[]} atores
 */
async function surpreender(atores) {
  for (const actor of atores) {
    const combatant = game.combat?.combatants.find((c) => c.actorId === actor.id);
    if (combatant) await combatant.setFlag("odrite", "surpreendido", true);
    else await actor.setFlag("odrite", "surpreendidoPendente", true);
  }
}

/**
 * Resolve uma emboscada entre dois grupos.
 *
 * Individual: o atacante vence se tiver sucesso e o alvo falhar; se ambos
 * tiverem sucesso, vence o menor valor no dado; nos demais casos a emboscada
 * falha. Em grupo, vence quem somar mais sucessos — empate favorece o alvo.
 *
 * @param {Actor[]} atacantes Tokens selecionados.
 * @param {Actor[]} alvos Tokens marcados.
 */
export async function resolverEmboscada(atacantes, alvos) {
  if (!atacantes.length || !alvos.length) {
    return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.EmboscadaSemLados"));
  }

  const ladoAtacante = [];
  for (const actor of atacantes) ladoAtacante.push(await testarLado(actor, "agilidade"));

  const ladoAlvo = [];
  for (const actor of alvos) ladoAlvo.push(await testarLado(actor, "sentidos"));

  const sucessosAtacante = ladoAtacante.filter((r) => r.sucesso);
  const sucessosAlvo = ladoAlvo.filter((r) => r.sucesso);

  let venceu;
  if (atacantes.length === 1 && alvos.length === 1) {
    const [a] = ladoAtacante;
    const [b] = ladoAlvo;
    // Dois sucessos: desempate pelo menor dado. Empate exato favorece o alvo.
    if (a.sucesso && b.sucesso) venceu = a.dado < b.dado;
    else venceu = a.sucesso && !b.sucesso;
  } else {
    venceu = sucessosAtacante.length > sucessosAlvo.length;
  }

  if (venceu) await surpreender(alvos.map((a) => a));

  const chave = venceu ? "ODRITE.Emboscada.Sucesso" : "ODRITE.Emboscada.Falha";
  return ChatMessage.create({
    content: `<div class="odrite chat-card"><h3 class="chat-card-titulo">${game.i18n.localize("ODRITE.Emboscada.Titulo")}</h3>
      <p>${game.i18n.format(chave, {
        atacantes: sucessosAtacante.length,
        alvos: sucessosAlvo.length,
        surpreendidos: alvos.map((a) => a.name).join(", ")
      })}</p></div>`
  });
}

/**
 * Ponto de entrada do mestre: emboscada dos tokens selecionados contra os
 * tokens marcados como alvo.
 */
export async function emboscarSelecao() {
  const atacantes = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean);
  const alvos = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  return resolverEmboscada(atacantes, alvos);
}
