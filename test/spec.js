const { test } = require('brittle')
const { faint, parse, Parser, red, setColorEnabled, SpecFormatter } = require('..')
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

  t.test('keep every diagnostic after the group heading', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const tap = `TAP version 13
# my group
    ok 1 - first
# next group
# reply: "hello"
# tokens = not a runner comment
    ok 2 - second
1..2
`
    const formatted = new SpecFormatter().formatToString(parse(tap))

    t.ok(formatted.includes('next group'), 'the first one is still the heading')
    t.ok(formatted.includes('reply: "hello"'), 'the second is no longer dropped')
    t.ok(formatted.includes('tokens = not a runner comment'), 'and so is the third')
  })

  t.test('keep diagnostics that follow the last test', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const tap = `TAP version 13
    ok 1 - only
# trailing one
# trailing two
1..1
`
    const formatted = new SpecFormatter().formatToString(parse(tap))

    t.ok(formatted.includes('trailing one'))
    t.ok(formatted.includes('trailing two'))
  })

  t.test('stream every diagnostic, not just the heading', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const parser = new Parser()
    const formatter = new SpecFormatter()
    formatter.streamStart(parser.results)

    let out = ''
    const tap = `TAP version 13
# my group
    ok 1 - first
# next group
# reply: "hello"
# and more
    ok 2 - second
1..2
`
    for (const event of parser.write(tap)) {
      if (event.type === 'test') out += formatter.streamTest(event.test)
      else if (event.type === 'yaml') out += formatter.streamYaml(event.test)
      else if (event.type !== 'bail') formatter.streamComment(event.text)
    }
    out += formatter.summaryToString()

    t.ok(out.includes('next group'), 'the heading survives')
    t.ok(out.includes('reply: "hello"'), 'and the diagnostics behind it')
    t.ok(out.includes('and more'))
  })

  t.test('stream trailing diagnostics into the summary', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    const parser = new Parser()
    const formatter = new SpecFormatter()
    formatter.streamStart(parser.results)

    let out = ''
    for (const event of parser.write('TAP version 13\n    ok 1 - only\n# after the end\n1..1\n')) {
      if (event.type === 'test') out += formatter.streamTest(event.test)
      else if (event.type === 'yaml') out += formatter.streamYaml(event.test)
      else if (event.type !== 'bail') formatter.streamComment(event.text)
    }
    out += formatter.summaryToString()

    t.ok(out.includes('after the end'))
  })

  t.test('an indented comment is a diagnostic, not a heading', (t) => {
    setColorEnabled(false)
    t.teardown(function () {
      setColorEnabled(true)
    })

    // brittle names a test at column 0 and indents what the test itself prints
    const tap = `TAP version 13
# first test
    # reply: "hello"
    ok 1 - an assertion
ok 1 - first test
# second test
    # reply: "there"
    ok 1 - an assertion
ok 2 - second test
1..2
`
    const lines = new SpecFormatter().formatToString(parse(tap)).split('\n')

    t.ok(lines.includes('  second test'), 'the test name is a heading, at two spaces')
    t.ok(lines.includes('    reply: "hello"'), 'the diagnostic sits with the assertions, at four')
    t.ok(lines.includes('    reply: "there"'))
    t.absent(lines.includes('  reply: "there"'), 'and is never promoted to a heading')
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
