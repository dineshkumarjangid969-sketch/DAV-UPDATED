const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('../BT2.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(e => console.error(e));
