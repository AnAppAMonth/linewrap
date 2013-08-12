
// lineBreak Schemes
var brPat = /<\s*br(?:[\s/]*|\s[^>]*)>/i;
var lineBreakSchemeMap = {
    'unix': [/\n/, '\n'],
    'dos': [/\r\n/, '\r\n'],
    'mac': [/\r/, '\r'],
    'html': [brPat, '<br>'],
    'xhtml': [brPat, '<br/>'],
}

function escapeRegExp(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
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

    // Precedence: Scheme > Regex > Str
    var skipScheme = params.skipScheme,
        skipPat = params.skipRegex;
    if (skipScheme) {
        // Supported schemes: 'color', 'html', 'bbcode'
        if (skipScheme === 'color') {
            skipPat = /\x1B\[[^m]*m/g;
        } else if (skipScheme === 'html') {
            skipPat = /<[^>]*>/g;
        } else if (skipScheme === 'bbcode') {
            skipPat = /\[[^]]*\]/g;
        }
    }
    if (skipPat instanceof RegExp) {
        if (!skipPat.global) {
            var flags = 'g';
            if (skipPat.ignoreCase) {
                flags += 'i';
            } else if (skipPat.multiline) {
                flags += 'm';
            }
            skipPat = new RegExp(skipPat.source, flags);
        } else {
            skipPat.lastIndex = 0;
        }
    } else if (params.skipStr) {
        skipPat = new RegExp(escapeRegExp(params.skipStr), 'g');
    } else {
        skipPat = undefined;
    }

    // Precedence:
    // - for lineBreakPat: Scheme > Regex > Str
    // - for lineBreakStr: Scheme > Str
    var lineBreakScheme = params.lineBreakScheme,
        lineBreakPat = params.lineBreakRegex,
        lineBreakStr = params.lineBreakStr;
    if (lineBreakScheme) {
        // Supported schemes: 'unix', 'dos', 'mac', 'html', 'xhtml'
        var item = lineBreakSchemeMap[lineBreakScheme];
        if (item) {
            lineBreakPat = item[0];
            lineBreakStr = item[1];
        }
    }
    if (!(lineBreakPat instanceof RegExp)) {
        if (lineBreakStr) {
            lineBraekPat = new RegExp(escapeRegExp(lineBreakStr));
        } else {
            lineBreakPat = /\n/;
        }
    }
    if (!lineBreakStr) {
        lineBreakStr = '\n';
    }

    var re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
    var prefix = new Array(start + 1).join(' ');
    var stripPrecedingWS = !(whitespace === 'line' || whitespace === 'all'),
        stripTrailingWS = !(whitespace === 'all');
    var pPat, tPat;

    if (stripTrailingWS) {
        tPat = new RegExp('^( {' + start + '}.*?)\\s+$');
    } else {
        tPat = new RegExp('^(.{' + stop + '}.*?)\\s+$');
    }

    return function (text) {
		text = text.toString().replace(/\t/g, new Array(tabWidth + 1).join(' '));

		if (whitespace === 'collapse') {
			text = text.replace(/  +/g, ' ');
		}

        var segments, match, base = 0;
        if (skipPat) {
            segments = [];
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

        var chunks = segments.reduce(function (result, segment) {
            if (typeof segment === 'string') {
                var parts = segment
                    .split(re)
                    .reduce(function (acc, x) {
                        if (mode === 'hard') {
                            for (var i = 0; i < x.length; i += stop - start) {
                                acc.push(x.slice(i, i + stop - start));
                            }
                        }
                        else acc.push(x);
                        return acc;
                    }, []);
                return result.concat(parts);
            } else {
                result.push(segment);
                return result;
            }
        }, []);

        var curLine = 0,
            curLineLength = start;
        chunks = chunks.reduce(function (lines, chunk) {
            if (chunk === '') return lines;

            if (typeof chunk !== 'string') {
                // Assumption: skip strings don't end with whitespaces.
                if (curLineLength >= stop) {
                    if (stripTrailingWS || curLineLength > stop) {
                        lines[curLine] = lines[curLine].replace(tPat, '$1');
                    }
                }
                lines[curLine] += chunk;
                return lines;
            }

            var xs, curr, curr2;
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
                xs.forEach(function (c) {
                    if (stripTrailingWS || curLineLength > stop) {
                        lines[curLine] = lines[curLine].replace(tPat, '$1');
                    }
                    if (stripPrecedingWS) {
                        c = c.replace(/^\s+/, '');
                    }
                    lines.push(prefix + c);
                    curLine++;
                    curLineLength = start + c.length;
                });
            }

            return lines;
        }, [ prefix ]);

        if (stripPrecedingWS) {
            pPat = new RegExp('^( {' + start + '})\\s+(.*)$');
            chunks[0] = chunks[0].replace(pPat, '$1$2');
        }
        if (stripTrailingWS || curLineLength > stop) {
            chunks[curLine] = chunks[curLine].replace(tPat, '$1');
        }
        return chunks.join(lineBreakStr);
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
