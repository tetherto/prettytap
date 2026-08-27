const { blue, bold, brightRed, cyan, faint, green, red, underline, yellow } = require('./colors')
const { suiteAndGroup } = require('./parser')

class SpecFormatter {
  constructor() {
    this.results = null
    this.failedTests = []
    this.headerWritten = false
    this.testsWritten = 0
    this.pendingSuite = null
    this.pendingDiagnostics = []
  }

  formatToString(results) {
    this.results = results

    let out = formatHeader(results)
    let suitechanged = false
    const failedtests = []

    for (let i = 0; i < results.tests.length; i++) {
      const test = results.tests[i]

      if (test.skipped || test.todo) {
        out += this.formatTest(test)
      } else {
        if (!test.passed) {
          failedtests.push(test)
        }

        const gap = !test.passed && test.yamlBytes.length > 0 && !suitechanged && i > 0 ? '\n' : ''
        out += this.formatTest(test, gap)
        out += this.formatDetail(test)
      }

      suitechanged = false

      const heading = test.testNumber < results.totalTests ? test.groups[0] : undefined
      if (heading !== undefined) {
        suitechanged = true
        out += `\n  ${underline(heading)}\n\n`
      }
      out += formatDiagnostics(test.diagnostics.filter((line) => line !== heading))
    }

    if (results.bailOut) {
      out += this.streamBail(results.bailOutReason)
    }

    this.failedTests = failedtests
    return out
  }

  summaryToString() {
    if (!this.results) return ''

    const results = this.results
    const failedtests = this.failedTests
    let out = this.flushTrailing()

    if (results.totalTests === 0) {
      return out + '  No tests found\n\n'
    }

    if (failedtests.length > 0) {
      const tense = failedtests.length === 1 ? 'was' : 'were'
      const action = failedtests.length === 1 ? 'failure' : 'failures'

      out += `\n  ${bold(brightRed('Failed Tests:'))} There ${tense} ${bold(brightRed(String(failedtests.length)))} ${action}\n\n`

      for (const test of failedtests) {
        out += this.formatTest(test)
      }
      out += '\n'
    }

    out += `  total:     ${results.totalTests}\n`
    out += `  ${green('passing:')}   ${green(results.passedTests)}\n`
    out += `  ${red('failing:')}   ${red(results.failedTests)}\n`
    if (results.skippedTests > 0) {
      out += `  ${blue('skipped:')}   ${blue(results.skippedTests)}\n`
    }
    if (results.todoTests > 0) {
      out += `  ${yellow('tasks:')}     ${yellow(results.todoTests)}\n`
    }
    out += '\n\n'

    return out
  }

  streamStart(results) {
    this.results = results
    this.failedTests = []
    this.headerWritten = false
    this.testsWritten = 0
    this.pendingSuite = null
  }

  streamComment(text, indented = false) {
    if (this.testsWritten === 0) return
    if (!indented && this.pendingSuite === null) {
      this.pendingSuite = text
      return
    }
    this.pendingDiagnostics.push(text)
  }

  streamTest(test) {
    let out = ''

    if (!this.headerWritten) {
      out += formatHeader(this.results)
      this.headerWritten = true
    }

    if (this.pendingSuite) {
      out += `\n  ${underline(this.pendingSuite)}\n\n`
      this.pendingSuite = null
    }

    out += this.flushDiagnostics()

    if (!test.passed && !test.skipped && !test.todo) {
      this.failedTests.push(test)
    }

    out += this.formatTest(test, this.testsWritten > 0 ? '\n' : '')
    this.testsWritten++

    return out
  }

  flushDiagnostics() {
    if (this.pendingDiagnostics.length === 0) return ''
    const out = formatDiagnostics(this.pendingDiagnostics)
    this.pendingDiagnostics = []
    return out
  }

  // no test follows, so a comment held as the next heading is a diagnostic after all
  flushTrailing() {
    const held = this.pendingSuite === null ? [] : [this.pendingSuite]
    const out = formatDiagnostics(held.concat(this.pendingDiagnostics))
    this.pendingSuite = null
    this.pendingDiagnostics = []
    return out
  }

  streamYaml(test) {
    return this.formatDetail(test)
  }

  streamBail(reason) {
    const sep = reason.trim().length > 0 ? ': ' : ''
    return `\n  ${bold(yellow('⚠ Aborted'))}${yellow(sep)}${yellow(reason)}\n`
  }

  format(results) {
    const text = this.formatToString(results)
    if (text) {
      process.stdout.write(text)
    }
  }

  summary() {
    const text = this.summaryToString()
    if (text) {
      process.stdout.write(text)
    }
  }

  formatTest(test, prefix = '') {
    if (test.skipped) {
      const directive = test.directiveText.replace(/skip/gi, '').trim()
      return `    ${faint(blue('↷'))} ${faint(blue('skipped'))} ${faint(blue(directive))}\n`
    }

    if (test.todo) {
      const directive = test.directiveText.replace(/todo/gi, '').trim()
      return `    ${yellow('🗹')}${bold(yellow('TO DO:'))} ${yellow(directive)}\n`
    }

    if (test.passed) {
      return `    ${green('✓')} ${faint(test.description)}\n`
    }

    return `${prefix}    ${red('⨯')} ${faint(red(test.description))}\n`
  }

  formatDetail(test) {
    if (test.yamlBytes.length === 0) return ''

    const chars = '-'.repeat(Math.max(test.description.length + 2, 3))
    return `    ${faint(red(chars))}\n` + formatYaml(test.yamlBytes)
  }
}

function formatDiagnostics(lines) {
  if (lines.length === 0) return ''
  return lines.map((line) => `    ${faint(line)}\n`).join('')
}

function formatHeader(results) {
  const { suite, group } = suiteAndGroup(results)
  if (!group) return ''

  const head = suite ? `\n  ${bold(suite)}\n\n` : '\n'
  // suiteAndGroup only names the first and the last, so anything between them is a diagnostic
  const between = formatDiagnostics(results.explanation.slice(1, -1))
  const leading = formatDiagnostics(results.leadingDiagnostics ?? [])
  return `${head}${between}  ${underline(group)}\n\n${leading}`
}

function formatSpec(results) {
  const formatter = new SpecFormatter()
  formatter.format(results)
  formatter.summary()
  return formatter
}

const yamlKey = /^(\s*)([A-Za-z_][\w-]*)\s*:/
const caretLine = /^\s*-+\^\s*$/

function formatYaml(yaml) {
  const lines = yaml.split('\n')
  let out = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const key = yamlKey.exec(line)

    if (key && (key[2] === 'source' || key[2] === 'stack')) {
      const keyIndent = key[1].length
      const block = []
      i++
      while (i < lines.length) {
        const next = lines[i]
        if (next.trim() === '') {
          i++
          continue
        }
        const nextKey = yamlKey.exec(next)
        if (nextKey && nextKey[1].length <= keyIndent) break
        block.push(next)
        i++
      }
      if (key[2] === 'source') {
        out += formatSourceBlock(block)
      } else {
        for (const l of block) {
          out += `  ${faint(l)}\n`
        }
      }
      continue
    }

    if (line.trim() !== '') {
      out += `  ${cyan(line)}\n`
    }
    i++
  }

  return out
}

function formatSourceBlock(lines) {
  const caretAt = lines.findIndex(function (line) {
    return caretLine.test(line)
  })
  let out = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const error = caretAt >= 0 && (i === caretAt || i === caretAt - 1)
    out += `  ${error ? red(line) : faint(line)}\n`
  }
  return out
}

module.exports = { SpecFormatter, formatSpec }
