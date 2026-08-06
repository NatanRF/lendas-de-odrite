import { ODRITE } from "./config.mjs";
import OdriteActor from "./documents/actor.mjs";
import OdriteCharacterData from "./data/actor-character.mjs";
import OdriteArmaData from "./data/item-arma.mjs";
import OdriteArmaduraData from "./data/item-armadura.mjs";
import OdriteEscudoData from "./data/item-escudo.mjs";
import OdriteMagiaData from "./data/item-magia.mjs";
import OdriteHabilidadeData from "./data/item-habilidade.mjs";
import OdriteItemData from "./data/item-item.mjs";
import OdriteCharacterSheet from "./sheets/actor-sheet.mjs";
import OdriteItemSheet from "./sheets/item-sheet.mjs";
import OdriteCharacterWizard from "./apps/character-wizard.mjs";

Hooks.once("init", () => {
  console.log("Lendas de Odrite | Inicializando sistema");

  game.odrite = { ODRITE };
  CONFIG.ODRITE = ODRITE;

  CONFIG.Actor.documentClass = OdriteActor;

  CONFIG.Actor.dataModels = {
    character: OdriteCharacterData
  };

  CONFIG.Item.dataModels = {
    arma: OdriteArmaData,
    armadura: OdriteArmaduraData,
    escudo: OdriteEscudoData,
    magia: OdriteMagiaData,
    habilidade: OdriteHabilidadeData,
    item: OdriteItemData
  };

  Actors.registerSheet("odrite", OdriteCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "ODRITE.SheetPersonagem"
  });

  Items.registerSheet("odrite", OdriteItemSheet, {
    types: ["arma", "armadura", "escudo", "magia", "habilidade", "item"],
    makeDefault: true,
    label: "ODRITE.SheetItem"
  });

  Handlebars.registerHelper("concat", (...args) => {
    args.pop();
    return args.join("");
  });

  Handlebars.registerHelper("eq", (a, b) => a === b);

  Handlebars.registerHelper("capitalize", (str) =>
    typeof str === "string" && str.length ? str[0].toUpperCase() + str.slice(1) : str
  );

  Handlebars.registerHelper("includes", (lista, valor) => Array.isArray(lista) && lista.includes(valor));

  Handlebars.registerHelper("lt", (a, b) => a < b);

  Handlebars.registerHelper("multiply", (a, b) => (Number(a) || 0) * (Number(b) || 0));

  Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));

  Handlebars.registerHelper("not", (a) => !a);
});

Hooks.on("createActor", async (actor, options, userId) => {
  if (actor.type !== "character" || game.user.id !== userId) return;

  const s = actor.system;
  const ehFichaEmBranco =
    s.detalhes.raca === ODRITE.racas[0] &&
    s.detalhes.classe === ODRITE.classes[0] &&
    Object.values(s.atributos).every((a) => a.value === 10) &&
    actor.items.size === 0;
  if (!ehFichaEmBranco) return;

  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("ODRITE.Assistente.Titulo") },
    content: `<p>${game.i18n.localize("ODRITE.Assistente.Pergunta")}</p>`,
    buttons: [
      { action: "manual", label: game.i18n.localize("ODRITE.Assistente.Manual") },
      { action: "guiada", label: game.i18n.localize("ODRITE.Assistente.Guiada"), default: true }
    ],
    modal: true
  });

  if (escolha === "guiada") {
    actor.sheet?.close();
    new OdriteCharacterWizard(actor).render(true);
  }
});
