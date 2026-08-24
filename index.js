const colors = require('./lib/colors')
const { JsonFormatter, formatJson } = require('./lib/json')
const { Parser, parse, isPassing, resultsToString } = require('./lib/parser')
const { SpecFormatter, formatSpec } = require('./lib/spec')

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
