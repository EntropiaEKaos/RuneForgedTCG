import type { CardDef, Region } from "@/game/types";

export interface Puzzle {
  id: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  reward: { gold: number; dust: number; xp: number };
  playerHand: string[];
  playerBench?: string[];
  playerMana: number;
  playerNexus: number;
  aiHand: string[];
  aiBench?: string[];
  aiNexus: number;
  goal: string;
  hint: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: "puzzle_1",
    name: "Golpe Certeiro",
    description: "Elimine o Adversário este turno com dano direto.",
    difficulty: 1,
    reward: { gold: 30, dust: 15, xp: 25 },
    playerHand: ["ember_bolt", "ember_bolt", "ember_face"],
    playerMana: 4,
    playerNexus: 5,
    aiHand: [],
    aiNexus: 6,
    goal: "Reduzir o Nexus inimigo a 0",
    hint: "Combine as duas Cargas Escaldantes + o Rosto Ardente",
  },
  {
    id: "puzzle_2",
    name: "Trade Perfeita",
    description: "Sobreviva à investida da IA e vire o jogo",
    difficulty: 2,
    reward: { gold: 50, dust: 25, xp: 40 },
    playerHand: ["tide_heal", "tide_freeze", "wood_mend"],
    playerBench: ["tide_guard"],
    playerMana: 6,
    playerNexus: 3,
    aiHand: [],
    aiBench: ["ember_zealot", "ember_raider"],
    aiNexus: 20,
    goal: "Sobreviver ao próximo turno",
    hint: "Congele o mais poderoso e cure seu Nexus",
  },
  {
    id: "puzzle_3",
    name: "Champion Rush",
    description: "Level up seu Campeão neste turno",
    difficulty: 3,
    reward: { gold: 80, dust: 40, xp: 60 },
    playerHand: ["ember_bolt", "ember_bolt", "ember_bolt"],
    playerBench: ["ember_champion"],
    playerMana: 10,
    playerNexus: 15,
    aiHand: [],
    aiNexus: 12,
    goal: "Fazer Pyra atingir 8 de dano no Nexus",
    hint: "Cada Carga causa 3 de dano; Pyra também precisa atacar",
  },
];

export interface Boss {
  id: string;
  name: string;
  emoji: string;
  region: Region;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  playerNexusStart: number;
  aiNexusStart: number;
  aiDeck: string[];
  aiStartingBench?: string[];
  reward: { gold: number; dust: number; xp: number; pack?: string };
}

export const BOSSES: Boss[] = [
  {
    id: "boss_infernus",
    name: "Infernus, o Fúria de Ember",
    emoji: "🔥",
    region: "Emberhold",
    difficulty: 2,
    description: "Um dragão ancestral que queima tudo em seu caminho. Começa com um Dragão 5/5 no board.",
    playerNexusStart: 25,
    aiNexusStart: 25,
    aiStartingBench: ["ember_champion"],
    aiDeck: [
      "ember_whelp", "ember_whelp", "ember_whelp", "ember_raider", "ember_raider", "ember_zealot", "ember_zealot",
      "ember_bolt", "ember_bolt", "ember_bolt", "ember_bolt", "ember_face", "ember_face", "ember_sire",
      "ember_hearth", "ember_champion", "ember_dragonfang", "ember_stun", "ember_melt", "ember_shatter",
    ],
    reward: { gold: 150, dust: 75, xp: 100, pack: "epic" },
  },
  {
    id: "boss_leviathan",
    name: "Leviatã das Profundezas",
    emoji: "🌊",
    region: "Tidecall",
    difficulty: 3,
    description: "Um controlador implacável. Neutraliza suas ameaças e recicla o próprio deck.",
    playerNexusStart: 20,
    aiNexusStart: 30,
    aiDeck: [
      "tide_sprite", "tide_sprite", "tide_sprite", "tide_oracle", "tide_oracle", "tide_guard", "tide_guard",
      "tide_freeze", "tide_freeze", "tide_freeze", "tide_draw", "tide_draw", "tide_heal", "tide_heal",
      "tide_mystic", "tide_champion", "tide_deny", "tide_deny", "tide_stun", "tide_recall", "tide_glacial",
    ],
    reward: { gold: 200, dust: 100, xp: 150, pack: "epic" },
  },
  {
    id: "boss_voidlord",
    name: "Mal'zahar, Senhor do Vazio",
    emoji: "💀",
    region: "Voidborn",
    difficulty: 5,
    description: "O Grão-Mestre supremo. Começa com 3 unidades no board e 30 de vida.",
    playerNexusStart: 20,
    aiNexusStart: 30,
    aiStartingBench: ["void_stalker", "void_hexer", "void_champion"],
    aiDeck: [
      "void_imp", "void_imp", "void_hexer", "void_hexer", "void_stalker", "void_stalker",
      "void_drain", "void_drain", "void_drain", "void_barrier", "void_barrier", "void_reaper", "void_reaper",
      "void_whisper", "void_whisper", "void_harvester", "void_champion", "void_unmake", "void_deathmark",
      "void_ghost", "void_siphon",
    ],
    reward: { gold: 500, dust: 250, xp: 300, pack: "legendary" },
  },
];

