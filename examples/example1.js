// Copyright (c) 2015 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var TChannel = require('../index.js');

var server = new TChannel({host: '127.0.0.1', port: 4040});
var client = new TChannel({host: '127.0.0.1', port: 4041});

// normal response
server.register('func 1', function (arg1, arg2, peerInfo, cb) {
	console.log('func 1 responding immediately 1:' + arg1.toString() + ' 2:' + arg2.toString());
	cb(null, 'result', 'indeed it did');
});
// err response
server.register('func 2', function (arg1, arg2, peerInfo, cb) {
	cb(new Error('it failed'));
});
client.send({host: '127.0.0.1:4040'}, 'func 1', "arg 1", "arg 2", function (err, res1, res2) {
	console.log('normal res: ' + res1.toString() + ' ' + res2.toString());
});
client.send({host: '127.0.0.1:4040'}, 'func 2', "arg 1", "arg 2", function (err, res1, res2) {
	console.log('err res: ' + err.message);
});
