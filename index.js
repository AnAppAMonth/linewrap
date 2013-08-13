
// lineBreak Schemes
var brPat = /<\s*br(?:[\s/]*|\s[^>]*)>/i;
var lineBreakSchemeMap = {
    'unix': [/\n/, '\n'],
    'dos': [/\r\n/, '\r\n'],
    'mac': [/\r/, '\r'],
    'html': [brPat, '<br>'],
    'xhtml': [brPat, '<br/>']
};

// skip Schemes
var skipSchemeMap = {
    'ansi-color': /\x1B\[[^m]*m/g,
    'html': /<[^>]*>/g,
    'bbcode': /\[[^]]*\]/g
};

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

    // Precedence: Regex = Str > Scheme
    var skip = params.skip,
        skipPat;

    if (skip) {
        if (skip instanceof RegExp) {
            skipPat = skip;
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
                } else {
                    lineBreak = lineBreak[0];
                }
            }
        }
        if (typeof lineBreak === 'string') {
            lineBreakStr = lineBreak;
            if (!lineBreakPat) {
                lineBreakPat = new RegExp(escapeRegExp(lineBreak));
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
        lineBreakPat = /\n/;
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

        if (!lineBreakStr) {
            // Try to get lineBreakStr from `text`
            var match = text.match(lineBreakPat);
            if (match) {
                lineBreakStr = match[0];
            } else {
                throw new TypeError('Line break string for the output not specified');
            }
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
