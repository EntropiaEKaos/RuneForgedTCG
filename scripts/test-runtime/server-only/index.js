// Test-runtime shim for Next.js' compile-time `server-only` marker.
//
// Production/server bundles still import the real marker through Next. Bare Node
// integration scripts do not run through the Next resolver, so they need a
// no-op module only to cross that framework boundary. Keep this directory on
// NODE_PATH only for explicit server-side certification commands.
module.exports = {};
