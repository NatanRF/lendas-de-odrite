/**
 * Gera os arquivos-fonte JSON de serviços predefinidos em
 * packs/_source/servicos/. Rode uma vez (ou de novo se editar a tabela
 * abaixo); depois compile com `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "servicos");

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const SERVICOS = [
  { nome: "Hospedagem Simples", preco: 2, icon: "house.svg" },
  { nome: "Hospedagem Modesta", preco: 10, icon: "house.svg" },
  { nome: "Hospedagem Luxuosa", preco: 25, icon: "house.svg" },
  { nome: "Refeição Simples", preco: 1, icon: "tankard.svg" },
  { nome: "Refeição Modesta", preco: 3, icon: "tankard.svg" },
  { nome: "Refeição Especial", preco: 10, icon: "tankard.svg" },
  { nome: "Carroça", preco: 500, icon: "barrel.svg" },
  { nome: "Cavalo de Montaria", preco: 300, icon: "pawprint.svg" },
  { nome: "Animal de Carga", preco: 150, icon: "pawprint.svg" },
  { nome: "Animal de Tração", preco: 200, icon: "pawprint.svg" }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const servico of SERVICOS) {
  const slug = servico.nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: servico.nome,
    type: "item",
    img: `icons/svg/${servico.icon}`,
    system: {
      quantidade: 1,
      preco: servico.preco,
      descricao: ""
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

  fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
}

console.log(`Gerados ${SERVICOS.length} arquivos em ${OUT_DIR}`);
