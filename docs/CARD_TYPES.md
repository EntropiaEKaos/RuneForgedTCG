# RuneForge Card Types

## Structural vs. semantic types

RuneForge keeps six stable structural engine types for persistence, replay compatibility and network DTOs: `Unit`, `Spell`, `Enchantment`, `Artifact`, `Equipment` and `Sentinela`.

Gameplay-facing card families that need distinct timing/resource rules are implemented as certified semantic types through `archetypeKey` / `archetypeName`. This lets the game add meaningful card types without invalidating old match logs or requiring a second engine path.

## Certified semantic types

### 🏰 Estrutura (`structure`)

- Structural base: `Artifact`.
- Enters the permanent battlefield zone and consumes one permanent slot.
- Uses **regular mana only**.
- Does **not** spend spell mana.
- Does **not** increment `spellsCast`.
- Has permanent HP (`maxHealth`, default 3).
- May use Artifact-compatible persistent contracts such as activated abilities, triggers and Auras when those contracts are otherwise valid.
- If a Structure is negated while pending on the reaction stack, its committed cost still uses regular mana and still does not count as a spell cast.

### 🜂 Ritual (`ritual`)

- Structural base: `Spell`.
- Requires an executable spell effect.
- Uses the ordinary spell-mana payment contract.
- Counts as a spell cast.
- Can only be initiated proactively during the owner's main phase.
- Cannot have `Fast` or `Burst` speed.
- Cannot be offered or accepted as a reaction response.

### 🪤 Armadilha (`trap`)

- Structural base: `Spell`.
- Requires an executable spell effect.
- Uses the ordinary spell-mana payment contract.
- Counts as a spell cast when it resolves/commits.
- Is **reaction-only**: normal `play` and `cast` reducer opcodes fail closed.
- Must declare `Fast` or `Burst` so the existing reaction-speed authority remains explicit.
- `Fast` follows RuneForge's existing narrower reaction windows; `Burst` follows the existing broad response contract, including spell responses where legal.

## Card Studio

Card Studio exposes the three certified types in **Card archetype / custom type**, above user-defined archetypes. Selecting one automatically chooses its structural base and normalizes incompatible fields.

The server remains authoritative. POST, PUT, bulk import, sandbox and content QA all run `validateAuthorableCardWithSemanticTypes`, so a modified browser cannot save an invalid certified subtype.

## Compatibility rule

Do not add these names to the structural `CardType` union. Their stable persisted type remains their documented base type. Player-facing rendering uses `archetypeName`, while engine timing/resource decisions use the certified `archetypeKey` contract.

## Certification

`src/game/semantic-card-types.test.ts` covers authoring, regular-vs-spell mana, `spellsCast`, permanent placement, proactive Trap rejection, real reaction resolution, Structure behavior through the stack, and legacy Artifact regression.

`src/lib/semantic-card-types-regression.test.ts` guards the Studio/API/QA/engine wiring so certified semantic types cannot silently regress into cosmetic labels.
