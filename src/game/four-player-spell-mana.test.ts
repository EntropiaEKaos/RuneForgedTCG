import assert from "node:assert/strict";
import { fourPlayerActivatedAbilityOptions, stageFourPlayerActivatedAbility } from "./four-player-activated-abilities";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { stageFourPlayerCardCast } from "./four-player-card-play";
import { collectibleCards } from "./cards";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import {
  advanceFourPlayerMatchTurn,
  createFourPlayerMatchState,
  FOUR_PLAYER_MAX_SPELL_MANA,
  type FourPlayerMatchState,
} from "./four-player-match";
import { projectFourPlayerStateForSeat, type FourPlayerPrivateSeatState } from "./four-player-projection";
import { isFourPlayerSpellChainSupported } from "./four-player-spell-contract";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";

const unit = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Unit"
  && card.cost >= 1
  && card.cost <= 10
  && createFourPlayerCombatBodySnapshot(card),
);
assert.ok(unit, "fixture requires a positive-cost collectible Unit");

const structure = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Artifact"
  && card.archetypeKey === "structure"
  && card.cost >= 1
  && card.cost <= 10,
);
assert.ok(structure, "fixture requires a positive-cost collectible Structure");

const spell = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Spell"
  && card.cost >= 1
  && card.cost <= 10
  && card.archetypeKey !== "trap"
  && card.spell?.kind === "selfMill"
  && isFourPlayerSpellChainSupported(card.spell),
);
assert.ok(spell?.spell, "fixture requires a proactive supported selfMill Spell");

// Banking mirrors the mature 1v1 rule: the incoming player's unused regular
// mana joins the persistent spell-mana bank, capped at three, before refill.
let banking: FourPlayerMatchState = createFourPlayerMatchState("p1", undefined, 0);
banking = {
  ...banking,
  seats: {
    ...banking.seats,
    p2: { ...banking.seats.p2, mana: 2, maxMana: 4, spellMana: 2 },
  },
};
const banked = advanceFourPlayerMatchTurn(banking);
assert.equal(banked.turn.activeSeat, "p2");
assert.equal(banked.seats.p2.spellMana, FOUR_PLAYER_MAX_SPELL_MANA);
assert.equal(banked.seats.p2.maxMana, 5);
assert.equal(banked.seats.p2.mana, 5);

const capped = advanceFourPlayerMatchTurn({
  ...banking,
  seats: {
    ...banking.seats,
    p2: { ...banking.seats.p2, mana: 10, maxMana: 4, spellMana: FOUR_PLAYER_MAX_SPELL_MANA },
  },
});
assert.equal(capped.seats.p2.spellMana, FOUR_PLAYER_MAX_SPELL_MANA);

// Eligible cards spend regular mana first and only then consume banked spell mana.
const spellZones = createFourPlayerCardZones({
  p1: [spell.defId],
  p2: [unit.defId],
  p3: [unit.defId],
  p4: [unit.defId],
}, 1);
const regularForSpell = Math.max(0, spell.cost - 1);
const spellBaseRaw = createFourPlayerMatchState("p1", undefined, 0);
const spellBase: FourPlayerMatchState = {
  ...spellBaseRaw,
  phase: "main_1",
  seats: {
    ...spellBaseRaw.seats,
    p1: { ...spellBaseRaw.seats.p1, mana: regularForSpell, maxMana: Math.max(regularForSpell, 1), spellMana: 3 },
  },
};
const spellStaged = stageFourPlayerCardCast(
  spellBase,
  spellZones,
  "p1",
  spellZones.p1.hand[0]!.instanceId,
  "e-spell-mana-card",
);
assert.equal(spellStaged.match.seats.p1.mana, 0);
assert.equal(spellStaged.match.seats.p1.spellMana, 2, "eligible card should consume exactly one banked point after regular mana");

