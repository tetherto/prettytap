const { test } = require('brittle')

test('passes but leaks a rejection after it resolves', async (t) => {
  t.pass('ok')
  setTimeout(() => Promise.reject(new Error('no such mesh: deadbeef')), 50)
  await new Promise((r) => setTimeout(r, 200))
})
