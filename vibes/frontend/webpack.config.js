const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  // Create the default Expo web config
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config
  config.resolve.alias = {
    ...config.resolve.alias,
    // Resolve platform-specific modules
    'react-native$': 'react-native-web',
    // Add any additional aliases you need
  };

  // Configure for web environment
  if (config.mode === 'development') {
    config.devServer = {
      ...config.devServer,
      historyApiFallback: true,
      hot: true,
      port: 19006,
      host: '0.0.0.0',
      static: {
        directory: path.join(__dirname, 'web'),
        publicPath: '/'
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      allowedHosts: 'all',
      compress: true,
      headers: {
        'Content-Security-Policy': "default-src 'self' http: https: ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src * blob:;",
      },
    };
  }

  // Ensure output has correct public path
  config.output = {
    ...config.output,
    publicPath: '/',
  };

  // Add polyfill for global and process
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert/"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify/browser"),
    "url": require.resolve("url/"),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser"),
    "@google-cloud/speech": false,
  };

  return config;
}; 