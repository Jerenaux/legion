const path = require('path');

module.exports = {
  mode: 'development', 
  entry: './src/index.ts', 
  target: 'node', // Important for Firebase functions
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
        '@legion/shared': path.resolve(__dirname, 'shared'),
      },
  },
  output: {
    path: path.resolve(__dirname, 'lib'), // Output directory
    filename: 'index.js', // Output file name
    libraryTarget: 'commonjs', // !! Important for Firebase functions
  },
  devtool: 'inline-source-map', // For development mode
};
