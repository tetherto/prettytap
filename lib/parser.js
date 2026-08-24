function emptyTest() {
  return {
    testNumber: -1,
    passed: false,
    failed: false,
    skipped: false,
    todo: false,
    description: '',
    directiveText: '',
    diagnostics: [],
    yamlBytes: ''
  }
}

function createResults(lines) {
  const results = {
    expectedTests: -1,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    todoTests: 0,
    tapVersion: -1,
    bailOut: false,
    bailOutReason: '',
    foundTapData: false,
    tests: [],
    lines,
    explanation: [],
    isPassing() {
      return isPassing(this)
    },
    toString() {
      return resultsToString(this)
    }
  }
  return results
}

const versionLine = /^TAP version (\d+)/
const bailOutLine = /^Bail out!\s*(\S.*)?$/
const testLine = /^\s*(not )?ok\b(.*)/
const optionalTestLine = /^\s*(\d+)?\s*([^#]*?)(?:#\s*((\w*)\s*(.*)))?$/
const testPlanDeclaration = /^\d+\.\.(\d+)$/
const diagnostic = /^\s*#(.*)$/
const runnerComment = /^(ok|not ok)$|^(tests|asserts|time)\s*=/i
const yamlStart = /^\s*---$/
const yamlStop = /^\s*\.\.\.$/

const FIND_VERSION = 0
const STORE_TEST_METADATA = 1
const STORE_YAML = 2

class Parser {
  constructor() {
    this.results = createResults([])
    this.state = FIND_VERSION
    this.currentTest = null
    this.foundTestPlan = false
    this.foundAllTests = false
    this.buffer = ''
  }

  write(chunk) {
    this.buffer += chunk
    const events = []
    let nl = this.buffer.indexOf('\n')
    while (nl !== -1) {
      let line = this.buffer.slice(0, nl)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      this.buffer = this.buffer.slice(nl + 1)
      events.push(...this.pushLine(line))
      nl = this.buffer.indexOf('\n')
    }
    return events
  }

  end() {
    const events = []
    if (this.buffer.length > 0) {
      events.push(...this.pushLine(this.buffer))
      this.buffer = ''
    }
    if (
      this.state === STORE_YAML &&
      this.currentTest !== null &&
      this.currentTest.yamlBytes.length > 0
    ) {
      events.push({ type: 'yaml', test: this.currentTest })
    }
    if (this.currentTest !== null) {
      this.results.tests.push(this.currentTest)
      this.currentTest = null
    }
    return events
  }

  pushLine(line) {
    const events = []
    const results = this.results
    results.lines.push(line)

    switch (this.state) {
      case FIND_VERSION: {
        const versionMatch = line.match(versionLine)
        if (versionMatch) {
          const v = parseInt(versionMatch[1], 10)
          if (!isNaN(v)) {
            results.tapVersion = v
            results.foundTapData = true
            this.state = STORE_TEST_METADATA
          }
        }
        break
      }
      case STORE_TEST_METADATA: {
        const bailOutMatch = line.match(bailOutLine)
        if (bailOutMatch) {
          results.bailOut = true
          results.bailOutReason = bailOutMatch[1] || ''
          events.push({ type: 'bail', reason: results.bailOutReason })
          break
        }

        if (!this.foundTestPlan) {
          const testPlan = line.match(testPlanDeclaration)
          if (testPlan) {
            const exp = parseInt(testPlan[1], 10)
            if (!isNaN(exp)) {
              results.expectedTests = exp
              this.foundTestPlan = true
            }
          }
        }

        const testLineMatch = line.match(testLine)
        if (testLineMatch) {
          if (this.foundAllTests) {
            break
          }

          if (this.currentTest !== null) {
            results.tests.push(this.currentTest)
          }

          this.currentTest = emptyTest()

          const optionalMatch = (testLineMatch[2] || '').match(optionalTestLine)
          const testNumString = optionalMatch[1]
          if (testNumString) {
            const num = parseInt(testNumString, 10)
            this.currentTest.testNumber = isNaN(num) ? -1 : num
          }

          this.currentTest.description = (optionalMatch[2] || '').trim()

          const directive = optionalMatch[4] || ''
          const directiveText = optionalMatch[3] || ''
          const isFailed = testLineMatch[1] === 'not '

          results.totalTests++

          if (directive !== '') {
            this.currentTest.directiveText = directiveText.trim()
          }

          const lowerDirective = directive.toLowerCase()
          if (lowerDirective === 'skip') {
            results.skippedTests++
            this.currentTest.skipped = true
          } else if (lowerDirective === 'todo') {
            results.todoTests++
            this.currentTest.todo = true
          } else if (isFailed) {
            results.failedTests++
            this.currentTest.failed = true
          } else {
            results.passedTests++
            this.currentTest.passed = true
          }

          if (results.totalTests === results.expectedTests) {
            this.foundAllTests = true
          }

          events.push({ type: 'test', test: this.currentTest })
        } else if (yamlStart.test(line)) {
          this.state = STORE_YAML
        } else {
          const diagMatch = line.match(diagnostic)
          if (diagMatch) {
            const diagnosticLine = (diagMatch[1] || '').trim()
            if (diagnosticLine !== '' && !runnerComment.test(diagnosticLine)) {
              if (this.currentTest !== null) {
                this.currentTest.diagnostics.push(diagnosticLine)
              } else {
                results.explanation.push(diagnosticLine)
              }
              events.push({ type: 'comment', text: diagnosticLine })
            }
          }
        }
        break
      }
      case STORE_YAML: {
        if (yamlStop.test(line)) {
          this.state = STORE_TEST_METADATA
          if (this.currentTest !== null && this.currentTest.yamlBytes.length > 0) {
            events.push({ type: 'yaml', test: this.currentTest })
          }
        } else if (this.currentTest !== null) {
          this.currentTest.yamlBytes += line + '\n'
        }
        break
      }
    }

    return events
  }
}

function parse(input) {
  const parser = new Parser()
  const text = Array.isArray(input) ? input.join('\n') + (input.length > 0 ? '\n' : '') : input
  parser.write(text)
  parser.end()
  return parser.results
}

function suiteAndGroup(results) {
  const explanation = results.explanation
  if (explanation.length > 1) {
    return { suite: explanation[0], group: explanation[explanation.length - 1] }
  }
  if (explanation.length === 1) {
    return { suite: '', group: explanation[0] }
  }
  return { suite: '', group: '' }
}

function isPassing(r) {
  if (r.tapVersion < 0) {
    return false
  }
  if (r.bailOut) {
    return false
  }
  const testCount = r.expectedTests >= 0 ? r.expectedTests : r.totalTests
  return r.todoTests + r.skippedTests + r.passedTests === testCount
}

function resultsToString(r) {
  let result = ''
  if (isPassing(r)) {
    result += ' Overall result: PASS\n'
  } else {
    result += ' Overall result: FAIL\n'
  }
  if (r.totalTests === 0 || r.passedTests !== r.totalTests) {
    result += `Total tests run: ${r.totalTests}\n`
  }
  if (r.expectedTests > 0 && r.expectedTests !== r.totalTests) {
    result += ` Expected tests: ${r.expectedTests}\n`
  }
  if (r.expectedTests > 0 && r.totalTests < r.expectedTests) {
    result += `  Missing tests: ${r.expectedTests - r.totalTests}\n`
  }
  if (r.passedTests > 0) {
    result += `   Passed tests: ${r.passedTests}\n`
  }
  if (r.failedTests > 0) {
    result += `   Failed tests: ${r.failedTests}\n`
  }
  if (r.skippedTests > 0) {
    result += `  Skipped tests: ${r.skippedTests}\n`
  }
  if (r.todoTests > 0) {
    result += `     TODO tests: ${r.todoTests}\n`
  }
  if (r.bailOut) {
    const reason = r.bailOutReason !== '' ? r.bailOutReason : '(no reason given)'
    result += `     Bailed out: ${reason}\n`
  }
  return result
}

module.exports = {
  Parser,
  parse,
  isPassing,
  resultsToString,
  suiteAndGroup
}