export interface Encounter {
  id: string;
  chapter: string;
  name: string;
  emoji: string;
  region: Region;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string;
  objective: string;
  opponentDeckId: string;
  playerNexus: number;
  aiNexus: number;
  playerMana?: number;
  aiMana?: number;
  playerHand?: number;
  aiHand?: number;
  aiBench?: string[];
  mutator: { id: string; label: string; description: string };
  reward: { gold: number; dust: number; xp: number; pack?: string };
}

export const ENCOUNTERS: Encounter[] = [
  {
    id: "expedition_ashen_gate", chapter: "I · O PORTÃO EM BRASAS", name: "Cerco do Tirano Cinéreo", emoji: "♨", region: "Emberhold", difficulty: 3,
    description: "Atravesse uma fortaleza que converte qualquer hesitação em dano.", objective: "Estabilize a mesa e destrua o Nexus de 28 pontos.", opponentDeckId: "ember_aggro",
    playerNexus: 24, aiNexus: 28, playerMana: 2, aiMana: 3, playerHand: 5, aiHand: 5, aiBench: ["ember_ashguard"],
    mutator: { id: "heated_start", label: "Calor Ascendente", description: "O inimigo começa com mana adicional e um Guardião das Cinzas." },
    reward: { gold: 220, dust: 90, xp: 160, pack: "rare" },
  },
  {
    id: "expedition_drowned_archive", chapter: "II · O ARQUIVO SUBMERSO", name: "Memória do Leviatã", emoji: "◉", region: "Tidecall", difficulty: 4,
    description: "Uma entidade antiga vence pelo tempo, cura e vantagem de cartas.", objective: "Quebre o ciclo de recursos antes que o Arquivo controle a partida.", opponentDeckId: "tide_control",
    playerNexus: 22, aiNexus: 32, playerMana: 3, aiMana: 3, playerHand: 5, aiHand: 7, aiBench: ["tide_cloudpiercer"],
    mutator: { id: "deep_memory", label: "Memória Profunda", description: "O oponente começa com sete cartas e uma ameaça evasiva." },
    reward: { gold: 320, dust: 140, xp: 220, pack: "epic" },
  },
  {
    id: "expedition_eclipse_hunt", chapter: "III · A CAÇADA DO ECLIPSE", name: "Convergência Predatória", emoji: "☾", region: "Voidborn", difficulty: 5,
    description: "O Vazio e a tempestade convergem numa caçada sem margem para erros.", objective: "Sobreviva à abertura e vença o predador Soberano.", opponentDeckId: "void_shadow",
    playerNexus: 20, aiNexus: 34, playerMana: 4, aiMana: 4, playerHand: 6, aiHand: 6, aiBench: ["void_gloom_warden", "void_stalker"],
    mutator: { id: "eclipse", label: "Eclipse Faminto", description: "O inimigo começa com duas criaturas e usa a política Soberano." },
    reward: { gold: 500, dust: 240, xp: 350, pack: "legendary" },
  },
];

export interface BrawlMode {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rules: {
    startingMana?: number;
    startingHand?: number;
    startingNexus?: number;
    /** Legacy UI compatibility sentinel. This rule is not supported or publishable. */
    spellsOnly?: never;
    /** Legacy UI compatibility sentinel. This rule is not supported or publishable. */
    unitsOnly?: never;
    /** Legacy UI compatibility sentinel. This rule is not supported or publishable. */
    doubleMana?: never;
  };
}

export const BRAWLS: BrawlMode[] = [
  {
    id: "brawl_bigfight",
    name: "Big Fight",
    description: "Comece com 5 de mana e 6 cartas. Combate acelerado!",
    emoji: "⚡",
    rules: { startingMana: 5, startingHand: 6 },
  },
  {
    id: "brawl_glasscannon",
    name: "Glass Cannon",
    description: "Nexus com apenas 10 de vida. Uma partida rápida e brutal.",
    emoji: "💥",
    rules: { startingNexus: 10 },
  },
  {
    id: "brawl_marathon",
    name: "Maratona",
    description: "Nexus com 40 de vida. Prepare-se para uma batalha longa.",
    emoji: "🏃",
    rules: { startingNexus: 40, startingHand: 5 },
  },
];
