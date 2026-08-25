const hasProcess = typeof process !== 'undefined'

function checkColorSupport(
  env = hasProcess ? process.env : null,
  argv = hasProcess ? process.argv : [],
  stdout = hasProcess ? process.stdout : null
) {
  if (env === null) return true
  if (argv.includes('--no-color')) return false
  if (argv.includes('--color')) return true
  if ('NO_COLOR' in env) return false
  if ('FORCE_COLOR' in env) return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false'
  if (stdout && !stdout.isTTY) return false
  return true
}

let colorEnabled = checkColorSupport()

function setColorEnabled(enabled) {
  colorEnabled = enabled
}

function isColorEnabled() {
  return colorEnabled
}

function style(open, close) {
  return function (str) {
    const s = String(str)
    if (!colorEnabled || !s) return s
    return open + s + close
  }
}

const bold = style('\x1b[1m', '\x1b[22m')
const faint = style('\x1b[2m', '\x1b[22m')
const dim = faint
const italic = style('\x1b[3m', '\x1b[23m')
const underline = style('\x1b[4m', '\x1b[24m')

const red = style('\x1b[31m', '\x1b[39m')
const green = style('\x1b[32m', '\x1b[39m')
const yellow = style('\x1b[33m', '\x1b[39m')
const blue = style('\x1b[34m', '\x1b[39m')
const magenta = style('\x1b[35m', '\x1b[39m')
const cyan = style('\x1b[36m', '\x1b[39m')

const brightRed = style('\x1b[91m', '\x1b[39m')
const brightMagenta = style('\x1b[95m', '\x1b[39m')

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

module.exports = {
  checkColorSupport,
  setColorEnabled,
  isColorEnabled,
  bold,
  faint,
  dim,
  italic,
  underline,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  brightRed,
  brightMagenta,
  stripAnsi
}
