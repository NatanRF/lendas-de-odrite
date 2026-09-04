import { ODRITE } from "../config.mjs";

const { StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields;

export default class OdriteCondicaoData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      valor: new NumberField({ required: true, integer: true, initial: -2 }),
      escopo: new StringField({
        required: true,
        initial: "qualquer",
        choices: ["qualquer", "ataque", "manobra", "conjuracao", "atributo"]
      }),
      atributoEspecifico: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.atributos)] }),
      duracaoRodadas: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      permanente: new BooleanField({ initial: false }),

      // Condições do livro (Sangrando, Caído, Envenenado, Imobilizado) têm
      // efeito mecânico próprio; uma condição sem chave é só o modificador.
      chave: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.condicoesNomeadas)] }),
      // Sangrando acumula: cada nova aplicação soma 1 ponto perdido por turno.
      intensidade: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      // Atributo testado para se livrar de Imobilizado (varia por conjuração).
      atributoEscape: new StringField({ initial: "", blank: true, choices: ["", ...Object.keys(ODRITE.atributos)] }),
      // Imobilizado por conjuração some ao alvo sofrer qualquer dano.
      removeAoSofrerDano: new BooleanField({ initial: false }),

      descricao: new HTMLField()
    };
  }
}
