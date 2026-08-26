import assert from "node:assert/strict";
import { sanitizedLogDetails } from "./operational-logger";

const clean = sanitizedLogDetails({ user: "tester", password: "hidden", nested: { accessToken: "hidden", value: 3 } });
assert.equal(clean.user, "tester");
assert.equal(clean.password, "[redacted]");
assert.deepEqual(clean.nested, { accessToken: "[redacted]", value: 3 });
console.log("OPERATIONAL LOGGER: PASS");
