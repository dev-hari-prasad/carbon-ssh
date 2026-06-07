import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // --- SECURITY: Ban dangerous APIs (D5.5) ---
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "@typescript-eslint/no-implied-eval": "error",
      // Disallow dynamic code execution via strings
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='setTimeout'][arguments.0.type!='FunctionExpression'][arguments.0.type!='ArrowFunctionExpression']",
          message: "setTimeout with string argument is prohibited. Use a function reference.",
        },
        {
          selector:
            "CallExpression[callee.name='setInterval'][arguments.0.type!='FunctionExpression'][arguments.0.type!='ArrowFunctionExpression']",
          message: "setInterval with string argument is prohibited. Use a function reference.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "document",
          property: "write",
          message: "document.write() is prohibited. Use DOM manipulation APIs.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["child_process"],
              message:
                "child_process.exec is dangerous. Use execFile without shell:true, or the ssh2 library for SSH.",
            },
          ],
        },
      ],
      // --- END SECURITY ---
    },
  },
  eslintPluginPrettier,
);
