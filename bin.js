#!/usr/bin/env node
const { run } = require('./cli')

run().catch(function (err) {
  console.error(err)
  process.exit(1)
})
