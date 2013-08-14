
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

    if (!params) { params = {}; }
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

    // NOTE: For the two RegExps `skipPat` and `lineBreakPat` that can be specified
    //       by the user:
    //       1. We require them to be "global", so we have to convert them to global
    //          if the user specifies a non-global regex.
    //       2. We cannot call `split()` on them, because they may or may not contain
    //          capturing parentheses which affect the output of `split()`.

    // Precedence: Regex = Str > Scheme
    var skip = params.skip,
        skipPat,
        flags;

    if (skip) {
        if (skip instanceof RegExp) {
            skipPat = skip;
            if (!skipPat.global) {
                flags = 'g';
                if (skipPat.ignoreCase) { flags += 'i'; }
                if (skipPat.multiline) { flags += 'm'; }
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
    if (!respectLineBreaks || !lineBreakPat.global) {
        flags = 'g';
        if (lineBreakPat.ignoreCase) { flags += 'i'; }
        if (lineBreakPat.multiline) { flags += 'm'; }
        if (!respectLineBreaks) {
            stripLineBreakPat = new RegExp('\\s*(?:' + lineBreakPat.source + ')(?:' +
                                           lineBreakPat.source + '|\\s)*', flags);
        }
        if (!lineBreakPat.global) {
            lineBreakPat = new RegExp(lineBreakPat.source, flags);
        }
    }

    var re = mode === 'hard' ? /\b/ : /(\S+\s+)/;
    var prefix = new Array(start + 1).join(' ');
    var stripPrecedingWS = !(whitespace === 'line' || whitespace === 'all'),
        stripTrailingWS = (whitespace !== 'all');
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

        var match;
        if (!lineBreakStr) {
            // Try to get lineBreakStr from `text`
            lineBreakPat.lastIndex = 0;
            match = lineBreakPat.exec(text);
            if (match) {
                lineBreakStr = match[0];
            } else {
                throw new TypeError('Line break string for the output not specified');
            }
        }

        // text -> blocks; each bloc -> segments; each segment -> chunks
        var blocks, base = 0;
        if (!respectLineBreaks) {
            // Strip line breaks and insert spaces when necessary.
            text = text.replace(stripLineBreakPat, function(match) {
                var res = match.replace(lineBreakPat, '');
                return res !== '' ? res : ' ';
            });
            blocks = [text];
        } else {
            // Split `text` by line breaks.
            blocks = [];
            lineBreakPat.lastIndex = 0;
            match = lineBreakPat.exec(text);
            while(match) {
                blocks.push(text.substring(base, match.index));
                // We use 0 to mark line breaks.
                blocks.push(0);
                base = match.index + match[0].length;
                match = lineBreakPat.exec(text);
            }
            blocks.push(text.substring(base));
        }

        var i, j, k;
        var segments;
        if (skipPat) {
            segments = [];
            for (i = 0; i < blocks.length; i++) {
                var bloc = blocks[i];
                if (bloc === 0) {
                    segments.push(bloc);
                } else {
                    base = 0;
                    skipPat.lastIndex = 0;
                    match = skipPat.exec(bloc);
                    while(match) {
                        segments.push(bloc.substring(base, match.index));
                        /* jshint -W053 */
                        segments.push(new String(match[0]));
                        base = match.index + match[0].length;
                        match = skipPat.exec(bloc);
                    }
                    segments.push(bloc.substring(base));
                }
            }
        } else {
            segments = blocks;
        }

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
                    else { acc.push(x); }
                }
                chunks = chunks.concat(acc);
            } else {
                // Can be `String` objects or 0.
                chunks.push(segment);
            }
        }

        var curLine = 0,
            curLineLength = start,
            lines = [ prefix ],
            newLine = true;

        for (i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];

            if (chunk === '') { continue; }

            if (chunk === 0) {
                // This is a line break.
                if (stripTrailingWS || curLineLength > stop) {
                    lines[curLine] = lines[curLine].replace(tPat, '$1');
                }
                lines.push(prefix);
                curLine++;
                curLineLength = start;
                newLine = true;
                continue;
            }

            if (typeof chunk !== 'string') {
                // This is a skip string.
                // Assumption: skip strings don't end with whitespaces.
                if (curLineLength >= stop) {
                    if (stripTrailingWS || curLineLength > stop) {
                        lines[curLine] = lines[curLine].replace(tPat, '$1');
                    }
                }
                lines[curLine] += chunk;
                continue;
            }

            var chunk2;
            if (curLineLength + chunk.length > stop &&
                    curLineLength + (chunk2 = chunk.replace(/\s+$/, '')).length > stop &&
                    chunk2 !== '' &&
                    curLineLength > start) {
                // This line is full, add `chunk` to the next line
                if (stripTrailingWS || curLineLength > stop) {
                    lines[curLine] = lines[curLine].replace(tPat, '$1');
                }
                if (stripPrecedingWS) {
                    chunk = chunk.replace(/^\s+/, '');
                }
                lines.push(prefix + chunk);
                curLine++;
                curLineLength = start + chunk.length;
            } else {
                // Add `chunk` to this line
                if (newLine) {
                    if (stripPrecedingWS) {
                        chunk = chunk.replace(/^\s+/, '');
                    }
                    if (chunk !== '') {
                        newLine = false;
                    }
                }
                lines[curLine] += chunk;
                curLineLength += chunk.length;
            }
        }

        if (stripTrailingWS || curLineLength > stop) {
            lines[curLine] = lines[curLine].replace(tPat, '$1');
        }
        return lines.join(lineBreakStr);
    };
};

linewrap.soft = linewrap;

linewrap.hard = function (/*start, stop, params*/) {
    var args = [].slice.call(arguments);
    var last = args.length - 1;
    if (typeof args[last] === 'object') {
        args[last].mode = 'hard';
    } else {
        args.push({ mode : 'hard' });
    }
    return linewrap.apply(null, args);
};

linewrap.wrap = function(text/*, start, stop, params*/) {
    var args = [].slice.call(arguments);
    args.shift();
    return linewrap.apply(null, args)(text);
};
