const { command, flag, header, summary } = require('paparam')
const { bold, brightMagenta, faint, italic, magenta } = require('./colors')
const { JsonFormatter } = require('./json')
const { Parser } = require('./parser')
const { SpecFormatter } = require('./spec')

function getVersion() {
  try {
    return require('../package.json').version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

async function formatStdin(formatName) {
  let formatter
  const normalizedFormat = formatName.trim().toLowerCase()

  switch (normalizedFormat) {
    case 'spec':
      formatter = new SpecFormatter()
      break
    case 'json':
      formatter = new JsonFormatter()
      break
    default:
      console.log(
        `\n\n  ${brightMagenta('\u26A0 Warning: unrecognized formatter,')} ${bold(magenta(formatName))}\n  ${italic(faint('  (using default formatter instead)'))}\n`
      )
      formatter = new SpecFormatter()
      break
  }

  if (process.stdin.isTTY) {
    console.log('No input stream to format.')
    console.log(faint('usage: myprocess | prettytap [-f spec]'))
    return
  }

  const parser = new Parser()
  const spec = formatter instanceof SpecFormatter ? formatter : null
  if (spec) spec.streamStart(parser.results)

  process.stdin.setEncoding('utf-8')

  process.stdin.on('data', function (chunk) {
    applyEvents(spec, parser.write(chunk))
  })

  await new Promise(function (resolve, reject) {
    process.stdin.on('end', function () {
      applyEvents(spec, parser.end())
      if (spec) {
        spec.summary()
      } else {
        formatter.format(parser.results)
        formatter.summary()
      }
      resolve()
    })

    process.stdin.on('error', reject)
  })
}

function applyEvents(spec, events) {
  if (!spec) return
  for (const event of events) {
    if (event.type === 'comment') spec.streamComment(event.text)
    else if (event.type === 'test') spec.streamTest(event.test)
    else if (event.type === 'yaml') spec.streamYaml(event.test)
    else spec.streamBail(event.reason)
  }
}

function createCommand() {
  const cmd = command(
    'prettytap',
    header('prettytap - Pretty-print TAP results'),
    summary('Pretty-print TAP results'),
    flag('--format|-f [format]', 'Output format: spec, json').default('spec'),
    flag('--version|-v', 'Show version'),
    flag('--color', 'Force color output').hide(),
    async function () {
      if (cmd.flags.version) {
        console.log(getVersion())
        return
      }

      await formatStdin(cmd.flags.format || 'spec')
    }
  )
  return cmd
}

async function run(argv) {
  const parsed = createCommand().parse(argv)
  if (parsed && parsed.running) await parsed.running
}

module.exports = { run }
