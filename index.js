
// lineBreak Schemes
var brPat = /<\s*br(?:[\s/]*|\s[^>]*)>/gi;
var lineBreakSchemeMap = {
    'unix': [/\n/g, '\n'],
    'dos': [/\r\n/g, '\r\n'],
    'mac': [/\r/g, '\r'],
    'html': [brPat, '<br>'],
    'xhtml': [brPat, '<br/>']
};

// skip Schemes
var skipSchemeMap = {
    'ansi-color': /\x1B\[[^m]*m/g,
    'html': /<[^>]*>/g,
    'bbcode': /\[[^]]*\]/g
};

var escapePat = /[-/\\^$*+?.()|[\]{}]/g;
function escapeRegExp(s) {
    return s.replace(escapePat, '\\$&');
}

var linewrap = module.exports = function (start, stop, params) {
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
    var tabWidth = params.tabWidth || 4;

    var respectLineBreaks;
    if (params.respectLineBreaks !== undefined) {
        respectLineBreaks = !!(params.respectLineBreaks);
    } else {
        respectLineBreaks = true;
    }

    // NOTE: of the two RegExps `skipPat` and `lineBreakPat`:
    // - We require `skipPat` to be "global" and convert it to global if it isn't.
    // - We require `lineBreakPat` to be "global" only if respectLineBreaks is
    //   false, otherwise we don't explicitly convert it to global, and therefore
    //   the program must be able to deal with both.

    // Precedence: Regex = Str > Scheme
    var skip = params.skip,
        skipPat,
        flags;

    if (skip) {
        if (skip instanceof RegExp) {
            skipPat = skip;
            if (!skipPat.global) {
                flags = 'g';
                if (skipPat.ignoreCase) flags += 'i';
                if (skipPat.multiline) flags += 'm';
                skipPat = new RegExp(skipPat.source, flags);
            }
        } else if (typeof skip === 'string') {
            skipPat = new RegExp(escapeRegExp(skip), 'g');
        }
    }
    if (!skipPat && params.skipScheme) {
        skipPat = skipSchemeMap[params.skipScheme];
    }

    // Precedence:
    // - for lineBreakPat: Regex > Scheme > Str
    // - for lineBreakStr: Str > Scheme > Regex
    var lineBreakScheme = params.lineBreakScheme,
        lineBreak = params.lineBreak,
        lineBreakPat, lineBreakStr;

    if (lineBreakScheme) {
        // Supported schemes: 'unix', 'dos', 'mac', 'html', 'xhtml'
        var item = lineBreakSchemeMap[lineBreakScheme];
        if (item) {
            lineBreakPat = item[0];
            lineBreakStr = item[1];
        }
    }
    if (lineBreak) {
        if (lineBreak instanceof Array) {
            if (lineBreak.length === 1) {
                lineBreak = lineBreak[0];
            } else if (lineBreak.length >= 2) {
                if (lineBreak[0] instanceof RegExp) {
                    lineBreakPat = lineBreak[0];
                    if (typeof lineBreak[1] === 'string') {
                        lineBreakStr = lineBreak[1];
                    }
                } else if (lineBreak[1] instanceof RegExp) {
                    lineBreakPat = lineBreak[1];
                    if (typeof lineBreak[0] === 'string') {
                        lineBreakStr = lineBreak[0];
                    }
                } else if (typeof lineBreak[0] === 'string' && typeof lineBreak[1] === 'string') {
                    lineBreakPat = new RegExp(escapeRegExp(lineBreak[0]), 'g');
                    lineBreakStr = lineBreak[1];
                } else {
                    lineBreak = lineBreak[0];
                }
            }
        }
        if (typeof lineBreak === 'string') {
            lineBreakStr = lineBreak;
            if (!lineBreakPat) {
                lineBreakPat = new RegExp(escapeRegExp(lineBreak), 'g');
            }
        } else if (lineBreak instanceof RegExp) {
            lineBreakPat = lineBreak;
        }
    }
    // Only assign defaults when `lineBreakPat` is not assigned.
    // So if `params.lineBreak` is a RegExp, we don't have a value in `lineBreakStr`
    // yet. We will try to get the value from the input string, and if failed, we
    // will throw an exception.
    if (!lineBreakPat) {
        lineBreakPat = /\n/g;
        lineBreakStr = '\n';
    }

    var stripLineBreakPat;
    if (!respectLineBreaks) {
        flags = 'g';
        if (lineBreakPat.ignoreCase) flags += 'i';
        if (lineBreakPat.multiline) flags += 'm';
        stripLineBreakPat = new RegExp('\\s*(?:' + lineBreakPat.source + ')(?:' + lineBreakPat.source + '|\\s)*', flags);
        // We need `lineBreakPat` to be global in this case.
        if (!lineBreakPat.global) {
            lineBreakPat = new RegExp(lineBreakPat.source, flags);
        }
    }

    var re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
    var prefix = new Array(start + 1).join(' ');
    var stripPrecedingWS = !(whitespace === 'line' || whitespace === 'all'),
        stripTrailingWS = !(whitespace === 'all');
    var pPat, tPat;

    if (stripTrailingWS) {
        tPat = new RegExp('^( {' + start + '}[^]*?)\\s+$');
    } else {
        tPat = new RegExp('^([^]{' + stop + '}[^]*?)\\s+$');
    }

    return function (text) {
        text = text.toString().replace(/\t/g, new Array(tabWidth + 1).join(' '));

        if (whitespace === 'collapse') {
            text = text.replace(/  +/g, ' ');
        }

        if (!lineBreakStr) {
            // Try to get lineBreakStr from `text`
            lineBreakPat.lastIndex = 0;
            var match = lineBreakPat.exec(text);
            if (match) {
                lineBreakStr = match[0];
            } else {
                throw new TypeError('Line break string for the output not specified');
            }
        }

        if (!respectLineBreaks) {
            // Strip line breaks and insert spaces when necessary.
            text = text.replace(stripLineBreakPat, function(match) {
                var res = match.replace(lineBreakPat, '');
                return res !== '' ? res : ' ';
            });
        }

        var segments, match, base = 0;
        if (skipPat) {
            segments = [];
            skipPat.lastIndex = 0;
            match = skipPat.exec(text);
            while(match) {
                segments.push(text.substring(base, match.index));
                segments.push(new String(match[0]));
                base = match.index + match[0].length;
                match = skipPat.exec(text);
            }
            segments.push(text.substring(base));
        } else {
            segments = [text];
        }

        var i, j, k;
        var chunks = [];

        for (i = 0; i < segments.length; i++) {
            var segment = segments[i];
            if (typeof segment === 'string') {
                var parts = segment.split(re),
                    acc = [];

                for (j = 0; j < parts.length; j++) {
                    var x = parts[j];
                    if (mode === 'hard') {
                        for (k = 0; k < x.length; k += stop - start) {
                            acc.push(x.slice(k, k + stop - start));
                        }
                    }
                    else acc.push(x);
                }
                chunks = chunks.concat(acc);
            } else {
                chunks.push(segment);
            }
        }

        var curLine = 0,
            curLineLength = start,
            lines = [ prefix ];

        for (i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];

            if (chunk === '') continue;

            if (typeof chunk !== 'string') {
                // Assumption: skip strings don't end with whitespaces.
                if (curLineLength >= stop) {
                    if (stripTrailingWS || curLineLength > stop) {
                        lines[curLine] = lines[curLine].replace(tPat, '$1');
                    }
                }
                lines[curLine] += chunk;
                continue;
            }

            var xs, curr, curr2;
            lineBreakPat.lastIndex = 0;
            if (lineBreakPat.test(chunk)) {
                // Don't pre-shift
                xs = chunk.split(lineBreakPat);
                curr = xs[0];
            } else {
                // Pre-shift
                xs = null;
                curr = chunk;
            }

            if (curLineLength + curr.length > stop &&
                    curLineLength + (curr2 = curr.replace(/\s+$/, '')).length > stop &&
                    curr2 !== '' &&
                    curLineLength > start) {
                // This line is full, add `curr` to the next line
                if (!xs) {
                    // Unshift since we pre-shifted
                    xs = [curr];
                }
            } else {
                // Add `curr` to this line
                if (xs) {
                    // Shift since we didn't pre-shift
                    xs.shift();
                }
                lines[curLine] += curr;
                curLineLength += curr.length;
            }

            if (xs) {
                for (j = 0; j < xs.length; j++) {
                    var c = xs[j];
                    if (stripTrailingWS || curLineLength > stop) {
                        lines[curLine] = lines[curLine].replace(tPat, '$1');
                    }
                    if (stripPrecedingWS) {
                        c = c.replace(/^\s+/, '');
                    }
                    lines.push(prefix + c);
                    curLine++;
                    curLineLength = start + c.length;
                }
            }
        }

        if (stripPrecedingWS) {
            pPat = new RegExp('^( {' + start + '})\\s+([^]*)$');
            lines[0] = lines[0].replace(pPat, '$1$2');
        }
        if (stripTrailingWS || curLineLength > stop) {
            lines[curLine] = lines[curLine].replace(tPat, '$1');
        }
        return lines.join(lineBreakStr);
    };
};

linewrap.soft = linewrap;

linewrap.hard = function (start, stop, params) {
    var args = [].slice.call(arguments);
    var last = args.length - 1;
    if (typeof args[last] === 'object') {
        args[last].mode = 'hard';
    } else {
        args.push({ mode : 'hard' });
    }
    return linewrap.apply(null, args);
};

linewrap.wrap = function(text, start, stop, params) {
    var args = [].slice.call(arguments);
    args.shift();
    return linewrap.apply(null, args)(text);
}
