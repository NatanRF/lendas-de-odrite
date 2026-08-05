import { ODRITE } from "../config.mjs";

const { SchemaField, NumberField, StringField, HTMLField } = foundry.data.fields;

/**
 * Cria um SchemaField padrão para um atributo, testado via 1d20 <= valor.
 * Por padrão o valor não pode passar de 14.
 */
function attributeField(initial) {
  return new SchemaField({
    value: new NumberField({ required: true, integer: true, min: 0, max: 14, initial })
  });
}

export default class OdriteCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      detalhes: new SchemaField({
        raca: new StringField({ initial: ODRITE.racas[0], choices: ODRITE.racas }),
        classe: new StringField({ initial: ODRITE.classes[0], choices: ODRITE.classes }),
        nivel: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
        experiencia: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        deslocamento: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        biografia: new HTMLField()
      }),

      atributos: new SchemaField({
        forca: attributeField(10),
        agilidade: attributeField(10),
        resistencia: attributeField(10),
        influencia: attributeField(10),
        mente: attributeField(10),
        sentidos: attributeField(10),
        habilidade: attributeField(10),
        conjuracao: attributeField(10)
      }),

      vitalidade: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),

      fadiga: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, max: 12, initial: 0 })
      }),

      fonteArcana: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.fontesArcanas] }),

      caminhosConjuracao: new SchemaField({
        um: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] }),
        dois: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] }),
        tres: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] })
      }),

      nivelTreinamento: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),

      proficiencias: new SchemaField({
        idiomas: new StringField({ initial: "" }),
        armas: new StringField({ initial: "" }),
        armaduras: new StringField({ initial: "" }),
        escudos: new StringField({ initial: "" })
      }),

      recursos: new SchemaField({
        drakeons: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        aljava: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        cantil: new StringField({ initial: "" })
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.vitalidade.value = Math.min(this.vitalidade.value, this.vitalidade.max);

    const fadiga = this.fadiga.value;
    if (fadiga >= 10) this.fadiga.estagio = "exaustao";
    else if (fadiga >= 7) this.fadiga.estagio = "penalidade4";
    else if (fadiga >= 4) this.fadiga.estagio = "penalidade2";
    else this.fadiga.estagio = "normal";

    this.fadiga.penalidade =
      this.fadiga.estagio === "exaustao" ? -4 :
      this.fadiga.estagio === "penalidade4" ? -4 :
      this.fadiga.estagio === "penalidade2" ? -2 : 0;

    this.fadiga.drenaVitalidade = this.fadiga.estagio === "exaustao";

    const itens = this.parent?.items ?? [];
    this.penalidadeAgilidade = itens
      .filter((item) => item.type === "armadura" || item.type === "escudo")
      .reduce((total, item) => total + (item.system.penalidade ?? 0), 0);

    this.dadoTreinamento = ODRITE.dadoTreinamentoPorNivel[this.nivelTreinamento] ?? 12;

    this.capacidadeCarga = Math.max(this.atributos.forca.value, 10);
    this.cargaAtual = itens
      .filter((item) => item.type === "item")
      .reduce((total, item) => total + (item.system.quantidade ?? 0), 0);
    this.sobrecarregado = this.cargaAtual > this.capacidadeCarga;
  }
}
