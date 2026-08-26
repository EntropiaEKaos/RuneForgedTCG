import assert from "node:assert/strict";
import { apiRequestId, isMutationRequest, requestOriginAllowed } from "./request-security";

assert.equal(isMutationRequest("GET"), false);
assert.equal(isMutationRequest("POST"), true);
assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "GET" })), true);
assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { origin: "https://game.example", host: "game.example" } })), true);
assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { origin: "https://evil.example", host: "game.example" } })), false);
assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { "sec-fetch-site": "cross-site" } })), false);
assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST" })), true);
assert.equal(apiRequestId(new Request("https://game.example", { headers: { "x-request-id": "request-12345" } })), "request-12345");
assert.match(apiRequestId(new Request("https://game.example")), /^[0-9a-f-]{36}$/);

console.log("REQUEST SECURITY: PASS");
