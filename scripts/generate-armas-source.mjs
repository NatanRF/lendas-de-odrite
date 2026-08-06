/**
 * Gera os arquivos-fonte JSON de armas predefinidas em packs/_source/armas/.
 * Rode uma vez (ou de novo se editar a tabela abaixo); depois compile com
 * `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "armas");

function randomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const ARMAS = [
  { nome: "Adaga", categoria: "Adagas", dano: 2, propriedade: "Sangrar", preco: 2, forcaMinima: 0, alcance: "Adjacente/10m", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "adaga.png" },
  { nome: "Espada", categoria: "Espadas", dano: 4, propriedade: "Sangrar", preco: 25, forcaMinima: 6, alcance: "Adjacente", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "espada-curta.png" },
  { nome: "Espada Longa", categoria: "Espadas", dano: 6, propriedade: "Sangrar", preco: 150, forcaMinima: 10, alcance: "Adjacente", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "espada-longa.png" },
  { nome: "Machado", categoria: "Machados", dano: 4, propriedade: "Mutilar", preco: 20, forcaMinima: 6, alcance: "Adjacente", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "machado.png" },
  { nome: "Machado de Guerra", categoria: "Machados", dano: 6, propriedade: "Mutilar", preco: 100, forcaMinima: 12, alcance: "Adjacente", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "machado-de-guerra.png" },
  { nome: "Foice", categoria: "Foices", dano: 3, propriedade: "Mutilar", preco: 5, forcaMinima: 4, alcance: "Adjacente", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "foice.png" },
  { nome: "Foice de Duas Mãos", categoria: "Foices", dano: 5, propriedade: "Mutilar", preco: 50, forcaMinima: 8, alcance: "Até 4 metros", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "foice-de-duas-maos.png" },
  { nome: "Lança", categoria: "Lanças", dano: 3, propriedade: "Debilitar", preco: 40, forcaMinima: 4, alcance: "Até 4 metros", maos: "1 ou 2 mãos", tipoAtaque: "corpoACorpo", icon: "lanca.png" },
  { nome: "Lança Montante", categoria: "Lanças", dano: 5, propriedade: "Debilitar", preco: 120, forcaMinima: 10, alcance: "Até 4 metros", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "lanca-montante.png" },
  { nome: "Bastão", categoria: "Bastões", dano: 1, propriedade: "Derrubar", preco: 1, forcaMinima: 0, alcance: "Até 4 metros", maos: "1 ou 2 mãos", tipoAtaque: "corpoACorpo", icon: "bastao.png" },
  { nome: "Maça", categoria: "Maças", dano: 4, propriedade: "Derrubar", preco: 15, forcaMinima: 6, alcance: "Adjacente", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "maca.png" },
  { nome: "Maça Pesada", categoria: "Maças", dano: 6, propriedade: "Derrubar", preco: 90, forcaMinima: 12, alcance: "Adjacente", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "maca-pesada.png" },
  { nome: "Martelo", categoria: "Martelos", dano: 4, propriedade: "Quebrar", preco: 5, forcaMinima: 4, alcance: "Adjacente", maos: "1 mão", tipoAtaque: "corpoACorpo", icon: "martelo.png" },
  { nome: "Martelo de Batalha", categoria: "Martelos", dano: 6, propriedade: "Quebrar", preco: 130, forcaMinima: 12, alcance: "Adjacente", maos: "2 mãos", tipoAtaque: "corpoACorpo", icon: "martelo-de-batalha.png" },
  { nome: "Arco", categoria: "Arcos", dano: 2, propriedade: "Atrasar", preco: 10, forcaMinima: 0, alcance: "Até 30 metros", maos: "2 mãos", tipoAtaque: "distancia", icon: "arco.png" },
  { nome: "Besta de 1 mão", categoria: "Bestas", dano: 4, propriedade: "Atrasar", preco: 120, forcaMinima: 6, alcance: "Até 30 metros", maos: "1 mão", tipoAtaque: "distancia", icon: "besta-de-1-mao.png" },
  { nome: "Besta", categoria: "Bestas", dano: 6, propriedade: "Sangrar", preco: 200, forcaMinima: 8, alcance: "Até 60 metros", maos: "2 mãos", tipoAtaque: "distancia", icon: "besta.png" }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const arma of ARMAS) {
  const slug = arma.nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: arma.nome,
    type: "arma",
    img: `systems/odrite/assets/icons/${arma.icon}`,
    system: {
      tipoAtaque: arma.tipoAtaque,
      categoria: arma.categoria,
      dano: arma.dano,
      propriedade: arma.propriedade,
      preco: arma.preco,
      forcaMinima: arma.forcaMinima,
      alcance: arma.alcance,
      maos: arma.maos,
      durabilidade: { value: 6, max: 6 }
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

console.log(`Gerados ${ARMAS.length} arquivos em ${OUT_DIR}`);
