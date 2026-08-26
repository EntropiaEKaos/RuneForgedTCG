import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const reactHooksPlugin = nextCoreWebVitals
  .find((config) => config.plugins?.["react-hooks"])
  ?.plugins?.["react-hooks"];

if (!reactHooksPlugin) {
  throw new Error("eslint-config-next/core-web-vitals did not expose the react-hooks plugin");
}

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    // Flat-config rules must register their plugin in the same config object.
    // Reuse Next's pinned plugin instance instead of introducing a second copy/version.
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    // Existing client views intentionally hydrate local state and fetch remote data from effects.
    // Keep the React 19 advisory visible without changing the underlying rule semantics.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
