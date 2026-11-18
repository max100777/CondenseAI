import tseslint from "typescript-eslint";
export default [
  {
    files: ["src/dcim/**/*.{ts,tsx}", "e2e/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-debugger": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-constant-condition": "error",
    },
  },
];
