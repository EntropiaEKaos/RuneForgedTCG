import fs from "node:fs";
import path from "node:path";

const mountPath = path.resolve("src/game/presentation/phaser/PhaserBattlefieldMount.tsx");
const sequencePath = path.resolve("src/game/presentation/phaser/BattlefieldDemoSequence.ts");
const mount = fs.readFileSync(mountPath, "utf8");
const sequence = fs.readFileSync(sequencePath, "utf8");

const requiredMountContracts = [
  'aria-label="Phaser Battlefield Lab canvas"',
  'demo: {demo.beat}',
  'buildDeterministicBattlefieldDemoSequence(scenario, "high")',
  'beat: "complete"',
  '"DEMO"',
];

const requiredSequenceContracts = [
  'id: "fireball"',
  'id: "damage"',
  'id: "death"',
  'id: "priority"',
  'fxKey: "spell.fireball"',
];

for (const contract of requiredMountContracts) {
  if (!mount.includes(contract)) throw new Error(`battlefield screenshot cert: missing mount contract: ${contract}`);
}
for (const contract of requiredSequenceContracts) {
  if (!sequence.includes(contract)) throw new Error(`battlefield screenshot cert: missing sequence contract: ${contract}`);
}

const capturePlan = {
  scenario: "commander-4p",
  quality: "high",
  viewport: { width: 1440, height: 900 },
  canvas: { minWidth: 640, height: 560 },
  trigger: "DEMO",
  captures: [
    { id: "fireball", atMs: 310, expectedBeat: "fireball" },
    { id: "damage", atMs: 880, expectedBeat: "damage" },
    { id: "death", atMs: 1450, expectedBeat: "death" },
    { id: "priority", atMs: 2180, expectedBeat: "priority" },
  ],
};

fs.mkdirSync(path.resolve("artifacts/battlefield-screenshot-cert"), { recursive: true });
fs.writeFileSync(
  path.resolve("artifacts/battlefield-screenshot-cert/capture-plan.json"),
  `${JSON.stringify(capturePlan, null, 2)}\n`,
  "utf8",
);

console.log("battlefield screenshot certification contract: ok");
console.log(JSON.stringify(capturePlan));
