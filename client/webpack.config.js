const path = require('path');
module.exports = {
  entry: './src/app.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'app.js'
  }
};

