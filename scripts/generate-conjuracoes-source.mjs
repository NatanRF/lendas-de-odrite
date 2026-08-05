/**
 * Gera os arquivos-fonte JSON de conjurações predefinidas em
 * packs/_source/conjuracoes/. As conjurações são organizadas em pastas por
 * Caminho (ex: Caminho da Vida).
 *
 * Rode de novo (adicionando caminhos ao objeto CONJURACOES_POR_CAMINHO)
 * sempre que houver novas conjurações; depois compile com
 * `npm run packs:compile`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "packs", "_source", "conjuracoes");

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

const CONJURACOES_POR_CAMINHO = {
  "Caminho da Vida": [
    { nome: "Cura Milagrosa", duracao: "Instantâneo", alcance: "Toque", descricao: "Você pode restaurar os d4 Pontos de Vitalidade do alvo.", icon: "heal.svg" },
    { nome: "Estabilizar", duracao: "Instantâneo", alcance: "Toque", descricao: "Toque em uma criatura que esteja morrendo e faça com que ela fique estabilizada.", icon: "regen.svg" },
    { nome: "Aura de Vitalidade", duracao: "Manutenção", alcance: "Pessoal", descricao: "Seu corpo é envolto por uma aura de vitalidade. Um aliado que iniciar o turno adjacente a você recupera 1 Ponto de Vitalidade.", icon: "aura.svg" },
    { nome: "Voz Curativa", duracao: "Instantâneo", alcance: "10 metros", descricao: "Você pode restaurar em 2 os Pontos de Vitalidade do alvo.", icon: "heal.svg" },
    { nome: "Potencializar Cura", duracao: "Manutenção", alcance: "Pessoal", descricao: "Enquanto esta conjuração estiver ativa, você pode curar 1 ponto de vitalidade adicional em todas as suas conjurações de cura.", icon: "upgrade.svg" },
    { nome: "Purificação", duracao: "Instantâneo", alcance: "Toque", descricao: "Toque em uma criatura para remover um efeito de veneno.", icon: "poison.svg" },
    { nome: "Vínculo Vital", duracao: "Manutenção", alcance: "Toque", descricao: "Conecte sua Essência com a de um aliado. Se ele sofreria dano, você sofre no lugar. E se você cura outro individuo, ele também recebe o mesmo valor de cura.", icon: "anchor.svg" },
    { nome: "Chama Vital", duracao: "Instantâneo", alcance: "20 metros", descricao: "Libere uma energia vital em forma de chamas contra um alvo. O alvo sofre 3 de dano e todos os aliados adjacentes ao alvo atingido recebem 1 de cura em sua vitalidade.", icon: "fire.svg" },
    { nome: "Fonte de Cura", duracao: "Manutenção", alcance: "Pessoal", descricao: "Você emana energia vital. Aliados em um raio de 3 metros ao redor de você podem usar uma Manobra de Combate para recuperar 2 pontos de vitalidade.", icon: "heal.svg" },
    { nome: "Toque Revigorante", duracao: "Instantâneo", alcance: "Toque", descricao: "Toque em uma criatura e remova dela até 2 pontos de Fadiga.", icon: "regen.svg" }
  ],

  "Caminho da Guerra": [
    { nome: "Provocar Combate", duracao: "Instantâneo", alcance: "10 Metros", descricao: "Você incita um alvo. No próximo turno ele será obrigado a desferir seus ataques contra você. Se não for possível lhe atacar, o alvo não pode usar uma manobra de combate para atacar outro personagem.", icon: "combat.svg" },
    { nome: "Ataque Preciso", duracao: "Instantâneo", alcance: "Pessoal", descricao: "Você pode rolar seu próximo ataque com +2 no valor alvo.", icon: "target.svg" },
    { nome: "Frenesi de Batalha", duracao: "Rodada", alcance: "Pessoal", descricao: "Você entra em um estado de frenesi. Até o final da rodada, adicione d4 de dano aos seus ataques corpo a corpo.", icon: "explosion.svg" },
    { nome: "Rugido de Batalha", duracao: "Rodada", alcance: "4 metros", descricao: "Solte um rugido poderoso. Os ataques de criaturas inimigas dentro do alcance contra você são considerados Muito Difíceis (-4) até o fim dessa rodada.", icon: "terror.svg" },
    { nome: "Força Indomável", duracao: "Rodada", alcance: "Pessoal", descricao: "Adicione +2 no valor alvo de seus testes de acerto e no dano até o fim da rodada.", icon: "upgrade.svg" },
    { nome: "Golpe Perfeito", duracao: "Rodada", alcance: "Pessoal", descricao: "Até o final da rodada, aplique a propriedade da sua arma ao acertar qualquer um de seus ataques.", icon: "sword.svg" },
    { nome: "Defesa Implacável", duracao: "Rodada", alcance: "Pessoal", descricao: "Até o final da rodada, se for atingido por um ataque, reduza pela metade todo o dano recebido arredondado para baixo.", icon: "shield.svg" },
    { nome: "Agressividade Irresponsável", duracao: "Rodada", alcance: "Pessoal", descricao: "Você não recebe Pontos de Fadiga por Atacar múltiplas vezes. Todos os ataques contra você até o fim da rodada são considerados Fáceis (+2).", icon: "thrust.svg" },
    { nome: "Barreira Defletora", duracao: "Manutenção", alcance: "Pessoal", descricao: "Ao receber dano de um ataque corpo a corpo, você anula d4 pontos de dano e devolve esse dano ao agressor.", icon: "fire-shield.svg" },
    { nome: "Bandeira de Guerra", duracao: "Manutenção", alcance: "6 Metros", descricao: "Você invoca uma bandeira espiritual que fortalece aliados ao redor dela. Criaturas aliadas dentro de uma área de 4x4m a partir do ponto em que a bandeira foi hasteada, recebem +2 em testes de acerto e testes de Resistência enquanto a conjuração for mantida.", icon: "tower-flag.svg" }
  ],

  "Caminho Elemental": [
    { nome: "Lança de Fogo", duracao: "Instantâneo", alcance: "20 Metros", descricao: "Você arremessa uma lança de fogo contra um inimigo. O alvo sofre d4 de dano de fogo.", icon: "fire.svg" },
    { nome: "Chamas Crescentes", duracao: "Manutenção", alcance: "10 Metros", descricao: "Escolha um alvo em alcance. Ele sofre 2 de dano no início de cada um de seus turnos. O alvo pode usar 1 manobra de combate para tentar passar em um teste de Resistência e interromper o efeito.", icon: "fire.svg" },
    { nome: "Rajada de Vento", duracao: "Instantâneo", alcance: "Pessoal", descricao: "Uma rajada de vento forte empurra criaturas adjacentes. Cada alvo sofre 1 de dano e é empurrado 4 metros.", icon: "wingfoot.svg" },
    { nome: "Pele Rochosa", duracao: "Manutenção", alcance: "Pessoal", descricao: "Você invoca uma barreira de pedra ao seu redor. Reduza todo dano sofrido em 1.", icon: "statue.svg" },
    { nome: "Lâmina de Vento", duracao: "Instantâneo", alcance: "20 Metros", descricao: "Você dispara uma rajada de vento de alta pressão que se torna cortante. O alvo sofre 2 de dano e fica Caído.", icon: "wingfoot.svg" },
    { nome: "Terra Movediça", duracao: "Instantâneo", alcance: "10 Metros", descricao: "Você transforma o terreno em uma área de 6x6m em uma área movediça. Qualquer que esteja na área fica Imobilizado. Cada indivíduo afetado pode, no seu respectivo turno, usar 1 manobra de combate para fazer um teste de Força para tentar sair da condição.", icon: "trap.svg" },
    { nome: "Chamado da Tempestade", duracao: "Instantâneo", alcance: "10 Metros", descricao: "Você invoca relâmpagos em um ponto dentro do alcance. Todas as criaturas adjacentes ao ponto sofrem 1d4 de dano.", icon: "lightning.svg" },
    { nome: "Fulgor Estático", duracao: "Instantâneo", alcance: "Pessoal", descricao: "Você descarrega energia elétrica em todas as criaturas adjacentes. Cada uma sofre 2 de dano e perde 1 manobra de combate nessa rodada.", icon: "lightning.svg" },
    { nome: "Chicote Torrencial", duracao: "Instantânea", alcance: "6 Metros", descricao: "Ataque com um chicote feito de água em alta pressão. Cause 1d4 de dano e puxe o alvo 4 metros em sua direção.", icon: "waterfall.svg" },
    { nome: "Onda Açoitante", duracao: "Instantânea", alcance: "Adjacente", descricao: "Uma onda surge de suas mãos, atingindo todas as criaturas em uma area de 4x4m imediatamente a sua frente. Cada alvo será empurrado 6 metros e sofrerá 2 de dano.", icon: "waterfall.svg" }
  ],

  "Caminho da Natureza": [
    { nome: "Espinhos Ascendentes", duracao: "Instantâneo", alcance: "10 Metros", descricao: "Você faz espinhos crescerem do solo em uma área de 8x8 metros. Criaturas que se moverem na área sofrem 1 de dano a cada 2 metros percorridos na área.", icon: "trap.svg" },
    { nome: "Ramos Protetores", duracao: "Manutenção", alcance: "6 Metros", descricao: "Escolha como alvo você ou uma criatura aliada. Ramos envolvem o alvo. Ataques contra o alvo são Difíceis (-2) enquanto a conjuração for mantida.", icon: "oak.svg" },
    { nome: "Chamado da Vida", duracao: "Instantâneo", alcance: "Toque", descricao: "Você invoca a energia vital da natureza para curar uma criatura. Restaure 3 pontos de vitalidade.", icon: "heal.svg" },
    { nome: "Sementes da Decadência", duracao: "Instantâneo", alcance: "6 Metros", descricao: "Escolha uma criatura. Esporos venenosos a envolvem. Cause 2 de dano e o alvo tem todas as suas rolagens consideradas Difíceis até o final dessa rodada.", icon: "poison.svg" },
    { nome: "Vinha Aprisionadora", duracao: "Instantâneo", alcance: "10 Metros", descricao: "Uma vinha surge e prende uma criatura. O alvo fica Imobilizado. O alvo pode, no seu respectivo turno, usar 1 manobra de combate para realizar um teste de Força para tentar sair da condição.", icon: "net.svg" },
    { nome: "Raízes Curativas", duracao: "Instantâneo", alcance: "6 Metros", descricao: "Raízes emergem de um ponto no solo para restaurar 2 pontos de vitalidade a todas as criaturas aliadas adjacentes ao ponto.", icon: "regen.svg" },
    { nome: "Chamado da Matilha", duracao: "Manutenção", alcance: "Pessoal", descricao: "Você invoca espíritos de lobos que atacam qualquer alvo que inicie seu turno adjacente a você. O alvo sofre d4 de dano automaticamente.", icon: "pawprint.svg" },
    { nome: "Escudo de Raízes", duracao: "Manutenção", alcance: "Pessoal", descricao: "Você conjura um escudo feito de raízes magicas com o qual você se torna proficiente e pode ser usado mesmo que empunhado armas de 2 mãos. O escudo possui 4 de Durabilidade.", icon: "mage-shield.svg" },
    { nome: "Urro Primitivo", duracao: "Rodada", alcance: "6 Metros", descricao: "Você invoca um urro de uma fera ancestral. Todas as criaturas inimigas em alcance não podem se aproximar de você voluntariamente até o fim dessa rodada.", icon: "terror.svg" },
    { nome: "Flecha da Natureza", duracao: "Instantânea", alcance: "Pessoal", descricao: "Você pode envolver um projetil com energia natural. Ao atingir um inimigo, causa 1d4 de dano adicional.", icon: "target.svg" }
  ],

  "Caminho da Mente": [
    { nome: "Ferimento Mental", duracao: "Instantâneo", alcance: "6 metros", descricao: "Uma onda de energia invade a mente de uma criatura. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, o alvo perde d4 pontos de vitalidade.", icon: "daze.svg" },
    { nome: "Ilusão Perturbadora", duracao: "Instantâneo", alcance: "4 metros", descricao: "Você cria uma ilusão perturbadora na mente do inimigo. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, todas as rolagens do alvo são Difíceis até o fim da rodada.", icon: "blind.svg" },
    { nome: "Domínio da Vontade", duracao: "Instantâneo", alcance: "4 metros", descricao: "Você tenta controlar a mente de uma criatura inimiga, forçando-a a agir de acordo com a sua vontade. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, ele ficará submisso e controlado por você durante essa rodada, realizando as manobras Atacar e Movimentar conforme sua vontade.", icon: "mystery-man.svg" },
    { nome: "Confusão Mental", duracao: "Instantâneo", alcance: "6 metros", descricao: "Você lança uma onda de confusão na mente do inimigo. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, o alvo perde 1 manobra de combate nessa rodada.", icon: "stoned.svg" },
    { nome: "Inibição", duracao: "Instantâneo", alcance: "6 metros", descricao: "O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, o alvo não pode usar nenhuma de suas habilidades até o fim da próxima rodada.", icon: "silenced.svg" },
    { nome: "Troca de Aliados", duracao: "Manutenção", alcance: "6 metros", descricao: "Você semeia uma ideia de revolta interna na mente do inimigo. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, ele passa a ver ser aliados como inimigos e vice versa.", icon: "mystery-man-black.svg" },
    { nome: "Fragmentação Mental", duracao: "Instantâneo", alcance: "3 metros", descricao: "O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, todo o dano causado pelo alvo é reduzido em 2 até o final dessa rodada.", icon: "degen.svg" },
    { nome: "Verdade Absoluta", duracao: "Instantâneo", alcance: "Adjacente", descricao: "Você toca uma criatura inibindo sua capacidade de mentir sobre qualquer assunto. O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, durante 5 minutos ele só consegue falar a verdade.", icon: "eye.svg" },
    { nome: "Falha Forçada", duracao: "Instantâneo", alcance: "9 metros", descricao: "Se um alvo que você possa ver dentro do alcance iria realizar um teste de atributo, você pode força-lo a fazer um teste de Mente ao invés do atributo original que era exigido no teste em questão.", icon: "downgrade.svg" },
    { nome: "Bloqueio da Mente", duracao: "Instantâneo", alcance: "6 metros", descricao: "O alvo deve ser bem sucedido em um teste de Mente. Em caso de falha, sua mente fica totalmente bloqueada, o impedindo de realizar qualquer tipo de ação. O alvo fica com a condição de Imobilizado e apenas pode usar suas manobras de combate apenas para fazer testes de Mente e tentar interromper o efeito.", icon: "paralysis.svg" }
  ]
};

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;

function escreverPasta(caminho) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!folders!${id}`,
    name: caminho,
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
  fs.writeFileSync(path.join(OUT_DIR, `_pasta-${slugify(caminho)}.json`), JSON.stringify(doc, null, 2) + "\n");
  return id;
}

function escrever(caminho, dados, pastaId) {
  const id = randomId();
  const doc = {
    _id: id,
    _key: `!items!${id}`,
    name: dados.nome,
    type: "magia",
    img: `icons/svg/${dados.icon}`,
    system: {
      caminho,
      duracao: dados.duracao,
      alcance: dados.alcance,
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
  fs.writeFileSync(path.join(OUT_DIR, `${slugify(caminho)}-${slugify(dados.nome)}.json`), JSON.stringify(doc, null, 2) + "\n");
  total++;
}

for (const [caminho, lista] of Object.entries(CONJURACOES_POR_CAMINHO)) {
  const pastaId = escreverPasta(caminho);
  for (const conjuracao of lista) escrever(caminho, conjuracao, pastaId);
}

console.log(`Gerados ${total} itens + ${Object.keys(CONJURACOES_POR_CAMINHO).length} pastas em ${OUT_DIR}`);
