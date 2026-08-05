const { NumberField, HTMLField } = foundry.data.fields;

export default class OdriteItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantidade: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      preco: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      descricao: new HTMLField()
    };
  }
}
