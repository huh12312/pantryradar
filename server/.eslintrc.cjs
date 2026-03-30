module.exports = {
  root: false,
  extends: ["../.eslintrc.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Allow unused vars with _ prefix (for DB schema placeholders)
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
  },
};
