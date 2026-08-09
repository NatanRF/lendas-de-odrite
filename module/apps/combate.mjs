import { aplicarDanoPendente, resolverDefesa } from "../helpers/combate.mjs";

Hooks.on("createChatMessage", (mensagem) => {
  if (!game.user.isGM) return;
  if (!mensagem.getFlag("odrite", "danoPendente")) return;
  aplicarDanoPendente(mensagem);
});

Hooks.on("combatTurn", async (combat, updateData, updateOptions) => {
  if (!game.user.isGM) return;

  const anteriorId = combat.previous?.combatantId;
  const anterior = anteriorId ? combat.combatants.get(anteriorId) : null;
  const sangrando = anterior?.getFlag("odrite", "sangrando");
  if (sangrando?.ativo && anterior.actor) {
    const alvo = anterior.actor;
    await alvo.update({ "system.vitalidade.value": Math.max(0, alvo.system.vitalidade.value - 1) });
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Combate.SangramentoTick", { alvo: alvo.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor: alvo })
    });
  }

  // combat.combatant ainda reflete o combatente ANTERIOR neste ponto do
  // hook — o novo turno é lido via updateData.turn, não pela propriedade.
  const atual = combat.turns[updateData.turn] ?? combat.combatant;
  if (atual?.getFlag("odrite", "atrasado")) {
    await atual.unsetFlag("odrite", "atrasado");
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Combate.AtrasadoAviso", { alvo: atual.actor?.name ?? atual.name })}</p>`
    });
  }
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
