/**
 * Gera os arquivos-fonte JSON de itens gerais predefinidos em
 * packs/_source/itens/. Rode uma vez (ou de novo se editar a tabela
 * abaixo); depois compile com `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "itens");

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const ITENS = [
  { nome: "Algibeira", preco: 1, icon: "coins.svg" },
  { nome: "Aljava Pequena", preco: 1, icon: "item-bag.svg" },
  { nome: "Aljava Média", preco: 3, icon: "item-bag.svg" },
  { nome: "Aljava Grande", preco: 10, icon: "item-bag.svg" },
  { nome: "Barraca", preco: 20, icon: "house.svg" },
  { nome: "Corda (3m)", preco: 1, icon: "net.svg" },
  { nome: "Corrente (3m)", preco: 10, icon: "net.svg" },
  { nome: "Lamparina", preco: 2, icon: "light.svg" },
  { nome: "Óleo (1 hora)", preco: 1, icon: "fire.svg" },
  { nome: "Mochila", preco: 3, icon: "item-bag.svg" },
  { nome: "Cantil", preco: 1, icon: "tankard.svg" },
  { nome: "Ração de Viagem (1 dia)", preco: 1, icon: "tankard.svg" },
  { nome: "Saco de Dormir", preco: 2, icon: "item-bag.svg" },
  { nome: "Tocha", preco: 1, icon: "light.svg" },
  { nome: "Elixir de Vitalidade", preco: 50, icon: "heal.svg" },
  { nome: "Elixir de Vitalidade Refinado", preco: 150, icon: "heal.svg" },
  { nome: "Elixir de Vitalidade Superior", preco: 300, icon: "heal.svg" },
  { nome: "Elixir de Vigor", preco: 50, icon: "regen.svg" },
  { nome: "Elixir de Vigor Refinado", preco: 150, icon: "regen.svg" },
  { nome: "Elixir de Vigor Superior", preco: 300, icon: "regen.svg" },
  { nome: "Kit de Ladroagem", preco: 5, icon: "padlock.svg" },
  { nome: "Kit Medicinal Simples", preco: 20, icon: "heal.svg" },
  { nome: "Kit Medicinal Refinado", preco: 50, icon: "heal.svg" },
  { nome: "Kit Medicinal Superior", preco: 150, icon: "heal.svg" },
  { nome: "Kit Herbalístico", preco: 2, icon: "oak.svg" },
  { nome: "Antídoto", preco: 5, icon: "poison.svg" }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const item of ITENS) {
  const slug = item.nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: item.nome,
    type: "item",
    img: `icons/svg/${item.icon}`,
    system: {
      quantidade: 1,
      preco: item.preco,
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

console.log(`Gerados ${ITENS.length} arquivos em ${OUT_DIR}`);
