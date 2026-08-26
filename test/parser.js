const { test } = require('brittle')
const { parse, Parser, resultsToString } = require('..')

test('TAP 13 Parser', (t) => {
  t.test('parse TAP version and basic passing tests', (t) => {
    const tap = `TAP version 13
1..2
ok 1 first test
ok 2 second test
`
    const results = parse(tap)
    t.is(results.tapVersion, 13)
    t.ok(results.foundTapData)
    t.is(results.expectedTests, 2)
    t.is(results.totalTests, 2)
    t.is(results.passedTests, 2)
    t.is(results.failedTests, 0)
    t.is(results.tests.length, 2)
    t.is(results.tests[0].testNumber, 1)
    t.is(results.tests[0].description, 'first test')
    t.ok(results.tests[0].passed)
    t.ok(results.isPassing())
  })

  t.test('parse failing tests and diagnostics', (t) => {
    const tap = `TAP version 13
1..2
ok 1 first test
not ok 2 second test
`
    const results = parse(tap)
    t.is(results.totalTests, 2)
    t.is(results.passedTests, 1)
    t.is(results.failedTests, 1)
    t.absent(results.tests[1].passed)
    t.ok(results.tests[1].failed)
    t.absent(results.isPassing())
  })

  t.test('parse skip and todo directives', (t) => {
    const tap = `TAP version 13
1..3
ok 1 regular pass
not ok 2 # skip not ready yet
ok 3 # todo implement feature
`
    const results = parse(tap)
    t.is(results.totalTests, 3)
    t.is(results.passedTests, 1)
    t.is(results.skippedTests, 1)
    t.is(results.todoTests, 1)
    t.is(results.failedTests, 0)

    t.ok(results.tests[1].skipped)
    t.is(results.tests[1].directiveText, 'skip not ready yet')

    t.ok(results.tests[2].todo)
    t.is(results.tests[2].directiveText, 'todo implement feature')
    t.ok(results.isPassing())
  })

  t.test('attach yaml on indented assertions to that assertion', (t) => {
    const tap = `TAP version 13
ok 1 - JSON Formatter
# CLI integration
    not ok 1 - (output version) - should be equal
      ---
      actual: 1.0.2
      expected: 1.0.1
      operator: is
      source: |
            t.is(out, "1.0.1");
        -----^
      ...
not ok 2 - CLI integration
1..2
`
    const results = parse(tap)
    t.is(results.tests.length, 3)
    t.ok(results.tests[1].failed)
    t.ok(results.tests[1].yamlBytes.includes('actual: 1.0.2'))
    t.ok(results.tests[1].yamlBytes.includes('t.is(out, "1.0.1");'))
    t.absent(results.tests[0].yamlBytes.includes('actual: 1.0.2'))
  })

  t.test('ignore brittle runner summary comments', (t) => {
    const tap = `TAP version 13
ok 1 a
ok 2 b
1..2
# tests = 2/2 pass
# asserts = 2/2 pass
# time = 1ms
# ok
`
    const results = parse(tap)
    for (const test of results.tests) {
      t.alike(test.diagnostics, [])
    }
    t.alike(results.explanation, [])
  })

  t.test('parse YAML diagnostic blocks', (t) => {
    const tap = `TAP version 13
1..1
not ok 1 test with yaml
  ---
  message: "Failed"
  severity: fail
  ...
`
    const results = parse(tap)
    t.is(results.totalTests, 1)
    t.is(results.tests[0].yamlBytes, '  message: "Failed"\n  severity: fail\n')
  })

  t.test('parse explanations and diagnostics', (t) => {
    const tap = `TAP version 13
# Suite Name
# Group Name
ok 1 test 1
# Next Group
ok 2 test 2
1..2
`
    const results = parse(tap)
    t.alike(results.explanation, ['Suite Name', 'Group Name'])
    t.alike(results.tests[0].diagnostics, ['Next Group'])
  })

  t.test('nested subtest asserts do not fail a passing run', (t) => {
    const tap = `TAP version 13

# a
    ok 1 - should be equal
    ok 2 - expected truthy value
ok 1 - a # time = 0.2ms

1..1
# tests = 1/1 pass
`
    const results = parse(tap)
    t.is(results.expectedTests, 1)
    t.is(results.totalTests, 3)
    t.is(results.failedTests, 0)
    t.ok(results.isPassing())
  })

  t.test('missing tests relative to the plan fail', (t) => {
    const tap = `TAP version 13
1..3
ok 1 first test
ok 2 second test
`
    const results = parse(tap)
    t.is(results.totalTests, 2)
    t.is(results.failedTests, 0)
    t.absent(results.isPassing())
  })

  t.test('parse bailout lines', (t) => {
    const tap = `TAP version 13
Bail out! Database connection failed
`
    const results = parse(tap)
    t.ok(results.bailOut)
    t.is(results.bailOutReason, 'Database connection failed')
    t.absent(results.isPassing())
  })

  t.test('emit each test as its line arrives, before end', (t) => {
    const parser = new Parser()
    const events = parser.write('TAP version 13\nok 1 first\n')
    const tests = events.filter(function (e) {
      return e.type === 'test'
    })
    t.is(tests.length, 1)
    t.is(tests[0].test.description, 'first')
    t.ok(tests[0].test.passed)

    const more = parser.write('ok 2 second\n')
    t.is(
      more.filter(function (e) {
        return e.type === 'test'
      }).length,
      1
    )
    const second = more.find(function (e) {
      return e.type === 'test'
    })
    t.is(second.test.description, 'second')
  })

  t.test('emit yaml after the test it belongs to', (t) => {
    const parser = new Parser()
    parser.write('TAP version 13\nnot ok 1 fail\n')
    const yamlEvents = parser.write('  ---\n  actual: 1\n  ...\n').filter(function (e) {
      return e.type === 'yaml'
    })
    t.is(yamlEvents.length, 1)
    t.ok(yamlEvents[0].test.yamlBytes.includes('actual: 1'))
  })

  t.test('generate results string representation', (t) => {
    const tap = `TAP version 13
1..3
ok 1 test 1
not ok 2 test 2
ok 3 # skip test 3
`
    const results = parse(tap)
    const str = resultsToString(results)
    t.ok(str.includes('Overall result: FAIL'))
    t.ok(str.includes('Total tests run: 3'))
    t.ok(str.includes('Passed tests: 1'))
    t.ok(str.includes('Failed tests: 1'))
    t.ok(str.includes('Skipped tests: 1'))
  })
})
