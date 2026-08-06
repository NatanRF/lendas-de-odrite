/**
 * Gera os arquivos-fonte JSON de habilidades predefinidas em
 * packs/_source/habilidades/. Cada classe tem 1 habilidade "basica"
 * (concedida automaticamente) e uma lista de habilidades "lista" que o
 * jogador destrava trocando por pontos de experiência.
 *
 * Rode de novo (adicionando classes ao objeto HABILIDADES_POR_CLASSE)
 * sempre que houver novas habilidades; depois compile com
 * `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "habilidades");

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function slugify(nome) {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const HABILIDADES_POR_CLASSE = {
  Guerreiro: {
    basica: {
      nome: "Maestria com Armas",
      tipo: "passiva",
      descricao: "Pode escolher uma categoria de arma. Ao atacar com uma arma dessa categoria pode adicionar +1 no valor alvo dos seus testes de acerto. Pode gastar 2 pontos de experiência para adicionar uma nova categoria de arma à sua maestria."
    },
    lista: [
      { nome: "Golpe Preciso", tipo: "ativa", descricao: "Pode rolar novamente 1 dos dados em um teste de ataque." },
      { nome: "Manuseio Avançado", tipo: "passiva", descricao: "Pode sacar ou trocar armas uma vez por rodada sem custo em Manobras de Combate." },
      { nome: "Contra Ataque", tipo: "ativa", descricao: "Após receber um ataque corpo a corpo, pode realizar imediatamente um ataque contra o inimigo que lhe alvejou." },
      { nome: "Oportunista", tipo: "passiva", descricao: "Pode realizar Golpe Oportuno uma vez por rodada sem contabilizar em suas Manobras de Combate realizadas." },
      { nome: "Investida", tipo: "ativa", descricao: "Uma vez por rodada, em uma só ação pode se mover até seu deslocamento máximo na direção de um alvo e, ao encerrar o movimento adjacente a ele, pode realizar um ataque imediatamente." },
      { nome: "Golpe Vingativo", tipo: "passiva", descricao: "Ao sofrer dano de um ataque, você pode realizar seu próximo ataque como Fácil (+2) contra seu agressor." },
      { nome: "Golpe Limitante", tipo: "ativa", descricao: "Ao acertar um ataque, tira 1 Manobra de Combate do alvo atingido, que se já tiver gasto todas as suas manobras, tira em seu próximo turno." },
      { nome: "Ataque Tornado", tipo: "ativa", descricao: "Ao realizar um ataque, você pode atacar simultaneamente todos aqueles que estiverem adjacentes a você." },
      { nome: "Golpe Destruidor", tipo: "ativa", descricao: "Se o inimigo iria mitigar o dano do seu ataque, você pode fazer com que o ataque cause o dano total ignorando a mitigação." },
      { nome: "Desestabilizar", tipo: "ativa", descricao: "Ao causar dano com um ataque, você pode fazer com que todos os ataques realizados contra esse alvo sejam considerados Fáceis (+2) até o fim da Rodada." }
    ]
  },

  Caçador: {
    basica: {
      nome: "Precisão Apurada",
      tipo: "passiva",
      descricao: "Você não sofre penalidade ao atacar um alvo adjacente a 1 ou mais aliados."
    },
    lista: [
      { nome: "Quebra Horda", tipo: "ativa", descricao: "Ao atingir um alvo, pode realizar um ataque imediatamente contra um outro alvo adjacente ao atingido." },
      { nome: "Afastar do Perigo", tipo: "passiva", descricao: "Uma vez por rodada, pode usar Desvencilhar uma vez sem contabilizar em suas Manobras de Combate." },
      { nome: "Disparo Vingativo", tipo: "ativa", descricao: "Quando um aliado a até 10m sofrer dano de um ataque direto, pode imediatamente realizar um ataque a distância contra o agressor uma vez sem contabilizar em suas Manobras de Combate." },
      { nome: "Concentração Total", tipo: "passiva", descricao: "Seu primeiro teste de Acerto da rodada é considerado Fácil (+2)." },
      { nome: "Disparo Duplo", tipo: "ativa", descricao: "Você dispara 2 projéteis no mesmo ataque, dobrando o dano causado em caso de acerto." },
      { nome: "Reflexo Avançado", tipo: "ativa", descricao: "Se um inimigo rola uma falha absoluta durante um ataque em que o alvo seja você ou um aliado, pode realizar um ataque contra esse inimigo uma vez sem contabilizar em suas Manobras de Combate realizadas." },
      { nome: "Projétil Sônico", tipo: "ativa", descricao: "Você dispara um projétil com velocidade altíssima o que faz com que seja impossível ao alvo usar Manobras de Combate em reação a esse ataque." },
      { nome: "Disparo Perfurante", tipo: "passiva", descricao: "O dano dos seus ataques a distância não pode ser mitigado." },
      { nome: "Perseguir a Presa", tipo: "ativa", descricao: "Após atingir um alvo com um ataque a distância, pode Movimentar uma vez sem contabilizar em suas Manobras de Combate realizadas." },
      { nome: "Recurso Precioso", tipo: "passiva", descricao: "Ao final do combate você pode recuperar d6 projéteis disparados." }
    ]
  },

  Assassino: {
    basica: {
      nome: "Golpe Assassino",
      tipo: "passiva",
      descricao: "Ao atacar um alvo que não possui ninguém adjacente a ele exceto você, o ataque causa 1d4 pontos de dano a mais no alvo em todos os seus acertos contra ele."
    },
    lista: [
      { nome: "Punir a Falha", tipo: "ativa", descricao: "Quando um inimigo falhar em um Teste de Acerto contra você, pode realizar imediatamente um ataque contra ele, desde que esteja no alcance da sua arma, uma vez sem contabilizar em suas Manobras de Combate realizadas." },
      { nome: "Adaptação Ágil", tipo: "passiva", descricao: "Ao usar uma arma corpo a corpo em que é proficiente, você pode escolher usar o atributo de Agilidade ao invés de Força para o valor alvo do teste de acerto." },
      { nome: "Filetar", tipo: "ativa", descricao: "Ao acertar um ataque e causar dano a um alvo, você pode imediatamente realizar um novo teste de Acerto contra o mesmo alvo uma vez sem contabilizar em suas Manobras de Combate." },
      { nome: "Golpe Letal", tipo: "ativa", descricao: "Ao atacar um alvo, você pode impedi-lo de usar Reações contra seu ataque." },
      { nome: "Desvencilhar Aprimorado", tipo: "passiva", descricao: "Caso você realize a ação Desvencilhar, pode se mover até seu movimento máximo ao invés de apenas metade." },
      { nome: "Esquiva Perfeita", tipo: "passiva", descricao: "Ao realizar um teste de Agilidade para Esquivar, ele é considerado Fácil (+2)." },
      { nome: "Assassino Voraz", tipo: "ativa", descricao: "Ao reduzir os pontos de Vitalidade de um alvo a 0, pelo restante da rodada você não recebe Pontos de Fadiga provenientes do uso de Manobras de Combate." },
      { nome: "Lâmina Protetora", tipo: "passiva", descricao: "Você pode usar sua arma empunhada ao invés de um escudo para Bloquear." },
      { nome: "Passo do Assassino", tipo: "ativa", descricao: "Em uma mesma manobra, você pode avançar até 4 metros na direção de um alvo a vista. Caso termine o movimento adjacente a ele, pode realizar um ataque corpo a corpo imediatamente." },
      { nome: "Aproveitar a Distração", tipo: "passiva", descricao: "Você recebe +1 no Valor Alvo do seu teste de Acerto em um ataque corpo a corpo para cada um de seus aliados adjacente ao seu alvo." }
    ]
  },

  Canalizador: {
    basica: {
      nome: "Concentração Avançada",
      tipo: "passiva",
      descricao: "Os testes para manter ativos os efeitos de manutenção são considerados Fáceis (+2)."
    },
    lista: [
      { nome: "Converter Dano", tipo: "passiva", descricao: "Ao sofrer dano você pode adicionar +1 de dano em sua próxima conjuração (cumulativo)." },
      { nome: "Anti Conjuração", tipo: "conjuracao", descricao: "Se um alvo que você possa ver iria invocar uma conjuração, anule a conjuração que está sendo invocada nesse momento." },
      { nome: "Duplicar Conjuração", tipo: "conjuracao", descricao: "Você pode afetar 2 alvos com a mesma conjuração." },
      { nome: "Esquiva Arcana", tipo: "ativa", descricao: "Pode Resguardar uma vez sem contabilizar em seus usos de Manobras de Combate realizadas." },
      { nome: "Dano Devastador", tipo: "conjuracao", descricao: "Ao acertar uma conjuração que causa dano, você adiciona d4 a ele." },
      { nome: "Consumir Vitalidade", tipo: "passiva", descricao: "Uma vez por manobra, você pode reduzir em 1 seus Pontos de Vitalidade para rolar novamente um teste de conjuração." },
      { nome: "Conjuração Potencializada", tipo: "conjuracao", descricao: "Seu próximo teste de conjuração é considerado Fácil (+2)." },
      { nome: "Conjuração Penetrante", tipo: "conjuracao", descricao: "O dano da sua próxima conjuração não pode ser mitigado até o final do combate." },
      { nome: "Vínculo", tipo: "passiva", descricao: "Uma vez por dia você pode criar um vínculo com outro indivíduo através de um toque. Você pode usar no alvo conjurações com alcance de toque, mesmo que ele esteja até 20 metros de você. O efeito se aplica até o final do dia." },
      { nome: "Força de Vontade", tipo: "conjuracao", descricao: "Ao rolar uma falha absoluta durante um teste de Conjuração você pode refazer essa rolagem." }
    ]
  },

  "Combatente Sagrado": {
    basica: {
      nome: "Protetor",
      tipo: "passiva",
      descricao: "Todos os ataques realizados contra os aliados adjacentes a você são considerados Difíceis (-2)."
    },
    lista: [
      { nome: "Abençoar Arma", tipo: "conjuracao", descricao: "Uma vez por combate pode infundir Essência em uma arma que possui proficiência. Essa arma passa a ter +2 no Valor Alvo dos testes de Acerto. No início de cada turno subsequente é necessário ter sucesso em um teste de Conjuração para manter o efeito ativo." },
      { nome: "Inspiração de Combate", tipo: "passiva", descricao: "Todos os aliados até 4 metros de você recebem +1 em seus testes de Acerto." },
      { nome: "Abençoar Escudo", tipo: "conjuracao", descricao: "Se seu escudo perderia pontos de durabilidade, sofre apenas metade do dano, arredondado para baixo se necessário." },
      { nome: "Abençoar Armadura", tipo: "conjuracao", descricao: "Se sua armadura perderia pontos de durabilidade, sofre apenas metade do valor, arredondado para baixo se necessário." },
      { nome: "Resistência Arcana", tipo: "passiva", descricao: "Ao realizar um teste de Resistência, ele é considerado Fácil (+2)." },
      { nome: "Golpe de Essência", tipo: "conjuracao", descricao: "Ao acertar um ataque, você pode adicionar d4 de dano." },
      { nome: "Negar Dano", tipo: "ativa", descricao: "Você pode anular completamente um dano recebido desde que esteja usando uma armadura ou escudo." },
      { nome: "Vigor do Combatente", tipo: "ativa", descricao: "Apenas durante um combate, no início do seu turno pode reduzir em 1 seus Pontos de Fadiga." },
      { nome: "Proteger Aliado", tipo: "ativa", descricao: "Um ataque feito contra um aliado adjacente a você é considerado Muito Difícil (-4)." },
      { nome: "Cicatrização Acelerada", tipo: "passiva", descricao: "Você pode recuperar d4 a mais de Pontos de Vitalidade durante um Descanso Completo." }
    ]
  }
};

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;

function escreverPasta(classe) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!folders!${id}`,
    name: classe,
    type: "Item",
    sorting: "m",
    color: null,
    folder: null,
    sort: 0,
    flags: {},
    _stats: {
      systemId: "odrite",
      systemVersion: "0.1.0",
      coreVersion: "14",
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null
    }
  };
  fs.writeFileSync(path.join(OUT_DIR, `_pasta-${slugify(classe)}.json`), JSON.stringify(doc, null, 2) + "\n");
  return id;
}

function escrever(classe, categoria, dados, pastaId) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: dados.nome,
    type: "habilidade",
    img: categoria === "basica" ? "icons/svg/upgrade.svg" : "icons/svg/book.svg",
    system: {
      tipo: dados.tipo,
      origem: "classe",
      raca: "",
      classe,
      categoria,
      descricao: dados.descricao
    },
    effects: [],
    folder: pastaId,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    _stats: {
      systemId: "odrite",
      systemVersion: "0.1.0",
      coreVersion: "14",
      createdTime: Date.now(),
      modifiedTime: Date.now(),
      lastModifiedBy: null
    }
  };
  fs.writeFileSync(path.join(OUT_DIR, `${slugify(classe)}-${slugify(dados.nome)}.json`), JSON.stringify(doc, null, 2) + "\n");
  total++;
}

for (const [classe, grupo] of Object.entries(HABILIDADES_POR_CLASSE)) {
  const pastaId = escreverPasta(classe);
  escrever(classe, "basica", grupo.basica, pastaId);
  for (const habilidade of grupo.lista) escrever(classe, "lista", habilidade, pastaId);
}

console.log(`Gerados ${total} itens + ${Object.keys(HABILIDADES_POR_CLASSE).length} pastas em ${OUT_DIR}`);
