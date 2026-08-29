import assert from "node:assert/strict";
import {
  ALPHA_FIRST_MATCH_DIFFICULTY,
  ALPHA_ONBOARDING_COMPLETE,
  ALPHA_ONBOARDING_STORAGE_KEY,
  shouldShowAlphaOnboarding,
} from "./alpha-onboarding";

assert.equal(ALPHA_FIRST_MATCH_DIFFICULTY, "apprentice", "first Alpha match must start at the accessible AI tier");
assert.equal(ALPHA_ONBOARDING_STORAGE_KEY, "runeforge_alpha_onboarding");
assert.equal(ALPHA_ONBOARDING_COMPLETE, "complete");
assert.equal(shouldShowAlphaOnboarding({ created: true, completed: false }), true, "brand-new players should see onboarding once");
assert.equal(shouldShowAlphaOnboarding({ created: true, completed: true }), false, "completed onboarding must not repeat");
assert.equal(shouldShowAlphaOnboarding({ created: false, completed: false }), false, "returning sessions must not be forced through onboarding");
assert.equal(shouldShowAlphaOnboarding({}), false, "ambiguous session state must fail closed to normal play, not pretend it is a new account");

console.log("ALPHA FIRST-RUN ONBOARDING: PASS");
