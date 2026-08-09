const { HTMLField } = foundry.data.fields;

export default class OdriteHabilidadeInimigoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      descricao: new HTMLField()
    };
  }
}