// Units and Structures remain regular-mana-only even when the bank is full.
for (const definition of [unit, structure]) {
  const zones = createFourPlayerCardZones({
    p1: [definition.defId],
    p2: [unit.defId],
    p3: [unit.defId],
    p4: [unit.defId],
  }, 1);
  const raw = createFourPlayerMatchState("p1", undefined, 0);
  const match: FourPlayerMatchState = {
    ...raw,
    phase: "main_1",
    seats: {
      ...raw.seats,
      p1: {
        ...raw.seats.p1,
        mana: Math.max(0, definition.cost - 1),
        maxMana: Math.max(1, definition.cost),
        spellMana: FOUR_PLAYER_MAX_SPELL_MANA,
      },
    },
  };
  assert.throws(
    () => stageFourPlayerCardCast(match, zones, "p1", zones.p1.hand[0]!.instanceId, `e-regular-only-${definition.defId}`),
    /Insufficient mana/,
    `${definition.defId} must not spend banked spell mana`,
  );
}

// Explicit activated-ability spellMana is a separate pool: no regular fallback.
const sourceDef = unit;
const originalAbilities = sourceDef.activatedAbilities;
sourceDef.activatedAbilities = [{
  description: "Spell-mana authority probe",
  cost: { spellMana: 2 },
  maxUsesPerRound: 1,
  effect: { kind: "draw", amount: 1, target: "none" },
}];
try {
  const body = createFourPlayerCombatBodySnapshot(sourceDef)!;
  const abilityZones = createFourPlayerCardZones({
    p1: [unit.defId],
    p2: [unit.defId],
    p3: [unit.defId],
    p4: [unit.defId],
  }, 0);
  const raw = createFourPlayerMatchState("p1", undefined, 0);
  let abilityMatch: FourPlayerMatchState = {
    ...raw,
    phase: "main_1",
    seats: {
      ...raw.seats,
      p1: { ...raw.seats.p1, mana: 0, maxMana: 1, spellMana: 2 },
    },
  };
  abilityMatch = {
    ...abilityMatch,
    battlefield: putFourPlayerBattlefieldObject(abilityMatch.battlefield!, {
      id: "spell-mana-source",
      defId: sourceDef.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: sourceDef.keywords ?? [],
      combat: body,
    }),
  };

  const options = fourPlayerActivatedAbilityOptions(abilityMatch, abilityZones, "p1");
  assert.equal(options.length, 1);
  assert.equal(options[0]?.spellManaCost, 2);

  const staged = stageFourPlayerActivatedAbility(
    abilityMatch,
    abilityZones,
    "p1",
    "spell-mana-source",
    "main",
    0,
    "e-spell-mana-ability",
  );
  assert.equal(staged.match.seats.p1.mana, 0);
  assert.equal(staged.match.seats.p1.spellMana, 0);

  const noBank: FourPlayerMatchState = {
    ...abilityMatch,
    seats: {
      ...abilityMatch.seats,
      p1: { ...abilityMatch.seats.p1, mana: 10, maxMana: 10, spellMana: 1 },
    },
  };
  assert.equal(fourPlayerActivatedAbilityOptions(noBank, abilityZones, "p1").length, 0);
  assert.throws(
    () => stageFourPlayerActivatedAbility(
      noBank,
      abilityZones,
      "p1",
      "spell-mana-source",
      "main",
      0,
      "e-spell-mana-no-fallback",
    ),
    /Not enough spell mana/,
  );

  const privateStates = FOUR_PLAYER_SEATS.reduce<Record<FourPlayerSeat, FourPlayerPrivateSeatState>>((result, seat) => {
    result[seat] = {
      seat,
      hand: abilityZones[seat].hand,
      deck: abilityZones[seat].deck,
      graveyard: abilityZones[seat].graveyard,
      publicBoard: [],
      nexusHealth: abilityMatch.seats[seat].life,
      eliminated: abilityMatch.seats[seat].eliminated,
    };
    return result;
  }, {} as Record<FourPlayerSeat, FourPlayerPrivateSeatState>);
  const projection = projectFourPlayerStateForSeat(privateStates, "p1", abilityMatch);
  assert.equal(projection.seats.p1.spellMana, 2);
  assert.equal(projection.seats.p2.spellMana, 0);
} finally {
  sourceDef.activatedAbilities = originalAbilities;
}

console.log("FOUR PLAYER SPELL MANA: PASS — banking cap, mixed card payment, regular-only card types, ability-only pool and public projection");