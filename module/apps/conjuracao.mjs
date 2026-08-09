import { resolverRefazer, resolverManutencao, postarPromptManutencao } from "../helpers/conjuracao.mjs";

Hooks.on("combatRound", async (combat) => {
  if (!game.user.isGM) return;

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || actor.type !== "character") continue;

    const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
    if (!ativas.length) continue;

    await postarPromptManutencao(actor, ativas);
  }
});

Hooks.on("renderChatMessageHTML", (mensagem, html) => {
  const refazerPendente = mensagem.getFlag("odrite", "refazerPendente");
  if (refazerPendente && !refazerPendente.resolvida) {
    const actor = fromUuidSync(refazerPendente.actorUuid);
    const podeResponder = !!actor?.isOwner;

    for (const botao of html.querySelectorAll('[data-action="refazer-conjuracao"]')) {
      if (botao.dataset.wired) continue;
      botao.dataset.wired = "true";

      if (!podeResponder) {
        botao.disabled = true;
        continue;
      }
      botao.addEventListener("click", () => resolverRefazer(mensagem, botao.dataset.escolha));
    }
  }

  const manutencaoPendente = mensagem.getFlag("odrite", "manutencaoPendente");
  if (manutencaoPendente) {
    const actor = fromUuidSync(manutencaoPendente.actorUuid);
    const podeResponder = !!actor?.isOwner;

    for (const botao of html.querySelectorAll('[data-action="manutencao-conjuracao"]')) {
      if (botao.dataset.wired) continue;
      botao.dataset.wired = "true";

      if (!podeResponder) {
        botao.disabled = true;
        continue;
      }
      botao.addEventListener("click", () => {
        botao.disabled = true;
        resolverManutencao(manutencaoPendente.actorUuid, botao.dataset.itemId);
      });
    }
  }
});
