const fs = require('fs');
let code = fs.readFileSync('patch_app.py', 'utf8');
if (code.startsWith('"') && code.endsWith('"')) {
    code = code.substring(1, code.length - 1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    fs.writeFileSync('patch_app.py', code, 'utf8');
    console.log('Fixed patch_app.py string formatting!');
}
