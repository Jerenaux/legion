const path = require('path');
const webpack = require('webpack');
const {sentryWebpackPlugin} = require('@sentry/webpack-plugin');

const isDocker = process.env.NODE_ENV === 'docker';
const isDeploy = process.env.DEPLOY === 'true';
const release = isDeploy ? `legion@${require('../../client/package.json').version}` : 'development';

module.exports = {
  mode: isDeploy ? 'production' : 'development',
  optimization: {minimize: false},
  // SDK runtime instrumentation must not be bundled; Firebase installs production dependencies.
  externals: [/^@sentry\//],
  entry: './src/index.ts', 
  target: 'node', // Important for Firebase functions
  stats: {
    warnings: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: isDocker ? 'tsconfig.docker.json' : 'tsconfig.json'
            }
          }
        ],
        exclude: /node_modules/
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
        '@legion/shared': path.resolve(__dirname, isDocker ? 'shared' : '../../shared'),
      },
  },
  output: {
    path: path.resolve(__dirname, 'lib'), // Output directory
    filename: 'index.js', // Output file name
    libraryTarget: 'commonjs', // !! Important for Firebase functions
  },
  plugins: [
    new webpack.DefinePlugin({'process.env.SENTRY_RELEASE': JSON.stringify(release)}),
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'dynetis-games',
      project: process.env.SENTRY_BACKEND_PROJECT,
      release: {name: release},
      sourcemaps: {assets: ['./lib/**']},
      telemetry: false,
    })] : []),
  ],
  devtool: isDeploy ? 'hidden-source-map' : 'inline-source-map',
};
