import assert from "node:assert/strict";
import { apiRequestId, isMutationRequest, readBoundedJson, requestOriginAllowed, RequestBodyTooLargeError } from "./request-security";

async function main() {
  assert.equal(isMutationRequest("GET"), false);
  assert.equal(isMutationRequest("POST"), true);
  assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "GET" })), true);
  assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { origin: "https://game.example", host: "game.example" } })), true);
  assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { origin: "https://evil.example", host: "game.example" } })), false);
  assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST", headers: { "sec-fetch-site": "cross-site" } })), false);
  assert.equal(requestOriginAllowed(new Request("https://game.example/api/test", { method: "POST" })), true);
  assert.equal(apiRequestId(new Request("https://game.example", { headers: { "x-request-id": "request-12345" } })), "request-12345");
  assert.match(apiRequestId(new Request("https://game.example")), /^[0-9a-f-]{36}$/);

  const parsed = await readBoundedJson<{ ok: boolean }>(new Request("https://game.example/api/test", { method: "POST", body: JSON.stringify({ ok: true }) }), 64);
  assert.equal(parsed.ok, true);
  await assert.rejects(
    readBoundedJson(new Request("https://game.example/api/test", { method: "POST", body: JSON.stringify({ payload: "x".repeat(128) }) }), 32),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
    "actual streamed bytes must enforce the limit even without a Content-Length header",
  );
  await assert.rejects(
    readBoundedJson(new Request("https://game.example/api/test", { method: "POST", headers: { "content-length": "9999" }, body: "{}" }), 32),
    (error: unknown) => error instanceof RequestBodyTooLargeError,
    "oversized declared Content-Length must fail before parsing",
  );

  console.log("REQUEST SECURITY: PASS");
}

void main();
