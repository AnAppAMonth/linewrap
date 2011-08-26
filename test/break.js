var assert = require('assert');
var wordwrap = require('../');

exports.json = function () {
    var wrap = wordwrap.hard(80);
    var s = 'Assert from {"type":"equal","ok":false,"found":1,"wanted":2,'
        + '"stack":[],"id":"b7ddcd4c409de8799542a74d1a04689b",'
        + '"browser":"chrome/6.0"}'
    ;
    
    assert.equal(
        wordwrap.hard(80)(s),
        s.slice(0,80) + '\n' + s.slice(80)
    );
};
