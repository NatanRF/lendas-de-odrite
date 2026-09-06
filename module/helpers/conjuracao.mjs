import { ODRITE } from "../config.mjs";
import { rolarTesteRollUnder } from "./dice.mjs";
import { obterAlvo, registrarUsoManobra, processarAcerto, podeUsarManobra } from "./combate.mjs";
import { aplicarCondicao, aplicarCondicaoNomeada } from "./condicoes.mjs";
import { ganharPontoMacula } from "./macula.mjs";

const REFAZER_TEMPLATE = "systems/odrite/templates/chat/refazer-prompt.hbs";
const MANUTENCAO_TEMPLATE = "systems/odrite/templates/chat/manutencao-prompt.hbs";

function destinatarios(actor) {
  const donos = game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  const gms = game.users.filter((u) => u.isGM).map((u) => u.id);
  return [...new Set([...donos, ...gms])];
}

function combatantDoAtor(actor) {
  return game.combat?.combatants.find((c) => c.actorId === actor.id) ?? null;
}

async function atualizarVitalidade(actor, dano) {
  if (dano <= 0) return;
  await actor.update({ "system.vitalidade.value": Math.max(0, actor.system.vitalidade.value - dano) });
}

/**
 * Tabela Ressonância da Conjuração (d10), rolada a cada gatilho de sorte:
 * resultado 1 no d20 (sucesso absoluto) e/ou 1 no Dado de Refinamento.
 * Os efeitos 4, 5 e 7 dependem de escolha na mesa e são apenas anunciados.
 */
const RESSONANCIA = {
  1: "sucessoGarantido",
  2: "semFadigaConjurar",
  3: "dobrarEfeito",
  4: "repetirProximoTurno",
  5: "segundoAlvo",
  6: "curaD4",
  7: "manutencaoLivre",
  8: "facilProximo",
  9: "conjurarLivre",
  10: "removeFadiga"
};

async function rolarRessonancia(actor) {
  const roll = await new Roll("1d10").evaluate();
  const efeito = RESSONANCIA[roll.total];
  const combatant = combatantDoAtor(actor);
  let dobrarEfeito = false;
  let detalhe = "";

  switch (efeito) {
    case "sucessoGarantido":
      await actor.setFlag("odrite", "conjuracaoSucessoGarantido", true);
      break;
    case "semFadigaConjurar":
      if (combatant) await combatant.setFlag("odrite", "conjurarSemFadiga", true);
      break;
    case "dobrarEfeito":
      dobrarEfeito = true;
      break;
    case "curaD4": {
      const cura = await new Roll("1d4").evaluate();
      const teto = actor.system.vitalidade.maxEfetivo ?? actor.system.vitalidade.max;
      await actor.update({
        "system.vitalidade.value": Math.min(teto, actor.system.vitalidade.value + cura.total)
      });
      detalhe = ` (${cura.total})`;
      break;
    }
    case "facilProximo":
      await actor.setFlag("odrite", "conjuracaoFacil", true);
      break;
    case "conjurarLivre":
      if (combatant) await combatant.setFlag("odrite", "conjuracaoLivre", true);
      break;
    case "removeFadiga":
      await actor.update({ "system.fadiga.value": Math.max(0, actor.system.fadiga.value - 1) });
      break;
    // repetirProximoTurno, segundoAlvo e manutencaoLivre são resolvidos na mesa.
  }

  await ChatMessage.create({
    content: `<p><strong>${game.i18n.localize("ODRITE.Ressonancia.Titulo")} (${roll.total})</strong><br>${game.i18n.localize(`ODRITE.Ressonancia.${roll.total}`)}${detalhe}</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll]
  });

  return { dobrarEfeito };
}

/**
 * Anuncia um resultado de tabela no chat, junto com a rolagem que o gerou.
 * @param {Actor} actor
 * @param {string} tituloChave Chave de localização do nome da tabela.
 * @param {Roll} roll
 * @param {string} textoChave Chave de localização da entrada sorteada.
 * @param {string} [detalhe] Sufixo com valores já rolados (ex: " (3)").
 */
function anunciarTabela(actor, tituloChave, roll, textoChave, detalhe = "") {
  return ChatMessage.create({
    content: `<p><strong>${game.i18n.localize(tituloChave)} (${roll.total})</strong><br>${game.i18n.localize(textoChave)}${detalhe}</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll]
  });
}

