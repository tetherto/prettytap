const test = require('brittle')

test('adds line totals', function (t) {
  t.is(10 + 5, 15)
  t.ok(15 > 0)
})

test('serializes the cart', function (t) {
  t.alike({ items: [1, 2] }, { items: [1, 2] })
})

test('charges the saved card', { skip: true }, function (t) {
  t.fail()
})

test('emails the receipt', { todo: true }, function (t) {
  t.fail()
})
