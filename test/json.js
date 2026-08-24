const { test } = require('brittle')
const { JsonFormatter, parse } = require('..')
const exampleTap = require('./fixtures/example')

test('JSON Formatter', function (t) {
  t.test('match expected JSON structure on example.txt', function (t) {
    const results = parse(exampleTap)
    const formatter = new JsonFormatter()
    const json = formatter.toJson(results)

    t.is(json.version, 13)
    t.alike(json.summary, {
      total: 6,
      passed: 3,
      failed: 1,
      skipped: 1,
      todo: 1,
      expected: 6,
      bailout: true,
      bailout_reason: 'Somethings amiss',
      failures: [
        {
          suite: 'THIS IS A SUITE',
          group: 'test 2',
          test_number: 2,
          passed: false,
          description: 'this test should fail',
          info: 'operator: ok\n    expected: true\n    actual:   false\n    at: Test.<anonymous> (/Users/khanh.nguyen/tap-spec/test.js:13:15)'
        }
      ]
    })

    t.is(json.results.length, 6)
    t.alike(json.results[0], {
      suite: 'THIS IS A SUITE',
      group: 'test 1',
      test_number: 1,
      passed: true,
      description: 'this test should pass'
    })

    t.alike(json.results[3], {
      suite: 'THIS IS A SUITE',
      group: 'test 2',
      test_number: 4,
      passed: false,
      directive: 'skip',
      description: 'a test to ignore'
    })

    t.alike(json.results[4], {
      suite: 'THIS IS A SUITE',
      group: 'test 2',
      test_number: 5,
      passed: false,
      directive: 'todo',
      description: 'must do something'
    })
  })

  t.test('format to JSON string', function (t) {
    const results = parse(exampleTap)
    const formatter = new JsonFormatter()
    const str = formatter.formatToString(results)
    const parsed = JSON.parse(str)
    t.is(parsed.version, 13)
    t.is(parsed.summary.total, 6)
  })
})