/** Encerra todos os efeitos de Manutenção ativos do conjurador. */
async function encerrarManutencoes(actor) {
  const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
  if (ativas.length) await actor.setFlag("odrite", "conjuracoesAtivas", []);
  return ativas.length;
}

/**
 * Marca uma maldição de duração em dias (o sistema não rastreia calendário,
 * então o valor rolado é anunciado e o mestre limpa a marca pela ficha).
 * @returns {Promise<number>} Dias rolados.
 */
async function marcarMaldicaoDias(actor, chave) {
  const dias = await new Roll("1d4").evaluate();
  await actor.setFlag("odrite", chave, dias.total);
  return dias.total;
}

/**
 * Tabela Ecos da Conjuração (d10), rolada quando o Dado de Refinamento sai 6,
 * com sucesso ou falha no teste. Cada Fonte Arcana tem sua própria tabela.
 * Os efeitos que dependem de posicionamento ou de decisão do mestre são
 * apenas anunciados com o texto da tabela.
 */
const ECOS_BENCAO = {
  1: "fadiga1",
  2: "bloqueiaConjurar",
  3: "agirPorUltimo",
  4: "atingeProximos",
  5: "encerraManutencao",
  6: "efeitoInvertido",
  7: "vitalidadeD4ECaido",
  8: "conjurarCustaFadiga",
  9: "caminhoBloqueado",
  10: "falhaAutomatica"
};

const ECOS_PACTO = {
  1: "vitalidade1",
  2: "vitalidade2",
  3: "vitalidadeD4",
  4: "atingeAliado",
  5: "encerraManutencaoEVitalidade",
  6: "efeitoInvertido",
  7: "conjurarCustaVitalidade",
  8: "cultistas",
  9: "patrono",
  10: "fendaMaldicao"
};

