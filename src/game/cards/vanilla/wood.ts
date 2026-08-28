import type { CardDef } from "../../types";

export const VANILLA_IRONWOOD_CARDS: Record<string, CardDef> = {
  van_wood_u01: {
    "defId": "van_wood_u01",
    "name": "Broto Guardião",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Beast",
    "keywords": [],
    "description": "Beast. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u02: {
    "defId": "van_wood_u02",
    "name": "Filhote de Musgo",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Spirit",
    "keywords": [
      "Regeneration"
    ],
    "description": "Spirit. Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u03: {
    "defId": "van_wood_u03",
    "name": "Batedor do Bosque",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Warrior",
    "keywords": [
      "Reach",
      "Hexproof"
    ],
    "description": "Warrior. Reach; Hexproof. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u04: {
    "defId": "van_wood_u04",
    "name": "Druida da Casca",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Beast",
    "keywords": [],
    "description": "Beast. Uma nova peça da coleção Vanilla. Ao entrar: Cure 2 de uma unidade aliada.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
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
  van_wood_u05: {
    "defId": "van_wood_u05",
    "name": "Lobo de Raiz",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Hexproof"
    ],
    "description": "Spirit. Hexproof. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u06: {
    "defId": "van_wood_u06",
    "name": "Sentinela de Carvalho",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u07: {
    "defId": "van_wood_u07",
    "name": "Espírito do Cedro",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Beast",
    "keywords": [],
    "description": "Beast. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u08: {
    "defId": "van_wood_u08",
    "name": "Caçador de Espinhos",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Reach"
    ],
    "description": "Spirit. Reach. Uma nova peça da coleção Vanilla. Ao entrar: Receba +0/+1.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffSelf",
        "amount": 0,
        "buffPower": 0,
        "buffHealth": 1,
        "target": "self"
      }
    }
  },
  van_wood_u09: {
    "defId": "van_wood_u09",
    "name": "Urso de Ferro",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u10: {
    "defId": "van_wood_u10",
    "name": "Mestre das Vinhas",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Beast",
    "keywords": [],
    "description": "Beast. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u11: {
    "defId": "van_wood_u11",
    "name": "Guardião do Bosque Antigo",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Spirit",
    "keywords": [
      "Tough"
    ],
    "description": "Spirit. Tough. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u12: {
    "defId": "van_wood_u12",
    "name": "Cervo de Pedra",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla. Ao entrar: Warrior recebem +1/+1.",
    "rarity": "Common",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "buffRace",
        "amount": 0,
        "buffPower": 1,
        "buffHealth": 1,
        "target": "none",
        "race": "Warrior"
      }
    }
  },
  van_wood_u13: {
    "defId": "van_wood_u13",
    "name": "Ancião da Seiva",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Beast",
    "keywords": [
      "Reach",
      "Hexproof"
    ],
    "description": "Beast. Reach; Hexproof. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u14: {
    "defId": "van_wood_u14",
    "name": "Titã do Tronco",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Spirit",
    "keywords": [
      "Challenger"
    ],
    "description": "Spirit. Challenger. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u15: {
    "defId": "van_wood_u15",
    "name": "Xamã das Raízes",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u16: {
    "defId": "van_wood_u16",
    "name": "Protetor da Floresta Profunda",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Beast",
    "keywords": [],
    "description": "Beast. Uma nova peça da coleção Vanilla. Ao entrar: Conceda Tough a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "grantKeyword",
        "amount": 0,
        "target": "none",
        "keyword": "Tough"
      }
    }
  },
  van_wood_u17: {
    "defId": "van_wood_u17",
    "name": "Avatar do Bosque",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Spirit",
    "keywords": [
      "Regeneration"
    ],
    "description": "Spirit. Regeneration. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_u18: {
    "defId": "van_wood_u18",
    "name": "Eldran, Coração de Ferro",
    "region": "Ironwood",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Warrior",
    "keywords": [
      "Reach",
      "Hexproof"
    ],
    "description": "Lenda Vanilla. Warrior. Reach; Hexproof. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "🌿",
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "isLegend": true
  },
  van_wood_s01: {
    "defId": "van_wood_s01",
    "name": "Seiva Restauradora",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 1,
    "description": "Cure 3 de uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌿",
    "spell": {
      "kind": "healUnit",
      "amount": 3,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_s02: {
    "defId": "van_wood_s02",
    "name": "Raízes Firmes",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda +0/+3 a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌿",
    "spell": {
      "kind": "buffUnit",
      "amount": 0,
      "buffPower": 0,
      "buffHealth": 3,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "speed": "Burst"
  },
  van_wood_s03: {
    "defId": "van_wood_s03",
    "name": "Crescimento Súbito",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 2,
    "description": "Conceda +2/+2 a uma unidade aliada.",
    "rarity": "Rare",
    "emoji": "🌿",
    "spell": {
      "kind": "buffUnit",
      "amount": 0,
      "buffPower": 2,
      "buffHealth": 2,
      "target": "allyUnit"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ],
    "speed": "Burst"
  },
  van_wood_s04: {
    "defId": "van_wood_s04",
    "name": "Chamado do Bosque",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 3,
    "description": "Compre 1 carta(s).",
    "rarity": "Epic",
    "emoji": "🌿",
    "spell": {
      "kind": "draw",
      "amount": 1,
      "target": "none"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_s05: {
    "defId": "van_wood_s05",
    "name": "Prisão de Espinhos",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 4,
    "description": "Atordoe uma unidade inimiga.",
    "rarity": "Epic",
    "emoji": "🌿",
    "spell": {
      "kind": "stun",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_s06: {
    "defId": "van_wood_s06",
    "name": "Pele de Carvalho",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 4,
    "description": "Conceda Tough a uma unidade aliada.",
    "rarity": "Epic",
    "emoji": "🌿",
    "spell": {
      "kind": "grantKeyword",
      "amount": 0,
      "target": "allyUnit",
      "keyword": "Tough"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_s07: {
    "defId": "van_wood_s07",
    "name": "Renascimento Verde",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 5,
    "description": "Cure 6 do seu Nexus.",
    "rarity": "Epic",
    "emoji": "🌿",
    "spell": {
      "kind": "healNexus",
      "amount": 6,
      "target": "none"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_s08: {
    "defId": "van_wood_s08",
    "name": "Ira da Floresta",
    "region": "Ironwood",
    "type": "Spell",
    "cost": 7,
    "description": "Aliados recebem +2/+2.",
    "rarity": "Epic",
    "emoji": "🌿",
    "spell": {
      "kind": "buffAllies",
      "amount": 0,
      "buffPower": 2,
      "buffHealth": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_e01: {
    "defId": "van_wood_e01",
    "name": "Bosque Sagrado",
    "region": "Ironwood",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: Cure 1 do seu Nexus.",
    "rarity": "Epic",
    "emoji": "🌿",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "healNexus",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
  van_wood_e02: {
    "defId": "van_wood_e02",
    "name": "Círculo dos Anciões",
    "region": "Ironwood",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Aliados recebem +1/+1.",
    "rarity": "Legend",
    "emoji": "🌿",
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
      "wood_midrange"
    ],
    "isLegend": true
  },
  van_wood_a01: {
    "defId": "van_wood_a01",
    "name": "Totem de Raizferro",
    "region": "Ironwood",
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
      "wood_midrange"
    ]
  },
  van_wood_q01: {
    "defId": "van_wood_q01",
    "name": "Machado do Guardião Verde",
    "region": "Ironwood",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e Tough.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "Tough"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "wood_midrange"
    ]
  },
};
