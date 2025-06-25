module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    
    // General rules
    'no-console': 'off', // Allow console.log for server logs
    'prefer-const': 'error',
    'no-var': 'error',
    
    // Import/Export rules
    'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
  },
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js', // Ignore existing JavaScript files during migration
    'public/',
    'uploads/',
    'transcripts/',
    'history/',
  ],
};