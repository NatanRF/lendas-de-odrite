import { ODRITE } from "../config.mjs";

/** Quanto Sangrando pode acumular por turno (limite do livro). */
export const SANGRAMENTO_MAXIMO = 5;

/**
 * Valores padrão de cada Condição nomeada. Todas são permanentes: só saem
 * por ação do alvo (estancar, levantar, antídoto, teste de escape) ou por
 * um efeito que as encerre — nunca por contagem de rodadas.
 *
 * O `valor` fica em 0 porque Caído e Imobilizado não penalizam as rolagens
 * de quem as carrega: elas facilitam os ataques feitos CONTRA o alvo, o que
 * é tratado por `modificadoresContraAlvo`.
 */
const PADROES_NOMEADAS = {
  sangrando: { valor: 0, escopo: "qualquer", permanente: true },
  caido: { valor: 0, escopo: "qualquer", permanente: true },
  envenenado: { valor: 0, escopo: "qualquer", permanente: true },
  imobilizado: { valor: 0, escopo: "qualquer", permanente: true, atributoEscape: "forca" }
};

function formatarSinal(valor) {
  return valor >= 0 ? `+${valor}` : `${valor}`;
}

/**
 * Retorna a Condição nomeada ativa do ator, se houver.
 * @param {Actor} actor
 * @param {string} chave
 * @returns {Item|null}
 */
export function condicaoNomeada(actor, chave) {
  return actor?.items.find((i) => i.type === "condicao" && i.system.chave === chave) ?? null;
}

/**
 * @param {Actor} actor
 * @param {string} chave
 * @returns {boolean}
 */
export function temCondicao(actor, chave) {
  return !!condicaoNomeada(actor, chave);
}

/**
 * Aplica uma Condição nomeada. Sangrando acumula (+1 ponto perdido por turno,
 * até 5); as demais são idempotentes — reaplicar não faz nada.
 * @param {Actor} actor
 * @param {string} chave
 * @param {object} [extras] Campos a sobrescrever (ex: atributoEscape, removeAoSofrerDano).
 */
export async function aplicarCondicaoNomeada(actor, chave, extras = {}) {
  const padrao = PADROES_NOMEADAS[chave];
  if (!padrao) return null;

  const nome = game.i18n.localize(ODRITE.condicoesNomeadas[chave]);
  const existente = condicaoNomeada(actor, chave);

  if (existente) {
    if (chave !== "sangrando") return null;

    const nova = Math.min(SANGRAMENTO_MAXIMO, existente.system.intensidade + 1);
    if (nova === existente.system.intensidade) return null;

    await existente.update({ "system.intensidade": nova });
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Condicao.SangramentoAgravado", { alvo: actor.name, valor: nova })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  await actor.createEmbeddedDocuments("Item", [
    { name: nome, type: "condicao", system: { ...padrao, chave, ...extras } }
  ]);

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Condicao.NomeadaAplicada", { alvo: actor.name, condicao: nome })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Remove a Condição nomeada do ator, se estiver ativa.
 * @param {Actor} actor
 * @param {string} chave
 * @returns {Promise<boolean>} Se havia algo para remover.
 */
export async function removerCondicaoNomeada(actor, chave) {
  const condicao = condicaoNomeada(actor, chave);
  if (!condicao) return false;
  await actor.deleteEmbeddedDocuments("Item", [condicao.id]);
  return true;
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
    if (!condicao.system.valor) continue;

    const escopo = condicao.system.escopo;
    const bate =
      escopo === "qualquer" ||
      (escopo === "atributo" && atributoChave && condicao.system.atributoEspecifico === atributoChave) ||
      (escopo === tipoTeste && ["ataque", "manobra", "conjuracao"].includes(escopo));

    if (bate) modificadores.push({ label: condicao.name, valor: condicao.system.valor });
  }

  return modificadores;
}

/**
 * Modificadores que a situação do ALVO concede a quem o ataca: um alvo Caído
 * é Muito Fácil (+4) de acertar corpo a corpo, e um alvo Imobilizado é Fácil
 * (+2) de acertar à distância (corpo a corpo contra ele nem rola — ver
 * `acertoAutomaticoContra`).
 * @param {Actor} alvo
 * @param {string} tipoAtaque "corpoACorpo" | "distancia"
 * @returns {{label: string, valor: number}[]}
 */
export function modificadoresContraAlvo(alvo, tipoAtaque) {
  if (!alvo) return [];
  const modificadores = [];

  if (tipoAtaque === "corpoACorpo" && temCondicao(alvo, "caido")) {
    modificadores.push({ label: game.i18n.localize("ODRITE.Condicao.AlvoCaido"), valor: 4 });
  }

  if (tipoAtaque === "distancia" && temCondicao(alvo, "imobilizado")) {
    modificadores.push({ label: game.i18n.localize("ODRITE.Condicao.AlvoImobilizado"), valor: 2 });
  }

  return modificadores;
}

/**
 * Ataques adjacentes contra um alvo Imobilizado acertam sem teste de Acerto.
 * @param {Actor} alvo
 * @param {string} tipoAtaque
 * @returns {boolean}
 */
export function acertoAutomaticoContra(alvo, tipoAtaque) {
  return tipoAtaque === "corpoACorpo" && temCondicao(alvo, "imobilizado");
}

