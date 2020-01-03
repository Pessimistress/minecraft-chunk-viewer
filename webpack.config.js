const {resolve} = require('path');

const prod = process.argv.NODE_ENV === 'production';

module.exports = {
  mode: prod ? 'production' : 'development',

  entry: [
    resolve('./src/app.js')
  ],

  output: {
    path: resolve('./dist'),
    filename: 'bundle.js'
  },

  devtool: prod ? false : 'source-map',

  devServer: {
    contentBase: './static',
    filename: "bundle.js",
    hot: true,
    compress: true
  },

  module: {
    rules: [
      {
        // Transpile ES6 to ES5 with babel
        // Remove if your app does not use JSX or you don't need to support old browsers
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/],
        options: {
          presets: ['@babel/preset-env', '@babel/preset-react'],
          plugins: ['@babel/plugin-proposal-class-properties']
        }
      }
    ]
  },

  node: {
    fs: 'empty'
  }

};
