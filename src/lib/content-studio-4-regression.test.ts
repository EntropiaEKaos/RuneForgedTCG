import { validateLiveOps } from "./live-ops-rules";

const bad = validateLiveOps("promotions", { startsAt:"2026-10-02", endsAt:"2026-10-01", conditions:{}, offers:[{price:-1}] });
if (bad.passed || bad.errors.length < 2) throw new Error("Live Ops validation regression failed");
const good = validateLiveOps("events", { startsAt:"2026-10-01", endsAt:"2026-10-02", rules:{mode:"ranked",missions:[]}, rewards:[] });
if (!good.passed) throw new Error("Valid event was rejected");
console.log("Content Studio 4 regression tests passed.");
