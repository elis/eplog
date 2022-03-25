module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  parser: '@babel/eslint-parser',
  extends: ['standard', 'prettier', 'eslint:recommended'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
  },
}
