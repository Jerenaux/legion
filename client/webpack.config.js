const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const isDocker = process.env.IS_DOCKER;

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  devServer: {
    historyApiFallback: true,
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
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      '@legion/shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'public'),
      'phaser': path.resolve(__dirname, 'node_modules/phaser/dist/phaser.js'),
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    }),
    new Dotenv({
      systemvars: true // Load all system variables as well
    })
  ]
};
