import { ODRITE } from "../config.mjs";

const { StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

export default class OdriteCondicaoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      valor: new NumberField({ required: true, integer: true, initial: -2 }),
      escopo: new StringField({
        required: true,
        initial: "qualquer",
        choices: ["qualquer", "ataque", "manobra", "conjuracao", "atributo"]
      }),
      atributoEspecifico: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.atributos)] }),
      duracaoRodadas: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      permanente: new BooleanField({ initial: false }),
      descricao: new HTMLField()
    };
  }
}
