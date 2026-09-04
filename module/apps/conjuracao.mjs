import {
  resolverRefazer,
  resolverManutencao,
  postarPromptManutencao,
  encerrarEfeitosDeRodada
} from "../helpers/conjuracao.mjs";

Hooks.on("combatRound", async (combat) => {
  if (!game.user.isGM) return;

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || actor.type !== "character") continue;

    // Duração "Rodada": o efeito vale só até o fim da rodada em que entrou.
    await encerrarEfeitosDeRodada(actor);

    // Eco 2 da Bênção: Conjurar travado pelo resto da rodada atual e por toda
    // a seguinte — o contador cai a cada virada até liberar.
    const bloqueio = combatant.getFlag("odrite", "conjurarBloqueado") ?? 0;
    if (bloqueio > 0) {
      const restante = bloqueio - 1;
      if (restante > 0) await combatant.setFlag("odrite", "conjurarBloqueado", restante);
      else await combatant.unsetFlag("odrite", "conjurarBloqueado");
    }

    // Eco 3 da Bênção: agir por último vale uma rodada; depois a iniciativa
    // original é devolvida.
    const original = combatant.getFlag("odrite", "iniciativaOriginal");
    if (original !== undefined) {
      await combatant.update({ initiative: original, "flags.odrite.-=iniciativaOriginal": null });
    }

    const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
    if (ativas.length) await postarPromptManutencao(actor, ativas);
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
