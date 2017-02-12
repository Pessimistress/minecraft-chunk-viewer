const {resolve} = require('path');

const prod = process.argv.indexOf('-p') !== -1;

module.exports = {

  entry: [
    resolve('./src/app.js')
  ],

  output: {
    path: resolve('./dist'),
    filename: 'bundle.js'
  },

  devtool: prod ? '' : 'source-map',

  resolve: {
    alias: {
      webworkify: 'webworkify-webpack-dropin',
      'gl-matrix': resolve('./node_modules/gl-matrix/dist/gl-matrix.js')
    }
  },

  devServer: {
    contentBase: './static',
    filename: "bundle.js",
    hot: true,
    compress: true
  },

  module: {

    loaders: [{
      test: /\.json$/,
      loader: 'json-loader'
    }, {
      test: /\.js$/,
      loader: 'babel-loader',
      include: resolve('./src')
    }, {
      include: [resolve('./src')],
      loader: 'transform-loader',
      query: 'brfs-babel'
    }]
  },

  node: {
    fs: 'empty'
  }

};
