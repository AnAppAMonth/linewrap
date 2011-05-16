exports.wrap = function (start, stop) {
    if (!stop) {
        stop = start;
        start = 0;
    }
    
    return function (text) {
        return text.split(/(\S+\s+)/).reduce(function (lines, rawChunk) {
            if (rawChunk === '') return lines;
            
            var chunk = rawChunk.replace(/\t/g, '    ');
            
            var i = lines.length - 1;
            if (lines[i].length + chunk.length > stop) {
                lines[i] = lines[i].replace(/\s+$/, '');
                lines.push(chunk.replace(/^\s+/, ''));
            }
            else {
                lines[i] += chunk;
            }
            
            return lines;
        }, [ '' ]);
    };
};
