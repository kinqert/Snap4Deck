const path = require('path');

module.exports = {
  entry: './src/main.js',
  mode: 'production',
  optimization: {
        minimize: false
    },
  output: {
    filename: 'snap4deck.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'snap4deck'
  },
};