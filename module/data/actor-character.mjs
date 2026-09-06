import { ODRITE } from "../config.mjs";

const { SchemaField, NumberField, StringField, HTMLField, ArrayField, BooleanField } = foundry.data.fields;

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
        tamanho: new StringField({ initial: "" }),
        // Só o Combatente Sagrado tem Devoção; nas demais classes fica vazia.
        devocao: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.devocoes)] }),
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
        max: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        reducaoMaxima: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      fadiga: new SchemaField({
        value: new NumberField({ required: true, integer: true, min: 0, max: 12, initial: 0 }),
        reducaoLimite: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
      }),

      ferimentosPermanentes: new ArrayField(new StringField()),
      mutilacoes: new ArrayField(new StringField()),
      transformadoMaldicao: new BooleanField({ initial: false }),
      morto: new BooleanField({ initial: false }),
      // Pontos de Mácula nunca são removidos; ao chegar em 5 o personagem é
      // consumido e se transforma numa Maldição.
      macula: new NumberField({ required: true, integer: true, min: 0, max: 5, initial: 0 }),

      fonteArcana: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.fontesArcanas] }),

      caminhosConjuracao: new SchemaField({
        um: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] }),
        dois: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] }),
        tres: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.caminhosConjuracao] })
      }),

      nivelTreinamento: new NumberField({ required: true, integer: true, min: 1, max: 5, initial: 1 }),

      manobrasPorRodada: new NumberField({ required: true, integer: true, min: 0, initial: 3 }),

      proficiencias: new SchemaField({
        idiomas: new StringField({ initial: "" }),
        armas: new StringField({ initial: "" }),
        armaduras: new StringField({ initial: "" }),
        escudos: new StringField({ initial: "" })
      }),

      recursos: new SchemaField({
        drakeons: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        municao: new SchemaField({
          value: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
        })
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.vitalidade.maxEfetivo = Math.max(0, this.vitalidade.max - (this.vitalidade.reducaoMaxima ?? 0));
    this.vitalidade.value = Math.min(this.vitalidade.value, this.vitalidade.maxEfetivo);

    // Estado derivado: a 0 de Vitalidade o personagem está inconsciente e faz
    // Rolagens de Morte; a morte definitiva é o único estado gravado.
    this.inconsciente = this.vitalidade.value <= 0 && !this.morto;

    this.fadiga.limite = Math.max(0, 12 - (this.fadiga.reducaoLimite ?? 0));
    this.fadiga.value = Math.min(this.fadiga.value, this.fadiga.limite);

    const fadiga = this.fadiga.value;
    const limite = this.fadiga.limite;
    if (fadiga >= limite - 2) this.fadiga.estagio = "exaustao";
    else if (fadiga >= limite - 5) this.fadiga.estagio = "penalidade4";
    else if (fadiga >= limite - 8) this.fadiga.estagio = "penalidade2";
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

    // Benefício concedido pelo deus escolhido na Devoção.
    this.beneficioDevocao = ODRITE.devocoes[this.detalhes.devocao]?.beneficio ?? "";

    this.capacidadeCarga = Math.max(this.atributos.forca.value, 10);
    if (this.mutilacoes?.includes("traumaColuna")) {
      this.capacidadeCarga = Math.floor(this.capacidadeCarga / 2);
    }
    this.cargaAtual = itens
      .filter((item) => item.type === "item" && !item.system.slotEspecial)
      .reduce((total, item) => total + (item.system.quantidade ?? 0), 0);
    this.sobrecarregado = this.cargaAtual > this.capacidadeCarga;

    this.recursos.municao.max = itens
      .filter((item) => item.type === "item" && item.system.slotEspecial === "aljava")
      .reduce((total, item) => total + (item.system.capacidade ?? 0), 0);
    this.recursos.municao.value = Math.min(this.recursos.municao.value, this.recursos.municao.max);

    this.deslocamentoEfetivo = this.mutilacoes?.includes("peDecepado")
      ? Math.floor(this.detalhes.deslocamento / 2)
      : this.detalhes.deslocamento;
  }
}
