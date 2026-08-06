/**
 * Gera os arquivos-fonte JSON de armaduras e escudos predefinidos em
 * packs/_source/protecao/. Rode uma vez (ou de novo se editar a tabela
 * abaixo); depois compile com `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "protecao");

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const ARMADURAS = [
  { nome: "Armadura Leve", durabilidade: 5, preco: 50, forcaMinima: 0, penalidade: 0 },
  { nome: "Armadura Média", durabilidade: 8, preco: 200, forcaMinima: 6, penalidade: 2 },
  { nome: "Armadura Pesada", durabilidade: 10, preco: 500, forcaMinima: 10, penalidade: 4 }
];

const ESCUDOS = [
  { nome: "Escudo Leve", durabilidade: 6, preco: 30, forcaMinima: 4, penalidade: 0 },
  { nome: "Escudo Médio", durabilidade: 10, preco: 120, forcaMinima: 6, penalidade: 2 },
  { nome: "Escudo Pesado", durabilidade: 12, preco: 300, forcaMinima: 8, penalidade: 4 }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(nome) {
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escrever(nome, type, dados) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: dados.nome,
    type,
    img: type === "armadura" ? "icons/svg/statue.svg" : "icons/svg/shield.svg",
    system: {
      tipo: dados.nome,
      preco: dados.preco,
      forcaMinima: dados.forcaMinima,
      penalidade: dados.penalidade,
      durabilidade: { value: dados.durabilidade, max: dados.durabilidade }
    },
    effects: [],
    folder: null,
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
  fs.writeFileSync(path.join(OUT_DIR, `${slugify(dados.nome)}.json`), JSON.stringify(doc, null, 2) + "\n");
}

for (const armadura of ARMADURAS) escrever(armadura.nome, "armadura", armadura);
for (const escudo of ESCUDOS) escrever(escudo.nome, "escudo", escudo);

console.log(`Gerados ${ARMADURAS.length + ESCUDOS.length} arquivos em ${OUT_DIR}`);
