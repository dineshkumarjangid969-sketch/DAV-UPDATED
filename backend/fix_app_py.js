const fs = require('fs');
let code = fs.readFileSync('docling-service/app.py', 'utf8');
const match = code.match(/"# Comprehensive STORE_REGISTRY\\n.*?"/s);
if (match) {
    let block = match[0];
    block = block.substring(1, block.length - 1);
    block = block.replace(/\\n/g, '\n');
    code = code.replace(match[0], block);
    fs.writeFileSync('docling-service/app.py', code, 'utf8');
    console.log('Fixed app.py string literal 1');
} else {
    console.log('Match 1 not found');
}

// Just in case there are others
const match2 = code.match(/"import re\\n.*?"/s);
if (match2) {
    let block = match2[0];
    block = block.substring(1, block.length - 1);
    block = block.replace(/\\n/g, '\n');
    code = code.replace(match2[0], block);
    fs.writeFileSync('docling-service/app.py', code, 'utf8');
    console.log('Fixed app.py string literal 2');
}

