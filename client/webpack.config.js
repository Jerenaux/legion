const {
  sentryWebpackPlugin
} = require("@sentry/webpack-plugin");

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const webpack = require('webpack');

const isDocker = process.env.IS_DOCKER;
const isProduction = process.env.NODE_ENV === 'production';
const isElectron = process.env.BUILD_TARGET === 'electron';
console.log('BUILD_TARGET:', process.env.BUILD_TARGET);
console.log('isElectron:', isElectron);

const sharedPrefix = isDocker ? '' : '../';

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',

  devServer: {
    historyApiFallback: true,
    headers: {
      'Permissions-Policy': '*=()'
    }
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: isDocker ? 'tsconfig.docker.json' : 'tsconfig.json',
              errorFormatter: (error, colors) => {
                try {
                  // Function to replace absolute paths with relative ones
                  const replaceAbsolutePath = (str) => {
                    if (typeof str === 'string') {
                      return str.replace(/\/usr\/src\/app\//g, '');
                    }
                    return str;
                  };

                  let errorMessage = '';

                  // Add file location
                  if (error.file) {
                    errorMessage += colors.cyan(replaceAbsolutePath(error.file));
                    if (error.line) {
                      errorMessage += colors.cyan(':' + error.line);
                      if (error.character) {
                        errorMessage += colors.cyan(':' + error.character);
                      }
                    }
                    errorMessage += '\n';
                  }

                  // Add error severity and content
                  errorMessage += colors.red(error.severity.toUpperCase() + ': ') + error.content;

                  return errorMessage;
                } catch (formattingError) {
                  console.error('Error in errorFormatter:', formattingError);
                  return colors.red('ERROR: Unable to format error message');
                }
              }
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.jsx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', ['@babel/preset-react', { pragma: 'h' }]]
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(wav|mp3|ogg)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.json$/i,
        type: 'json'
      }
    ]
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      '@legion/shared': path.resolve(__dirname, `${sharedPrefix}shared`),
      '@assets': path.resolve(__dirname, 'public'),
      'phaser': path.resolve(__dirname, 'node_modules/phaser/dist/phaser.js'),
    }
  },

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      hash: !isElectron,
    }),
    new webpack.DefinePlugin(Object.fromEntries([
      'API_URL', 'GAME_SERVER_URL', 'MATCHMAKER_URL',
      'USE_FIREBASE_EMULATOR', 'FIREBASE_AUTH_EMULATOR_HOST',
    ].map(key => [`process.env.${key}`, JSON.stringify(process.env[key] || '')]))),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/favicon.ico', to: 'favicon.ico' },
      ]
    }),
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "dynetis-games",
      project: "javascript-react"
    })] : []),
    new NodePolyfillPlugin(),
  ],

  devtool: isProduction ? "hidden-source-map" : "source-map"
};
