const Module = require("node:module");
const path = require("node:path");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const mapped = typeof request === "string" && request.startsWith("@/")
    ? path.join(process.cwd(), "src", request.slice(2))
    : request;
  return originalResolveFilename.call(this, mapped, parent, isMain, options);
};