async function rolarEcos(actor, item) {
  const pacto = actor.system.fonteArcana === "Pacto Amaldiçoado";
  const tabela = pacto ? ECOS_PACTO : ECOS_BENCAO;
  const prefixo = pacto ? "ODRITE.Ecos.Pacto" : "ODRITE.Ecos.Bencao";

  const roll = await new Roll("1d10").evaluate();
  const efeito = tabela[roll.total];
  const combatant = combatantDoAtor(actor);
  let inverterEfeito = false;
  let detalhe = "";

  switch (efeito) {
    case "fadiga1":
      await actor.update({ "system.fadiga.value": actor.system.fadiga.value + 1 });
      break;
    case "vitalidade1":
      await atualizarVitalidade(actor, 1);
      break;
    case "vitalidade2":
      await atualizarVitalidade(actor, 2);
      break;
    case "vitalidadeD4": {
      const perda = await new Roll("1d4").evaluate();
      await atualizarVitalidade(actor, perda.total);
      detalhe = ` (${perda.total})`;
      break;
    }
    case "bloqueiaConjurar":
      // Vale a rodada atual e a próxima: o contador é zerado no fim da rodada
      // seguinte pelo hook de rodada.
      if (combatant) await combatant.setFlag("odrite", "conjurarBloqueado", 2);
      break;
    case "agirPorUltimo":
      if (combatant) await colocarPorUltimo(combatant);
      break;
    case "encerraManutencao":
      detalhe = ` (${await encerrarManutencoes(actor)})`;
      break;
    case "encerraManutencaoEVitalidade":
      detalhe = ` (${await encerrarManutencoes(actor)})`;
      await atualizarVitalidade(actor, 1);
      break;
    case "efeitoInvertido":
      inverterEfeito = true;
      break;
    case "vitalidadeD4ECaido": {
      const perda = await new Roll("1d4").evaluate();
      await atualizarVitalidade(actor, perda.total);
      await aplicarCondicaoNomeada(actor, "caido");
      detalhe = ` (${perda.total})`;
      break;
    }
    case "conjurarCustaFadiga":
      detalhe = ` (${await marcarMaldicaoDias(actor, "conjurarCustaFadiga")} dias)`;
      break;
    case "conjurarCustaVitalidade":
      detalhe = ` (${await marcarMaldicaoDias(actor, "conjurarCustaVitalidade")} dias)`;
      break;
    case "caminhoBloqueado": {
      const dias = await new Roll("1d4").evaluate();
      const caminho = item.system.caminho || game.i18n.localize("ODRITE.Ecos.CaminhoDesconhecido");
      const bloqueados = actor.getFlag("odrite", "caminhosBloqueados") ?? [];
      if (!bloqueados.includes(caminho)) {
        await actor.setFlag("odrite", "caminhosBloqueados", [...bloqueados, caminho]);
      }
      detalhe = ` — ${caminho} (${dias.total} dias)`;
      break;
    }
    case "falhaAutomatica":
      detalhe = ` (${await marcarMaldicaoDias(actor, "conjuracaoFalhaAutomatica")} dias)`;
      break;
    case "cultistas": {
      const qtd = await new Roll("1d6+2").evaluate();
      detalhe = ` (${qtd.total})`;
      break;
    }
    // atingeProximos, atingeAliado e fendaMaldicao são resolvidos na mesa.
  }

  await anunciarTabela(actor, "ODRITE.Ecos.Titulo", roll, `${prefixo}.${roll.total}`, detalhe);

  // O patrono fala: teste de Mente e, em seguida, os Sussurros do Pacto.
  if (efeito === "patrono") await conversarComPatrono(actor);

  return { inverterEfeito };
}

/**
 * Eco 9 do Pacto: um Teste de Mente falho contrai o Véu da Insanidade no
 * Estágio 1 (registrado como Ferimento Permanente, já que o sistema não
 * modela enfermidades), e depois vêm os Sussurros do Pacto.
 */
async function conversarComPatrono(actor) {
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Ecos.TestePatrono"),
    alvo: actor.system.atributos.mente.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.mente),
    modificadores: actor._modificadoresBase("mente"),
    tipoTeste: "atributo",
    atributoChave: "mente",
    actor
  });

  if (!resultado.sucesso) {
    const marca = game.i18n.localize("ODRITE.Ecos.VeuInsanidade");
    await actor.update({
      "system.ferimentosPermanentes": [...(actor.system.ferimentosPermanentes ?? []), marca]
    });
    await ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ecos.VeuContraido", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  return rolarSussurros(actor);
}

const SUSSURRO_OFERTA = {
  1: "mesa", 2: "mesa", 3: "mesa", 4: "mesa", 5: "mesa",
  6: "mesa",
  7: "acertoMais4",
  8: "curaD6",
  9: "removeFadigaToda",
  10: "sucessoQualquerTeste"
};

const SUSSURRO_PRECO = {
  1: "mesa",
  2: "fadiga3",
  3: "descansoDesconfortavel",
  4: "semDefensivas",
  5: "metadeVitalidade",
  6: "mesa", 7: "mesa", 8: "mesa", 9: "mesa", 10: "mesa"
};

/**
 * Sussurros do Pacto: a Maldição concede uma Oferta e cobra um Preço — as
 * duas sub-tabelas são roladas juntas.
 */
