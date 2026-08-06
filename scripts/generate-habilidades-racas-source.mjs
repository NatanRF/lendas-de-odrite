/**
 * Gera os arquivos-fonte JSON de habilidades raciais predefinidas em
 * packs/_source/habilidades/. Cada raça concede automaticamente 2
 * habilidades próprias (não são escolha do jogador).
 *
 * IMPORTANTE: rode SEMPRE depois de `generate-habilidades-source.mjs`
 * (aquele script apaga a pasta inteira antes de regenerar as habilidades
 * de classe; este aqui só adiciona por cima, sem apagar nada).
 *
 * Rode de novo (adicionando raças ao objeto HABILIDADES_POR_RACA) sempre
 * que houver novas habilidades raciais; depois compile com
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

const HABILIDADES_POR_RACA = {
  Humano: [
    { nome: "Aprendizado Acelerado", tipo: "passiva", descricao: "Você pode selecionar 1 habilidade de especialização adicional." },
    { nome: "Maestria Acurada", tipo: "passiva", descricao: "Seu nível de treinamento começa em 2." }
  ],
  Nitz: [
    { nome: "Sempre Alerta", tipo: "passiva", descricao: "Uma vez por rodada pode Esquivar sem contabilizar em suas Manobras de Combate." },
    { nome: "Conexão Arcana", tipo: "passiva", descricao: "Uma vez por rodada pode optar por ter sucesso automático em um teste de Conjuração ou Manutenção." }
  ],
  Rhundrak: [
    { nome: "Explosão de Velocidade", tipo: "passiva", descricao: "Uma vez por rodada, você pode Movimentar uma vez sem contabilizar em suas Manobras de Combate." },
    { nome: "Arma Natural", tipo: "passiva", descricao: "Você pode usar suas garras como armas causando 4 de dano." }
  ],
  Draenir: [
    { nome: "Resiliência Draenir", tipo: "passiva", descricao: "Uma vez por combate, se o personagem cairia para 0 pontos de Vitalidade, o jogador pode rolar um teste de Resistência. Se for bem sucedido, permanece com 1 ponto de vitalidade." },
    { nome: "Armadura Natural", tipo: "passiva", descricao: "Devido as suas escamas resistentes, ataques realizados contra o personagem são considerados Difíceis (-2)." }
  ],
  Elster: [
    { nome: "Surto Reativo", tipo: "ativa", descricao: "Uma vez por combate, durante uma rodada, você não recebe Pontos de Fadiga devido ao uso de Manobras de Combate." },
    { nome: "Transfusão de Vitalidade", tipo: "passiva", descricao: "Uma vez por dia pode tocar numa criatura e transferir qualquer quantidade de seus próprios pontos de Vitalidade para o alvo até chegar a 0, quando cai inconsciente." }
  ]
};

fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;

function escreverPasta(raca) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!folders!${id}`,
    name: `Raça: ${raca}`,
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
  fs.writeFileSync(path.join(OUT_DIR, `_pasta-raca-${slugify(raca)}.json`), JSON.stringify(doc, null, 2) + "\n");
  return id;
}

function escrever(raca, dados, pastaId) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: dados.nome,
    type: "habilidade",
    img: "icons/svg/aura.svg",
    system: {
      tipo: dados.tipo,
      origem: "raca",
      raca,
      classe: "",
      categoria: "basica",
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
  fs.writeFileSync(path.join(OUT_DIR, `raca-${slugify(raca)}-${slugify(dados.nome)}.json`), JSON.stringify(doc, null, 2) + "\n");
  total++;
}

for (const [raca, lista] of Object.entries(HABILIDADES_POR_RACA)) {
  const pastaId = escreverPasta(raca);
  for (const habilidade of lista) escrever(raca, habilidade, pastaId);
}

console.log(`Gerados ${total} itens + ${Object.keys(HABILIDADES_POR_RACA).length} pastas em ${OUT_DIR}`);
