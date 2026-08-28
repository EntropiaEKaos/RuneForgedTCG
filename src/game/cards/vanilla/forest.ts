import type { CardDef } from "../../types";

export const VANILLA_FLORESTIA_CARDS: Record<string, CardDef> = {
  van_forest_u01: {
    "defId": "van_forest_u01",
    "name": "Filhote da Matilha",
    "region": "Florestia",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Besta",
    "keywords": [],
    "description": "Besta. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u02: {
    "defId": "van_forest_u02",
    "name": "Farejador Lunar",
    "region": "Florestia",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Beast",
    "keywords": [
      "Regeneration"
    ],
    "description": "Beast. Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u03: {
    "defId": "van_forest_u03",
    "name": "Lince do Capim Alto",
    "region": "Florestia",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Challenger",
      "Haste"
    ],
    "description": "Spirit. Challenger; Haste. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u04: {
    "defId": "van_forest_u04",
    "name": "Caçadora da Alcateia",
    "region": "Florestia",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Besta",
    "keywords": [],
    "description": "Besta. Uma nova peça da coleção Vanilla. Ao entrar: Aliados recebem +1/+0.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffAllies",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 0,
        "target": "none"
      }
    }
  },
  van_forest_u05: {
    "defId": "van_forest_u05",
    "name": "Javali de Casca",
    "region": "Florestia",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Beast",
    "keywords": [
      "Haste"
    ],
    "description": "Beast. Haste. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u06: {
    "defId": "van_forest_u06",
    "name": "Guardião das Presas",
    "region": "Florestia",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Spirit",
    "keywords": [],
    "description": "Spirit. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u07: {
    "defId": "van_forest_u07",
    "name": "Puma da Aurora",
    "region": "Florestia",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Besta",
    "keywords": [],
    "description": "Besta. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u08: {
    "defId": "van_forest_u08",
    "name": "Xamã da Matilha",
    "region": "Florestia",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Beast",
    "keywords": [
      "Challenger"
    ],
    "description": "Beast. Challenger. Uma nova peça da coleção Vanilla. Ao entrar: Cure 1 de uma unidade aliada.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "healUnit",
        "amount": 1,
        "target": "allyUnit"
      }
    }
  },
  van_forest_u09: {
    "defId": "van_forest_u09",
    "name": "Urso da Lua Cheia",
    "region": "Florestia",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Spirit",
    "keywords": [],
    "description": "Spirit. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u10: {
    "defId": "van_forest_u10",
    "name": "Predador de Espinhos",
    "region": "Florestia",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Besta",
    "keywords": [],
    "description": "Besta. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u11: {
    "defId": "van_forest_u11",
    "name": "Alfa da Clareira",
    "region": "Florestia",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Beast",
    "keywords": [
      "Reach"
    ],
    "description": "Beast. Reach. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u12: {
    "defId": "van_forest_u12",
    "name": "Cervo de Guerra",
    "region": "Florestia",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Spirit",
    "keywords": [],
    "description": "Spirit. Uma nova peça da coleção Vanilla. Ao entrar: Besta recebem +1/+1.",
    "rarity": "Common",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffRace",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 1,
        "target": "none",
        "race": "Besta"
      }
    }
  },
  van_forest_u13: {
    "defId": "van_forest_u13",
    "name": "Fera do Vale Antigo",
    "region": "Florestia",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Besta",
    "keywords": [
      "Challenger",
      "Haste"
    ],
    "description": "Besta. Challenger; Haste. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u14: {
    "defId": "van_forest_u14",
    "name": "Matriarca das Presas",
    "region": "Florestia",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Beast",
    "keywords": [
      "Tough"
    ],
    "description": "Beast. Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u15: {
    "defId": "van_forest_u15",
    "name": "Grande Lobo Dourado",
    "region": "Florestia",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Spirit",
    "keywords": [],
    "description": "Spirit. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u16: {
    "defId": "van_forest_u16",
    "name": "Titã da Selva",
    "region": "Florestia",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Besta",
    "keywords": [],
    "description": "Besta. Uma nova peça da coleção Vanilla. Ao entrar: Conceda Reach a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "grantKeyword",
        "amount": 0,
        "target": "none",
        "keyword": "Reach"
      }
    }
  },
  van_forest_u17: {
    "defId": "van_forest_u17",
    "name": "Arauto da Caçada",
    "region": "Florestia",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Beast",
    "keywords": [
      "Regeneration"
    ],
    "description": "Beast. Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_u18: {
    "defId": "van_forest_u18",
    "name": "Lyka, Mãe da Matilha",
    "region": "Florestia",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Spirit",
    "keywords": [
      "Challenger",
      "Haste"
    ],
    "description": "Lenda Vanilla. Spirit. Challenger; Haste. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🐺",
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "isLegend": true
  },
  van_forest_s01: {
    "defId": "van_forest_s01",
    "name": "Uivo de União",
    "region": "Florestia",
    "type": "Spell",
    "cost": 1,
    "description": "Conceda +2/+1 a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🐺",
    "spell": {
      "kind": "buffUnit",
      "amount": 0,
      "buffPower": 2,
      "buffHealth": 1,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_s02: {
    "defId": "van_forest_s02",
    "name": "Salto Predador",
    "region": "Florestia",
    "type": "Spell",
    "cost": 2,
    "description": "Cause 2 de dano a uma unidade.",
    "rarity": "Rare",
    "emoji": "🐺",
    "spell": {
      "kind": "damageUnit",
      "amount": 2,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "speed": "Burst"
  },
  van_forest_s03: {
    "defId": "van_forest_s03",
    "name": "Pele da Matilha",
    "region": "Florestia",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda Reach a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🐺",
    "spell": {
      "kind": "grantKeyword",
      "amount": 0,
      "target": "allyUnit",
      "keyword": "Reach"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "speed": "Burst"
  },
  van_forest_s04: {
    "defId": "van_forest_s04",
    "name": "Emboscada Verde",
    "region": "Florestia",
    "type": "Spell",
    "cost": 3,
    "description": "Atordoe uma unidade inimiga.",
    "rarity": "Epic",
    "emoji": "🐺",
    "spell": {
      "kind": "stun",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_s05: {
    "defId": "van_forest_s05",
    "name": "Lua Revigorante",
    "region": "Florestia",
    "type": "Spell",
    "cost": 4,
    "description": "Cure 4 do seu Nexus.",
    "rarity": "Epic",
    "emoji": "🐺",
    "spell": {
      "kind": "healNexus",
      "amount": 4,
      "target": "none"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_s06: {
    "defId": "van_forest_s06",
    "name": "Caçada Implacável",
    "region": "Florestia",
    "type": "Spell",
    "cost": 4,
    "description": "Aliados recebem +1/+1.",
    "rarity": "Epic",
    "emoji": "🐺",
    "spell": {
      "kind": "buffAllies",
      "amount": 0,
      "buffPower": 1,
      "buffHealth": 1,
      "target": "none"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_s07: {
    "defId": "van_forest_s07",
    "name": "Chamado Ancestral",
    "region": "Florestia",
    "type": "Spell",
    "cost": 5,
    "description": "Compre 2 carta(s).",
    "rarity": "Epic",
    "emoji": "🐺",
    "spell": {
      "kind": "draw",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_s08: {
    "defId": "van_forest_s08",
    "name": "Fúria da Alcateia",
    "region": "Florestia",
    "type": "Spell",
    "cost": 7,
    "description": "Besta recebem +2/+2.",
    "rarity": "Epic",
    "emoji": "🐺",
    "spell": {
      "kind": "buffRace",
      "amount": 0,
      "buffPower": 2,
      "buffHealth": 2,
      "target": "none",
      "race": "Besta"
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_e01: {
    "defId": "van_forest_e01",
    "name": "Toca da Lua Dourada",
    "region": "Florestia",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: Aliados recebem +1/+0.",
    "rarity": "Epic",
    "emoji": "🐺",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "buffAllies",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 0,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
  van_forest_e02: {
    "defId": "van_forest_e02",
    "name": "Pedra da Matilha",
    "region": "Florestia",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Aliados recebem +1/+1.",
    "rarity": "Legend",
    "emoji": "🐺",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "buffAllies",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "florestia_tribal"
    ],
    "isLegend": true
  },
  van_forest_a01: {
    "defId": "van_forest_a01",
    "name": "Totem das Presas",
    "region": "Florestia",
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
      "florestia_tribal"
    ]
  },
  van_forest_q01: {
    "defId": "van_forest_q01",
    "name": "Lança do Alfa",
    "region": "Florestia",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e Reach.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "Reach"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "florestia_tribal"
    ]
  },
};
