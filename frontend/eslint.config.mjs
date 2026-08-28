import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Downgraded from error to warning, deliberately.
      //
      // The rule flags any setState reachable from an effect, including calls
      // that only run inside a promise continuation after an await. Every
      // remaining report in this codebase is that shape: an effect calls an
      // async fetch whose setState happens after the request resolves, which
      // cannot cascade a synchronous render.
      //
      // The genuine violations the rule caught -- prop-to-state sync effects
      // and a nav-close effect -- were fixed rather than silenced (see
      // app/settings/page.tsx, app/tasks/[id]/page.tsx, components/app/Shell.tsx).
      // Keeping this as a warning preserves the signal for new code without
      // failing CI on a false positive.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
