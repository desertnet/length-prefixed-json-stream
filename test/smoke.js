import assert from 'assert'
import JSONStreamIteratorActual from '../src/lib/JSONStreamIterator'
const exports = require('../src')

describe('exports', function () {
  describe('default', function () {
    it('should be JSONStreamIterator', function () {
      assert.strictEqual(exports.default, JSONStreamIteratorActual)
    })
  })

  describe('JSONStreamIterator', function () {
    it('should be JSONStreamIterator', function () {
      assert.strictEqual(exports.JSONStreamIterator, JSONStreamIteratorActual)
    })
  })
})