export async function rolarSussurros(actor) {
  const oferta = await new Roll("1d10").evaluate();
  let detalhe = "";

  switch (SUSSURRO_OFERTA[oferta.total]) {
    case "acertoMais4":
      // "+4 no Valor Alvo dos testes de Acerto até o fim deste combate" cabe
      // exatamente no sistema de Condições, com escopo de ataque.
      await aplicarCondicao(actor, {
        nome: game.i18n.localize("ODRITE.Sussurros.FavorDoPatrono"),
        valor: 4, escopo: "ataque", duracaoRodadas: 1, permanente: true
      });
      break;
    case "curaD6": {
      const cura = await new Roll("1d6").evaluate();
      const teto = actor.system.vitalidade.maxEfetivo ?? actor.system.vitalidade.max;
      await actor.update({ "system.vitalidade.value": Math.min(teto, actor.system.vitalidade.value + cura.total) });
      detalhe = ` (${cura.total})`;
      break;
    }
    case "removeFadigaToda":
      await actor.update({ "system.fadiga.value": 0 });
      break;
    case "sucessoQualquerTeste":
      await actor.setFlag("odrite", "sucessoAutomaticoProximoTeste", true);
      break;
  }
  await anunciarTabela(actor, "ODRITE.Sussurros.Oferta", oferta, `ODRITE.Sussurros.OfertaTabela.${oferta.total}`, detalhe);

  const preco = await new Roll("1d10").evaluate();
  detalhe = "";

  switch (SUSSURRO_PRECO[preco.total]) {
    case "fadiga3":
      await actor.update({ "system.fadiga.value": actor.system.fadiga.value + 3 });
      break;
    case "semDefensivas":
      detalhe = ` (${await marcarMaldicaoDias(actor, "semManobrasDefensivas")} dias)`;
      break;
    case "descansoDesconfortavel":
      await actor.setFlag("odrite", "descansoSempreDesconfortavel", 4);
      break;
    case "metadeVitalidade":
      await atualizarVitalidade(actor, Math.ceil(actor.system.vitalidade.value / 2));
      break;
  }
  return anunciarTabela(actor, "ODRITE.Sussurros.Preco", preco, `ODRITE.Sussurros.PrecoTabela.${preco.total}`, detalhe);
}

/**
 * Coloca o combatente atrás de todos na ordem de iniciativa, guardando o
 * valor original para que o hook de rodada o restaure depois.
 */
async function colocarPorUltimo(combatant) {
  if (combatant.getFlag("odrite", "iniciativaOriginal") !== undefined) return;
  const menor = Math.min(...combatant.combat.combatants.map((c) => c.initiative ?? 0));
  await combatant.update({
    initiative: menor - 1,
    "flags.odrite.iniciativaOriginal": combatant.initiative ?? 0
  });
}

/**
 * Ponto de entrada: resolve um cast de Conjuração inteiro, incluindo a
 * mecânica própria de Bênção Divina / Pacto Amaldiçoado e Dado de
 * Refinamento — substitui o sistema genérico de Acerto/Falha Absoluta
 * usado por armas e manobras.
 * @param {Actor} actor
 * @param {Item} item
 */
export async function resolverConjuracao(actor, item) {
  if (!podeConjurar(actor, item)) return;

  const alvo = obterAlvo();
  if (!alvo) return;

  // Ressonância 9 concede um Conjurar sem gastar Manobra de Combate.
  const combatant = combatantDoAtor(actor);
  if (combatant?.getFlag("odrite", "conjuracaoLivre")) {
    await combatant.unsetFlag("odrite", "conjuracaoLivre");
  } else {
    await registrarUsoManobra(actor, "conjurar");
  }

  await cobrarMaldicoesDeConjurar(actor);

  if (actor.getFlag("odrite", "conjuracaoSucessoGarantido")) {
    await actor.unsetFlag("odrite", "conjuracaoSucessoGarantido");
    await ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.SucessoGarantidoUsado", { nome: actor.name, magia: item.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return finalizarConjuracaoSucesso(actor, item, alvo);
  }

  const resultado = await rolarConjuracao(actor, item);

  // Eco 10 da Bênção: durante d4 dias todo teste de Conjuração falha, por
  // melhor que seja a rolagem. O Dado de Refinamento continua valendo, então
  // o resultado só é forçado depois de rolado.
  if (actor.getFlag("odrite", "conjuracaoFalhaAutomatica") && !resultado.falhaAbsoluta) {
    await ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ecos.FalhaAutomaticaAplicada", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    resultado.sucesso = false;
    resultado.acertou = false;
    resultado.acertoAbsoluto = false;
  }

  return processarResultadoConjuracao(actor, item, alvo, resultado);
}

