export const ODRITE = {};

ODRITE.atributos = {
  forca: "ODRITE.Atributo.Forca",
  agilidade: "ODRITE.Atributo.Agilidade",
  resistencia: "ODRITE.Atributo.Resistencia",
  influencia: "ODRITE.Atributo.Influencia",
  mente: "ODRITE.Atributo.Mente",
  sentidos: "ODRITE.Atributo.Sentidos",
  habilidade: "ODRITE.Atributo.Habilidade",
  conjuracao: "ODRITE.Atributo.Conjuracao"
};

/**
 * Tamanho do dado de treinamento de armas por nível (1 a 5).
 * Nível 1 = d12 (mais difícil), nível 5 = d4 (mais fácil de tirar 1).
 */
ODRITE.dadoTreinamentoPorNivel = {
  1: 12,
  2: 10,
  3: 8,
  4: 6,
  5: 4
};

ODRITE.dadoRefinamentoMagia = 6;

ODRITE.duracoesMagia = {
  instantaneo: "ODRITE.Magia.DuracaoInstantaneo",
  rodada: "ODRITE.Magia.DuracaoRodada",
  manutencao: "ODRITE.Magia.DuracaoManutencao"
};

ODRITE.tiposAtaque = {
  corpoACorpo: "ODRITE.TipoAtaque.CorpoACorpo",
  distancia: "ODRITE.TipoAtaque.Distancia"
};

// Manobras que uma habilidade pode conceder "sem contabilizar em suas
// Manobras de Combate". "qualquer" cobre qualquer manobra.
ODRITE.acoesLivres = {
  qualquer: "ODRITE.AcaoLivre.qualquer",
  atacar: "ODRITE.AcaoLivre.atacar",
  conjurar: "ODRITE.AcaoLivre.conjurar",
  esquivar: "ODRITE.AcaoLivre.esquivar",
  aparar: "ODRITE.AcaoLivre.aparar",
  bloquear: "ODRITE.AcaoLivre.bloquear",
  mitigar: "ODRITE.AcaoLivre.mitigar",
  recarregar: "ODRITE.AcaoLivre.recarregar",
  movimentar: "ODRITE.AcaoLivre.movimentar"
};

// Condições do livro que têm efeito mecânico próprio, além do modificador
// numérico comum a qualquer Condição.
ODRITE.condicoesNomeadas = {
  sangrando: "ODRITE.Condicao.Nomeada.Sangrando",
  caido: "ODRITE.Condicao.Nomeada.Caido",
  envenenado: "ODRITE.Condicao.Nomeada.Envenenado",
  imobilizado: "ODRITE.Condicao.Nomeada.Imobilizado"
};

ODRITE.atributoPorTipoAtaque = {
  corpoACorpo: "forca",
  distancia: "agilidade"
};

ODRITE.tiposHabilidade = {
  passiva: "ODRITE.TipoHabilidade.Passiva",
  ativa: "ODRITE.TipoHabilidade.Ativa",
  conjuracao: "ODRITE.TipoHabilidade.Conjuracao"
};

ODRITE.racas = ["Humano", "Nitz", "Rhundrak", "Draenir", "Elster"];

ODRITE.classes = ["Guerreiro", "Caçador", "Assassino", "Canalizador", "Combatente Sagrado"];

ODRITE.empunhaduras = ["1 mão", "2 mãos", "1 ou 2 mãos"];

ODRITE.categoriasHabilidade = {
  basica: "ODRITE.CategoriaHabilidade.Basica",
  lista: "ODRITE.CategoriaHabilidade.Lista"
};

ODRITE.fontesArcanas = ["Bênção Divina", "Pacto Amaldiçoado"];

ODRITE.caminhosConjuracao = ["Caminho da Vida", "Caminho da Guerra", "Caminho Elemental", "Caminho da Natureza", "Caminho da Mente"];

