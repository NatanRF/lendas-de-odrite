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

ODRITE.tiposAtaque = {
  corpoACorpo: "ODRITE.TipoAtaque.CorpoACorpo",
  distancia: "ODRITE.TipoAtaque.Distancia"
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

ODRITE.classes = ["Guerreiro", "Caçador", "Assassino", "Canalisador", "Combatente Sagrado"];

ODRITE.empunhaduras = ["1 mão", "2 mãos", "1 ou 2 mãos"];

ODRITE.categoriasHabilidade = {
  basica: "ODRITE.CategoriaHabilidade.Basica",
  lista: "ODRITE.CategoriaHabilidade.Lista"
};

ODRITE.fontesArcanas = ["Bênção Divina", "Pacto Amaldiçoado"];

ODRITE.caminhosConjuracao = ["Caminho da Vida", "Caminho da Guerra", "Caminho Elemental", "Caminho da Natureza", "Caminho da Mente"];