/**
 * Bloqueios impostos pelos Ecos da Conjuração antes mesmo da rolagem:
 * Conjurar travado por uma rodada (Eco 2 da Bênção) e Caminho interditado
 * por d4 dias (Eco 9 da Bênção).
 * @returns {boolean} Se a conjuração pode prosseguir.
 */
function podeConjurar(actor, item) {
  if (!podeUsarManobra(actor)) return false;

  if (combatantDoAtor(actor)?.getFlag("odrite", "conjurarBloqueado")) {
    ui.notifications.warn(game.i18n.format("ODRITE.Aviso.ConjurarBloqueado", { nome: actor.name }));
    return false;
  }

  const bloqueados = actor.getFlag("odrite", "caminhosBloqueados") ?? [];
  if (item.system.caminho && bloqueados.includes(item.system.caminho)) {
    ui.notifications.warn(game.i18n.format("ODRITE.Aviso.CaminhoBloqueado", { caminho: item.system.caminho }));
    return false;
  }

  return true;
}

/**
 * Custo extra permanente que os Ecos 8 (Bênção) e 7 (Pacto) impõem a cada
 * uso da manobra Conjurar, com sucesso ou falha, enquanto durarem.
 */
async function cobrarMaldicoesDeConjurar(actor) {
  if (actor.getFlag("odrite", "conjurarCustaFadiga")) {
    await actor.update({ "system.fadiga.value": actor.system.fadiga.value + 1 });
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ecos.CustoFadigaCobrado", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  if (actor.getFlag("odrite", "conjurarCustaVitalidade")) {
    await atualizarVitalidade(actor, 2);
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ecos.CustoVitalidadeCobrado", { nome: actor.name })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}

async function rolarConjuracao(actor, item) {
  const facil = !!actor.getFlag("odrite", "conjuracaoFacil");
  if (facil) await actor.unsetFlag("odrite", "conjuracaoFacil");

  const modificadores = actor._modificadoresBase("conjuracao");
  if (facil) modificadores.push({ label: game.i18n.localize("ODRITE.Conjuracao.FacilLabel"), valor: 2 });

  const atributo = actor.system.atributos.conjuracao;
  return rolarTesteRollUnder({
    titulo: game.i18n.format("ODRITE.Rolagem.TesteMagia", { magia: item.name }),
    alvo: atributo.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.conjuracao),
    modificadores,
    tipoTeste: "conjuracao",
    atributoChave: "conjuracao",
    dadoSecundarioFaces: ODRITE.dadoRefinamentoMagia,
    dadoSecundarioLabel: game.i18n.localize("ODRITE.Rolagem.DadoRefinamento"),
    testeDeAcerto: true,
    actor
  });
}

async function processarResultadoConjuracao(actor, item, alvo, resultado) {
  // Refinamento 1 numa falha comum: permite refazer a rolagem do d20.
  if (resultado.resultadoSecundario === 1 && !resultado.acertou && !resultado.falhaAbsoluta) {
    return postarPromptRefazer(actor, item, alvo);
  }

  // Refinamento 6 dispara os Ecos da Conjuração independentemente de o teste
  // ter tido sucesso ou não — por isso é resolvido antes do desfecho.
  const ecos = resultado.resultadoSecundario === 6 ? await rolarEcos(actor, item) : {};

  if (resultado.falhaAbsoluta) {
    return actor.system.fonteArcana === "Pacto Amaldiçoado"
      ? processarFalhaCriticaPacto(actor)
      : processarFalhaCriticaBencao(actor);
  }

  if (!resultado.acertou) return processarFalhaNormal(actor);

  // Sucesso absoluto (d20 = 1) e Refinamento 1 são gatilhos independentes de
  // Ressonância — quando ambos ocorrem, o conjurador rola as duas vezes.
  let dobrarEfeito = false;
  if (resultado.acertoAbsoluto) {
    dobrarEfeito = (await rolarRessonancia(actor)).dobrarEfeito || dobrarEfeito;
  }
  if (resultado.resultadoSecundario === 1) {
    dobrarEfeito = (await rolarRessonancia(actor)).dobrarEfeito || dobrarEfeito;
  }

  return finalizarConjuracaoSucesso(actor, item, alvo, {
    dobrarEfeito,
    inverterEfeito: !!ecos.inverterEfeito
  });
}

async function processarFalhaNormal(actor) {
  const perda = await new Roll("1d4").evaluate();

  if (actor.system.fonteArcana === "Pacto Amaldiçoado") {
    await atualizarVitalidade(actor, perda.total);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.FalhaPacto", { nome: actor.name, perda: perda.total })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  await actor.update({ "system.fadiga.value": actor.system.fadiga.value + perda.total });
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.FalhaBencao", { nome: actor.name, perda: perda.total })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function processarFalhaCriticaBencao(actor) {
  const resistencia = actor.system.atributos.resistencia;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Conjuracao.TesteResistenciaBencao"),
    alvo: resistencia.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.resistencia),
    modificadores: actor._modificadoresBase("resistencia"),
    tipoTeste: "atributo",
    atributoChave: "resistencia",
    actor
  });

  // Sucesso: sobrevive, mas perde d4 de Conjuração permanentemente.
  if (resultado.sucesso) {
    const perda = await new Roll("1d4").evaluate();
    const atual = actor.system.atributos.conjuracao.value;
    const novo = Math.max(0, atual - perda.total);
    // Zerar Conjuração mata pela regra geral de atributo em 0, aplicada e
    // anunciada pelo _preUpdate do ator.
    await actor.update({ "system.atributos.conjuracao.value": novo });

    return ChatMessage.create({
      content: `<p>${game.i18n.format(
        novo <= 0 ? "ODRITE.Conjuracao.ConjuracaoZeradaBencao" : "ODRITE.Conjuracao.ResistenciaBencaoSucesso",
        { nome: actor.name, perda: perda.total }
      )}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  // Falha: o corpo mortal não suporta a Essência e o personagem morre.
  await actor.update({ "system.morto": true, "system.vitalidade.value": 0 });
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.MorteBencao", { nome: actor.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function processarFalhaCriticaPacto(actor) {
  const mente = actor.system.atributos.mente;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.localize("ODRITE.Conjuracao.TesteMentePacto"),
    alvo: mente.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.mente),
    modificadores: actor._modificadoresBase("mente"),
    tipoTeste: "atributo",
    atributoChave: "mente",
    actor
  });

  // Sucesso: a Maldição cobra d6 de Vitalidade, mas o controle é mantido.
  if (resultado.sucesso) {
    const perda = await new Roll("1d6").evaluate();
    await atualizarVitalidade(actor, perda.total);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.MenteSucessoPacto", { nome: actor.name, perda: perda.total })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  // Falha: a Mácula avança mais um passo. A transformação em Maldição não é
  // mais imediata — acontece ao acumular o quinto Ponto de Mácula, tratado
  // pelo _preUpdate do ator.
  return ganharPontoMacula(actor, game.i18n.localize("ODRITE.Macula.MotivoPacto"));
}

async function finalizarConjuracaoSucesso(
  actor, item, alvo, { dobrarEfeito = false, inverterEfeito = false } = {}
) {
  let dano = item.system.dano ?? 0;
  let cura = item.system.cura ?? 0;

  // Devoção a Vimera: toda conjuração de cura restaura 1 ponto a mais.
  if (cura > 0 && actor.system.beneficioDevocao === "curaAdicional") {
    cura += 1;
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Devocao.CuraVimera", { nome: actor.name })}</p>`
    });
  }

  if (dano > 0 && actor.system.fonteArcana === "Pacto Amaldiçoado") {
    const bonus = await new Roll("1d4").evaluate();
    dano += bonus.total;
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.BonusDanoPacto", { dano: bonus.total })}</p>`
    });
  }

  // Ressonância 3 dobra o efeito numérico — dano ou cura — já somado aos
  // bônus anteriores.
  if (dobrarEfeito && (dano > 0 || cura > 0)) {
    dano *= 2;
    cura *= 2;
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ressonancia.DanoDobrado", { dano: dano || cura })}</p>`
    });
  }

  // Eco 6: o efeito se aplica ao contrário, no mesmo valor.
  if (inverterEfeito && (dano > 0 || cura > 0)) {
    [dano, cura] = [cura, dano];
    ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Ecos.EfeitoInvertidoAplicado", { alvo: alvo.name, valor: dano || cura })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  if (cura > 0) await curarAlvo(actor, alvo, cura);
  if (dano > 0) await processarAcerto({ atacante: actor, alvo, dano, tipoAtaque: "distancia" });

  if (item.system.duracao === "manutencao") {
    await ativarManutencao(actor, item);
  } else if (item.system.duracao === "rodada") {
    await ativarEfeitoDeRodada(actor, item);
  }

  if (item.system.concedeCondicao) {
    const destinatario = item.system.condicaoAlvo === "alvo" ? alvo : actor;
    await aplicarCondicao(destinatario, {
      nome: item.system.condicaoNome || item.name,
      valor: item.system.condicaoValor,
      escopo: item.system.condicaoEscopo,
      atributoEspecifico: item.system.condicaoAtributoEspecifico,
      duracaoRodadas: item.system.condicaoDuracaoRodadas,
      permanente: item.system.condicaoPermanente
    });
  }
}

