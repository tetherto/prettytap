const { command, flag, header, summary } = require('paparam')
const { bold, brightMagenta, faint, italic, magenta } = require('./colors')
const { version } = require('../package.json')
const { JsonFormatter } = require('./json')
const { Parser } = require('./parser')
const { SpecFormatter } = require('./spec')

async function formatStdin(formatName) {
  let format = formatName.trim().toLowerCase()

  if (format !== 'spec' && format !== 'json') {
    process.stderr.write(
      `\n\n  ${brightMagenta('⚠ Warning: unrecognized formatter,')} ${bold(magenta(formatName))}\n  ${italic(faint('  (using default formatter instead)'))}\n\n`
    )
    format = 'spec'
  }

  if (process.stdin.isTTY) {
    console.log('No input stream to format.')
    console.log(faint('usage: myprocess | prettytap [-f spec]'))
    return
  }

  const parser = new Parser()
  const spec = format === 'spec' ? new SpecFormatter() : null
  if (spec) spec.streamStart(parser.results)

  process.stdin.setEncoding('utf-8')

  process.stdin.on('data', function (chunk) {
    writeEvents(spec, parser.write(chunk))
  })

  await new Promise(function (resolve, reject) {
    process.stdin.on('end', function () {
      writeEvents(spec, parser.end())

      if (spec) process.stdout.write(spec.summaryToString())
      else process.stdout.write(new JsonFormatter().formatToString(parser.results) + '\n')

      if (!parser.results.isPassing()) process.exitCode = 1

      resolve()
    })

    process.stdin.on('error', reject)
  })
}

function writeEvents(spec, events) {
  if (!spec) return

  let out = ''
  for (const event of events) {
    if (event.type === 'test') out += spec.streamTest(event.test)
    else if (event.type === 'yaml') out += spec.streamYaml(event.test)
    else if (event.type === 'bail') out += spec.streamBail(event.reason)
    else spec.streamComment(event.text)
  }

  if (out) process.stdout.write(out)
}

function createCommand() {
  const cmd = command(
    'prettytap',
    header('prettytap - Pretty-print TAP results'),
    summary('Pretty-print TAP results'),
    flag('--format|-f [format]', 'Output format: spec, json').default('spec'),
    flag('--version|-v', 'Show version'),
    flag('--color', 'Force color output').hide(),
    flag('--no-color', 'Disable color output').hide(),
    async function () {
      if (cmd.flags.version) {
        console.log(version)
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
