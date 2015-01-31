# TChannel

network multiplexing and framing protocol for RPC

## Example

```js
var TChannel = require('tchannel');

var server = new TChannel({host: '127.0.0.1', port: 4040});
var client = new TChannel({host: '127.0.0.1', port: 4041});

// normal response
server.register('func 1', function (reqHead, reqBody, peerInfo, cb) {
    console.log('func 1 responding immediately 1:' + reqHead.toString() + ' 2:' + reqBody.toString());
    cb(null, 'result', 'indeed it did');
});
// err response
server.register('func 2', function (reqHead, reqBody, peerInfo, cb) {
    cb(new Error('it failed'));
});
client.send({host: '127.0.0.1:4040'}, 'func 1', "arg 1", "arg 2", function (err, resHead, resBody) {
    console.log('normal res: ' + resHead.toString() + ' ' + resBody.toString());
});
client.send({host: '127.0.0.1:4040'}, 'func 2', "arg 1", "arg 2", function (err, resHead, resBody) {
    console.log('err res: ' + err.message);
});
```

This example registers two functions on the "server". "func 1" always works and "func 2" always 
returns an error. The client sends a request for each function, then prints the result.

Note that every instance is bidirectional. New connections are initiated on demand.

## Overview

TChannel is a network protocol with the following goals:

 * request / response model
 * multiple requests multiplexed across the same TCP socket
 * out of order responses
 * streaming request and responses
 * all frames checksummed
 * transport arbitrary payloads
 * easy to implement in multiple languages
 * near-redis performance

This protocol is intended to run on datacenter networks for inter-process communication.

## Protocol

TChannel frames have a fixed length header and 3 variable length fields. The underlying protocol
does not assign meaning to these fields, but the included client/server implementation uses
the first field to represent a unique endpoint or function name in an RPC model.
The next two fields can be used for arbitrary data. Some suggested way to use the 3 fields are:

* URI path, HTTP method and headers as JSON, body
* function name, headers, thrift / protobuf

This design supports efficient routing and forwarding of data where the routing information needs
to parse only the first or second field, but the 3rd field is forwarded without parsing.

There is no notion of client and server in this system. Every TChannel instance is capable of 
making or receiving requests, and thus requires a unique port on which to listen. This requirement may
change in the future.

 - See [docs/protocol.md](docs/protocol.md) for more details

## Performance

On a Macbook Pro, we see around 50,000 ops/sec from a single node process talking to one other node
process.

## Documentation

### `var channel = TChannel(options)`

```ocaml
tchannel : (options: {
    host: String,
    port: Number,
    logger?: Object,
    timers?: Object,

    reqTimeoutDefault?: Number,
    timeoutCheckInterval?: Number,
    timeoutFuzz?: Number
}) => {
    register: (op: String, fn: Function),
    send: (
        options: Object,
        op: String,
        reqHead: Any,
        reqBody: Any,
        cb: Function
    ) => void,
    quit: (Callback<Error>) => void,
}
```

To create a `channel` you call `TChannel` with some options.

```js
var TChannel = require('tchannel');

var channel = TChannel({
    host: '127.0.0.1',
    port: 8080
});
```

#### `options.host`

You must specify a local host name. This local host name will
    be used the remote server to identify you.

The host name and port must be a unique identifier for your
    TChannel server and its strongly recommended that this host
    is the publicly addressable IP address.

#### `options.port`

The port for which `TChannel` will open a TCP server on.

#### `options.logger`

```ocaml
type Logger : {
    debug: (String, Object) => void,
    info: (String, Object) => void,
    warn: (String, Object) => void,
    error: (String, Object) => void,
    fatal: (String, Object) => void
}
```

You can pass in your own logger instance. This will default to
    a null logger that prints no information.

The logger you pass in must implement `debug`, `info`, `warn`,
    `error` and `fatal` methods.

#### `options.timers`

```ocaml
type Timers : {
    setTimeout: (Function, timeout: Number) => id: Number,
    clearTimeout: (id: Number) => void,
    now: () => timestamp: Number
}
```

You can pass in an implementation of various timer methods.

This will allow you to either test TChannel without using
    real timer implementation or pass in an alternative
    implementation of time that's not backed by javascript's
    default implementation of `Date.now()`

#### `options.reqTimeoutDefault`

default value: `5000`

A default timeout for request timeouts.

For every outgoing request which does not have a set timeout
    i.e. every `.send()` without a timeout we will default
    the timeout period to be this value.

