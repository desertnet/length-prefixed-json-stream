import assert from 'assert'
import sinon from 'sinon'
import {JSONStreamIterator} from '../src'
import {PassThrough} from 'stream'

describe('JSONStreamIterator', function () {
  let responses, inputStream

  beforeEach(function () {
    inputStream = new PassThrough()
    responses = new JSONStreamIterator(inputStream)
  })

  describe('constructor()', function () {
    it('should throw if not passed a stream', function () {
      assert.throws(() => new JSONStreamIterator())
      assert.throws(() => new JSONStreamIterator('foobar'))
    })
  })

  describe('@@asyncIterator()', function () {
    it('should return `this`', function () {
      assert.strictEqual(responses, responses[Symbol.asyncIterator]())
    })
  })

  describe('readValueFromStream()', function () {
    it('should call .next()', async function () {
      const expectation = sinon
        .mock(responses)
        .expects('next')
        .once()
        .resolves({done:true})
      await responses.readValueFromStream()
      expectation.verify()
    })

    it('should return the value from .next() if not done', async function () {
      sinon.stub(responses, 'next').resolves({ value: 'foo', done: false })
      const result = await responses.readValueFromStream()
      assert.strictEqual(result, 'foo')
    })

    it('should return null if .next() returns done', async function () {
      sinon.stub(responses, 'next').resolves({ done: true })
      const result = await responses.readValueFromStream()
      assert.strictEqual(result, null)
    })
  })

  describe('return()', function () {
    it('should destroy the input stream', function () {
      const expectation = sinon
        .mock(inputStream)
        .expects('destroy')
        .once()
      responses.return()
      expectation.verify()
    })
  })

  describe('next()', function () {
    it('should throw an error when input stream emits error', async function () {
      setImmediate(() => inputStream.emit('error', new Error('stream error')))
      try { await responses.next() }
      catch (err) {
        assert.strictEqual(err.message, 'stream error')
        return
      }
      assert.fail('Did not throw')
    })

    it('should extract response objects from the input stream', async function () {
      sendChunks(['   37{"quux":false, "quuxx":{"foo":"bar"}}13 {"quux":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {done: false, value: {quux: false, quuxx: {foo:"bar"} } })
      response = await responses.next()
      assert.deepStrictEqual(response, {done: false, value: {quux: true} })
      response = await responses.next()
      assert.deepStrictEqual(response, {done: true})
    })

    it('should handle many chunks', async function () {
      sendChunks([' ', '  3', '7{"qu', 'u', 'x":false, "quuxx":{"foo":"bar"}}\n 13', '{"quux":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {done: false, value: {quux: false, quuxx: {foo:"bar"}}})
      response = await responses.next()
      assert.deepStrictEqual(response, {done: false, value: {quux: true}})
      response = await responses.next()
      assert.deepStrictEqual(response, {done: true})
    })

    it('should throw an error on malformed size value', async function () {
      sendChunks(['14{"quux":false}.13{"quux":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {done: false, value: {quux:false}})
      try { response = await responses.next() }
      catch (err) {
        assert(err.message.match(/response size/))
        return
      }
      assert.fail('Failed to throw')
    })

    it('should throw an error on malformed JSON', async function () {
      sendChunks(['9{badjson}'])
      try { await responses.next() }
      catch (err) {
        assert(err.message.match(/JSON/))
        return
      }
      assert.fail('Failed to throw')
    })

    it('should throw an error when stream ends unexpectedly in prefix', async function () {
      sendChunks(['   3', '8'])
      try { await responses.next() }
      catch (err) {
        assert(err.message.match(/Unexpected end of stream/i))
        return
      }
      assert.fail('Failed to throw')
    })

    it('should throw an error when stream ends in JSON value', async function () {
      sendChunks(['37{"quux":fal', 'se, "quuxx":{"foo":"ba'])
      try { await responses.next() }
      catch (err) {
        assert(err.message.match(/Unexpected end of stream/i))
        return
      }
      assert.fail('Failed to throw')
    })
  })

  function sendChunks (chunks) {
    return new Promise(resolve => {
      sendNext(chunks)
      function sendNext (chunks) {
        setImmediate(() => {
          inputStream.write(Buffer.from(chunks.shift()))
          if (chunks.length) {
            sendNext(chunks)
          }
          else {
            inputStream.end()
            return resolve()
          }
        })
      }
    })
  }
})