/**
 * Restaura Vitalidade no alvo, respeitando o teto efetivo. Cura não passa
 * pelo fluxo de defesa — não há o que defender.
 * @param {Actor} conjurador
 * @param {Actor} alvo
 * @param {number} cura
 */
async function curarAlvo(conjurador, alvo, cura) {
  const teto = alvo.system.vitalidade.maxEfetivo ?? alvo.system.vitalidade.max;
  const antes = alvo.system.vitalidade.value;
  const depois = Math.min(teto, antes + cura);
  await alvo.update({ "system.vitalidade.value": depois });

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.CuraAplicada", {
      alvo: alvo.name, cura: depois - antes, atual: depois, teto
    })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor: conjurador })
  });
}

/**
 * Duração "Rodada": o efeito fica registrado até o fim da rodada em que foi
 * ativado. O hook de rodada limpa a lista e anuncia o encerramento.
 */
async function ativarEfeitoDeRodada(actor, item) {
  const ativos = actor.getFlag("odrite", "conjuracoesRodada") ?? [];
  if (ativos.some((a) => a.itemId === item.id)) return;

  await actor.setFlag("odrite", "conjuracoesRodada", [...ativos, { itemId: item.id, nome: item.name }]);
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.RodadaAtivada", { nome: actor.name, magia: item.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Encerra os efeitos de Duração "Rodada" do ator. Chamado pelo hook de
 * rodada, depois que a rodada em que foram ativados termina.
 * @param {Actor} actor
 */
export async function encerrarEfeitosDeRodada(actor) {
  const ativos = actor.getFlag("odrite", "conjuracoesRodada") ?? [];
  if (!ativos.length) return;

  await actor.setFlag("odrite", "conjuracoesRodada", []);
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.RodadaEncerrada", {
      nome: actor.name,
      magias: ativos.map((a) => a.nome).join(", ")
    })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function ativarManutencao(actor, item) {
  const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
  if (ativas.some((a) => a.itemId === item.id)) return;

  await actor.setFlag("odrite", "conjuracoesAtivas", [...ativas, { itemId: item.id, nome: item.name }]);
  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Conjuracao.ManutencaoAtivada", { nome: actor.name, magia: item.name })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

async function postarPromptRefazer(actor, item, alvo) {
  const content = await foundry.applications.handlebars.renderTemplate(REFAZER_TEMPLATE, {
    nome: actor.name,
    magia: item.name
  });

  return ChatMessage.create({
    content,
    whisper: destinatarios(actor),
    flags: {
      odrite: {
        refazerPendente: {
          actorUuid: actor.uuid,
          itemUuid: item.uuid,
          alvoUuid: alvo.uuid,
          resolvida: false
        }
      }
    }
  });
}

export async function resolverRefazer(mensagem, escolha) {
  const pendente = mensagem.getFlag("odrite", "refazerPendente");
  if (!pendente || pendente.resolvida) return;

  const actor = fromUuidSync(pendente.actorUuid);
  if (!actor?.isOwner) return;

  await mensagem.setFlag("odrite", "refazerPendente", { ...pendente, resolvida: true });

  const item = fromUuidSync(pendente.itemUuid);
  const alvo = fromUuidSync(pendente.alvoUuid);

  if (escolha === "aceitar") {
    await mensagem.update({
      content: `<div class="odrite chat-card"><p>${game.i18n.format("ODRITE.Conjuracao.RefazerRecusado", { nome: actor.name })}</p></div>`
    });
    return processarFalhaNormal(actor);
  }

  await mensagem.update({
    content: `<div class="odrite chat-card"><p>${game.i18n.format("ODRITE.Conjuracao.RefezRolagem", { nome: actor.name })}</p></div>`
  });

  const resultado = await rolarConjuracao(actor, item);
  return processarResultadoConjuracao(actor, item, alvo, resultado);
}

export async function postarPromptManutencao(actor, ativas) {
  const content = await foundry.applications.handlebars.renderTemplate(MANUTENCAO_TEMPLATE, {
    nome: actor.name,
    ativas
  });

  return ChatMessage.create({
    content,
    whisper: destinatarios(actor),
    flags: { odrite: { manutencaoPendente: { actorUuid: actor.uuid } } }
  });
}

export async function resolverManutencao(actorUuid, itemId) {
  const actor = fromUuidSync(actorUuid);
  if (!actor?.isOwner) return;

  const ativas = actor.getFlag("odrite", "conjuracoesAtivas") ?? [];
  if (!ativas.some((a) => a.itemId === itemId)) return;

  const item = actor.items.get(itemId);
  const atributo = actor.system.atributos.conjuracao;
  const resultado = await rolarTesteRollUnder({
    titulo: game.i18n.format("ODRITE.Conjuracao.TesteManutencao", { magia: item?.name ?? "?" }),
    alvo: atributo.value,
    atributoLabel: game.i18n.localize(ODRITE.atributos.conjuracao),
    modificadores: actor._modificadoresBase("conjuracao"),
    tipoTeste: "conjuracao",
    atributoChave: "conjuracao",
    actor
  });

  if (!resultado.sucesso) {
    const restantes = ativas.filter((a) => a.itemId !== itemId);
    await actor.setFlag("odrite", "conjuracoesAtivas", restantes);
    return ChatMessage.create({
      content: `<p>${game.i18n.format("ODRITE.Conjuracao.ManutencaoFalhou", { nome: actor.name, magia: item?.name ?? "?" })}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}
