var wordwrap = module.exports = function (start, stop, params) {
    if (typeof start === 'object') {
        params = start;
        start = params.start;
        stop = params.stop;
    }

    if (typeof stop === 'object') {
        params = stop;
        start = start || params.start;
        stop = undefined;
    }

    if (!stop) {
        stop = start;
        start = 0;
    }

    if (!params) params = {};
    var mode = params.mode || 'soft';
    // Availbalbe options: 'collapse', 'default', 'line', and 'all'
    var whitespace = params.whitespace || 'default';

    var re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
    var prefix = new Array(start + 1).join(' ');
    var stripPrecedingWS = !(whitespace === 'line' || whitespace === 'all'),
        stripTrailingWS = !(whitespace === 'all');
    var pPat, tPat, last;

    if (stripTrailingWS) {
        tPat = new RegExp('^( {' + start + '}.*?)\\s+$');
    } else {
        tPat = new RegExp('^(.{' + stop + '}.*?)\\s+$');
    }

    return function (text) {
		text = text.toString().replace(/\t/g, '    ');

		if (whitespace === 'collapse') {
			text = text.replace(/  +/g, ' ');
		}

        var chunks = text
            .split(re)
            .reduce(function (acc, x) {
                if (mode === 'hard') {
                    for (var i = 0; i < x.length; i += stop - start) {
                        acc.push(x.slice(i, i + stop - start));
                    }
                }
                else acc.push(x)
                return acc;
            }, []);

        chunks = chunks.reduce(function (lines, chunk) {
            if (chunk === '') return lines;

            var i = lines.length - 1;
            var xs = chunk.split(/\n/),
                curr = xs[0];

            if (!(lines[i].length + curr.length > stop &&
                    lines[i].length + curr.replace(/\s+$/, '').length > stop &&
                    lines[i].length > start)) {
                lines[i] += xs.shift();
            }

            xs.forEach(function (c) {
                last = lines.length - 1;
                if (stripTrailingWS || lines[last].length > stop) {
                    lines[last] = lines[last].replace(tPat, '$1');
                }
                if (stripPrecedingWS) {
                    c = c.replace(/^\s+/, '');
                }
                lines.push(prefix + c);
            });

            return lines;
        }, [ prefix ]);

        if (stripPrecedingWS) {
            pPat = new RegExp('^( {' + start + '})\\s+(.*)$');
            chunks[0] = chunks[0].replace(pPat, '$1$2');
        }
        last = chunks.length - 1;
        if (stripTrailingWS || chunks[last].length > stop) {
            chunks[last] = chunks[last].replace(tPat, '$1');
        }
        return chunks.join('\n');
    };
};

wordwrap.soft = wordwrap;

wordwrap.hard = function (start, stop) {
    return wordwrap(start, stop, { mode : 'hard' });
};
