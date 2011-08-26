var assert = require('assert');
var wordwrap = require('../');

exports.hard = function () {
    var wrap = wordwrap.hard(80);
    var s = 'Assert from {"type":"equal","ok":false,"found":1,"wanted":2,'
        + '"stack":[],"id":"b7ddcd4c409de8799542a74d1a04689b",'
        + '"browser":"chrome/6.0"}'
    ;
    var s_ = wordwrap.hard(80)(s);
    
    var lines = s_.split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].length < 80);
    assert.ok(lines[1].length < 80);
    
    assert.equal(s, s_.replace(/\n/g, ''));
};
