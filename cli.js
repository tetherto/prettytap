const { bold, brightMagenta, faint, italic, magenta } = require('./colors')
const { JsonFormatter } = require('./json')
const { Parser } = require('./parser')
const { SpecFormatter } = require('./spec')

function getVersion() {
  try {
    return require('./package.json').version || '1.0.4'
  } catch {
    return '1.0.4'
  }
}

function printHelp() {
  console.log(`
  prettytap - Pretty-print TAP results

  Usage:
    myprocess | prettytap [-f spec]
    cat results.tap | prettytap [options]

  Options:
    -f, --format <format>  Output format: spec (default), json
    -h, --help             Show help
    -v, --version          Show version
`)
}

async function run(args = process.argv.slice(2)) {
  let formatName = 'spec'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-h' || arg === '--help') {
      printHelp()
      return
    }
    if (arg === '-v' || arg === '--version') {
      console.log(getVersion())
      return
    }
    if (arg === '-f' || arg === '--format') {
      formatName = args[i + 1] || 'spec'
      i++
    } else if (arg.startsWith('-f=')) {
      formatName = arg.slice(3)
    } else if (arg.startsWith('--format=')) {
      formatName = arg.slice(9)
    }
  }

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

module.exports = { run }
