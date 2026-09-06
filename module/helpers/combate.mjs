import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "./dice.mjs";
import {
  aplicarCondicaoNomeada,
  condicaoNomeada,
  removerCondicaoNomeada,
  temCondicao
} from "./condicoes.mjs";
import { ganharPontoMacula } from "./macula.mjs";

const CATEGORIAS_ARMAS_LEVES = ["Adagas", "Bastões", "Arcos", "Bestas"];
const DEFESA_TEMPLATE = "systems/odrite/templates/chat/defesa-prompt.hbs";

const MUTILACOES = ["traumaColuna", "maoDecepada", "bracoDecepado", "peDecepado"];

const MUTILACAO_LABELS = {
  traumaColuna: "ODRITE.Mutilacao.TraumaColuna",
  maoDecepada: "ODRITE.Mutilacao.MaoDecepada",
  bracoDecepado: "ODRITE.Mutilacao.BracoDecepado",
  peDecepado: "ODRITE.Mutilacao.PeDecepado"
};

const ATRIBUTO_POR_RESULTADO_FERIMENTO = {
  2: "forca",
  3: "agilidade",
  4: "resistencia",
  5: "mente",
  6: "influencia",
  7: "sentidos"
};

const LABEL_TIPO_ITEM = { arma: "ODRITE.Arma", armadura: "ODRITE.Armadura", escudo: "ODRITE.Escudo" };

function normalizarPropriedade(texto) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Lê o alvo atualmente targetado pelo usuário (marcação visual nativa do
 * Foundry). Se nenhum, avisa e retorna null para abortar o ataque.
 */
export function obterAlvo() {
  const alvo = [...game.user.targets][0];
  if (!alvo?.actor) {
    ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SelecioneAlvo"));
    return null;
  }
  return alvo.actor;
}

function combatantDoAtor(actor) {
  return game.combat?.combatants.find((c) => c.actorId === actor.id) ?? null;
}

/**
 * Porteiro único de qualquer gasto de Manobra de Combate. Um alvo Imobilizado
 * só pode agir para tentar se libertar, e um alvo surpreendido por uma
 * Emboscada perde a primeira rodada inteira.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function podeUsarManobra(actor) {
  if (temCondicao(actor, "imobilizado")) {
    ui.notifications.warn(game.i18n.format("ODRITE.Aviso.Imobilizado", { nome: actor.name }));
    return false;
  }

  if (combatantDoAtor(actor)?.getFlag("odrite", "surpreendido")) {
    ui.notifications.warn(game.i18n.format("ODRITE.Aviso.Surpreendido", { nome: actor.name }));
    return false;
  }

  return true;
}

/**
 * Orçamento de ações livres da rodada: habilidades passivas que concedem uma
 * manobra "sem contabilizar em suas Manobras de Combate" somam aqui.
 * @param {Actor} actor
 * @returns {Record<string, number>}
 */
export function orcamentoAcoesLivres(actor) {
  const orcamento = {};
  for (const item of actor.items) {
    if (item.type !== "habilidade" || !item.system.concedeAcaoLivre) continue;
    const tipo = item.system.acaoLivreTipo || "qualquer";
    orcamento[tipo] = (orcamento[tipo] ?? 0) + (item.system.acaoLivrePorRodada ?? 1);
  }
  return orcamento;
}

/**
 * Consome uma ação livre do tipo pedido, se houver saldo. Um saldo declarado
 * como "qualquer" cobre qualquer manobra e só é usado depois do específico.
 * @param {Actor} actor
 * @param {string} tipo
 * @returns {Promise<boolean>} Se a manobra saiu de graça.
 */
export async function consumirAcaoLivre(actor, tipo) {
  const combatant = combatantDoAtor(actor);
  if (!combatant) return false;

  const orcamento = orcamentoAcoesLivres(actor);
  const usadas = combatant.getFlag("odrite", "acoesLivresUsadas") ?? {};

  for (const chave of [tipo, "qualquer"]) {
    const disponivel = (orcamento[chave] ?? 0) - (usadas[chave] ?? 0);
    if (disponivel <= 0) continue;

    await combatant.setFlag("odrite", "acoesLivresUsadas", { ...usadas, [chave]: (usadas[chave] ?? 0) + 1 });
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Combate.AcaoLivreUsada", {
        nome: actor.name,
        acao: game.i18n.localize(ODRITE.acoesLivres[tipo] ?? "ODRITE.AcaoLivre.qualquer")
      })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return true;
  }

  return false;
}