This means every outgoing operation will be terminated with
    a timeout error if the timeout is hit.

#### `options.timeoutCheckInterval`

default value: `1000`

The interval at which the the TChannel client will scan for
    any outgoing requests which might have timed out.

This means, by default we will scan over every outgoing request
    every 1000 milliseconds to see whether the difference
    between now and when the request has started

#### `options.timeoutFuzz`

default value: `100`

The client interval does not run every N milliseconds, it has
    certain amount of random fuzz, this means it will run

> every `timeoutCheckInterval` +/ `fuzz/2`

This is used to avoid race conditions in the network.

### `channel.register(op, fn)`

```ocaml
register: (
    op: String,
    fn: (
        reqHead: Buffer,
        reqBody: Buffer,
        hostInfo: String,
        cb: (
            err?: Error,
            resHead: Buffer | String | Object | Any,
            resBody: Buffer | String | Object | Any
        ) => void
    ) => void
) => void
```

You can call `register` on a channel and it allows you to
    register named operations on the server.

When you register an operation you must implement a very
    specific interface.

#### `reqHead`

The first argument you take is the `head` send by the client.

This will always be a `Buffer`

#### `reqBody`

The second argument you take is the `body` send by the client.

This will always be a `Buffer`

#### `hostInfo`

The third argument will be the host information of the calling
    client. This will be `{ip}:{port}`

#### `cb(err, resHead, resBody)`

Your operation takes a callback as the fourth argument. This
    must always be called.

This should either be called with an err (`cb(err)`) or without
    an err (`cb(null, head, body)`).

The `err` must always be an `Error`.
The `resHead` is the head to return to the client
The `resBody` is the body to return to the client.

`TChannel` will format the head (resHead) and body (resBody) for you

 - If you pass a `Buffer` it uses the buffer.
 - If you pass `undefined` it will cast it to `''`
 - If you pass `null` it will cast it to `''`
 - If you pass a `String` it will cast it to a buffer.
 - If you pass an `Object` it will JSON serialize it to a string
 - If you pass anything else it will call `toString()` on it.

### `channel.send(options, op, reqHead, reqBody, cb)`

```ocaml
send: (
    options: {
        host: String,
        timeout?: Number
    },
    op: Buffer | String,
    reqHead: Buffer | String | Object | Any,
    reqBody: Buffer | String | Object | Any,
    cb: (
        err?: Error,
        resHead: Buffer,
        resBody: Buffer
    ) => void
) => void
```

`send()` is used for a channel to send an outgoing message
    to another channel.

`TChannel` will format the head (reqHead) and body (reqBody) for you

 - If you pass a `Buffer` it uses the buffer.
 - If you pass `undefined` it will cast it to `''`
 - If you pass `null` it will cast it to `''`
 - If you pass a `String` it will cast it to a buffer.
 - If you pass an `Object` it will JSON serialize it to a string
 - If you pass anything else it will call `toString()` on it.


#### `options.host`

You must specify the host you want to write to. This should be
    string in the format of `{ip}:{port}`

#### `options.timeout`

You should specify a timeout for this operation. This will
    default to 5000.

This will call your callback with a timeout error if no response
    was received within the timeout.

#### `op`

The first argument must be the name of the operation you want
    to call as a string or a buffer.

#### `reqHead`

The second argument will be the `head` to send to the server,
    this will be `reqHead` in the servers operation function.

#### `reqBody`

The third argument will be the `body` to send to the server.
    This will be `reqBody` in the servers operation function.

#### `cb(err, resHead, resBody)`

When you `send()` a message to another tchannel server it will
    give you a callback

The callback will either get called with `cb(err)` or with
    `cb(null, resHead, resBody)`

 - `err` will either be `null` or an `Error`. This can be an
    error send from the remote server or another type of error
    like a timeout, IO or 404 error.
 - `resHead` will be the `head` response from the server as a buffer
 - `resBody` will be the `body` response from the server as a buffer

### `channel.quit(cb)`

When you want to close your channel you call `.quit()`. This
    will cleanup the tcp server and any tcp sockets as well
    as cleanup any inflight operations.

Your `cb` will get called when it's finished.

## Further examples

 - [example1.js](examples/example1.js)
 - [example2.js](examples/example2.js)

## Installation

`npm install tchannel`

## Tests

`npm test`

## Contributors

 - mranney
 - jwolski
 - Raynos

## MIT Licenced
