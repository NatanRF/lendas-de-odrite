function construirPipsManobra(combatant, max, usadas) {
  const container = document.createElement("div");
  container.className = "odrite-manobras-pips";

  for (let indice = 1; indice <= max; indice++) {
    const gasta = indice <= usadas;

    const pip = document.createElement("button");
    pip.type = "button";
    pip.className = "odrite-manobra-pip" + (gasta ? " gasta" : "");
    pip.title = game.i18n.localize(gasta ? "ODRITE.ManobraGasta" : "ODRITE.ManobraDisponivel");

    if (combatant.isOwner) {
      pip.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const atual = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
        const novo = atual === indice ? indice - 1 : indice;
        await combatant.setFlag("odrite", "manobrasUsadas", novo);
      });
    } else {
      pip.disabled = true;
    }

    container.appendChild(pip);
  }

  return container;
}

function injetarPipsManobra(app, html) {
  const combat = app.viewed ?? game.combat;
  if (!combat) return;

  for (const li of html.querySelectorAll("li.combatant[data-combatant-id]")) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    if (!combatant?.actor) continue;

    li.querySelector(".odrite-manobras-pips")?.remove();

    const max = combatant.actor.system.manobrasPorRodada ?? 0;
    if (!max) continue;

    const usadas = Math.min(combatant.getFlag("odrite", "manobrasUsadas") ?? 0, max);
    li.appendChild(construirPipsManobra(combatant, max, usadas));
  }
}

Hooks.on("renderCombatTracker", injetarPipsManobra);

Hooks.on("createCombatant", async (combatant, options, userId) => {
  if (game.user.id !== userId) return;
  const agilidade = combatant.actor?.system?.atributos?.agilidade?.value ?? 0;
  await combatant.update({ initiative: agilidade, "flags.odrite.manobrasUsadas": 0 });
});

Hooks.on("combatRound", async (combat) => {
  if (!game.user.isGM) return;
  const updates = combat.combatants.map((c) => ({
    _id: c.id,
    "flags.odrite.manobrasUsadas": 0,
    "flags.odrite.usosAtacar": 0,
    "flags.odrite.usosConjurar": 0,
    "flags.odrite.isentoProximoAtacar": false
  }));
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
});
