import { rebaixarConforto } from "./macula.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Recuperação por Descanso Completo conforme o conforto do ambiente.
 * Um descanso exige no mínimo 6 horas seguidas sem esforço físico ou mental.
 */
const CONFORTOS = {
  desconfortavel: { vitalidade: 1, fadiga: 1 },
  razoavel: { vitalidade: 2, fadiga: 3 },
  confortavel: { vitalidade: 4, fadiga: 5 }
};

/** Tipos de equipamento que podem ser remendados em campo. */
const REPARAVEIS = ["arma", "armadura", "escudo"];

function ehKit(item, funcao) {
  if (item.type !== "item" || (item.system.quantidade ?? 0) <= 0) return false;
  if (item.system.funcao) return item.system.funcao === funcao;

  // Itens criados antes do campo "funcao" são reconhecidos pelo nome.
  const nome = item.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return funcao === "kitMedicinal" ? nome.includes("kit medicinal") : nome.includes("kit de reparo");
}

/** Vitalidade extra de um Kit Medicinal: do campo, ou deduzida do nome. */
function potenciaDoKit(item) {
  if (item.system.potencia) return item.system.potencia;
  const nome = item.name.toLowerCase();
  if (nome.includes("superior")) return 8;
  if (nome.includes("refinado")) return 4;
  return 2;
}

function opcoesSelect(itens, rotulo) {
  return itens.map((i) => `<option value="${i.id}">${i.name} (${i.system.quantidade})</option>`).join("")
    || `<option value="">${rotulo}</option>`;
}

async function consumirUm(item) {
  return item.update({ "system.quantidade": Math.max(0, item.system.quantidade - 1) });
}

/**
 * Abre o diálogo de Descanso Completo e aplica o resultado escolhido:
 * recuperação de Vitalidade e Fadiga pelo conforto, Vitalidade adicional de
 * um Kit Medicinal e, opcionalmente, um reparo em campo (1 por descanso).
 * @param {Actor} actor
 */
export async function abrirDescansoCompleto(actor) {
  const kitsMedicinais = actor.items.filter((i) => ehKit(i, "kitMedicinal"));
  const kitsReparo = actor.items.filter((i) => ehKit(i, "kitReparo"));
  const equipamentos = actor.items.filter(
    (i) => REPARAVEIS.includes(i.type) && (i.system.durabilidade?.value ?? 0) < (i.system.durabilidade?.max ?? 0)
  );

  // Sussurros do Pacto (Preço 3): por alguns dias todo descanso vale como
  // desconfortável, então nem faz sentido oferecer a escolha.
  const forcaDesconfortavel = !!actor.getFlag("odrite", "descansoSempreDesconfortavel");

  const linhas = [
    `<div class="campo"><label>${game.i18n.localize("ODRITE.Descanso.Conforto")}</label>
      <select name="conforto" ${forcaDesconfortavel ? "disabled" : ""}>
        ${Object.keys(CONFORTOS).map((c) =>
          `<option value="${c}" ${c === "razoavel" && !forcaDesconfortavel ? "selected" : ""}>${game.i18n.localize(`ODRITE.Descanso.${c}`)}</option>`
        ).join("")}
      </select></div>`
  ];

  if (forcaDesconfortavel) {
    linhas.push(`<p class="aviso">${game.i18n.localize("ODRITE.Descanso.ForcadoDesconfortavel")}</p>`);
  }

  if (kitsMedicinais.length) {
    linhas.push(
      `<div class="campo"><label><input type="checkbox" name="usarKit"> ${game.i18n.localize("ODRITE.Descanso.UsarKitMedicinal")}</label>
        <select name="kitId">${opcoesSelect(kitsMedicinais)}</select></div>`
    );
  }

  if (kitsReparo.length && equipamentos.length) {
    linhas.push(
      `<div class="campo"><label><input type="checkbox" name="reparar"> ${game.i18n.localize("ODRITE.Descanso.RepararEquipamento")}</label>
        <select name="equipamentoId">${opcoesSelect(equipamentos)}</select></div>`
    );
  }

  const escolha = await DialogV2.prompt({
    window: { title: game.i18n.localize("ODRITE.Descanso.Titulo") },
    content: linhas.join(""),
    ok: {
      label: game.i18n.localize("ODRITE.Descanso.Confirmar"),
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          conforto: f.conforto?.value ?? "desconfortavel",
          usarKit: !!f.usarKit?.checked,
          kitId: f.kitId?.value ?? "",
          reparar: !!f.reparar?.checked,
          equipamentoId: f.equipamentoId?.value ?? ""
        };
      }
    },
    rejectClose: false
  });

  if (!escolha) return;
  return aplicarDescanso(actor, forcaDesconfortavel ? { ...escolha, conforto: "desconfortavel" } : escolha);
}