ODRITE.categoriasArma = ["Adagas", "Espadas", "Machados", "Lanças", "Maças", "Martelos", "Foices", "Bastões", "Arcos", "Bestas"];

/**
 * Dados mecânicos por raça, usados pelo assistente de criação de personagem.
 * bonusAtributo: "qualquer" ou lista de chaves de atributo permitidas para o bônus +1.
 */
ODRITE.dadosRacas = {
  Humano: {
    tamanho: "Padrão",
    vitalidade: 5,
    deslocamento: 10,
    bonusAtributo: "qualquer",
    idiomaRacial: null,
    idiomaLimiarMente: 10,
    nivelTreinamentoInicial: 2,
    listaExtra: 1
  },
  Nitz: {
    tamanho: "Pequeno",
    vitalidade: 3,
    deslocamento: 12,
    bonusAtributo: ["agilidade", "conjuracao"],
    idiomaRacial: "Nitz",
    idiomaLimiarMente: 8
  },
  Rhundrak: {
    tamanho: "Padrão",
    vitalidade: 6,
    deslocamento: 14,
    bonusAtributo: ["sentidos", "agilidade"],
    idiomaRacial: "Rhundrak",
    idiomaLimiarMente: 12
  },
  Draenir: {
    tamanho: "Padrão",
    vitalidade: 7,
    deslocamento: 10,
    bonusAtributo: ["resistencia", "influencia"],
    idiomaRacial: "Draenir",
    idiomaLimiarMente: 9
  },
  Elster: {
    tamanho: "Padrão",
    vitalidade: 4,
    deslocamento: 12,
    bonusAtributo: ["agilidade", "mente"],
    idiomaRacial: "Elster",
    idiomaLimiarMente: 11
  }
};

/**
 * Dados mecânicos por classe, usados pelo assistente de criação de personagem.
 * armaduras: "todas" ou lista de tiers (Leve/Média/Pesada).
 * escudos: "todos" ou lista de tiers (Pequeno/Médio/Grande).
 */
ODRITE.dadosClasses = {
  Guerreiro: { conjuradora: false, vitalidade: 6, categoriasArma: 3, armaduras: "todas", escudos: "todos", atributoPrincipal: ["forca", "resistencia"] },
  "Caçador": { conjuradora: false, vitalidade: 5, categoriasArma: 3, armaduras: ["Leve", "Média"], escudos: [], atributoPrincipal: ["agilidade", "sentidos"] },
  Assassino: { conjuradora: false, vitalidade: 4, categoriasArma: 3, armaduras: ["Leve"], escudos: ["Pequeno"], atributoPrincipal: ["agilidade", "influencia"] },
  Canalizador: { conjuradora: true, vitalidade: 3, categoriasArma: 1, armaduras: ["Leve"], escudos: ["Pequeno"], atributoPrincipal: ["conjuracao", "mente"] },
  "Combatente Sagrado": { conjuradora: true, vitalidade: 7, categoriasArma: 2, armaduras: "todas", escudos: "todos", fonteArcanaFixa: "Bênção Divina", atributoPrincipal: ["conjuracao", "resistencia"] }
};

/**
 * Devoção do Combatente Sagrado, que só conjura pela Bênção Divina. Cada deus
 * determina o(s) Caminho(s) de Conjuração disponíveis (`caminhos: null` deixa
 * o jogador escolher 1 livremente) e concede um benefício próprio.
 */
ODRITE.devocoes = {
  Vimera: { caminhos: ["Caminho da Vida"], beneficio: "curaAdicional" },
  Zerlios: { caminhos: ["Caminho da Guerra"], beneficio: "todasCategoriasArma" },
  Kaerys: { caminhos: null, beneficio: "bonusTesteConjuracao" }
};

/** Devoções agrupadas pelo benefício, para consulta rápida nas regras. */
ODRITE.devocaoPorBeneficio = Object.fromEntries(
  Object.entries(ODRITE.devocoes).map(([deus, dados]) => [dados.beneficio, deus])
);
