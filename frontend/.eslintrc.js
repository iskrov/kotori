module.exports = {
  extends: [
    'eslint:recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  rules: {
    // Code Quality Rules
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-unreachable': 'error',
    'complexity': ['error', { max: 10 }],
    
    // Security Rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Performance Rules
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error'
  },
  env: {
    es6: true,
    node: true,
    jest: true,
    browser: true
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'build/',
    '*.js.map',
    'coverage/'
  ]
}; 