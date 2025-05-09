const { getDefaultConfig } = require('expo/metro-config');

// Add additional configurations for web
const config = getDefaultConfig(__dirname);

// Add resolver aliases for web
config.resolver.sourceExts = process.env.RN_SRC_EXT
  ? [...process.env.RN_SRC_EXT.split(',').concat(config.resolver.sourceExts), 'web.js', 'web.ts', 'web.tsx']
  : [...config.resolver.sourceExts, 'web.js', 'web.ts', 'web.tsx'];

// Add SVG support
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

// Export config
module.exports = config; 