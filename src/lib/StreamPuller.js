import {Writable} from 'stream'

export default class StreamPuller extends Writable {
  constructor (inputStream, options) {
    super(options)

    this._inputStream = inputStream
    this._resetState()

    this._inputStream.once('error', err => this._rejectAsSoonAsPossible(err))
    this._inputStream.pipe(this)
  }

  _resetState () {
    this._chunk = null
    this._resolve = null
    this._reject = null
    this._callback = null
    this._err = null
  }

  get _isReadyToResolveNextChunkPromise () {
    return this._chunk && this._resolve && this._callback
  }

  get _isReadyToRejectNextChunkPromise () {
    return this._reject && this._err
  }

  _write (chunk, _, cb) {
    this._chunk = chunk
    this._callback = cb
    this._attemptToSettleNextChunkPromise()
  }

  nextChunk () {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
      this._attemptToSettleNextChunkPromise()
    })
  }

  _attemptToSettleNextChunkPromise () {
    if (this._isReadyToRejectNextChunkPromise) {
      const reject = this._reject
      return reject(this._err)
    }

    if (this._isReadyToResolveNextChunkPromise) {
      const resolve = this._resolve
      const chunk = this._chunk
      const callback = this._callback
      this._resetState()

      callback()
      return resolve(chunk)
    }
  }

  _rejectAsSoonAsPossible (err) {
    this._err = err
    this._attemptToSettleNextChunkPromise()
  }

  _destroy () {
    this._inputStream.unpipe()
    this._inputStream.destroy()
  }
}
