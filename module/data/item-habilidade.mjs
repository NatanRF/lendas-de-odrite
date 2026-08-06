import { ODRITE } from "../config.mjs";

const { StringField, HTMLField } = foundry.data.fields;

export default class OdriteHabilidadeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tipo: new StringField({
        required: true,
        choices: Object.keys(ODRITE.tiposHabilidade),
        initial: "passiva"
      }),
      classe: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.classes] }),
      origem: new StringField({
        required: true,
        choices: ["classe", "raca"],
        initial: "classe"
      }),
      raca: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.racas] }),
      categoria: new StringField({
        required: true,
        choices: Object.keys(ODRITE.categoriasHabilidade),
        initial: "lista"
      }),
      descricao: new HTMLField()
    };
  }
}