export function alvoTemManobraDisponivel(alvoActor) {
  const combatant = combatantDoAtor(alvoActor);
  if (!combatant) return false;
  const max = alvoActor.system.manobrasPorRodada ?? 0;
  const usadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
  return usadas < max;
}

/**
 * Registra o uso de "Atacar" ou "Conjurar" pelo personagem nesta rodada:
 * sempre consome 1 Manobra de Combate e, se a mesma ação já foi usada antes
 * na rodada, soma 1 Fadiga — exceto se estiver isento por um Acerto
 * Absoluto anterior (só vale pra "atacar") ou se a arma usada for de uma
 * categoria leve (Adagas, Bastões, Arcos, Bestas), que exigem menos
 * esforço e nunca contam fadiga por repetição (mas ainda consomem a
 * Manobra normalmente).
 * @param {Actor} atacante
 * @param {"atacar"|"conjurar"} tipo
 * @param {string} [categoriaArma] Categoria da arma usada, só relevante para "atacar".
 */
export async function registrarUsoManobra(atacante, tipo, categoriaArma) {
  if (atacante.type !== "character") return;

  const combatant = combatantDoAtor(atacante);
  if (!combatant) return;

  // Uma ação livre concedida por habilidade cobre a Manobra, mas não isenta
  // a Fadiga por repetição — o esforço aconteceu do mesmo jeito.
  const livre = await consumirAcaoLivre(atacante, tipo);

  const manobrasUsadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
  const updates = livre ? {} : { "flags.odrite.manobrasUsadas": manobrasUsadas + 1 };

  // Armas leves nunca cansam por repetição; a Ressonância 2 dá o mesmo
  // benefício ao Conjurar até o fim do combate.
  const semFadigaRepeticao =
    (tipo === "atacar" && CATEGORIAS_ARMAS_LEVES.includes(categoriaArma)) ||
    (tipo === "conjurar" && !!combatant.getFlag("odrite", "conjurarSemFadiga"));

  if (!semFadigaRepeticao) {
    const chaveContador = tipo === "atacar" ? "usosAtacar" : "usosConjurar";
    const usos = combatant.getFlag("odrite", chaveContador) ?? 0;
    const isento = tipo === "atacar" && !!combatant.getFlag("odrite", "isentoProximoAtacar");

    if (usos >= 1 && !isento) {
      await atacante.update({ "system.fadiga.value": atacante.system.fadiga.value + 1 });
      ChatMessage.create({
        content: `<p>${game.i18n.format("ODRITE.Combate.FadigaRepeticao", { nome: atacante.name })}</p>`,
        speaker: ChatMessage.getSpeaker({ actor: atacante })
      });
    }

    updates[`flags.odrite.${chaveContador}`] = usos + 1;
    if (isento) updates["flags.odrite.isentoProximoAtacar"] = false;
  }

  await combatant.update(updates);
}

/**
 * Marca que o próximo uso de "Atacar" nesta rodada não deve cobrar Fadiga
 * por repetição (concedido por um Acerto Absoluto).
 * @param {Actor} atacante
 */
export async function concederIsencaoProximoAtaque(atacante) {
  const combatant = combatantDoAtor(atacante);
  if (combatant) await combatant.setFlag("odrite", "isentoProximoAtacar", true);
}

export function montarOpcoesDefesa(alvoActor, tipoAtaque) {
  const opcoes = [];

  // Sussurros do Pacto (Preço 4): sem Manobras Defensivas por d4 dias.
  if (alvoActor.getFlag("odrite", "semManobrasDefensivas")) {
    return [{ tipo: "nenhuma", label: game.i18n.localize("ODRITE.Defesa.NaoDefender") }];
  }

  if (alvoActor.type === "character") {
    opcoes.push({ tipo: "esquivar", label: game.i18n.localize("ODRITE.Defesa.Esquivar") });

    if (tipoAtaque === "corpoACorpo") {
      const arma = alvoActor.items.find(
        (i) => i.type === "arma" && !CATEGORIAS_ARMAS_LEVES.includes(i.system.categoria)
      );
      if (arma) opcoes.push({ tipo: "aparar", label: game.i18n.localize("ODRITE.Defesa.Aparar") });
    }

  } else if (alvoActor.type === "inimigo") {
    for (const manobra of alvoActor.items.filter((i) => i.type === "manobra" && i.system.defensiva)) {
      opcoes.push({ tipo: "manobraDefensiva", itemId: manobra.id, label: manobra.name });
    }
  }

  if (alvoActor.items.find((i) => i.type === "escudo")) {
    opcoes.push({ tipo: "bloquear", label: game.i18n.localize("ODRITE.Defesa.Bloquear") });
  }

  if (alvoActor.items.find((i) => i.type === "armadura")) {
    opcoes.push({ tipo: "mitigar", label: game.i18n.localize("ODRITE.Defesa.Mitigar") });
  }

  opcoes.push({ tipo: "nenhuma", label: game.i18n.localize("ODRITE.Defesa.NaoDefender") });
  return opcoes;
}

