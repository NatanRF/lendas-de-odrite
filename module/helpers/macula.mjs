/** Pontos de Mácula em que o hospedeiro é consumido e vira uma Maldição. */
export const MACULA_MAXIMA = 5;

/**
 * Penalidades da Mácula, cumulativas: quem tem 3 pontos sofre também o que
 * vale para 1 e 2. O efeito de 2 pontos (Descanso Completo uma categoria
 * abaixo) não é um modificador de rolagem e vive em `descanso.mjs`.
 *
 * O -2 em Influência do primeiro ponto vale sempre: as marcas ficam na pele e
 * o sistema não tem como saber quem está olhando.
 *
 * @param {Actor} actor
 * @param {string} chave Atributo testado.
 * @returns {{label: string, valor: number}[]}
 */
export function modificadoresMacula(actor, chave) {
  const pontos = actor?.system?.macula ?? 0;
  if (pontos < 1) return [];

  const modificadores = [];
  const rotulo = (nivel) => game.i18n.format("ODRITE.Macula.Modificador", { nivel });

  if (pontos >= 1 && chave === "influencia") modificadores.push({ label: rotulo(1), valor: -2 });
  if (pontos >= 3 && chave === "mente") modificadores.push({ label: rotulo(3), valor: -4 });
  if (pontos >= 4) modificadores.push({ label: rotulo(4), valor: -2 });

  return modificadores;
}

/**
 * Acrescenta 1 Ponto de Mácula. Pontos de Mácula não podem ser removidos, e
 * ao chegar em 5 o personagem é consumido — a transformação em Maldição é
 * aplicada pelo _preUpdate do ator, junto da mesma escrita.
 *
 * @param {Actor} actor
 * @param {string} motivo Texto já localizado com a origem da contaminação.
 */
export async function ganharPontoMacula(actor, motivo) {
  if (actor?.type !== "character") return;

  const atual = actor.system.macula ?? 0;
  if (atual >= MACULA_MAXIMA) return;

  await actor.update({ "system.macula": atual + 1 });

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Macula.Recebido", {
      nome: actor.name, motivo, total: atual + 1
    })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Rebaixa o conforto de um Descanso Completo em uma categoria, efeito do
 * segundo Ponto de Mácula. Desconfortável já é o piso.
 * @param {string} conforto
 * @returns {string}
 */
export function rebaixarConforto(conforto) {
  const escala = ["confortavel", "razoavel", "desconfortavel"];
  const indice = escala.indexOf(conforto);
  if (indice < 0) return "desconfortavel";
  return escala[Math.min(indice + 1, escala.length - 1)];
}
