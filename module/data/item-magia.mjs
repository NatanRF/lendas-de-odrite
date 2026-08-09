import { ODRITE } from "../config.mjs";

const { StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

export default class OdriteMagiaData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      caminho: new StringField({ initial: "" }),
      duracao: new StringField({
        required: true,
        initial: "instantaneo",
        choices: Object.keys(ODRITE.duracoesMagia)
      }),
      alcance: new StringField({ initial: "" }),
      dano: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      descricao: new HTMLField(),

      concedeCondicao: new BooleanField({ initial: false }),
      condicaoNome: new StringField({ initial: "" }),
      condicaoValor: new NumberField({ required: true, integer: true, initial: 2 }),
      condicaoEscopo: new StringField({
        required: true,
        initial: "qualquer",
        choices: ["qualquer", "ataque", "manobra", "conjuracao", "atributo"]
      }),
      condicaoAtributoEspecifico: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.atributos)] }),
      condicaoDuracaoRodadas: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      condicaoPermanente: new BooleanField({ initial: false }),
      condicaoAlvo: new StringField({ required: true, initial: "lancador", choices: ["lancador", "alvo"] })
    };
  }
}