async function reduzirDurabilidade(item, faces = 4) {
  const roll = await new Roll(`1d${faces}`).evaluate();
  const atual = item.system.durabilidade?.value ?? 0;
  await item.update({ "system.durabilidade.value": Math.max(0, atual - roll.total) });
  return roll.total;
}

async function atualizarVitalidade(actor, dano) {
  if (dano <= 0) return;
  const atual = actor.system.vitalidade.value;
  await actor.update({ "system.vitalidade.value": Math.max(0, atual - dano) });

  // Imobilizado por conjuração se desfaz assim que o alvo sofre dano.
  const imobilizado = condicaoNomeada(actor, "imobilizado");
  if (imobilizado?.system.removeAoSofrerDano) {
    await removerCondicaoNomeada(actor, "imobilizado");
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Condicao.ImobilizadoRompido", { alvo: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}

export async function aplicarDanoDireto(alvo, dano) {
  if (dano <= 0) return;

  if (alvo.isOwner) {
    await atualizarVitalidade(alvo, dano);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Defesa.DanoAplicado", { alvo: alvo.name, dano })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor: alvo })
    });
  }

  return ChatMessage.create({
    content: "",
    whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
    flags: { odrite: { danoPendente: { alvoUuid: alvo.uuid, dano } } }
  });
}

export async function aplicarDanoPendente(mensagem) {
  const pendente = mensagem.getFlag("odrite", "danoPendente");
  if (!pendente) return;
  const alvo = fromUuidSync(pendente.alvoUuid);
  if (!alvo) return;
  await atualizarVitalidade(alvo, pendente.dano);
  await ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Defesa.DanoAplicado", { alvo: alvo.name, dano: pendente.dano })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: alvo })
  });
}

export async function postarPromptDefesa({ atacante, alvo, dano, tipoAtaque, opcoes }) {
  const donos = game.users.filter((u) => !u.isGM && alvo.testUserPermission(u, "OWNER")).map((u) => u.id);
  const gms = game.users.filter((u) => u.isGM).map((u) => u.id);
  const whisper = [...new Set([...donos, ...gms])];

  const content = await foundry.applications.handlebars.renderTemplate(DEFESA_TEMPLATE, {
    atacanteNome: atacante.name,
    alvoNome: alvo.name,
    dano,
    opcoes
  });

  return ChatMessage.create({
    content,
    whisper,
    flags: {
      odrite: {
        defesaPendente: {
          atacanteUuid: atacante.uuid,
          alvoUuid: alvo.uuid,
          dano,
          tipoAtaque,
          resolvida: false
        }
      }
    }
  });
}

async function perguntarMitigacao(danoMax) {
  const resultado = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("ODRITE.Defesa.Mitigar") },
    content: `<div class="campo"><label>${game.i18n.format("ODRITE.Defesa.QuantoMitigar", { max: danoMax })}</label><input type="number" name="mitigar" value="${danoMax}" min="0" max="${danoMax}"></div>`,
    ok: {
      label: game.i18n.localize("ODRITE.Defesa.Confirmar"),
      callback: (event, button) => Number(button.form.elements.mitigar.value)
    }
  });

  const valor = Number(resultado);
  if (Number.isNaN(valor)) return 0;
  return Math.min(Math.max(valor, 0), danoMax);
}

