const colors = require('./colors')
const { JsonFormatter, formatJson } = require('./json')
const { Parser, parse, isPassing, resultsToString } = require('./parser')
const { SpecFormatter, formatSpec } = require('./spec')

module.exports = {
  Parser,
  parse,
  isPassing,
  resultsToString,
  SpecFormatter,
  formatSpec,
  JsonFormatter,
  formatJson,
  ...colors
}
