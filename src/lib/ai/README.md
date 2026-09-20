# RuneForged AI Gateway

Provider-neutral server-side gateway for generative AI.

## Architecture

Game/UI -> server use-case -> AiGateway -> AiProvider -> Groq (or future provider).

The deterministic RuneForged engine remains authoritative. Generative AI may explain,
recommend, tutor or propose actions, but it must never mutate authoritative game state
without normal engine validation.

## Environment

- `AI_PROVIDER=groq`
- `GROQ_API_KEY` (server secret; never expose with NEXT_PUBLIC_)
- `GROQ_MODEL=openai/gpt-oss-20b` (optional)
- `GROQ_BASE_URL=https://api.groq.com/openai/v1` (optional)

No key is committed to source control.

## Next integration layer

Add narrow server-side use cases (tutorial, card explanation, deck assistant), JSON-schema
contracts for proposed actions, metrics/rate limits, and an admin control surface. Keep the
existing deterministic `src/game/ai-core.ts` intact until benchmark/regression gates prove
a replacement is safe.