export async function resolverDefesa(mensagem, tipo, itemId) {
  const pendente = mensagem.getFlag("odrite", "defesaPendente");
  if (!pendente || pendente.resolvida) return;

  const alvo = fromUuidSync(pendente.alvoUuid);
  const atacante = fromUuidSync(pendente.atacanteUuid);
  if (!alvo?.isOwner) return;

  // Reivindica a resolução imediatamente (antes de qualquer rolagem/diálogo)
  // para evitar processar o mesmo clique duas vezes.
  await mensagem.setFlag("odrite", "defesaPendente", { ...pendente, resolvida: true });

  if (tipo !== "nenhuma") {
    const combatant = combatantDoAtor(alvo);
    // Habilidades como "Esquivar uma vez por rodada sem contabilizar em suas
    // Manobras de Combate" entram aqui.
    if (combatant && !(await consumirAcaoLivre(alvo, tipo))) {
      const usadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
      await combatant.setFlag("odrite", "manobrasUsadas", usadas + 1);
    }
  }

  let danoFinal = pendente.dano;
  let resumo;

  if (tipo === "bloquear") {
    const escudo = alvo.items.find((i) => i.type === "escudo");
    danoFinal = 0;
    const perdido = escudo ? await reduzirDurabilidade(escudo) : 0;
    resumo = game.i18n.format("ODRITE.Defesa.ResultadoBloquear", { alvo: alvo.name, durabilidade: perdido });
  } else if (tipo === "aparar") {
    // Aparar não exige teste: anula todo o dano, mas a arma perde Durabilidade
    // igual à metade do dano anulado (arredondado para cima). Se a arma não
    // quebrar no processo, concede um contra-ataque que não custa Manobra.
    const arma = alvo.items.find(
      (i) => i.type === "arma" && !CATEGORIAS_ARMAS_LEVES.includes(i.system.categoria)
    );

    danoFinal = 0;
    const custo = Math.ceil(pendente.dano / 2);
    let quebrou = false;

    if (arma) {
      const atualDur = arma.system.durabilidade?.value ?? 0;
      const novaDur = Math.max(0, atualDur - custo);
      await arma.update({ "system.durabilidade.value": novaDur });
      quebrou = novaDur <= 0;
    }

    resumo = game.i18n.format(
      quebrou ? "ODRITE.Defesa.ResultadoApararQuebrou" : "ODRITE.Defesa.ResultadoApararSucesso",
      { alvo: alvo.name, durabilidade: custo, arma: arma?.name ?? "" }
    );

    if (arma && atacante && !quebrou) {
      alvo.rollAtaque(arma.id, atacante, { semManobra: true });
    }
  } else if (tipo === "esquivar") {
    const agilidade = alvo.system.atributos.agilidade;
    const modificadores = alvo._modificadoresBase("agilidade");
    if (pendente.tipoAtaque === "distancia") {
      modificadores.push({ label: game.i18n.localize("ODRITE.Defesa.PenalidadeDistancia"), valor: -4 });
    }
    const resultado = await rolarTesteRollUnder({
      titulo: game.i18n.localize("ODRITE.Defesa.Esquivar"),
      alvo: agilidade.value,
      atributoLabel: game.i18n.localize(ODRITE.atributos.agilidade),
      modificadores,
      tipoTeste: "manobra",
      atributoChave: "agilidade",
      actor: alvo
    });

    if (resultado.sucesso) {
      danoFinal = 0;
      resumo = game.i18n.format("ODRITE.Defesa.ResultadoEsquivarSucesso", { alvo: alvo.name });
    } else {
      danoFinal = Math.floor(pendente.dano / 2);
      resumo = game.i18n.format("ODRITE.Defesa.ResultadoEsquivarFalha", { alvo: alvo.name, dano: danoFinal });
    }
  } else if (tipo === "mitigar") {
    // Cada ponto de Durabilidade da armadura absorve 2 pontos de dano, então
    // a armadura limita quanto pode ser mitigado; o excedente passa direto.
    const armadura = alvo.items.find((i) => i.type === "armadura");
    const durAtual = armadura?.system.durabilidade?.value ?? 0;
    const maximoMitigavel = Math.min(pendente.dano, durAtual * 2);

    if (maximoMitigavel <= 0) {
      danoFinal = pendente.dano;
      resumo = game.i18n.format("ODRITE.Defesa.ResultadoMitigarSemArmadura", { alvo: alvo.name, dano: danoFinal });
    } else {
      const mitigado = await perguntarMitigacao(maximoMitigavel);
      danoFinal = pendente.dano - mitigado;
      const custo = Math.ceil(mitigado / 2);
      if (armadura && custo > 0) {
        await armadura.update({ "system.durabilidade.value": Math.max(0, durAtual - custo) });
      }
      resumo = game.i18n.format("ODRITE.Defesa.ResultadoMitigar", { alvo: alvo.name, mitigado, dano: danoFinal });
    }
  } else if (tipo === "manobraDefensiva") {
    const manobra = alvo.items.get(itemId);
    danoFinal = 0;
    resumo = game.i18n.format("ODRITE.Defesa.ResultadoManobraDefensiva", {
      alvo: alvo.name,
      manobra: manobra?.name ?? "?"
    });
  } else {
    resumo = game.i18n.format("ODRITE.Defesa.ResultadoNenhuma", { alvo: alvo.name, dano: danoFinal });
  }

  await atualizarVitalidade(alvo, danoFinal);

  await mensagem.update({
    content: `<div class="odrite chat-card"><p>${resumo}</p></div>`,
    "flags.odrite.defesaPendente.resolvida": true
  });
}

