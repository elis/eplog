const { initCLI } = require('./src/cli');

const main = () =>
  initCLI().parse(process.argv)

module.exports = main
