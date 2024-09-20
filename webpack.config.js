const path = require('path');

module.exports = {
  entry: './src/index.js',  // Path to your main JavaScript file
  output: {
    filename: 'bundle.js',  // Name of the output file
    path: path.resolve(__dirname, 'dist'),  // Output folder
  },
  mode: 'development'  // or 'production'
};