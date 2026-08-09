Hooks.on("combatRound", async (combat) => {
  if (!game.user.isGM) return;

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;

    const condicoes = actor.items.filter((i) => i.type === "condicao" && !i.system.permanente);
    if (!condicoes.length) continue;

    const atualizar = [];
    const expiradas = [];

    for (const condicao of condicoes) {
      const nova = condicao.system.duracaoRodadas - 1;
      if (nova <= 0) expiradas.push(condicao);
      else atualizar.push({ _id: condicao.id, "system.duracaoRodadas": nova });
    }

    if (atualizar.length) await actor.updateEmbeddedDocuments("Item", atualizar);

    if (expiradas.length) {
      await actor.deleteEmbeddedDocuments("Item", expiradas.map((c) => c.id));
      for (const condicao of expiradas) {
        ChatMessage.create({
          content: `<p>${game.i18n.format("ODRITE.Condicao.Expirou", { nome: actor.name, condicao: condicao.name })}</p>`,
          speaker: ChatMessage.getSpeaker({ actor })
        });
      }
    }
  }
});
