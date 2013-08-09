var assert = require('assert');
var wordwrap = require('../');

// Exposes bugs in wordwrap 0.0.2
exports.bug1 = function() {
	var text = "I love u\n\n\n";
	var res = wordwrap(10)(text);
	assert.equal(res, "I love u\n\n\n");
};

exports.bug2 = function() {
	var text = "I hug you, my friend";
	var res = wordwrap(10)(text);
	assert.equal(res, "I hug you,\nmy friend");
};

exports.bug3 = function() {
	var text = "I love u\n\n\n";
	var res = wordwrap.hard(10)(text);
	assert.equal(res, "I love u\n\n\n");
};

exports.bug4 = function() {
	var text = "I hug you, my friend";
	var res = wordwrap.hard(10)(text);
	assert.equal(res, "I hug you,\nmy friend");
};

exports.bug5 = function() {
	var text = "12345678910";
	var res = wordwrap(10)(text);
	assert.equal(res, "12345678910");
};

exports.bug6 = function() {
	var text = "\n12345678910\n";
	var res = wordwrap(1, 11)(text);
	assert.equal(res, " \n 12345678910\n ");
};
