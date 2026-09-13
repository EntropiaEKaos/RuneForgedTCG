import { syncStudioBaseline } from "@/lib/studio-baseline-sync";

async function main() {
  const result = await syncStudioBaseline();
  console.log("STUDIO BASELINE SYNC: PASS", JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
