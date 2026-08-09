import { ODRITE } from "../config.mjs";

const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class OdriteManobraData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ofensiva: new BooleanField({ initial: true }),
      defensiva: new BooleanField({ initial: false }),
      tipoAtaque: new StringField({
        required: true,
        choices: Object.keys(ODRITE.tiposAtaque),
        initial: "corpoACorpo"
      }),
      dano: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      custo: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      propriedade: new StringField({ initial: "" }),
      descricao: new HTMLField()
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.atributo = ODRITE.atributoPorTipoAtaque[this.tipoAtaque] ?? "forca";
  }
}
