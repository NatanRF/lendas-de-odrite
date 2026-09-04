import { ODRITE } from "../config.mjs";

const { StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

export default class OdriteHabilidadeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tipo: new StringField({
        required: true,
        choices: Object.keys(ODRITE.tiposHabilidade),
        initial: "passiva"
      }),
      classe: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.classes] }),
      origem: new StringField({
        required: true,
        choices: ["classe", "raca"],
        initial: "classe"
      }),
      raca: new StringField({ initial: "", blank: true, choices: ["", ...ODRITE.racas] }),
      categoria: new StringField({
        required: true,
        choices: Object.keys(ODRITE.categoriasHabilidade),
        initial: "lista"
      }),
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

      // Habilidades do tipo "faça X uma vez por rodada sem contabilizar em
      // suas Manobras de Combate": o saldo é reposto a cada rodada.
      concedeAcaoLivre: new BooleanField({ initial: false }),
      acaoLivreTipo: new StringField({
        required: true,
        initial: "qualquer",
        choices: Object.keys(ODRITE.acoesLivres)
      }),
      acaoLivrePorRodada: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
    };
  }
}
