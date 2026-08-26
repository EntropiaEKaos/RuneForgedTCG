import type { CardDef } from "../../types";

export const VANILLA_EMBERHOLD_CARDS: Record<string, CardDef> = {
  van_ember_u01: {
    "defId": "van_ember_u01",
    "name": "Faísca da Forja",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Dragon",
    "keywords": [],
    "description": "Dragon. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u02: {
    "defId": "van_ember_u02",
    "name": "Escudeiro das Cinzas",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Warrior",
    "keywords": [
      "Overwhelm"
    ],
    "description": "Warrior. Overwhelm. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u03: {
    "defId": "van_ember_u03",
    "name": "Draco de Brasa",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Elemental",
    "keywords": [
      "Haste",
      "Tough"
    ],
    "description": "Elemental. Haste; Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u04: {
    "defId": "van_ember_u04",
    "name": "Batedor do Crisol",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Dragon",
    "keywords": [],
    "description": "Dragon. Uma nova peça da coleção Vanilla. Ao entrar: Cause 1 de dano ao Nexus inimigo.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "damageNexus",
        "amount": 1,
        "target": "none"
      }
    }
  },
  van_ember_u05: {
    "defId": "van_ember_u05",
    "name": "Guerreiro Rubro",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Warrior",
    "keywords": [
      "Tough"
    ],
    "description": "Warrior. Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u06: {
    "defId": "van_ember_u06",
    "name": "Elemental da Bigorna",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u07: {
    "defId": "van_ember_u07",
    "name": "Caçador de Escória",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Dragon",
    "keywords": [],
    "description": "Dragon. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u08: {
    "defId": "van_ember_u08",
    "name": "Cavaleiro da Chama",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Warrior",
    "keywords": [
      "Haste"
    ],
    "description": "Warrior. Haste. Uma nova peça da coleção Vanilla. Ao entrar: Receba +1/+0.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffSelf",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 0,
        "target": "self"
      }
    }
  },
  van_ember_u09: {
    "defId": "van_ember_u09",
    "name": "Draco Fuliginoso",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u10: {
    "defId": "van_ember_u10",
    "name": "Mestre do Fole",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Dragon",
    "keywords": [],
    "description": "Dragon. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u11: {
    "defId": "van_ember_u11",
    "name": "Vanguarda Incandescente",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Warrior",
    "keywords": [
      "QuickAttack"
    ],
    "description": "Warrior. QuickAttack. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u12: {
    "defId": "van_ember_u12",
    "name": "Guardião do Magma",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla. Ao entrar: Elemental recebem +1/+0.",
    "rarity": "Common",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffRace",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 0,
        "target": "none",
        "race": "Elemental"
      }
    }
  },
  van_ember_u13: {
    "defId": "van_ember_u13",
    "name": "Campeão da Bigorna",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Dragon",
    "keywords": [
      "Haste",
      "Tough"
    ],
    "description": "Dragon. Haste; Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u14: {
    "defId": "van_ember_u14",
    "name": "Dragão da Caldeira",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Warrior",
    "keywords": [
      "Challenger"
    ],
    "description": "Warrior. Challenger. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u15: {
    "defId": "van_ember_u15",
    "name": "General da Forja",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u16: {
    "defId": "van_ember_u16",
    "name": "Colosso de Obsidiana",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Dragon",
    "keywords": [],
    "description": "Dragon. Uma nova peça da coleção Vanilla. Ao entrar: Cause 1 de dano a uma unidade.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "damageUnit",
        "amount": 1,
        "target": "enemyUnit"
      }
    }
  },
  van_ember_u17: {
    "defId": "van_ember_u17",
    "name": "Arauto do Sol Rubro",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Warrior",
    "keywords": [
      "Overwhelm"
    ],
    "description": "Warrior. Overwhelm. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_u18: {
    "defId": "van_ember_u18",
    "name": "Asterion, Coração da Forja",
    "region": "Emberhold",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Elemental",
    "keywords": [
      "Haste",
      "Tough"
    ],
    "description": "Lenda Vanilla. Elemental. Haste; Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🔥",
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "isLegend": true
  },
  van_ember_s01: {
    "defId": "van_ember_s01",
    "name": "Estalo Ígneo",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 1,
    "description": "Cause 2 de dano a uma unidade.",
    "rarity": "Rare",
    "emoji": "🔥",
    "spell": {
      "kind": "damageUnit",
      "amount": 2,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_s02: {
    "defId": "van_ember_s02",
    "name": "Investida de Brasas",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 2,
    "description": "Cause 2 de dano ao Nexus inimigo.",
    "rarity": "Rare",
    "emoji": "🔥",
    "spell": {
      "kind": "damageNexus",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "speed": "Burst"
  },
  van_ember_s03: {
    "defId": "van_ember_s03",
    "name": "Martelo Flamejante",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda +2/+0 a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🔥",
    "spell": {
      "kind": "buffUnit",
      "amount": 0,
      "buffPower": 2,
      "buffHealth": 0,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ],
    "speed": "Burst"
  },
  van_ember_s04: {
    "defId": "van_ember_s04",
    "name": "Chuva de Escória",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 3,
    "description": "Atordoe uma unidade inimiga.",
    "rarity": "Epic",
    "emoji": "🔥",
    "spell": {
      "kind": "stun",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_s05: {
    "defId": "van_ember_s05",
    "name": "Ruptura Vulcânica",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 4,
    "description": "Cause 1 de dano a todas as unidades inimigas.",
    "rarity": "Epic",
    "emoji": "🔥",
    "spell": {
      "kind": "aoeEnemy",
      "amount": 1,
      "target": "none"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_s06: {
    "defId": "van_ember_s06",
    "name": "Juramento da Forja",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 4,
    "description": "Conceda Overwhelm a uma unidade aliada.",
    "rarity": "Epic",
    "emoji": "🔥",
    "spell": {
      "kind": "grantKeyword",
      "amount": 0,
      "target": "allyUnit",
      "keyword": "Overwhelm"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_s07: {
    "defId": "van_ember_s07",
    "name": "Fúria do Crisol",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 5,
    "description": "Cause 5 de dano a uma unidade.",
    "rarity": "Epic",
    "emoji": "🔥",
    "spell": {
      "kind": "damageUnit",
      "amount": 5,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_s08: {
    "defId": "van_ember_s08",
    "name": "Apocalipse de Cinzas",
    "region": "Emberhold",
    "type": "Spell",
    "cost": 7,
    "description": "Cause 6 de dano ao Nexus inimigo.",
    "rarity": "Epic",
    "emoji": "🔥",
    "spell": {
      "kind": "damageNexus",
      "amount": 6,
      "target": "none"
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_e01: {
    "defId": "van_ember_e01",
    "name": "Câmara das Brasas",
    "region": "Emberhold",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: Cause 1 de dano ao Nexus inimigo.",
    "rarity": "Epic",
    "emoji": "🔥",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "damageNexus",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
  van_ember_e02: {
    "defId": "van_ember_e02",
    "name": "Trono do Vulcão",
    "region": "Emberhold",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Aliados recebem +1/+1.",
    "rarity": "Legend",
    "emoji": "🔥",
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
      "ember_aggro"
    ],
    "isLegend": true
  },
  van_ember_a01: {
    "defId": "van_ember_a01",
    "name": "Coração da Bigorna",
    "region": "Emberhold",
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
      "ember_aggro"
    ]
  },
  van_ember_q01: {
    "defId": "van_ember_q01",
    "name": "Lâmina da Primeira Chama",
    "region": "Emberhold",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e QuickAttack.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "QuickAttack"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "ember_aggro"
    ]
  },
};
