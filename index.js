const { initCLI } = require('./src/cli')
const { propToText, valuefy } = require('./src/notion')

const main = () =>
  initCLI().parse(process.argv)

module.exports = main
module.exports.propToText = propToText
module.exports.valuefy = valuefy