async function aplicarDescanso(actor, { conforto, usarKit, kitId, reparar, equipamentoId }) {
  const partes = [];

  // 2 Pontos de Mácula: os pesadelos rebaixam todo descanso uma categoria.
  const escolhido = conforto;
  if ((actor.system.macula ?? 0) >= 2) {
    conforto = rebaixarConforto(conforto);
    if (conforto !== escolhido) {
      partes.push(game.i18n.format("ODRITE.Macula.DescansoRebaixado", {
        de: game.i18n.localize(`ODRITE.Descanso.${escolhido}`),
        para: game.i18n.localize(`ODRITE.Descanso.${conforto}`)
      }));
    }
  }

  const tabela = CONFORTOS[conforto] ?? CONFORTOS.desconfortavel;

  let ganhoVitalidade = tabela.vitalidade;
  const kit = usarKit ? actor.items.get(kitId) : null;
  if (kit) {
    ganhoVitalidade += potenciaDoKit(kit);
    await consumirUm(kit);
    partes.push(game.i18n.format("ODRITE.Descanso.ResumoKit", { kit: kit.name }));
  }

  const teto = actor.system.vitalidade.maxEfetivo ?? actor.system.vitalidade.max;
  const vitalidadeFinal = Math.min(teto, actor.system.vitalidade.value + ganhoVitalidade);
  const fadigaFinal = Math.max(0, actor.system.fadiga.value - tabela.fadiga);

  await actor.update({ "system.vitalidade.value": vitalidadeFinal, "system.fadiga.value": fadigaFinal });

  partes.unshift(game.i18n.format("ODRITE.Descanso.ResumoBase", {
    conforto: game.i18n.localize(`ODRITE.Descanso.${conforto}`),
    vitalidade: vitalidadeFinal,
    teto,
    fadiga: fadigaFinal
  }));

  if (reparar) {
    const resumoReparo = await repararEmCampo(actor, equipamentoId);
    if (resumoReparo) partes.push(resumoReparo);
  }

  return ChatMessage.create({
    content: `<div class="odrite chat-card"><h3 class="chat-card-titulo">${game.i18n.localize("ODRITE.Descanso.Titulo")}</h3><p>${partes.join("<br>")}</p></div>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/**
 * Reparo em Campo: consome 1 Kit de Reparo e devolve d4 de Durabilidade.
 * Só 1 reparo por Descanso Completo, garantido por ser chamado uma única vez.
 */
async function repararEmCampo(actor, equipamentoId) {
  const equipamento = actor.items.get(equipamentoId);
  const kit = actor.items.find((i) => ehKit(i, "kitReparo"));
  if (!equipamento || !kit) return null;

  const roll = await new Roll("1d4").evaluate();
  const atual = equipamento.system.durabilidade?.value ?? 0;
  const max = equipamento.system.durabilidade?.max ?? 0;
  const nova = Math.min(max, atual + roll.total);

  await equipamento.update({ "system.durabilidade.value": nova });
  await consumirUm(kit);

  return game.i18n.format("ODRITE.Descanso.ResumoReparo", {
    equipamento: equipamento.name,
    pontos: nova - atual,
    durabilidade: nova,
    max
  });
}

/**
 * Fadiga acumulada fora de combate: viagem a pé além do limite da Resistência
 * (1 por hora extra) e privações do dia (sem Descanso Completo, sem comida,
 * sem água — cada uma conta 1 individualmente).
 * @param {Actor} actor
 */
export async function abrirFadigaDeViagem(actor) {
  const limite = actor.system.atributos.resistencia.value;

  const escolha = await DialogV2.prompt({
    window: { title: game.i18n.localize("ODRITE.Viagem.Titulo") },
    content: `
      <p>${game.i18n.format("ODRITE.Viagem.LimiteResistencia", { limite })}</p>
      <div class="campo"><label>${game.i18n.localize("ODRITE.Viagem.HorasCaminhadas")}</label>
        <input type="number" name="horas" value="0" min="0"></div>
      <div class="campo"><label><input type="checkbox" name="semDescanso"> ${game.i18n.localize("ODRITE.Viagem.SemDescanso")}</label></div>
      <div class="campo"><label><input type="checkbox" name="semComida"> ${game.i18n.localize("ODRITE.Viagem.SemComida")}</label></div>
      <div class="campo"><label><input type="checkbox" name="semAgua"> ${game.i18n.localize("ODRITE.Viagem.SemAgua")}</label></div>`,
    ok: {
      label: game.i18n.localize("ODRITE.Descanso.Confirmar"),
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          horas: Number(f.horas.value) || 0,
          privacoes: [f.semDescanso.checked, f.semComida.checked, f.semAgua.checked].filter(Boolean).length
        };
      }
    },
    rejectClose: false
  });

  if (!escolha) return;

  const horasExtras = Math.max(0, escolha.horas - limite);
  const total = horasExtras + escolha.privacoes;
  if (!total) {
    return ui.notifications.info(game.i18n.localize("ODRITE.Viagem.SemFadiga"));
  }

  await actor.update({ "system.fadiga.value": actor.system.fadiga.value + total });

  return ChatMessage.create({
    content: `<p>${game.i18n.format("ODRITE.Viagem.Resumo", {
      nome: actor.name,
      total,
      horas: horasExtras,
      privacoes: escolha.privacoes
    })}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}