/**
 * Resolve um acerto comum. Os dois benefícios opcionais vêm do Dado de
 * Treinamento com resultado 1: aplicar a Propriedade da arma, ou impedir
 * que o alvo use Manobras Defensivas em reação.
 */
export async function processarAcerto({
  atacante,
  alvo,
  dano,
  tipoAtaque,
  item = null,
  aplicarPropriedadeArma = false,
  negarDefesa = false
}) {
  const danoFinal = aplicarPropriedadeArma && item
    ? await aplicarPropriedade({ atacante, alvo, item, dano, tipoAtaque })
    : dano;

  const direcaoReativa =
    (atacante.type === "inimigo" && alvo.type === "character") ||
    (atacante.type === "character" && alvo.type === "inimigo");

  if (!negarDefesa && direcaoReativa && alvoTemManobraDisponivel(alvo)) {
    const opcoes = montarOpcoesDefesa(alvo, tipoAtaque);
    if (opcoes.length > 1) {
      return postarPromptDefesa({ atacante, alvo, dano: danoFinal, tipoAtaque, opcoes });
    }
  }

  return aplicarDanoDireto(alvo, danoFinal);
}

/**
 * Dado de Treinamento 1 em um acerto: o atacante escolhe entre aplicar a
 * Propriedade da arma ou impedir Manobras Defensivas do alvo. Sem
 * Propriedade definida no item, resta apenas negar a defesa.
 * @returns {Promise<"propriedade"|"negarDefesa">}
 */
export async function escolherBeneficioTreinamento(item) {
  const temPropriedade = !!(item?.system.propriedade ?? "").trim();
  if (!temPropriedade) return "negarDefesa";

  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("ODRITE.Combate.BeneficioTreinamento") },
    content: `<p>${game.i18n.localize("ODRITE.Combate.BeneficioPergunta")}</p>`,
    buttons: [
      {
        action: "propriedade",
        label: game.i18n.format("ODRITE.Combate.BeneficioPropriedade", { propriedade: item.system.propriedade })
      },
      { action: "negarDefesa", label: game.i18n.localize("ODRITE.Combate.BeneficioNegarDefesa") }
    ],
    modal: true
  });

  return escolha === "propriedade" ? "propriedade" : "negarDefesa";
}

/**
 * Dado de Treinamento 1 em uma falha (que não seja Falha Absoluta):
 * permite refazer o teste de acerto.
 * @returns {Promise<boolean>}
 */
export async function perguntarRefazerAtaque() {
  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("ODRITE.Combate.RefazerAtaqueTitulo") },
    content: `<p>${game.i18n.localize("ODRITE.Combate.RefazerAtaquePergunta")}</p>`,
    buttons: [
      { action: "refazer", label: game.i18n.localize("ODRITE.Combate.RefazerAtaque"), default: true },
      { action: "aceitar", label: game.i18n.localize("ODRITE.Combate.AceitarFalhaAtaque") }
    ],
    modal: true
  });

  return escolha === "refazer";
}

/**
 * Falha Absoluta: quem atacou perde o resto das manobras da rodada e,
 * se for personagem, recebe 2 Pontos de Fadiga.
 * @param {Actor} atacante
 */
export async function processarFalhaAbsoluta(atacante) {
  const combatant = combatantDoAtor(atacante);
  if (combatant) {
    const max = atacante.system.manobrasPorRodada ?? 0;
    await combatant.setFlag("odrite", "manobrasUsadas", max);
  }

  if (atacante.type === "character") {
    await atacante.update({ "system.fadiga.value": atacante.system.fadiga.value + 2 });
  }

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Combate.FalhaAbsolutaResultado", { nome: atacante.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: atacante })
  });
}

// --- Propriedades (aplicadas só em Acerto Absoluto) ---

async function aplicarSangrar({ alvo }) {
  // Aplicar Sangrar num alvo que já sangra agrava o efeito (+1 por turno,
  // até 5) em vez de criar uma segunda condição.
  await aplicarCondicaoNomeada(alvo, "sangrando");
  return { danoExtra: 0 };
}

