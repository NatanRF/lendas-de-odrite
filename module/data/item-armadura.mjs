const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class OdriteArmaduraData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tipo: new StringField({ initial: "" }),
      preco: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      forcaMinima: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      penalidade: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      durabilidade: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
      })
    };
  }
}
