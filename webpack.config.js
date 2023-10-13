const path = require('path');
const fse = require('fs-extra');

fse.readFile('logo.txt', 'utf8', function(err, data) {
  console.log('\x1b[36m', data.toString(), '\x1b[0m');
});

module.exports = {
  entry: {
    "snap4deck.min": './src/main.js',
    "workers/gltf-loader-worker": './src/workers/gltf-loader-worker.js',
    "workers/building-worker": './src/workers/building-worker.js',
  },
  mode: 'production',
  optimization: {
    minimize: false,
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: 'snap4deck'
  },
};