async function aplicarMutilar() {
  const bonus = await new Roll("1d4").evaluate();
  ChatMessage.create({ content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.MutilarAplicado", { dano: bonus.total })}</p>` });
  return { danoExtra: bonus.total };
}

async function aplicarDerrubar({ alvo }) {
  // O ícone nativo "prone" é só o indicador visual no token; a mecânica
  // (levantar custa 1 Manobra, ataques corpo a corpo ganham +4) vem da
  // Condição Caído.
  await alvo.toggleStatusEffect("prone", { active: true });
  await aplicarCondicaoNomeada(alvo, "caido");
  return { danoExtra: 0 };
}

async function escolherItemQuebrar(alvo) {
  const opcoes = ["arma", "armadura", "escudo"]
    .map((tipo) => ({ tipo, item: alvo.items.find((i) => i.type === tipo) }))
    .filter((o) => o.item);

  if (!opcoes.length) return null;

  const resultado = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("ODRITE.Combate.Propriedade.Quebrar") },
    content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.EscolherItem", { alvo: alvo.name })}</p>`,
    buttons: opcoes.map((o) => ({
      action: o.item.id,
      label: `${game.i18n.localize(LABEL_TIPO_ITEM[o.tipo])}: ${o.item.name}`
    })),
    modal: true
  });

  return alvo.items.get(resultado) ?? null;
}

async function aplicarQuebrar({ alvo }) {
  const item = await escolherItemQuebrar(alvo);
  if (!item) return { danoExtra: 0 };

  const roll = await new Roll("1d4").evaluate();
  const atual = item.system.durabilidade?.value ?? 0;
  await item.update({ "system.durabilidade.value": Math.max(0, atual - roll.total) });

  ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.QuebrarAplicado", { item: item.name, durabilidade: roll.total })}</p>`
  });
  return { danoExtra: 0 };
}

