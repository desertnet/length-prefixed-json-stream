# length-prefixed-json-stream

A length-prefixed JSON stream reader that accommodates whitespace padding.

## Length Prefixed JSON Streams

Length prefixed JSON streams are streams of JSON values, where each value is preceded by the length-in-bytes of the value. (The length is a decimal integer encoded as a string of digits.) Here's an example:

```
18{"message": "Hi!"}27{"message": "How are you?"}
```

## Whitespace Padding

This module supports ASCII whitespace characters both before and after the length prefix. This has the effect of allowing literal number values to be sent without necessitating a wrapper object, by simply appending a space after the length prefix string. For example:

```
2 42 2 84 3 168 4 0.42
```

## Usage

```javascript
import JSONStreamIterator from 'length-prefixed-json-stream'

async function responseHandler (response) {
  const streamIterator = new JSONStreamIterator(response)

  let value
  while ((value = await streamIterator.readNextValue()) !== undefined) {
    console.log(value)
  }
}
```

If your JavaScript environment supports it, you can use the more readable `for await…of`:

```javascript
async function responseHandler (response) {
  const streamIterator = new JSONStreamIterator(response)
  for await (const value of streamIterator) {
    console.log(value)
  }
}
```

## API

```javascript
import JSONStreamIterator from 'length-prefixed-json-stream'
```

### new JSONStreamIterator(stream)

Reads values one at a time from `stream`.

  - `stream`: Node.js readable stream.

#### .readNextValue()

Returns a promise that resolves to the next value from the input stream. When the stream ends, the promise will resolve to `undefined`. If there is an error parsing the stream, or some sort of connection error, the promise will be rejected with the error.

#### .next()

A `for await…of` (async iterator) compatible method. If you are using `for await…of`, this is called for you, but you can also use it explicitly if you would like. It wraps the returned values according to the spec: while not complete, returns a promise that resolves to `{done: false, value: …}`, and when complete, returns a promise that resolves to `{done: false}`.

#### .return()

Also a part of the async iterator spec, but you can call it explicitly to end iteration early and free resources.
