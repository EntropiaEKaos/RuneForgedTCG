import type { CardDef } from "../../types";

export const VANILLA_VOIDBORN_CARDS: Record<string, CardDef> = {
  van_void_u01: {
    "defId": "van_void_u01",
    "name": "Sombra Faminta",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 1,
    "power": 1,
    "health": 2,
    "race": "Voidling",
    "keywords": [],
    "description": "Voidling. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u02: {
    "defId": "van_void_u02",
    "name": "Acólito do Vazio",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 1,
    "power": 2,
    "health": 1,
    "race": "Spirit",
    "keywords": [
      "Lifesteal"
    ],
    "description": "Spirit. Lifesteal. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u03: {
    "defId": "van_void_u03",
    "name": "Rastejante Umbral",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 2,
    "race": "Warrior",
    "keywords": [
      "Elusive",
      "Wither"
    ],
    "description": "Warrior. Elusive; Wither. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u04: {
    "defId": "van_void_u04",
    "name": "Ladrão de Ecos",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 2,
    "power": 2,
    "health": 3,
    "race": "Voidling",
    "keywords": [],
    "description": "Voidling. Uma nova peça da coleção Vanilla. Ao entrar: Cause 1 de dano ao Nexus inimigo.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
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
  van_void_u05: {
    "defId": "van_void_u05",
    "name": "Bruxa do Eclipse",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 2,
    "power": 3,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Wither"
    ],
    "description": "Spirit. Wither. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u06: {
    "defId": "van_void_u06",
    "name": "Predador do Abismo",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 3,
    "power": 3,
    "health": 3,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u07: {
    "defId": "van_void_u07",
    "name": "Ceifador Menor",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 3,
    "power": 2,
    "health": 4,
    "race": "Voidling",
    "keywords": [],
    "description": "Voidling. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u08: {
    "defId": "van_void_u08",
    "name": "Espectro de Cinza",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 3,
    "power": 4,
    "health": 2,
    "race": "Spirit",
    "keywords": [
      "Lifesteal"
    ],
    "description": "Spirit. Lifesteal. Uma nova peça da coleção Vanilla. Ao entrar: O inimigo descarta 1 carta(s) do topo do deck.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "mill",
        "amount": 1,
        "target": "none"
      }
    }
  },
  van_void_u09: {
    "defId": "van_void_u09",
    "name": "Arauto da Ruína",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 4,
    "power": 4,
    "health": 4,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u10: {
    "defId": "van_void_u10",
    "name": "Carrasco do Nada",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 4,
    "power": 3,
    "health": 5,
    "race": "Voidling",
    "keywords": [],
    "description": "Voidling. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u11: {
    "defId": "van_void_u11",
    "name": "Vampiro do Eclipse",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 4,
    "power": 5,
    "health": 3,
    "race": "Spirit",
    "keywords": [
      "Wither"
    ],
    "description": "Spirit. Wither. Uma nova peça da coleção Vanilla.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u12: {
    "defId": "van_void_u12",
    "name": "Tecelão de Pesadelos",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 5,
    "power": 4,
    "health": 5,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla. Ao entrar: O Nexus inimigo recebe 1 marcador(es) de veneno.",
    "rarity": "Common",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ],
    "trigger": {
      "when": "onSummon",
      "effect": {
        "kind": "poison",
        "amount": 1,
        "target": "none"
      }
    }
  },
  van_void_u13: {
    "defId": "van_void_u13",
    "name": "Devastador Umbral",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 5,
    "power": 5,
    "health": 5,
    "race": "Voidling",
    "keywords": [
      "Fearsome",
      "Elusive"
    ],
    "description": "Voidling. Fearsome; Elusive. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u14: {
    "defId": "van_void_u14",
    "name": "Príncipe do Silêncio",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 5,
    "power": 6,
    "health": 4,
    "race": "Spirit",
    "keywords": [
      "Lifesteal"
    ],
    "description": "Spirit. Lifesteal. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u15: {
    "defId": "van_void_u15",
    "name": "Arconte da Desolação",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 6,
    "power": 5,
    "health": 6,
    "race": "Warrior",
    "keywords": [],
    "description": "Warrior. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u16: {
    "defId": "van_void_u16",
    "name": "Monstro Sem Nome",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 6,
    "power": 6,
    "health": 6,
    "race": "Voidling",
    "keywords": [],
    "description": "Voidling. Uma nova peça da coleção Vanilla. Ao entrar: Receba +1/+0.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
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
  van_void_u17: {
    "defId": "van_void_u17",
    "name": "Profeta do Fim",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 7,
    "power": 7,
    "health": 6,
    "race": "Spirit",
    "keywords": [
      "Wither"
    ],
    "description": "Spirit. Wither. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_u18: {
    "defId": "van_void_u18",
    "name": "Morthys, Olho do Vazio",
    "region": "Voidborn",
    "type": "Unit",
    "cost": 8,
    "power": 8,
    "health": 8,
    "race": "Warrior",
    "keywords": [
      "Deathtouch",
      "Lifesteal"
    ],
    "description": "Lenda Vanilla. Warrior. Deathtouch; Lifesteal. Uma nova peça da coleção Vanilla.",
    "rarity": "Rare",
    "emoji": "☠️",
    "doctrineAffinities": [
      "void_shadow"
    ],
    "isLegend": true
  },
  van_void_s01: {
    "defId": "van_void_s01",
    "name": "Toque Sombrio",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 1,
    "description": "Cause 2 de dano a uma unidade.",
    "rarity": "Rare",
    "emoji": "☠️",
    "spell": {
      "kind": "damageUnit",
      "amount": 2,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_s02: {
    "defId": "van_void_s02",
    "name": "Sussurro do Nada",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 2,
    "description": "O inimigo descarta 2 carta(s) do topo do deck.",
    "rarity": "Rare",
    "emoji": "☠️",
    "spell": {
      "kind": "mill",
      "amount": 2,
      "target": "none"
    },
    "doctrineAffinities": [
      "void_shadow"
    ],
    "speed": "Burst"
  },
  van_void_s03: {
    "defId": "van_void_s03",
    "name": "Marca Venenosa",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 2,
    "description": "O Nexus inimigo recebe 1 marcador(es) de veneno.",
    "rarity": "Rare",
    "emoji": "☠️",
    "spell": {
      "kind": "poison",
      "amount": 1,
      "target": "none"
    },
    "doctrineAffinities": [
      "void_shadow"
    ],
    "speed": "Burst"
  },
  van_void_s04: {
    "defId": "van_void_s04",
    "name": "Dreno de Alma",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 3,
    "description": "Cause 3 de dano ao Nexus inimigo.",
    "rarity": "Epic",
    "emoji": "☠️",
    "spell": {
      "kind": "damageNexus",
      "amount": 3,
      "target": "none"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_s05: {
    "defId": "van_void_s05",
    "name": "Rasgo Umbral",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 4,
    "description": "Destrua uma unidade.",
    "rarity": "Epic",
    "emoji": "☠️",
    "spell": {
      "kind": "killUnit",
      "amount": 0,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_s06: {
    "defId": "van_void_s06",
    "name": "Condenação Silenciosa",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 4,
    "description": "O inimigo descarta 4 carta(s) do topo do deck.",
    "rarity": "Epic",
    "emoji": "☠️",
    "spell": {
      "kind": "mill",
      "amount": 4,
      "target": "none"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_s07: {
    "defId": "van_void_s07",
    "name": "Banquete do Abismo",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 5,
    "description": "Cause 5 de dano a uma unidade.",
    "rarity": "Epic",
    "emoji": "☠️",
    "spell": {
      "kind": "damageUnit",
      "amount": 5,
      "target": "enemyUnit"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_s08: {
    "defId": "van_void_s08",
    "name": "Fim Inevitável",
    "region": "Voidborn",
    "type": "Spell",
    "cost": 7,
    "description": "Destrua uma unidade.",
    "rarity": "Epic",
    "emoji": "☠️",
    "spell": {
      "kind": "killUnit",
      "amount": 0,
      "target": "anyUnit"
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_e01: {
    "defId": "van_void_e01",
    "name": "Altar do Eclipse",
    "region": "Voidborn",
    "type": "Enchantment",
    "cost": 4,
    "maxHealth": 4,
    "description": "Início da rodada: O inimigo descarta 1 carta(s) do topo do deck.",
    "rarity": "Epic",
    "emoji": "☠️",
    "trigger": {
      "when": "onRoundStart",
      "effect": {
        "kind": "mill",
        "amount": 1,
        "target": "none"
      }
    },
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
  van_void_e02: {
    "defId": "van_void_e02",
    "name": "Poço Sem Fundo",
    "region": "Voidborn",
    "type": "Enchantment",
    "cost": 5,
    "maxHealth": 5,
    "description": "Início da rodada: Aliados recebem +1/+1.",
    "rarity": "Legend",
    "emoji": "☠️",
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
      "void_shadow"
    ],
    "isLegend": true
  },
  van_void_a01: {
    "defId": "van_void_a01",
    "name": "Ídolo do Nada",
    "region": "Voidborn",
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
      "void_shadow"
    ]
  },
  van_void_q01: {
    "defId": "van_void_q01",
    "name": "Foice do Último Suspiro",
    "region": "Voidborn",
    "type": "Equipment",
    "cost": 4,
    "description": "Equipe: +2/+2 e Fearsome.",
    "rarity": "Legend",
    "emoji": "⚔️",
    "equipment": {
      "buffPower": 2,
      "buffHealth": 2,
      "keywords": [
        "Fearsome"
      ]
    },
    "isLegend": true,
    "doctrineAffinities": [
      "void_shadow"
    ]
  },
};
