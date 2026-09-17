import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-plugin-react-hooks 7's new rule flags any setState call
      // reachable from an effect body, including standard fetch-on-mount
      // and isMounted-guard patterns (it even flags shadcn's own generated
      // use-mobile.ts). Kept as a warning rather than off since it's still
      // useful signal for genuine synchronous-derived-state bugs.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
