function formatarSinal(valor) {
  return valor >= 0 ? `+${valor}` : `${valor}`;
}

/**
 * Cria uma condição embutida no ator (Item tipo "condicao") e anuncia no chat.
 * @param {Actor} actor
 * @param {object} dados
 * @param {string} dados.nome
 * @param {number} dados.valor
 * @param {string} dados.escopo
 * @param {string} [dados.atributoEspecifico]
 * @param {number} dados.duracaoRodadas
 * @param {boolean} dados.permanente
 */
export async function aplicarCondicao(actor, { nome, valor, escopo, atributoEspecifico, duracaoRodadas, permanente }) {
  await actor.createEmbeddedDocuments("Item", [
    {
      name: nome,
      type: "condicao",
      system: {
        valor,
        escopo,
        atributoEspecifico: atributoEspecifico ?? "",
        duracaoRodadas: Math.max(1, duracaoRodadas ?? 1),
        permanente: !!permanente
      }
    }
  ]);

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Condicao.Aplicada", { nome: actor.name, condicao: nome, valor: formatarSinal(valor) })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Lê as condições ativas do ator e retorna os modificadores que se aplicam
 * ao teste atual, conforme o escopo de cada uma.
 * @param {Actor} actor
 * @param {object} contexto
 * @param {string} [contexto.tipoTeste] "atributo" | "ataque" | "manobra" | "conjuracao"
 * @param {string} [contexto.atributoChave] Chave do atributo usado no teste (ex: "forca").
 * @returns {{label: string, valor: number}[]}
 */
export function coletarModificadores(actor, { tipoTeste, atributoChave } = {}) {
  if (!actor) return [];

  const condicoes = actor.items.filter((i) => i.type === "condicao");
  const modificadores = [];

  for (const condicao of condicoes) {
    const escopo = condicao.system.escopo;
    const bate =
      escopo === "qualquer" ||
      (escopo === "atributo" && atributoChave && condicao.system.atributoEspecifico === atributoChave) ||
      (escopo === tipoTeste && ["ataque", "manobra", "conjuracao"].includes(escopo));

    if (bate) modificadores.push({ label: condicao.name, valor: condicao.system.valor });
  }

  return modificadores;
}
