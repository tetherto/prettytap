const { test } = require('brittle')

const isBare = typeof Bare !== 'undefined'
const opts = { skip: isBare }

test('output help with --help', opts, (t) => {
  const out = runCli(['--help'])

  t.ok(out.includes('prettytap - Pretty-print TAP results'))
  t.ok(out.includes('Flags:'))
})

test('output version with --version', opts, (t) => {
  const fs = require('fs')
  const path = require('path')

  const out = runCli(['--version']).trim()
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

  t.is(out, pkg.version)
})

test('format piped input with default spec formatter', opts, (t) => {
  const out = runCli([], require('./fixtures/example'))

  t.ok(out.includes('THIS IS A SUITE'))
  t.ok(out.includes('✓ this test should pass'))
  t.ok(out.includes('total:     6'))
})

test('format piped input with -f json', opts, (t) => {
  const json = JSON.parse(runCli(['-f', 'json'], require('./fixtures/example')))

  t.is(json.version, 13)
  t.is(json.summary.total, 6)
  t.is(json.results.length, 6)
})

test('stream spec output before stdin ends', opts, async (t) => {
  const child = spawnCli()

  child.stdin.write('TAP version 13\nok 1 first\n')
  await child.until('first')
  t.ok(child.output.includes('first'))
  t.absent(child.output.includes('total:'))

  child.stdin.write('ok 2 second\n1..2\n')
  child.stdin.end()
  await child.closed

  t.ok(child.output.includes('second'))
  t.ok(child.output.includes('total:'))
})

test('wait for a slow first TAP line instead of exiting', opts, async (t) => {
  const child = spawnCli()

  await new Promise(function (resolve) {
    setTimeout(resolve, 1500)
  })
  t.absent(child.output.includes('No input stream to format.'))

  child.stdin.write('TAP version 13\nok 1 late\n1..1\n')
  child.stdin.end()
  await child.closed

  t.ok(child.output.includes('late'))
  t.ok(child.output.includes('total:'))
})

test('warn and use spec formatter when unknown format is passed', opts, (t) => {
  const out = runCli(['-f', 'unknown'], require('./fixtures/example'))

  t.ok(out.includes('Warning: unrecognized formatter'))
  t.ok(out.includes('using default formatter instead'))
  t.ok(out.includes('THIS IS A SUITE'))
})

test('exit non-zero when tests fail', opts, (t) => {
  const run = execCli([], require('./fixtures/example'))

  t.is(run.status, 1)
})

test('exit zero when every test passes', opts, (t) => {
  const run = execCli([], 'TAP version 13\n1..1\nok 1 all good\n')

  t.is(run.status, 0)
})

test('exit zero when nested subtest asserts exceed the plan', opts, (t) => {
  const tap = 'TAP version 13\n# a\n    ok 1 - assert\nok 1 - a\n1..1\n'
  const run = execCli([], tap)

  t.is(run.status, 0)
})

test('run a command and exit with its status when TAP passes but the runner crashes', opts, (t) => {
  const script =
    "process.stdout.write('TAP version 13\\n1..1\\nok 1 fine\\n'); setTimeout(() => { throw new Error('boom') })"
  const run = execCli(['--', process.execPath, '-e', script])

  t.ok(run.stdout.includes('fine'))
  t.ok(run.stderr.includes('boom'))
  t.ok(run.stdout.includes('runner exited: 1'))
  t.is(run.status, 1)
})

test('run a command and exit zero when both TAP and runner pass', opts, (t) => {
  const script = "process.stdout.write('TAP version 13\\n1..1\\nok 1 fine\\n')"
  const run = execCli(['-f', 'json', '--', process.execPath, '-e', script])

  t.is(JSON.parse(run.stdout).summary.total, 1)
  t.is(run.status, 0)
})

test('run a command and exit non-zero when TAP fails even if the runner exits zero', opts, (t) => {
  const script = "process.stdout.write('TAP version 13\\n1..1\\nnot ok 1 bad\\n')"
  const run = execCli(['--', process.execPath, '-e', script])

  t.is(run.status, 1)
})

function cliPath() {
  return require('path').resolve(__dirname, '../bin.js')
}

function runCli(args, input) {
  return execCli(args, input).stdout
}

function execCli(args, input) {
  return require('child_process').spawnSync(process.execPath, [cliPath()].concat(args), {
    encoding: 'utf8',
    input
  })
}

function spawnCli() {
  const child = require('child_process').spawn(process.execPath, [cliPath()], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const waiting = []

  child.output = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', function (chunk) {
    child.output += chunk
    for (const wait of waiting.splice(0)) {
      if (child.output.includes(wait.text)) wait.resolve()
      else waiting.push(wait)
    }
  })

  child.until = function (text) {
    if (child.output.includes(text)) return Promise.resolve()
    return new Promise(function (resolve) {
      waiting.push({ text, resolve })
    })
  }

  child.closed = new Promise(function (resolve) {
    child.once('close', resolve)
  })

  return child
}
