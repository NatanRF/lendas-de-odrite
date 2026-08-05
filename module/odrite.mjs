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
});
