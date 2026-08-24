const { test } = require('brittle')
const { faint, parse, red, setColorEnabled, SpecFormatter } = require('..')
const exampleTap = require('./fixtures/example')

test('Spec Formatter', (t) => {
  t.test('format TAP results to spec output string', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const results = parse(exampleTap)
    const formatter = new SpecFormatter()
    const formatted = formatter.formatToString(results)
    const summary = formatter.summaryToString()

    t.ok(formatted.includes('THIS IS A SUITE'))
    t.ok(formatted.includes('test 1'))
    t.ok(formatted.includes('✓ this test should pass'))
    t.ok(formatted.includes('test 2'))
    t.ok(formatted.includes('⨯ this test should fail'))
    t.ok(formatted.includes('operator: ok'))
    t.ok(formatted.includes('↷ skipped a test to ignore'))
    t.ok(formatted.includes('🗹TO DO: must do something'))
    t.ok(formatted.includes('⚠ Aborted: Somethings amiss'))

    t.ok(summary.includes('Failed Tests: There was 1 failure'))
    t.ok(summary.includes('total:     6'))
    t.ok(summary.includes('passing:   3'))
    t.ok(summary.includes('failing:   1'))
    t.ok(summary.includes('skipped:   1'))
    t.ok(summary.includes('tasks:     1'))
  })

  t.test('format multiple failures with correct pluralization', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const tap = `TAP version 13
1..2
not ok 1 first failure
not ok 2 second failure
`
    const results = parse(tap)
    const formatter = new SpecFormatter()
    formatter.formatToString(results)
    const summary = formatter.summaryToString()

    t.ok(summary.includes('Failed Tests: There were 2 failures'))
  })

  t.test('color error line red and source context gray', (t) => {
    setColorEnabled(true)
    t.teardown(function () {
      setColorEnabled(false)
    })

    const tap = `TAP version 13
1..1
not ok 1 applies member discount
  ---
  actual: 90
  expected: 80
  operator: is
  source: |
        t.is(100 * 0.9, 80);
    -----^
      });
  stack: |
    ./examples/demo.js:13:5
  ...
`
    const results = parse(tap)
    const formatted = new SpecFormatter().formatToString(results)

    t.ok(formatted.includes(red('        t.is(100 * 0.9, 80);')))
    t.ok(formatted.includes(red('    -----^')))
    t.ok(formatted.includes(faint('      });')))
    t.absent(formatted.includes(red('      });')))
    t.absent(formatted.includes(faint('        t.is(100 * 0.9, 80);')))
  })

  t.test('hide brittle runner summary comments', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const tap = `TAP version 13
ok 1 passing
1..1
# tests = 1/1 pass
# asserts = 1/1 pass
# time = 1ms
# ok
`
    const formatted = new SpecFormatter().formatToString(parse(tap))
    t.absent(formatted.includes('tests = 1/1 pass'))
    t.absent(/\n\s*ok\s*\n/.test(formatted))
  })

  t.test('format no tests found', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const tap = `TAP version 13
1..0
`
    const results = parse(tap)
    const formatter = new SpecFormatter()
    formatter.formatToString(results)
    const summary = formatter.summaryToString()

    t.ok(summary.includes('No tests found'))
  })
})
