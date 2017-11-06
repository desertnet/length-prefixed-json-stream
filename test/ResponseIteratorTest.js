import assert from 'assert'
import sinon from 'sinon'
import {ResponseIterator} from '../src'
import {PassThrough} from 'stream'

describe('ResponseIterator', function () {
  let responses, inputStream

  beforeEach(function () {
    inputStream = new PassThrough()
    responses = new ResponseIterator(inputStream)
  })

  describe('constructor()', function () {
    it('should throw if not passed a stream', function () {
      assert.throws(() => new ResponseIterator())
      assert.throws(() => new ResponseIterator('foobar'))
    })
  })

  describe('@@asyncIterator()', function () {
    it('should return `this`', function () {
      assert.strictEqual(responses, responses[Symbol.asyncIterator]())
    })
  })

  describe('getNextResponse()', function () {
    it('should call .next()', async function () {
      const expectation = sinon
        .mock(responses)
        .expects('next')
        .once()
        .resolves({done:true})
      await responses.getNextResponse()
      expectation.verify()
    })

    it('should return the value from .next() if not done', async function () {
      sinon.stub(responses, 'next').resolves({ value: 'foo', done: false })
      const result = await responses.getNextResponse()
      assert.strictEqual(result, 'foo')
    })

    it('should return null if .next() returns done', async function () {
      sinon.stub(responses, 'next').resolves({ done: true })
      const result = await responses.getNextResponse()
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
      sendChunks(['   37{"done":false, "value":{"foo":"bar"}}13 {"done":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {"done":false, "value":{"foo":"bar"}})
      response = await responses.next()
      assert.deepStrictEqual(response, {"done":true})
    })

    it('should handle many chunks', async function () {
      sendChunks([' ', '  3', '7{"do', 'n', 'e":false, "value":{"foo":"bar"}}\n 13', '{"done":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {"done":false, "value":{"foo":"bar"}})
      response = await responses.next()
      assert.deepStrictEqual(response, {"done":true})
    })

    it('should throw an error on malformed size value', async function () {
      sendChunks(['14{"done":false}.13{"done":true}'])
      let response = await responses.next()
      assert.deepStrictEqual(response, {done:false})
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
  })

  function sendChunks (chunks) {
    return new Promise(resolve => {
      sendNext(chunks)
      function sendNext (chunks) {
        setImmediate(() => {
          inputStream.write(Buffer.from(chunks.shift()))
          if (chunks.length) { sendNext(chunks) }
          else { return resolve() }
        })
      }
    })
  }
})
