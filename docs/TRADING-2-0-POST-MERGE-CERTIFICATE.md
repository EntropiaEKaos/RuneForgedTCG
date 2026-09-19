# Trading 2.0 Post-Merge Certificate

## Certified merge

- Merge SHA: `6847f77354a59ac13826d2bbbaab2e39aec41cb7`
- Certified branch: `main`
- Rollback ref: `release/trading-2.0-certified-6847f773`
- Certification date: 2026-09-19

This document records the post-merge evidence for Trading 2.0. It is a provenance record only; it does not change runtime behavior.

## Post-merge workflow matrix

All ten workflows triggered for the exact merge SHA completed successfully:

1. CI #1625
2. Alpha Release Candidate #68
3. Ranked Release Certification #143
4. Alpha Starter Balance Evidence #753
5. Flagship Mana Rituals Visual Cert #884
6. Flagship Structures Visual Cert #887
7. Flagship Starter Signatures Visual Cert #880
8. Visual 4.2 Notebook Density Cert #654
9. Flagship Traps Visual Cert #882
10. Visual 4.3 Mobile Responsive Cert #628

No PR-head result was reused as post-merge evidence.

## Trading 2.0 browser evidence

The full CI browser gate executed `scripts/alpha-trading-2-visual-cert.mjs` against the exact merge SHA and reported:

`TRADING 2 VISUAL CERT: PASS — 2x2 composer + exact serialized request + no-Gold boundary captured`

Expected evidence:

- `61-trading-2-multicard-composer.png`
- `trading-2-visual-manifest.json`

The browser gate additionally verified no horizontal overflow and no severe runtime errors for the composer evidence.

## Artifact provenance

The exact-SHA workflows uploaded the following artifacts and digests:

- CI visual artifact SHA256: `fdca3c1d242110180907ea3ce248a581785c5bb01cceafe8d087a8db64d4c6cf`
- Alpha RC artifact SHA256: `18e615d2db4e8d8166cc91613db1b65976c34fed019083581202e6fa7d343f86`
- Ranked certification artifact SHA256: `63601714ba8bf0108f95cb8536c44ae2a466855b5d69977988851cc214f442ec`

The Alpha RC evidence explicitly matched deployment provenance to the exact workflow SHA.

## Release boundary

Trading 2.0 remains within the existing Marketplace authority boundary:

- direct trades are card-for-card;
- no Gold is carried inside a direct trade;
- Dust remains non-transferable;
- exact collectible identity is authoritative through `card_assets`;
- aggregate gameplay ownership remains authoritative through `player_cards`;
- escrow remains authoritative through `card_asset_locks`.

## Rollback

For emergency source rollback, use the certified ref:

`release/trading-2.0-certified-6847f773`

Do not force-move that ref. Any later release must create a new certified rollback ref rather than reusing this one.
