import { aplicarDanoPendente, resolverDefesa } from "../helpers/combate.mjs";
import { processarFimTurno, processarInicioTurno } from "../helpers/turno.mjs";

Hooks.on("createChatMessage", (mensagem) => {
  if (!game.user.isGM) return;
  if (!mensagem.getFlag("odrite", "danoPendente")) return;
  aplicarDanoPendente(mensagem);
});

/**
 * Dentro dos hooks de virada, o documento ainda não refletiu a mudança:
 * `combat.combatant` é o combatente cujo turno está TERMINANDO e
 * `combat.turns[updateData.turn]` é o que está COMEÇANDO.
 *
 * `combat.previous` não serve aqui — ele guarda o estado anterior à
 * atualização passada, ficando um turno inteiro atrasado.
 */
function combatentesDaVirada(combat, updateData) {
  return { encerrando: combat.combatant ?? null, iniciando: combat.turns[updateData?.turn ?? 0] ?? null };
}

Hooks.on("combatTurn", async (combat, updateData, updateOptions) => {
  if (!game.user.isGM) return;

  const { encerrando, iniciando: atual } = combatentesDaVirada(combat, updateData);
  if (encerrando) await processarFimTurno(encerrando);

  if (atual?.getFlag("odrite", "atrasado")) {
    await atual.unsetFlag("odrite", "atrasado");
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Combate.AtrasadoAviso", { alvo: atual.actor?.name ?? atual.name })}</p>`
    });
  }

  if (atual) await processarInicioTurno(atual);
});

// combatTurn, combatRound e combatStart são mutuamente exclusivos no Foundry:
// a virada de rodada dispara só combatRound, e o início do combate só
// combatStart. Os dois precisam cobrir o mesmo par fim/início de turno.
Hooks.on("combatStart", async (combat, updateData) => {
  if (!game.user.isGM) return;
  const primeiro = combat.turns[updateData?.turn ?? 0];
  if (primeiro) await processarInicioTurno(primeiro);
});

Hooks.on("combatRound", async (combat, updateData) => {
  if (!game.user.isGM) return;

  const { encerrando, iniciando } = combatentesDaVirada(combat, updateData);
  if (encerrando) await processarFimTurno(encerrando);
  if (iniciando) await processarInicioTurno(iniciando);
});

Hooks.on("renderChatMessageHTML", (mensagem, html) => {
  const pendente = mensagem.getFlag("odrite", "defesaPendente");
  if (!pendente || pendente.resolvida) return;

  const alvo = fromUuidSync(pendente.alvoUuid);
  const podeResponder = !!alvo?.isOwner;

  for (const botao of html.querySelectorAll('[data-action="defender"]')) {
    if (botao.dataset.wired) continue;
    botao.dataset.wired = "true";

    if (!podeResponder) {
      botao.disabled = true;
      continue;
    }
    botao.addEventListener("click", () => resolverDefesa(mensagem, botao.dataset.tipo, botao.dataset.itemId));
  }
});
