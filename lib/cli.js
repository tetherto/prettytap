const { command, flag, header, rest, summary } = require('paparam')
const { bold, brightMagenta, brightRed, faint, italic, magenta } = require('./colors')
const { version } = require('../package.json')
const { JsonFormatter } = require('./json')
const { Parser } = require('./parser')
const { SpecFormatter } = require('./spec')

async function formatStdin(formatName) {
  if (process.stdin.isTTY) {
    console.log('No input stream to format.')
    console.log(faint('usage: myprocess | prettytap [-f spec]'))
    console.log(faint('       prettytap [-f spec] -- myprocess [args]'))
    return
  }

  process.stdin.setEncoding('utf-8')
  await format(process.stdin, formatName)
}

async function formatCommand(formatName, argv) {
  const child = require('child_process').spawn(argv[0], argv.slice(1), {
    stdio: ['inherit', 'pipe', 'inherit']
  })
  child.stdout.setEncoding('utf-8')

  const exited = new Promise(function (resolve) {
    child.on('exit', function (code, signal) {
      resolve(code === null || signal ? 1 : code)
    })
  })

  await format(child.stdout, formatName)
  const code = await exited
  if (code === 0) return

  process.stdout.write(`  ${bold(brightRed('runner exited:'))} ${brightRed(String(code))}\n\n`)
  process.exitCode = code
}

async function format(input, formatName) {
  let format = formatName.trim().toLowerCase()

  if (format !== 'spec' && format !== 'json') {
    process.stdout.write(
      `\n\n  ${brightMagenta('⚠ Warning: unrecognized formatter,')} ${bold(magenta(formatName))}\n  ${italic(faint('  (using default formatter instead)'))}\n\n`
    )
    format = 'spec'
  }

  const parser = new Parser()
  const spec = format === 'spec' ? new SpecFormatter() : null
  if (spec) spec.streamStart(parser.results)

  input.on('data', function (chunk) {
    writeEvents(spec, parser.write(chunk))
  })

  await new Promise(function (resolve, reject) {
    input.on('end', function () {
      writeEvents(spec, parser.end())

      if (spec) process.stdout.write(spec.summaryToString())
      else process.stdout.write(new JsonFormatter().formatToString(parser.results) + '\n')

      if (!parser.results.isPassing()) process.exitCode = 1

      resolve()
    })

    input.on('error', reject)
  })
}

function writeEvents(spec, events) {
  if (!spec) return

  let out = ''
  for (const event of events) {
    if (event.type === 'test') out += spec.streamTest(event.test)
    else if (event.type === 'yaml') out += spec.streamYaml(event.test)
    else if (event.type === 'bail') out += spec.streamBail(event.reason)
    else spec.streamComment(event.text, event.indented)
  }

  if (out) process.stdout.write(out)
}

function createCommand(argvCommand) {
  const cmd = command(
    'prettytap',
    header('prettytap - Pretty-print TAP results'),
    summary('Pretty-print TAP results'),
    flag('--format|-f [format]', 'Output format: spec, json').default('spec'),
    flag('--version|-v', 'Show version'),
    flag('--color', 'Force color output').hide(),
    flag('--no-color', 'Disable color output').hide(),
    rest(
      '[-- command args...]',
      'Run command, format its TAP output, exit non-zero if it or the tests fail'
    ),
    async function () {
      if (cmd.flags.version) {
        console.log(version)
        return
      }

      const format = cmd.flags.format || 'spec'
      if (argvCommand.length) await formatCommand(format, argvCommand)
      else await formatStdin(format)
    }
  )
  return cmd
}

async function run(argv = process.argv.slice(2)) {
  const sep = argv.indexOf('--')
  const command = sep === -1 ? [] : argv.slice(sep + 1)
  const parsed = createCommand(command).parse(sep === -1 ? argv : argv.slice(0, sep))
  if (parsed && parsed.running) await parsed.running
}

module.exports = { run }
