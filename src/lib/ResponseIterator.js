import StreamPuller from './StreamPuller'
import isStream from 'is-stream'

const whitespace = makeCharCodeLookupTable([' ', '\r', '\n', '\t'])
const digits = makeCharCodeLookupTable('0 1 2 3 4 5 6 7 8 9'.split(/\s+/))

export default class ResponseIterator {
  constructor (inputStream) {
    if (!inputStream) {
      throw new Error('Missing inputStream argument to ResponseIterator constructor')
    }

    if (!isStream.readable(inputStream)) {
      throw new Error('Stream argument must be a Readable for ResponseIterator constructor')
    }

    this.position = 0
    this.buffer = Buffer.from('')
    this.input = new StreamPuller(inputStream)
  }

  // Async iterator protocol
  async next () {
    await this._consumeToken(whitespace)
    const size = Number.parseInt(await this._consumeToken(digits), 10)
    if (Number.isNaN(size)) throw new Error('Failed to parse response size')
    await this._consumeToken(whitespace)

    const response = await this._consumeString(size)
    return JSON.parse(response)
  }

  async _consumeToken (codeTable) {
    let tok = []
    if (this.position === this.buffer.length) await this._updateBuffer()
    while (codeTable[this.buffer[this.position]]) {
      tok.push(this.buffer[this.position])
      this.position += 1
      if (this.position === this.buffer.length) await this._updateBuffer()
    }
    return Buffer.from(tok).toString('utf8')
  }

  async _consumeString (size) {
    let result = Buffer.from('')

    this.buffer = this.buffer.slice(this.position)
    this.position = 0

    while (result.length < size) {
      if (this.position === this.buffer.length) await this._updateBuffer()
      const slice = this.buffer.slice(0, size - result.length)
      this.position += slice.length
      result = Buffer.concat([result, slice])
    }

    return result.toString('utf8')
  }

  async _updateBuffer () {
    this.position = 0
    this.buffer = await this.input.nextChunk()
  }

  // Async iterator protocol
  return () {
    this.input.destroy()
  }

  async getNextResponse () {
    const item = await this.next()
    if (item.done) return null
    return item.value
  }
}

/* istanbul ignore else */
if (Symbol.asyncIterator) {
  // If there is support for async iterators in our env, support it.
  ResponseIterator.prototype[Symbol.asyncIterator] = function () { return this }
}

function makeCharCodeLookupTable (chars) {
  return chars
    .map(char => char.charCodeAt())
    .reduce((arr, code) => { arr[code] = true; return arr }, [])
}
