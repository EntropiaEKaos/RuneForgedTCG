import type { CardDef } from "../types";

/**
 * RuneForge 2.96 — Sentinelas & Convergência.
 *
 * 33 code-authored Vanilla cards:
 * - 12 Sentinelas (6 mono-region + 6 multi-region)
 * - 15 dual-region cards (one for every dual identity)
 * - 6 tri-region cards (one for every named triad)
 *
 * New cards intentionally stay outside the eight certified decklists until the
 * balance gate promotes them. They are immediately available to Collection,
 * Forge, Draft and custom deckbuilding through the canonical card registry.
 */
export const RELEASE_296_CARDS: Record<string, CardDef> = {
  // ───────────────────────── Mono-region Sentinelas ─────────────────────────
  rf296_sent_ilyra: {
    defId: "rf296_sent_ilyra", name: "Ilyra, Forjadora de Guerras", region: "Emberhold",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "🔥",
    description: "Sentinela — transforma pressão em fogo disciplinado.",
    flavor: "Toda guerra começa na temperatura certa.", strategicRole: "finisher", doctrineAffinities: ["ember_aggro"],
    sentinela: { startingLoyalty: 4, abilities: [
      { cost: 1, description: "+1: cause 1 de dano ao Nexus inimigo", effect: { kind: "damageNexus", amount: 1, target: "none" } },
      { cost: -2, description: "-2: conceda Ataque Rápido a uma unidade aliada", effect: { kind: "grantKeyword", amount: 0, keyword: "QuickAttack", target: "allyUnit" } },
      { cost: -6, description: "-6: cause 4 de dano a todos os inimigos", effect: { kind: "aoeEnemy", amount: 4, target: "none" } },
    ] },
  },
  rf296_sent_selene: {
    defId: "rf296_sent_selene", name: "Selene, Cartógrafa do Abismo", region: "Tidecall",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "🌊",
    description: "Sentinela — redesenha a batalha como quem redesenha uma corrente.",
    flavor: "O mapa termina onde a maré decide começar.", strategicRole: "engine", doctrineAffinities: ["tide_control"],
    sentinela: { startingLoyalty: 5, abilities: [
      { cost: 1, description: "+1: compre 1 carta", effect: { kind: "draw", amount: 1, target: "none" } },
      { cost: -2, description: "-2: congele uma unidade inimiga", effect: { kind: "frostbite", amount: 0, target: "enemyUnit" } },
      { cost: -7, description: "-7: devolva uma unidade inimiga e compre 2", effect: { kind: "recall", amount: 0, target: "enemyUnit", also: { kind: "draw", amount: 2, target: "none" } } },
    ] },
  },
  rf296_sent_doran: {
    defId: "rf296_sent_doran", name: "Doran, Escudo Ancestral", region: "Ironwood",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "🌿",
    description: "Sentinela — converte raízes, pedra e paciência em uma muralha viva.",
    flavor: "A floresta não recua; ela cria raízes.", strategicRole: "defense", doctrineAffinities: ["wood_midrange"],
    sentinela: { startingLoyalty: 6, abilities: [
      { cost: 1, description: "+1: cure 1 do seu Nexus", effect: { kind: "healNexus", amount: 1, target: "none" } },
      { cost: -2, description: "-2: conceda Regeneração a uma unidade aliada", effect: { kind: "grantKeyword", amount: 0, keyword: "Regeneration", target: "allyUnit" } },
      { cost: -7, description: "-7: invoque dois Golens de Raiz", effect: { kind: "summonToken", amount: 2, tokenDefId: "wood_root_golem_token", target: "none" } },
    ] },
  },
  rf296_sent_morvane: {
    defId: "rf296_sent_morvane", name: "Morvane, Tecelão do Luto", region: "Voidborn",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "☠",
    description: "Sentinela — transforma memória em fome e ausência.",
    flavor: "Ele não coleciona mortos. Coleciona o espaço que deixaram.", strategicRole: "removal", doctrineAffinities: ["void_shadow"],
    sentinela: { startingLoyalty: 4, abilities: [
      { cost: 1, description: "+1: descarte 2 cartas do topo do deck inimigo", effect: { kind: "mill", amount: 2, target: "none" } },
      { cost: -2, description: "-2: cause 2 a uma unidade e cure 2 do seu Nexus", effect: { kind: "damageUnit", amount: 2, target: "enemyUnit", also: { kind: "healNexus", amount: 2, target: "none" } } },
      { cost: -7, description: "-7: destrua uma unidade inimiga e cure 4", effect: { kind: "killUnit", amount: 0, target: "enemyUnit", also: { kind: "healNexus", amount: 4, target: "none" } } },
    ] },
  },
  rf296_sent_rhaika: {
    defId: "rf296_sent_rhaika", name: "Rhaika, Alfa do Primeiro Uivo", region: "Florestia",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "🐺",
    description: "Sentinela — faz da matilha um único organismo de caça.",
    flavor: "Antes do primeiro reino, já havia um uivo.", strategicRole: "engine", doctrineAffinities: ["florestia_tribal"],
    sentinela: { startingLoyalty: 5, abilities: [
      { cost: 1, description: "+1: Bestas aliadas recebem +1/+0", effect: { kind: "buffRace", amount: 0, buffPower: 1, buffHealth: 0, race: "Besta", target: "none" } },
      { cost: -2, description: "-2: invoque dois Filhotes", effect: { kind: "summonToken", amount: 2, tokenDefId: "forest_cub_token", target: "none" } },
      { cost: -7, description: "-7: aliados recebem +2/+2", effect: { kind: "buffAllies", amount: 0, buffPower: 2, buffHealth: 2, target: "none" } },
    ] },
  },
  rf296_sent_elyon: {
    defId: "rf296_sent_elyon", name: "Elyon, Olho da Tormenta", region: "Tempestade",
    type: "Sentinela", cost: 5, rarity: "Legend", isLegend: true, emoji: "⚡",
    description: "Sentinela — governa o instante entre o relâmpago e o impacto.",
    flavor: "Quem vê o centro da tempestade nunca mais teme suas bordas.", strategicRole: "tempo", doctrineAffinities: ["tempestade_rush"],
    sentinela: { startingLoyalty: 4, abilities: [
      { cost: 1, description: "+1: cause 1 de dano ao Nexus inimigo", effect: { kind: "damageNexus", amount: 1, target: "none" } },
      { cost: -2, description: "-2: atordoe uma unidade inimiga", effect: { kind: "stun", amount: 0, target: "enemyUnit" } },
      { cost: -6, description: "-6: aliados recebem +2/+1", effect: { kind: "buffAllies", amount: 0, buffPower: 2, buffHealth: 1, target: "none" } },
    ] },
  },

  // ───────────────────────── Multi-region Sentinelas ────────────────────────
  rf296_sent_kaelis: {
    defId: "rf296_sent_kaelis", name: "Kaelis, Arquiteto da Forja a Vapor", region: "Emberhold", regions: ["Emberhold", "Tidecall"], regionalPerk: "convergence",
    type: "Sentinela", cost: 6, rarity: "Legend", isLegend: true, emoji: "🔥🌊",
    description: "Sentinela da Forja a Vapor. Maestria reduz seu custo em uma identidade exata.",
    flavor: "Água e fogo discordam até a máquina começar a respirar.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
    sentinela: { startingLoyalty: 5, abilities: [
      { cost: 1, description: "+1: compre 1 carta", effect: { kind: "draw", amount: 1, target: "none" } },
      { cost: -2, description: "-2: cause 2 a uma unidade e 1 ao Nexus", effect: { kind: "damageUnit", amount: 2, target: "enemyUnit", also: { kind: "damageNexus", amount: 1, target: "none" } } },
      { cost: -7, description: "-7: cause 3 a todos os inimigos e cure 3", effect: { kind: "aoeEnemy", amount: 3, target: "none", also: { kind: "healNexus", amount: 3, target: "none" } } },
    ] },
  },
  rf296_sent_nymara: {
    defId: "rf296_sent_nymara", name: "Nymara, Guardiã das Raízes da Maré", region: "Tidecall", regions: ["Tidecall", "Ironwood"], regionalPerk: "convergence",
    type: "Sentinela", cost: 6, rarity: "Legend", isLegend: true, emoji: "🌊🌿",
    description: "Sentinela das Raízes da Maré. Protege o campo enquanto aprofunda a mão.",
    flavor: "Cada onda traz uma semente; cada raiz devolve uma corrente.", strategicRole: "defense", doctrineAffinities: ["convergence_dual"],
    sentinela: { startingLoyalty: 6, abilities: [
      { cost: 1, description: "+1: cure 1 do seu Nexus", effect: { kind: "healNexus", amount: 1, target: "none" } },
      { cost: -2, description: "-2: conceda Barreira a uma unidade aliada", effect: { kind: "grantBarrier", amount: 0, target: "allyUnit" } },
      { cost: -8, description: "-8: aliados ganham Barreira e você compra 2", effect: { kind: "grantBarrier", amount: 0, target: "none", also: { kind: "draw", amount: 2, target: "none" } } },
    ] },
  },
  rf296_sent_orun: {
    defId: "rf296_sent_orun", name: "Orun, Voz do Pacto Ancestral", region: "Ironwood", regions: ["Ironwood", "Florestia"], regionalPerk: "convergence",
    type: "Sentinela", cost: 6, rarity: "Legend", isLegend: true, emoji: "🌿🐺",
    description: "Sentinela do Pacto Ancestral. Faz raízes e matilha crescerem juntas.",
    flavor: "O pacto não foi escrito. Foi herdado nos ossos.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
    sentinela: { startingLoyalty: 6, abilities: [
      { cost: 1, description: "+1: cure 2 de uma unidade aliada", effect: { kind: "healUnit", amount: 2, target: "allyUnit" } },
      { cost: -2, description: "-2: Bestas e Besta recebem +1/+1", effect: { kind: "buffAllies", amount: 0, buffPower: 1, buffHealth: 1, races: ["Beast", "Besta"], target: "none" } },
      { cost: -8, description: "-8: invoque dois Golens de Raiz", effect: { kind: "summonToken", amount: 2, tokenDefId: "wood_root_golem_token", target: "none" } },
    ] },
  },
  rf296_sent_veyra: {
    defId: "rf296_sent_veyra", name: "Veyra, Rainha do Eclipse Elétrico", region: "Voidborn", regions: ["Voidborn", "Tempestade"], regionalPerk: "convergence",
    type: "Sentinela", cost: 6, rarity: "Legend", isLegend: true, emoji: "☠⚡",
    description: "Sentinela do Eclipse Elétrico. Alterna execução e velocidade impossível.",
    flavor: "A luz morreu; o trovão continuou falando.", strategicRole: "removal", doctrineAffinities: ["convergence_dual"],
    sentinela: { startingLoyalty: 5, abilities: [
      { cost: 1, description: "+1: descarte 1 carta do topo do deck inimigo", effect: { kind: "mill", amount: 1, target: "none" } },
      { cost: -2, description: "-2: cause 3 de dano a uma unidade inimiga", effect: { kind: "damageUnit", amount: 3, target: "enemyUnit" } },
      { cost: -7, description: "-7: destrua uma unidade e cause 3 ao Nexus", effect: { kind: "killUnit", amount: 0, target: "enemyUnit", also: { kind: "damageNexus", amount: 3, target: "none" } } },
    ] },
  },
  rf296_sent_malakar: {
    defId: "rf296_sent_malakar", name: "Malakar, Coração da Tempestade Negra", region: "Emberhold", regions: ["Emberhold", "Voidborn", "Tempestade"], regionalPerk: "convergence",
    type: "Sentinela", cost: 7, rarity: "Legend", isLegend: true, emoji: "🔥☠⚡",
    description: "Sentinela do Apocalipse da Tempestade Negra. Uma tríade feita para encerrar partidas.",
    flavor: "Quando três fins do mundo concordam, nasce uma cor nova.", strategicRole: "finisher", doctrineAffinities: ["convergence_triad"],
    sentinela: { startingLoyalty: 5, abilities: [
      { cost: 1, description: "+1: cause 1 de dano ao Nexus inimigo", effect: { kind: "damageNexus", amount: 1, target: "none" } },
      { cost: -3, description: "-3: cause 4 de dano a uma unidade inimiga", effect: { kind: "damageUnit", amount: 4, target: "enemyUnit" } },
      { cost: -8, description: "-8: cause 4 de dano a todos os inimigos e 4 ao Nexus", effect: { kind: "aoeEnemy", amount: 4, target: "none", also: { kind: "damageNexus", amount: 4, target: "none" } } },
    ] },
  },
  rf296_sent_liora: {
    defId: "rf296_sent_liora", name: "Liora, Lua da Grande Monção", region: "Tidecall", regions: ["Tidecall", "Florestia", "Tempestade"], regionalPerk: "convergence",
    type: "Sentinela", cost: 7, rarity: "Legend", isLegend: true, emoji: "🌊🐺⚡",
    description: "Sentinela da Lua da Grande Monção. Crescimento, cura e impulso em um único ciclo.",
    flavor: "As matilhas aprenderam a caçar pelo reflexo da lua na tempestade.", strategicRole: "engine", doctrineAffinities: ["convergence_triad"],
    sentinela: { startingLoyalty: 6, abilities: [
      { cost: 1, description: "+1: cure 2 do seu Nexus", effect: { kind: "healNexus", amount: 2, target: "none" } },
      { cost: -2, description: "-2: invoque dois Filhotes", effect: { kind: "summonToken", amount: 2, tokenDefId: "forest_cub_token", target: "none" } },
      { cost: -8, description: "-8: aliados recebem +2/+2 e Barreira", effect: { kind: "buffAllies", amount: 0, buffPower: 2, buffHealth: 2, target: "none", also: { kind: "grantBarrier", amount: 0, target: "none" } } },
    ] },
  },

  // ─────────────────────── Every dual identity gets a card ──────────────────
  rf296_steam_bastion: {
    defId: "rf296_steam_bastion", name: "Bastião da Forja a Vapor", region: "Emberhold", regions: ["Emberhold", "Tidecall"], regionalPerk: "bulwark",
    type: "Artifact", cost: 4, maxHealth: 5, rarity: "Epic", emoji: "⚙️", description: "Início de Rodada: cure 1 do seu Nexus.", flavor: "Pressão contida é apenas força esperando permissão.", strategicRole: "defense", doctrineAffinities: ["convergence_dual"],
    trigger: { when: "onRoundStart", effect: { kind: "healNexus", amount: 1, target: "none" } },
  },
  rf296_molten_canopy: {
    defId: "rf296_molten_canopy", name: "Guardião do Bosque Incandescente", region: "Emberhold", regions: ["Emberhold", "Ironwood"], regionalPerk: "bulwark",
    type: "Unit", cost: 4, power: 4, health: 5, race: "Elemental", keywords: ["Tough"], rarity: "Epic", emoji: "🌋", description: "Resistente. A Maestria do Bosque Incandescente reforça sua Vida.", flavor: "A casca queimou; o coração aprendeu a ser metal.", strategicRole: "defense", doctrineAffinities: ["convergence_dual"],
  },
  rf296_ashveil_reclaimer: {
    defId: "rf296_ashveil_reclaimer", name: "Reivindicação das Cinzas Profanas", region: "Emberhold", regions: ["Emberhold", "Voidborn"], regionalPerk: "convergence",
    type: "Spell", cost: 4, rarity: "Rare", emoji: "🕯️", description: "Cause 3 a uma unidade inimiga e cure 2 do seu Nexus.", flavor: "Nada volta inteiro do fogo do Vazio.", strategicRole: "removal", doctrineAffinities: ["convergence_dual"],
    spell: { kind: "damageUnit", amount: 3, target: "enemyUnit", also: { kind: "healNexus", amount: 2, target: "none" } }, speed: "Fast",
  },
  rf296_emberfang_huntress: {
    defId: "rf296_emberfang_huntress", name: "Caçadora Presa-de-Brasa", region: "Emberhold", regions: ["Emberhold", "Florestia"], regionalPerk: "assault",
    type: "Unit", cost: 3, power: 3, health: 3, race: "Besta", keywords: ["Challenger", "Haste"], rarity: "Rare", emoji: "🐺", description: "Desafiador e Ímpeto. A Maestria da Caçada da Brasa reforça seu Poder.", flavor: "Ela segue o cheiro do medo através da fumaça.", strategicRole: "tempo", doctrineAffinities: ["convergence_dual"],
  },
  rf296_thunderforge_hammer: {
    defId: "rf296_thunderforge_hammer", name: "Martelo da Forja do Trovão", region: "Emberhold", regions: ["Emberhold", "Tempestade"], regionalPerk: "convergence",
    type: "Equipment", cost: 3, rarity: "Rare", emoji: "🔨", description: "Equipe: +2/+1 e Ataque Rápido.", flavor: "O segundo impacto sempre chega antes do som.", strategicRole: "tempo", doctrineAffinities: ["convergence_dual"],
    equipment: { buffPower: 2, buffHealth: 1, keywords: ["QuickAttack"] },
  },
  rf296_tidal_rootkeeper: {
    defId: "rf296_tidal_rootkeeper", name: "Guardião das Raízes da Maré", region: "Tidecall", regions: ["Tidecall", "Ironwood"], regionalPerk: "bulwark",
    type: "Unit", cost: 3, power: 2, health: 5, race: "Spirit", keywords: ["Regeneration"], rarity: "Rare", emoji: "🌱", description: "Regeneração. A Maestria das Raízes da Maré reforça sua Vida.", flavor: "Toda enchente deixa uma floresta em algum lugar.", strategicRole: "defense", doctrineAffinities: ["convergence_dual"],
  },
  rf296_drowned_oracle: {
    defId: "rf296_drowned_oracle", name: "Oráculo do Abismo Afogado", region: "Tidecall", regions: ["Tidecall", "Voidborn"], regionalPerk: "convergence",
    type: "Unit", cost: 4, power: 3, health: 4, race: "Spirit", secondaryRaces: ["Voidling"], keywords: ["Lifesteal", "Elusive"], rarity: "Epic", emoji: "🔮", description: "Vampírico e Evasivo.", flavor: "Ela lê futuros que já se afogaram.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
  },
  rf296_moonwater_call: {
    defId: "rf296_moonwater_call", name: "Chamado da Matilha Lunar", region: "Tidecall", regions: ["Tidecall", "Florestia"], regionalPerk: "convergence",
    type: "Spell", cost: 4, rarity: "Rare", emoji: "🌙", description: "Invoque dois Filhotes e cure 2 do seu Nexus.", flavor: "Sob a lua, até as ondas aprendem a uivar.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
    spell: { kind: "summonToken", amount: 2, tokenDefId: "forest_cub_token", target: "none", also: { kind: "healNexus", amount: 2, target: "none" } },
  },
  rf296_monsoon_lance: {
    defId: "rf296_monsoon_lance", name: "Lança da Monção Celeste", region: "Tidecall", regions: ["Tidecall", "Tempestade"], regionalPerk: "convergence",
    type: "Spell", cost: 3, rarity: "Rare", emoji: "🌩️", description: "Cause 2 a uma unidade inimiga e compre 1.", flavor: "A chuva escolhe o alvo; o raio confirma.", strategicRole: "removal", doctrineAffinities: ["convergence_dual"],
    spell: { kind: "damageUnit", amount: 2, target: "enemyUnit", also: { kind: "draw", amount: 1, target: "none" } }, speed: "Fast",
  },
  rf296_twilight_seed: {
    defId: "rf296_twilight_seed", name: "Semente do Jardim do Crepúsculo", region: "Ironwood", regions: ["Ironwood", "Voidborn"], regionalPerk: "convergence",
    type: "Enchantment", cost: 4, maxHealth: 4, rarity: "Epic", emoji: "🥀", description: "Início de Rodada: cure 1 do seu Nexus e descarte 1 do topo do deck inimigo.", flavor: "Flores que só abrem depois que a luz esquece seu nome.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
    trigger: { when: "onRoundStart", effect: { kind: "healNexus", amount: 1, target: "none", also: { kind: "mill", amount: 1, target: "none" } } },
  },
  rf296_ancestral_harness: {
    defId: "rf296_ancestral_harness", name: "Arnês do Pacto Ancestral", region: "Ironwood", regions: ["Ironwood", "Florestia"], regionalPerk: "convergence",
    type: "Equipment", cost: 3, rarity: "Rare", emoji: "🦴", description: "Equipe: +1/+2 e Regeneração.", flavor: "Nenhuma caça termina onde começou.", strategicRole: "defense", doctrineAffinities: ["convergence_dual"],
    equipment: { buffPower: 1, buffHealth: 2, keywords: ["Regeneration"] },
  },
  rf296_stormwood_colossus: {
    defId: "rf296_stormwood_colossus", name: "Colosso da Copa Fulminante", region: "Ironwood", regions: ["Ironwood", "Tempestade"], regionalPerk: "bulwark",
    type: "Unit", cost: 5, power: 4, health: 6, race: "Elemental", keywords: ["Reach", "Haste"], rarity: "Epic", emoji: "🌳", description: "Alcance e Ímpeto. A Maestria da Copa Fulminante reforça sua Vida.", flavor: "O relâmpago encontrou uma árvore que respondeu.", strategicRole: "finisher", doctrineAffinities: ["convergence_dual"],
  },
  rf296_shadowpack_howl: {
    defId: "rf296_shadowpack_howl", name: "Uivo da Matilha Sombria", region: "Voidborn", regions: ["Voidborn", "Florestia"], regionalPerk: "convergence",
    type: "Spell", cost: 3, rarity: "Rare", emoji: "🌑", description: "Bestas, Besta e Voidlings aliados recebem +1/+1.", flavor: "O Vazio aprendeu um som que não deveria existir.", strategicRole: "engine", doctrineAffinities: ["convergence_dual"],
    spell: { kind: "buffAllies", amount: 0, buffPower: 1, buffHealth: 1, races: ["Beast", "Besta", "Voidling"], target: "none" },
  },
  rf296_eclipse_reaver: {
    defId: "rf296_eclipse_reaver", name: "Ceifador do Eclipse Elétrico", region: "Voidborn", regions: ["Voidborn", "Tempestade"], regionalPerk: "assault",
    type: "Unit", cost: 4, power: 4, health: 3, race: "Voidling", keywords: ["Fearsome", "QuickAttack"], rarity: "Epic", emoji: "🌘", description: "Assustador e Ataque Rápido. A Maestria do Eclipse Elétrico reforça seu Poder.", flavor: "O clarão mostra o que a sombra já escolheu matar.", strategicRole: "tempo", doctrineAffinities: ["convergence_dual"],
  },
  rf296_thunderhowl_alpha: {
    defId: "rf296_thunderhowl_alpha", name: "Alfa do Uivo do Trovão", region: "Florestia", regions: ["Florestia", "Tempestade"], regionalPerk: "assault",
    type: "Unit", cost: 5, power: 5, health: 5, race: "Besta", keywords: ["Haste", "Reach"], rarity: "Epic", emoji: "🐺", description: "Ímpeto e Alcance. A Maestria do Uivo do Trovão reforça seu Poder.", flavor: "O céu rosna primeiro. A matilha responde.", strategicRole: "finisher", doctrineAffinities: ["convergence_dual"],
  },

  // ─────────────────────── Every named triad gets a card ────────────────────
  rf296_creation_engine: {
    defId: "rf296_creation_engine", name: "Motor da Tríade da Criação", region: "Emberhold", regions: ["Emberhold", "Tidecall", "Ironwood"], regionalPerk: "convergence",
    type: "Artifact", cost: 6, maxHealth: 6, rarity: "Legend", isLegend: true, emoji: "🧭", description: "Início de Rodada: compre 1 carta.", flavor: "Fogo dá impulso. Água dá ritmo. Raiz dá memória.", strategicRole: "engine", doctrineAffinities: ["convergence_triad"],
    trigger: { when: "onRoundStart", effect: { kind: "draw", amount: 1, target: "none" } },
  },
  rf296_worldfire_pact: {
    defId: "rf296_worldfire_pact", name: "Pacto da Árvore-Mundo em Chamas", region: "Emberhold", regions: ["Emberhold", "Ironwood", "Florestia"], regionalPerk: "convergence",
    type: "Enchantment", cost: 5, maxHealth: 5, rarity: "Legend", isLegend: true, emoji: "🌲", description: "Início de Rodada: aliados recebem +1/+1.", flavor: "Ela queimou até descobrir que fogo também pode ser seiva.", strategicRole: "engine", doctrineAffinities: ["convergence_triad"],
    trigger: { when: "onRoundStart", effect: { kind: "buffAllies", amount: 0, buffPower: 1, buffHealth: 1, target: "none" } },
  },
  rf296_blackstorm_avatar: {
    defId: "rf296_blackstorm_avatar", name: "Avatar da Tempestade Negra", region: "Emberhold", regions: ["Emberhold", "Voidborn", "Tempestade"], regionalPerk: "assault",
    type: "Unit", cost: 7, power: 7, health: 5, race: "Elemental", keywords: ["Flying", "Fearsome", "Haste"], rarity: "Legend", isLegend: true, emoji: "🌩️", description: "Voo, Assustador e Ímpeto. A Maestria tríplice reforça seu Poder.", flavor: "A tempestade encontrou uma sombra que também sabia queimar.", strategicRole: "finisher", doctrineAffinities: ["convergence_triad"],
  },
  rf296_abyssal_worldroot: {
    defId: "rf296_abyssal_worldroot", name: "Raiz-Mundo do Abismo Vivo", region: "Tidecall", regions: ["Tidecall", "Ironwood", "Voidborn"], regionalPerk: "bulwark",
    type: "Unit", cost: 6, power: 4, health: 7, race: "Spirit", secondaryRaces: ["Voidling"], keywords: ["Tough", "Lifesteal"], rarity: "Legend", isLegend: true, emoji: "🪸", description: "Resistente e Vampírico. A Maestria tríplice reforça sua Vida.", flavor: "O fundo do oceano também possui raízes — só ninguém deveria acordá-las.", strategicRole: "defense", doctrineAffinities: ["convergence_triad"],
  },
  rf296_great_monsoon_hunt: {
    defId: "rf296_great_monsoon_hunt", name: "Grande Caçada da Monção", region: "Tidecall", regions: ["Tidecall", "Florestia", "Tempestade"], regionalPerk: "convergence",
    type: "Spell", cost: 6, rarity: "Legend", isLegend: true, emoji: "🌧️", description: "Cause 2 a todos os inimigos e invoque dois Filhotes.", flavor: "Quando a tempestade abre a trilha, a matilha termina o trabalho.", strategicRole: "finisher", doctrineAffinities: ["convergence_triad"],
    spell: { kind: "aoeEnemy", amount: 2, target: "none", also: { kind: "summonToken", amount: 2, tokenDefId: "forest_cub_token", target: "none" } },
  },
  rf296_dreadroot_covenant: {
    defId: "rf296_dreadroot_covenant", name: "Guardião do Círculo da Raiz Sombria", region: "Ironwood", regions: ["Ironwood", "Voidborn", "Florestia"], regionalPerk: "bulwark",
    type: "Unit", cost: 6, power: 5, health: 7, race: "Beast", secondaryRaces: ["Voidling", "Besta"], keywords: ["Regeneration", "Fearsome"], rarity: "Legend", isLegend: true, emoji: "🕸️", description: "Regeneração e Assustador. A Maestria tríplice reforça sua Vida.", flavor: "Há raízes que crescem para baixo porque o céu não é seu destino.", strategicRole: "defense", doctrineAffinities: ["convergence_triad"],
  },
};
