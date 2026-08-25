const { suiteAndGroup } = require('./parser')

class JsonFormatter {
  toJson(results) {
    const summary = {
      total: results.totalTests,
      passed: results.passedTests,
      failed: results.failedTests,
      skipped: results.skippedTests,
      todo: results.todoTests,
      expected: results.expectedTests
    }

    if (results.bailOut) {
      summary.bailout = true
      if (results.bailOutReason.trim().length > 0) {
        summary.bailout_reason = results.bailOutReason
      }
    }

    let { suite, group } = suiteAndGroup(results)

    const testResults = []
    const failures = []

    for (const test of results.tests) {
      const t = {}

      if (suite) {
        t.suite = suite
      }
      if (group) {
        t.group = group
      }

      t.test_number = test.testNumber
      t.passed = test.passed

      const split = splitDirective(test)
      const directive = split.directive
      const description = split.description

      if (directive) {
        t.directive = directive
      }

      t.description = description

      if (test.yamlBytes.length > 0) {
        t.info = test.yamlBytes.trim()
      }

      testResults.push(t)

      if (!t.passed && !t.directive) {
        failures.push(t)
      }

      if (test.diagnostics.length > 0) {
        group = test.diagnostics[0]
      }
    }

    if (failures.length > 0) {
      summary.failures = failures
    }

    return {
      version: results.tapVersion,
      summary,
      results: testResults
    }
  }

  formatToString(results) {
    return JSON.stringify(this.toJson(results), null, 2)
  }

  format(results) {
    console.log(this.formatToString(results))
  }

  summary() {}
}

function splitDirective(test) {
  if (test.directiveText.length === 0) {
    return { directive: undefined, description: test.description }
  }

  const items = test.directiveText.split(' ')
  return {
    directive: items[0],
    description: test.description.length === 0 ? items.slice(1).join(' ') : test.description
  }
}

function formatJson(results) {
  const formatter = new JsonFormatter()
  formatter.format(results)
  return formatter.toJson(results)
}

module.exports = { JsonFormatter, formatJson }
