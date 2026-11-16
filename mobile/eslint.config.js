// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '.expo/**',
    'dist/**',
    'web-build/**',
    'build/**',
    'coverage/**',
    'ios/**',
    'android/**',
    'expo-env.d.ts',
  ]),
  expoConfig,
]);
