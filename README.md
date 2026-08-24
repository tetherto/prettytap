# prettytap

Pretty-print [TAP](https://testanything.org) (v13) as spec output or JSON.

## Install

```bash
npm install prettytap
```

CLI:

```bash
npm install -g prettytap
```

or `npx prettytap`.

## Example

This repo uses [brittle](https://github.com/holepunchto/brittle) as the TAP producer and formats it with `prettytap`:

```bash
node examples/demo.js | npx prettytap
```

A saved TAP stream works the same:

```bash
cat test/fixtures/example.txt | npx prettytap
```

![spec output](./docs/example.png)

## Formats

- `spec` (default)
- `json`

```bash
cat results.tap | prettytap -f json
```

## Library

```js
const { parse, SpecFormatter, JsonFormatter } = require('prettytap')

const results = parse(`TAP version 13
1..2
ok 1 test 1
not ok 2 test 2
`)

const spec = new SpecFormatter()
console.log(spec.formatToString(results))
console.log(spec.summaryToString())

const json = new JsonFormatter()
console.log(JSON.stringify(json.toJson(results), null, 2))
```

## Why

TAP is a cross-language protocol. Formatters usually are not — they ship tied to one runtime. `prettytap` is a CLI and a library you can pipe any TAP stream into.

```bash
node examples/demo.js | prettytap
npm test | prettytap
cat results.tap | prettytap
```

## License

MIT
