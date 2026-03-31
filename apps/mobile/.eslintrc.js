module.exports = {
  extends: "../../.eslintrc.js",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: false,
    node: true,
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
    "import/namespace": "off",
    "import/no-unresolved": "off",
  },
  ignorePatterns: ["/dist/*", "/node_modules/*", "*.config.js", "babel.config.js"],
};
