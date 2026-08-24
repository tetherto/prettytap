const { test } = require('brittle')

const isBare = typeof Bare !== 'undefined'

test('CLI integration', { skip: isBare }, function (t) {
  const { execFileSync, spawn } = require('child_process')
  const fs = require('fs')
  const path = require('path')
  const exampleTap = require('./fixtures/example')

  const cli = path.resolve(__dirname, '../bin.js')

  function runCli(args, input) {
    return execFileSync(process.execPath, [cli].concat(args || []), {
      encoding: 'utf8',
      input
    })
  }

  async function waitUntil(check, ms = 1000) {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (check()) return
      await new Promise(function (resolve) {
        setTimeout(resolve, 15)
      })
    }
    throw new Error('timed out waiting for streamed output')
  }

  t.test('output help with --help', function (t) {
    const out = runCli(['--help'])
    t.ok(out.includes('prettytap - Pretty-print TAP results'))
    t.ok(out.includes('Options:'))
  })

  t.test('output version with --version', function (t) {
    const out = runCli(['--version']).trim()
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
    t.is(out, pkg.version)
  })

  t.test('format piped input with default spec formatter', function (t) {
    const out = runCli([], exampleTap)
    t.ok(out.includes('THIS IS A SUITE'))
    t.ok(out.includes('✓ this test should pass'))
    t.ok(out.includes('total:     6'))
  })

  t.test('format piped input with -f json', function (t) {
    const out = runCli(['-f', 'json'], exampleTap)
    const json = JSON.parse(out)
    t.is(json.version, 13)
    t.is(json.summary.total, 6)
    t.is(json.results.length, 6)
  })

  t.test('stream spec output before stdin ends', async function (t) {
    const child = spawn(process.execPath, [cli], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function (chunk) {
      out += chunk
    })

    child.stdin.write('TAP version 13\nok 1 first\n')
    await waitUntil(function () {
      return out.includes('first')
    })
    t.ok(out.includes('first'))
    t.absent(out.includes('total:'))

    child.stdin.write('ok 2 second\n1..2\n')
    child.stdin.end()
    await new Promise(function (resolve) {
      child.once('close', resolve)
    })
    t.ok(out.includes('second'))
    t.ok(out.includes('total:'))
  })

  t.test('wait for a slow first TAP line instead of exiting', async function (t) {
    const child = spawn(process.execPath, [cli], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function (chunk) {
      out += chunk
    })

    await new Promise(function (resolve) {
      setTimeout(resolve, 1500)
    })
    t.absent(out.includes('No input stream to format.'))

    child.stdin.write('TAP version 13\nok 1 late\n1..1\n')
    child.stdin.end()
    await new Promise(function (resolve) {
      child.once('close', resolve)
    })
    t.ok(out.includes('late'))
    t.ok(out.includes('total:'))
  })

  t.test('warn and use spec formatter when unknown format is passed', function (t) {
    const out = runCli(['-f', 'unknown'], exampleTap)
    t.ok(out.includes('Warning: unrecognized formatter'))
    t.ok(out.includes('using default formatter instead'))
    t.ok(out.includes('THIS IS A SUITE'))
  })
})
