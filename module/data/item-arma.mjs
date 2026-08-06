import { ODRITE } from "../config.mjs";

const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class OdriteArmaData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tipoAtaque: new StringField({
        required: true,
        choices: Object.keys(ODRITE.tiposAtaque),
        initial: "corpoACorpo"
      }),
      categoria: new StringField({
        required: true,
        choices: ODRITE.categoriasArma,
        initial: ODRITE.categoriasArma[0]
      }),
      dano: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      propriedade: new StringField({ initial: "" }),
      preco: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      forcaMinima: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      alcance: new StringField({ initial: "" }),
      maos: new StringField({
        required: true,
        choices: ODRITE.empunhaduras,
        initial: "1 mão"
      }),
      durabilidade: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 6 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 6 })
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.atributo = ODRITE.atributoPorTipoAtaque[this.tipoAtaque] ?? "forca";
  }
}