async function aplicarDebilitar({ alvo }) {
  const combatant = combatantDoAtor(alvo);
  if (combatant) await combatant.setFlag("odrite", "debilitado", true);
  ChatMessage.create({ content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.DebilitarAplicado", { alvo: alvo.name })}</p>` });
  return { danoExtra: 0 };
}

async function aplicarAtrasar({ alvo }) {
  const combatant = combatantDoAtor(alvo);
  if (combatant) await combatant.setFlag("odrite", "atrasado", true);
  ChatMessage.create({ content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.AtrasarAplicado", { alvo: alvo.name })}</p>` });
  return { danoExtra: 0 };
}

async function aplicarAmaldicoar({ alvo }) {
  // Só personagens acumulam Mácula; inimigos já são criaturas da Mácula.
  await ganharPontoMacula(alvo, game.i18n.localize("ODRITE.Macula.MotivoAmaldicoar"));
  return { danoExtra: 0 };
}

const PROPRIEDADES = {
  sangrar: aplicarSangrar,
  mutilar: aplicarMutilar,
  derrubar: aplicarDerrubar,
  quebrar: aplicarQuebrar,
  debilitar: aplicarDebilitar,
  atrasar: aplicarAtrasar,
  amaldicoar: aplicarAmaldicoar
};

async function aplicarPropriedade({ atacante, alvo, item, dano, tipoAtaque }) {
  const nomeProp = (item?.system.propriedade ?? "").trim();
  if (!nomeProp) return dano;

  const chave = normalizarPropriedade(nomeProp);
  const handler = PROPRIEDADES[chave];
  if (!handler) {
    ChatMessage.create({ content: `<p>${game.i18n.format("ODRITE.Combate.Propriedade.Generica", { propriedade: nomeProp })}</p>` });
    return dano;
  }

  const resultado = await handler({ atacante, alvo, item, dano, tipoAtaque });
  return dano + (resultado?.danoExtra ?? 0);
}

/**
 * Acerto Absoluto (não-fatal): nunca há prompt de defesa; aplica a
 * Propriedade da arma/manobra; se o atacante for inimigo e o alvo um
 * personagem, força um Teste de Resistência (falha = Ferimento Permanente).
 */
export async function processarAcertoAbsoluto({ atacante, alvo, item, dano, tipoAtaque }) {
  // O teste de Resistência do Ferimento roda ANTES da Propriedade ser
  // aplicada: como esse teste também passa por rolarTesteRollUnder, se a
  // Propriedade fosse aplicada primeiro (ex: Debilitar), o próprio teste de
  // ferimento consumiria o efeito de "próxima rolagem" em vez do alvo.
  if (atacante.type === "inimigo" && alvo.type === "character") {
    await testarResistenciaFerimento(alvo);
  }

  const danoFinal = await aplicarPropriedade({ atacante, alvo, item, dano, tipoAtaque });

  await aplicarDanoDireto(alvo, danoFinal);
}

/**
 * Testa a Resistência do alvo depois de sofrer um Acerto Absoluto de um
 * inimigo; em caso de falha, rola 1d8 na tabela de Ferimentos Permanentes.
 * @param {Actor} alvo
 */
export async function testarResistenciaFerimento(alvo) {
  const resistencia = alvo.system.atributos.resistencia;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Combate.TesteResistenciaFerimento"),
    alvo: resistencia.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.resistencia),
    modificadores: alvo._modificadoresBase("resistencia"),
    tipoTeste: "atributo",
    atributoChave: "resistencia",
    actor: alvo
  });

  if (resultado.sucesso) return;

  const rolagem = await new Roll("1d8").evaluate();
  await aplicarFerimentoPermanente(alvo, rolagem.total);
}

/**
 * Aplica a consequência da tabela de Ferimentos Permanentes (1d8), incluindo
 * a sub-tabela de Mutilações (1d4) no resultado 8.
 * @param {Actor} alvo
 * @param {number} resultado Resultado do 1d8.
 */
export async function aplicarFerimentoPermanente(alvo, resultado) {
  let descricao;
  const changes = {};

  if (resultado === 1) {
    changes["system.fadiga.reducaoLimite"] = (alvo.system.fadiga.reducaoLimite ?? 0) + 1;
    descricao = game.i18n.localize("ODRITE.Ferimento.Leve");
  } else if (resultado === 8) {
    const rolagemMutilacao = await new Roll("1d4").evaluate();
    const chave = MUTILACOES[rolagemMutilacao.total - 1];
    changes["system.mutilacoes"] = [...(alvo.system.mutilacoes ?? []), chave];
    descricao = game.i18n.localize(MUTILACAO_LABELS[chave]);
  } else {
    const chaveAtributo = ATRIBUTO_POR_RESULTADO_FERIMENTO[resultado];
    const atual = alvo.system.atributos[chaveAtributo].value;
    changes[`system.atributos.${chaveAtributo}.value`] = Math.max(0, atual - 2);
    descricao = game.i18n.format("ODRITE.Ferimento.Atributo", {
      atributo: game.i18n.localize(ODRITE.atributos[chaveAtributo])
    });
  }

  changes["system.ferimentosPermanentes"] = [...(alvo.system.ferimentosPermanentes ?? []), descricao];
  await alvo.update(changes);

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Ferimento.Anuncio", { alvo: alvo.name, descricao })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: alvo })
  });
}

/**
 * Acerto Absoluto Fatal (d20 e dado secundário saíram 1 juntos): substitui
 * todo o processamento normal. Sucesso na Resistência do alvo = vitalidade 1;
 * falha = inimigo morre / personagem vai a 0.
 */
