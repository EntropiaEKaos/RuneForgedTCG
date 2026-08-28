import type { CardDef } from "../../types";

export const VANILLA_TIDECALL_CARDS: Record<string, CardDef> = {
  van_tide_u01: {
    "defId": "van_tide_u01",
    "name": "Náiade da Orla",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Sprite",
    "keywords": [],
    "description": "Sprite. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u02: {
    "defId": "van_tide_u02",
    "name": "Vigia das Marés",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Spirit",
    "keywords": [
      "Barrier"
    ],
    "description": "Spirit. Barrier. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u03: {
    "defId": "van_tide_u03",
    "name": "Sprite de Espuma",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Elemental",
    "keywords": [
      "Lifesteal",
      "Regeneration"
    ],
    "description": "Elemental. Lifesteal; Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u04: {
    "defId": "van_tide_u04",
    "name": "Místico do Estuário",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Sprite",
    "keywords": [],
    "description": "Sprite. Uma nova peça da coleção Vanilla. Ao entrar: Compre 1 carta(s).",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "draw",
        "amount": 1,
        "target": "none"
      }
    }
  },
  van_tide_u05: {
    "defId": "van_tide_u05",
    "name": "Guardião Coralino",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Regeneration"
    ],
    "description": "Spirit. Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u06: {
    "defId": "van_tide_u06",
    "name": "Espírito da Enseada",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u07: {
    "defId": "van_tide_u07",
    "name": "Tecelã de Névoa",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Sprite",
    "keywords": [],
    "description": "Sprite. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u08: {
    "defId": "van_tide_u08",
    "name": "Oráculo Abissal",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Lifesteal"
    ],
    "description": "Spirit. Lifesteal. Uma nova peça da coleção Vanilla. Ao entrar: Cure 2 do seu Nexus.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "healNexus",
        "amount": 2,
        "target": "none"
      }
    }
  },
  van_tide_u09: {
    "defId": "van_tide_u09",
    "name": "Cavaleiro da Corrente",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u10: {
    "defId": "van_tide_u10",
    "name": "Protetor da Laguna",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Sprite",
    "keywords": [],
    "description": "Sprite. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u11: {
    "defId": "van_tide_u11",
    "name": "Cantora das Profundezas",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Spirit",
    "keywords": [
      "Elusive"
    ],
    "description": "Spirit. Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u12: {
    "defId": "van_tide_u12",
    "name": "Sentinela da Maré Alta",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla. Ao entrar: Conceda Barreira a uma unidade aliada.",
    "rarity": "Common",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "grantBarrier",
        "amount": 0,
        "target": "none"
      }
    }
  },
  van_tide_u13: {
    "defId": "van_tide_u13",
    "name": "Arconte das Águas",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Sprite",
    "keywords": [
      "Lifesteal",
      "Regeneration"
    ],
    "description": "Sprite. Lifesteal; Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u14: {
    "defId": "van_tide_u14",
    "name": "Leviatã de Cristal",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Spirit",
    "keywords": [
      "Hexproof"
    ],
    "description": "Spirit. Hexproof. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u15: {
    "defId": "van_tide_u15",
    "name": "Sábio das Nove Correntes",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u16: {
    "defId": "van_tide_u16",
    "name": "Guardião do Horizonte Azul",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Sprite",
    "keywords": [],
    "description": "Sprite. Uma nova peça da coleção Vanilla. Ao entrar: Cure 2 de uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "healUnit",
        "amount": 2,
        "target": "allyUnit"
      }
    }
  },
  van_tide_u17: {
    "defId": "van_tide_u17",
    "name": "Arauto do Dilúvio",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Spirit",
    "keywords": [
      "Barrier"
    ],
    "description": "Spirit. Barrier. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_u18: {
    "defId": "van_tide_u18",
    "name": "Nerissa, Voz do Oceano",
    "region": "Tidecall",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Elemental",
    "keywords": [
      "Lifesteal",
      "Regeneration"
    ],
    "description": "Lenda Vanilla. Elemental. Lifesteal; Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌊",
    "doctrineAffinities": [
      "tide_control"
    ],
    "isLegend": true
  },
  van_tide_s01: {
    "defId": "van_tide_s01",
    "name": "Gota Restauradora",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 1,
    "description": "Cure 3 de uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌊",
    "spell": {
      "kind": "healUnit",
      "amount": 3,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_s02: {
    "defId": "van_tide_s02",
    "name": "Corrente de Retorno",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 2,
    "description": "Retorne uma unidade para a mão.",
    "rarity": "Rare",
    "emoji": "🌊",
    "spell": {
      "kind": "recall",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tide_control"
    ],
    "speed": "Burst"
  },
  van_tide_s03: {
    "defId": "van_tide_s03",
    "name": "Bruma Protetora",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda Barreira a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌊",
    "spell": {
      "kind": "grantBarrier",
      "amount": 0,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "tide_control"
    ],
    "speed": "Burst"
  },
  van_tide_s04: {
    "defId": "van_tide_s04",
    "name": "Visão da Maré",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 3,
    "description": "Compre 2 carta(s).",
    "rarity": "Epic",
    "emoji": "🌊",
    "spell": {
      "kind": "draw",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_s05: {
    "defId": "van_tide_s05",
    "name": "Prisão de Gelo",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 4,
    "description": "Congele uma unidade inimiga.",
    "rarity": "Epic",
    "emoji": "🌊",
    "spell": {
      "kind": "frostbite",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_s06: {
    "defId": "van_tide_s06",
    "name": "Onda Purificadora",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 4,
    "description": "Cure 5 do seu Nexus.",
    "rarity": "Epic",
    "emoji": "🌊",
    "spell": {
      "kind": "healNexus",
      "amount": 5,
      "target": "none"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_s07: {
    "defId": "van_tide_s07",
    "name": "Memória do Abismo",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 5,
    "description": "Compre 3 carta(s).",
    "rarity": "Epic",
    "emoji": "🌊",
    "spell": {
      "kind": "draw",
      "amount": 3,
      "target": "none"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_s08: {
    "defId": "van_tide_s08",
    "name": "Grande Refluxo",
    "region": "Tidecall",
    "type": "Spell",
    "cost": 7,
    "description": "Retorne uma unidade para a mão.",
    "rarity": "Epic",
    "emoji": "🌊",
    "spell": {
      "kind": "recall",
      "amount": 0,
      "target": "anyUnit"
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_e01: {
    "defId": "van_tide_e01",
    "name": "Santuário das Correntes",
    "region": "Tidecall",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: Cure 1 do seu Nexus.",
    "rarity": "Epic",
    "emoji": "🌊",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "healNexus",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_e02: {
    "defId": "van_tide_e02",
    "name": "Farol das Profundezas",
    "region": "Tidecall",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Compre 1 carta(s).",
    "rarity": "Legend",
    "emoji": "🌊",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "draw",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "tide_control"
    ],
    "isLegend": true
  },
  van_tide_a01: {
    "defId": "van_tide_a01",
    "name": "Cálice das Marés",
    "region": "Tidecall",
    "type": "Artifact",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: recupere 1 de mana.",
    "rarity": "Legend",
    "emoji": "💠",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "manaRefund",
        "amount": 1,
        "target": "none"
      }
    },
    "isLegend": true,
    "doctrineAffinities": [
      "tide_control"
    ]
  },
  van_tide_q01: {
    "defId": "van_tide_q01",
    "name": "Tridente da Lua Azul",
    "region": "Tidecall",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e Elusive.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "Elusive"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "tide_control"
    ]
  },
};
