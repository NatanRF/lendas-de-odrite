const { StringField, HTMLField } = foundry.data.fields;

export default class OdriteMagiaData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      caminho: new StringField({ initial: "" }),
      duracao: new StringField({ initial: "" }),
      alcance: new StringField({ initial: "" }),
      descricao: new HTMLField()
    };
  }
}
