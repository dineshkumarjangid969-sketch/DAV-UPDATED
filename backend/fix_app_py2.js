const fs = require('fs');
let code = fs.readFileSync('docling-service/app.py', 'utf8');

// There are multiple broken string literals from transcript. Let's fix them all.
// Find any line starting with a single quote that contains "\n" and ends with a single quote
// Or block that starts with " and ends with " and contains "\n"

code = code.replace(/"(.*?\\n.*?)"/g, (match) => {
    // If it looks like python code (e.g. contains 'lat', 'lon', or 'def ', etc.)
    let block = match.substring(1, match.length - 1);
    block = block.replace(/\\n/g, '\n');
    return block;
});
fs.writeFileSync('docling-service/app.py', code, 'utf8');
