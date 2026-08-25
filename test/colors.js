const { test } = require('brittle')
const { checkColorSupport, isColorEnabled, setColorEnabled, stripAnsi, red } = require('..')

const tty = { isTTY: true }
const pipe = { isTTY: false }

test('Colors', (t) => {
  t.test('let explicit flags beat environment variables', (t) => {
    t.is(checkColorSupport({ NO_COLOR: '1' }, ['--color'], pipe), true)
    t.is(checkColorSupport({ FORCE_COLOR: '1' }, ['--no-color'], tty), false)
  })

  t.test('treat FORCE_COLOR=0 as disabled', (t) => {
    t.is(checkColorSupport({ FORCE_COLOR: '0' }, [], pipe), false)
    t.is(checkColorSupport({ FORCE_COLOR: 'false' }, [], pipe), false)
    t.is(checkColorSupport({ FORCE_COLOR: '1' }, [], pipe), true)
  })

  t.test('fall back to TTY detection', (t) => {
    t.is(checkColorSupport({}, [], tty), true)
    t.is(checkColorSupport({}, [], pipe), false)
  })

  t.test('enable color when there is no process, as on Bare', (t) => {
    t.is(checkColorSupport(null, [], null), true)
  })

  t.test('toggle and strip colors', (t) => {
    setColorEnabled(true)
    t.teardown(function () {
      setColorEnabled(false)
    })

    t.ok(isColorEnabled())
    t.is(stripAnsi(red('boom')), 'boom')

    setColorEnabled(false)
    t.is(red('boom'), 'boom')
  })
})
