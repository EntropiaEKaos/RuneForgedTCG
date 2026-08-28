import type { CardDef } from "../../types";

export const VANILLA_TEMPESTADE_CARDS: Record<string, CardDef> = {
  van_storm_u01: {
    "defId": "van_storm_u01",
    "name": "Faísca Alada",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Tempesteiro",
    "keywords": [],
    "description": "Tempesteiro. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u02: {
    "defId": "van_storm_u02",
    "name": "Mensageiro do Trovão",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Anjo",
    "keywords": [
      "Flying"
    ],
    "description": "Anjo. Flying. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u03: {
    "defId": "van_storm_u03",
    "name": "Tempesteiro Novato",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Elemental",
    "keywords": [
      "QuickAttack",
      "Elusive"
    ],
    "description": "Elemental. QuickAttack; Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u04: {
    "defId": "van_storm_u04",
    "name": "Anjo da Brisa",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Tempesteiro",
    "keywords": [],
    "description": "Tempesteiro. Uma nova peça da coleção Vanilla. Ao entrar: Cause 1 de dano ao Nexus inimigo.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
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
  van_storm_u05: {
    "defId": "van_storm_u05",
    "name": "Corredor Relâmpago",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Anjo",
    "keywords": [
      "Elusive"
    ],
    "description": "Anjo. Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u06: {
    "defId": "van_storm_u06",
    "name": "Elemental de Nuvem",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u07: {
    "defId": "van_storm_u07",
    "name": "Lanceiro Celeste",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Tempesteiro",
    "keywords": [],
    "description": "Tempesteiro. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u08: {
    "defId": "van_storm_u08",
    "name": "Vigia da Tormenta",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Anjo",
    "keywords": [
      "Flying"
    ],
    "description": "Anjo. Flying. Uma nova peça da coleção Vanilla. Ao entrar: Compre 1 carta(s).",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
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
  van_storm_u09: {
    "defId": "van_storm_u09",
    "name": "Serafim do Raio",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u10: {
    "defId": "van_storm_u10",
    "name": "Duelista do Vendaval",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Tempesteiro",
    "keywords": [],
    "description": "Tempesteiro. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u11: {
    "defId": "van_storm_u11",
    "name": "Capitã dos Céus",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Anjo",
    "keywords": [
      "Elusive"
    ],
    "description": "Anjo. Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u12: {
    "defId": "van_storm_u12",
    "name": "Arconte da Centelha",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla. Ao entrar: Receba +1/+0.",
    "rarity": "Common",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
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
  van_storm_u13: {
    "defId": "van_storm_u13",
    "name": "Dragão de Tempestade",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Tempesteiro",
    "keywords": [
      "Haste",
      "QuickAttack"
    ],
    "description": "Tempesteiro. Haste; QuickAttack. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u14: {
    "defId": "van_storm_u14",
    "name": "Guardião do Olho",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Anjo",
    "keywords": [
      "Flying"
    ],
    "description": "Anjo. Flying. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u15: {
    "defId": "van_storm_u15",
    "name": "Mestre do Trovão",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Elemental",
    "keywords": [],
    "description": "Elemental. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u16: {
    "defId": "van_storm_u16",
    "name": "Serafim da Ruptura",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Tempesteiro",
    "keywords": [],
    "description": "Tempesteiro. Uma nova peça da coleção Vanilla. Ao entrar: Conceda Haste a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "grantKeyword",
        "amount": 0,
        "target": "none",
        "keyword": "Haste"
      }
    }
  },
  van_storm_u17: {
    "defId": "van_storm_u17",
    "name": "Arauto do Céu Partido",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Anjo",
    "keywords": [
      "Elusive"
    ],
    "description": "Anjo. Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_u18: {
    "defId": "van_storm_u18",
    "name": "Vaelora, Rainha da Tempestade",
    "region": "Tempestade",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Elemental",
    "keywords": [
      "Barrier",
      "Flying"
    ],
    "description": "Lenda Vanilla. Elemental. Barrier; Flying. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "⚡",
    "doctrineAffinities": [
      "tempestade_rush"
    ],
    "isLegend": true
  },
  van_storm_s01: {
    "defId": "van_storm_s01",
    "name": "Centelha Rápida",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 1,
    "description": "Cause 2 de dano a uma unidade.",
    "rarity": "Rare",
    "emoji": "⚡",
    "spell": {
      "kind": "damageUnit",
      "amount": 2,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_s02: {
    "defId": "van_storm_s02",
    "name": "Rajada Cortante",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 2,
    "description": "Atordoe uma unidade inimiga.",
    "rarity": "Rare",
    "emoji": "⚡",
    "spell": {
      "kind": "stun",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ],
    "speed": "Burst"
  },
  van_storm_s03: {
    "defId": "van_storm_s03",
    "name": "Asas de Relâmpago",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda Flying a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "⚡",
    "spell": {
      "kind": "grantKeyword",
      "amount": 0,
      "target": "allyUnit",
      "keyword": "Flying"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ],
    "speed": "Burst"
  },
  van_storm_s04: {
    "defId": "van_storm_s04",
    "name": "Pulso Trovejante",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 3,
    "description": "Cause 2 de dano ao Nexus inimigo.",
    "rarity": "Epic",
    "emoji": "⚡",
    "spell": {
      "kind": "damageNexus",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_s05: {
    "defId": "van_storm_s05",
    "name": "Vento de Recuo",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 4,
    "description": "Retorne uma unidade para a mão.",
    "rarity": "Epic",
    "emoji": "⚡",
    "spell": {
      "kind": "recall",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_s06: {
    "defId": "van_storm_s06",
    "name": "Prisão Elétrica",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 4,
    "description": "Conceda Barreira a uma unidade aliada.",
    "rarity": "Epic",
    "emoji": "⚡",
    "spell": {
      "kind": "grantBarrier",
      "amount": 0,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_s07: {
    "defId": "van_storm_s07",
    "name": "Tempestade Crescente",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 5,
    "description": "Cause 2 de dano a todas as unidades inimigas.",
    "rarity": "Epic",
    "emoji": "⚡",
    "spell": {
      "kind": "aoeEnemy",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_s08: {
    "defId": "van_storm_s08",
    "name": "Julgamento dos Céus",
    "region": "Tempestade",
    "type": "Spell",
    "cost": 7,
    "description": "Cause 6 de dano a uma unidade.",
    "rarity": "Epic",
    "emoji": "⚡",
    "spell": {
      "kind": "damageUnit",
      "amount": 6,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_e01: {
    "defId": "van_storm_e01",
    "name": "Santuário do Olho da Tempestade",
    "region": "Tempestade",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: Cause 1 de dano ao Nexus inimigo.",
    "rarity": "Epic",
    "emoji": "⚡",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "damageNexus",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
  van_storm_e02: {
    "defId": "van_storm_e02",
    "name": "Templo do Céu Partido",
    "region": "Tempestade",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Compre 1 carta(s).",
    "rarity": "Legend",
    "emoji": "⚡",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "draw",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "tempestade_rush"
    ],
    "isLegend": true
  },
  van_storm_a01: {
    "defId": "van_storm_a01",
    "name": "Orbe do Trovão",
    "region": "Tempestade",
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
      "tempestade_rush"
    ]
  },
  van_storm_q01: {
    "defId": "van_storm_q01",
    "name": "Lança do Relâmpago",
    "region": "Tempestade",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e Haste.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "Haste"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "tempestade_rush"
    ]
  },
};
