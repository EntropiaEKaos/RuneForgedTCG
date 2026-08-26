import { cleanupExpiredRuntimeData } from "../src/lib/session-cleanup";

cleanupExpiredRuntimeData()
  .then((result) => {
    console.log(JSON.stringify({ ok: true, ...result }));
    process.exit(0);
  })
  .catch((error) => {
    console.error("runtime session cleanup failed", error);
    process.exit(1);
  });
