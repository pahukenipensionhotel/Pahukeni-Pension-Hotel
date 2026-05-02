import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  {
    ignores: [
      "src/functions-notify-skeleton.ts",
      "**/node_modules/**",
      "dist/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn"],
    },
  },
);
