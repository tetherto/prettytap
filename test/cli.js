const { test } = require('brittle')

const isBare = typeof Bare !== 'undefined'
const opts = { skip: isBare }

test('output help with --help', opts, (t) => {
  const out = runCli(['--help']).stdout

  t.ok(out.includes('prettytap - Pretty-print TAP results'))
  t.ok(out.includes('Flags:'))
})

test('output version with --version', opts, (t) => {
  const fs = require('fs')
  const path = require('path')

  const out = runCli(['--version']).stdout.trim()
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

  t.is(out, pkg.version)
})

test('format piped input with default spec formatter', opts, (t) => {
  const out = runCli([], require('./fixtures/example')).stdout

  t.ok(out.includes('THIS IS A SUITE'))
  t.ok(out.includes('✓ this test should pass'))
  t.ok(out.includes('total:     6'))
})

test('exit non-zero on failing TAP and zero on passing TAP', opts, (t) => {
  t.is(runCli([], 'TAP version 13\nnot ok 1 boom\n1..1\n').status, 1)
  t.is(runCli([], 'TAP version 13\nok 1 fine\n1..1\n').status, 0)
  t.is(runCli([], 'TAP version 13\nok 1 fine\nBail out! nope\n1..1\n').status, 1)
})

test('format piped input with -f json', opts, (t) => {
  const json = JSON.parse(runCli(['-f', 'json'], require('./fixtures/example')).stdout)

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
  const res = runCli(['-f', 'unknown'], require('./fixtures/example'))

  t.ok(res.stderr.includes('Warning: unrecognized formatter'))
  t.ok(res.stderr.includes('using default formatter instead'))
  t.absent(res.stdout.includes('Warning: unrecognized formatter'))
  t.ok(res.stdout.includes('THIS IS A SUITE'))
})

test('keep stdout clean enough for jq when -f json', opts, (t) => {
  const res = runCli(['-f', 'jsn'], 'TAP version 13\nok 1 fine\n1..1\n')

  t.ok(res.stderr.includes('Warning: unrecognized formatter'))
  t.absent(res.stdout.includes('Warning'))
})

function cliPath() {
  return require('path').resolve(__dirname, '../bin.js')
}

function runCli(args, input) {
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
