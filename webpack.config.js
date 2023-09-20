const path = require('path');
const fse = require('fs-extra');

const srcDir = `./src/workers/`;
const destDir = `./dist/workers/`;
                                 
try {
  fse.copySync(srcDir, destDir, { overwrite: true })
  console.log('worker copied')
} catch (err) {
  console.error(err)
}

fse.readFile('logo.txt', 'utf8', function(err, data) {
  console.log('\x1b[36m', data.toString(), '\x1b[0m');
});

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