export async function processarAcertoFatal({ atacante, alvo }) {
  const resistencia = alvo.system.atributos.resistencia;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Combate.TesteResistenciaFatal"),
    alvo: resistencia.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.resistencia),
    modificadores: alvo._modificadoresBase("resistencia"),
    tipoTeste: "atributo",
    atributoChave: "resistencia",
    actor: alvo
  });

  if (resultado.sucesso) {
    await alvo.update({ "system.vitalidade.value": 1 });
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Combate.FatalSucesso", { alvo: alvo.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor: alvo })
    });
  }

  await alvo.update({ "system.vitalidade.value": 0 });
  const chave = alvo.type === "inimigo" ? "ODRITE.Combate.FatalMorte" : "ODRITE.Combate.FatalZero";
  return ChatMessage.create({
    content: `<p>${game.i18n.format(chave, { alvo: alvo.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: alvo })
  });
}

/**
 * Estanca o Sangramento do personagem: custa 2 manobras, ou 1 manobra +
 * 1 Kit Medicinal (se houver ambas opções disponíveis, pergunta qual usar).
 * @param {Actor} actor
 */
export async function estancarSangramento(actor) {
  if (!podeUsarManobra(actor)) return;

  const combatant = combatantDoAtor(actor);
  if (!combatant) return;

  const max = actor.system.manobrasPorRodada ?? 0;
  const usadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
  const disponiveis = max - usadas;
  const kit = actor.items.find((i) => i.type === "item" && normalizarPropriedade(i.name).includes("kit medicinal"));

  let custoManobras;
  let usouKit = false;

  if (disponiveis >= 2 && kit) {
    const escolha = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("ODRITE.Combate.EstancarSangramento") },
      content: `<p>${game.i18n.localize("ODRITE.Combate.EstancarPergunta")}</p>`,
      buttons: [
        { action: "duasManobras", label: game.i18n.localize("ODRITE.Combate.DuasManobras") },
        { action: "manobraEKit", label: game.i18n.localize("ODRITE.Combate.ManobraEKit") }
      ],
      modal: true
    });
    custoManobras = escolha === "manobraEKit" ? 1 : 2;
    usouKit = escolha === "manobraEKit";
  } else if (disponiveis >= 2) {
    custoManobras = 2;
  } else if (disponiveis >= 1 && kit) {
    custoManobras = 1;
    usouKit = true;
  } else {
    return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SemRecursoEstancar"));
  }

  if (usouKit) await kit.update({ "system.quantidade": Math.max(0, kit.system.quantidade - 1) });

  await combatant.setFlag("odrite", "manobrasUsadas", usadas + custoManobras);
  await removerCondicaoNomeada(actor, "sangrando");

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Combate.SangramentoEstancado", { alvo: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Consome Manobras de Combate do ator, avisando se não houver disponíveis.
 * Fora de combate não há custo.
 * @returns {Promise<boolean>} Se a ação pode prosseguir.
 */
async function consumirManobras(actor, quantidade) {
  const combatant = combatantDoAtor(actor);
  if (!combatant) return true;

  const max = actor.system.manobrasPorRodada ?? 0;
  const usadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
  if (usadas + quantidade > max) {
    ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SemManobrasDisponiveis"));
    return false;
  }

  await combatant.setFlag("odrite", "manobrasUsadas", usadas + quantidade);
  return true;
}

/**
 * Reerguer-se da condição Caído: custa 1 Manobra de Combate, sem teste.
 * @param {Actor} actor
 */
export async function levantarSe(actor) {
  if (!condicaoNomeada(actor, "caido")) return;
  if (!(await consumirManobras(actor, 1))) return;

  await removerCondicaoNomeada(actor, "caido");
  await actor.toggleStatusEffect("prone", { active: false });

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Condicao.Levantou", { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Tentativa de se livrar da condição Imobilizado: custa 1 Manobra de Combate
 * e exige um teste do atributo definido na condição (Força por padrão — cada
 * conjuração pode exigir outro).
 * @param {Actor} actor
 */
export async function libertarSe(actor) {
  const condicao = condicaoNomeada(actor, "imobilizado");
  if (!condicao) return;
  if (!(await consumirManobras(actor, 1))) return;

  const chave = condicao.system.atributoEscape || "forca";
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Condicao.TesteLibertar"),
    alvo: actor.system.atributos[chave].value,
    atributoLabel: game.i18n.localize(ODRITE.atributos[chave]),
    modificadores: actor._modificadoresBase(chave),
    tipoTeste: "manobra",
    atributoChave: chave,
    actor
  });

  if (!resultado.sucesso) {
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Condicao.LibertarFalha", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  await removerCondicaoNomeada(actor, "imobilizado");
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Condicao.LibertarSucesso", { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Recarrega uma arma (ex: besta) que exige recarga após o disparo. Em
 * combate, custa 1 Manobra; fora de combate não há custo. Sem manobras
 * disponíveis, a recarga é recusada.
 * @param {Actor} actor
 * @param {Item} item
 */
export async function recarregarArma(actor, item) {
  if (item.system.carregada) {
    return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.ArmaJaCarregada"));
  }
  if (!podeUsarManobra(actor)) return;

  const combatant = combatantDoAtor(actor);
  if (combatant && !(await consumirAcaoLivre(actor, "recarregar"))) {
    const max = actor.system.manobrasPorRodada ?? 0;
    const usadas = combatant.getFlag("odrite", "manobrasUsadas") ?? 0;
    if (usadas >= max) {
      return ui.notifications.warn(game.i18n.localize("ODRITE.Aviso.SemManobraRecarregar"));
    }
    await combatant.setFlag("odrite", "manobrasUsadas", usadas + 1);
  }

  await item.update({ "system.carregada": true });

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Combate.ArmaRecarregada", { nome: actor.name, arma: item.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}
