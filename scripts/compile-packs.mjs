/**
 * Compila as pastas em packs/_source/* para compêndios binários em packs/*,
 * prontos para o Foundry carregar. Rode `npm run packs:compile` sempre que
 * editar os arquivos-fonte (JSON individuais por item).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.join(__dirname, "..", "packs", "_source");
const OUT_ROOT = path.join(__dirname, "..", "packs");

const nomesPacks = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const nome of nomesPacks) {
  const origem = path.join(SOURCE_ROOT, nome);
  const destino = path.join(OUT_ROOT, nome);
  try {
    await compilePack(origem, destino, { recursive: true });
    console.log(`Compilado: ${nome}`);
  } catch (err) {
    const locked = err.code === "LEVEL_LOCKED" || err.cause?.code === "LEVEL_LOCKED";
    if (locked) {
      console.warn(`Pulado (em uso pelo Foundry): ${nome} — feche o Foundry e rode de novo para atualizar este pack.`);
    } else {
      throw err;
    }
  }
}
