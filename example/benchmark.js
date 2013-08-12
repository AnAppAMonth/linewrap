var wordwrap = require('wordwrap');
var linewrap = require('../');

var fs = require('fs');
var idleness = fs.readFileSync(__dirname + '/../test/idleness.txt', 'utf8');
var html = fs.readFileSync(__dirname + '/../test/html.txt', 'utf8');

if (require.main === module) {
    var wrap, result;
    var time, diff, i, k;
    var mb, s;

    var tests = [linewrap(80), wordwrap(80), linewrap(10), wordwrap(10),
                 linewrap(20, 60), wordwrap(20, 60), linewrap(30), linewrap(30, 60)];
    var inputs = [idleness, idleness, idleness, idleness, idleness, idleness, html, html];
    var titles = ['linewrap(80), txt', 'wordwrap(80), txt', 'linewrap(10), txt',
                  'wordwrap(10), txt', 'linewrap(20, 60), txt', 'wordwrap(20, 60), txt',
                  'linewrap(30), html', 'linewrap(30, 60), html'];
    var loops = [500, 500, 500, 500, 500, 500, 5000, 5000];

    for (k = 0; k < tests.length; k++) {
        wrap = tests[k];
        time = process.hrtime();
        for (i = 0; i < loops[k]; i++) {
            result = wrap(inputs[k]);
        }
        diff = process.hrtime(time);
        mb = inputs[k].length * loops[k] / 1024 / 1024;
        s = diff[0] + diff[1]/1e9;
        console.log('Test %s: %s...', k+1, titles[k]);
        console.log(mb/s + " MB/s: " + mb, " MB wrapped in " + s + " seconds.");
        console.log();
    }
}
