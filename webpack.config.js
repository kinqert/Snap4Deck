const path = require('path');

module.exports = {
  entry: {
    "snap4deck": './src/main.js',
    "snap4deck.min": './src/main.js'
  },
  mode: 'production',
  optimization: {
    minimize: true,
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: 'snap4deck'
  },
};