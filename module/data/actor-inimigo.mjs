const { SchemaField, NumberField } = foundry.data.fields;

/**
 * Cria um SchemaField padrão para um atributo de inimigo, testado via
 * 1d20 <= valor. Diferente do personagem, não há teto de 14 — inimigos
 * podem ter atributos mais altos.
 */
function attributeField(initial) {
  return new SchemaField({
    value: new NumberField({ required: true, integer: true, min: 0, initial })
  });
}

export default class OdriteInimigoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      vitalidade: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),

      deslocamento: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),

      manobrasPorRodada: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),

      dadoTreinamento: new NumberField({ required: true, integer: true, min: 2, initial: 12 }),

      atributos: new SchemaField({
        forca: attributeField(10),
        agilidade: attributeField(10),
        resistencia: attributeField(10),
        influencia: attributeField(10),
        mente: attributeField(10),
        sentidos: attributeField(10),
        habilidade: attributeField(10),
        conjuracao: attributeField(10)
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.vitalidade.value = Math.min(this.vitalidade.value, this.vitalidade.max);
  }
}
