const fs = require('fs');
const PDFDocument = require('pdfkit');

const mdPath = 'C:\\Users\\dines\\.gemini\\antigravity-ide\\brain\\c8b7d660-4b0b-4456-b368-1f21e93bb63c\\deployment_guide.md';
const pdfPath = 'C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\Deployment_Guide.pdf';

const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split('\n');

const doc = new PDFDocument({ margin: 50 });
doc.pipe(fs.createWriteStream(pdfPath));

doc.fontSize(20).text('DAV Transport Deployment Guide', { align: 'center' });
doc.moveDown(2);

let inCodeBlock = false;

lines.forEach(line => {
  if (line.startsWith('```')) {
    inCodeBlock = !inCodeBlock;
    if (!inCodeBlock) doc.moveDown();
    return;
  }
  
  if (inCodeBlock) {
    doc.font('Courier').fontSize(10).fillColor('#333333').text(line);
    return;
  }
  
  doc.font('Helvetica').fillColor('black');
  
  if (line.startsWith('# ')) {
    // skip, already added title
  } else if (line.startsWith('## ')) {
    doc.moveDown().fontSize(16).text(line.replace('## ', ''), { underline: true });
    doc.moveDown(0.5);
  } else if (line.startsWith('### ')) {
    doc.moveDown(0.5).fontSize(14).text(line.replace('### ', ''));
    doc.moveDown(0.5);
  } else if (line.startsWith('#### ')) {
    doc.moveDown(0.5).fontSize(12).text(line.replace('#### ', ''));
    doc.moveDown(0.5);
  } else if (line.trim().length > 0) {
    let cleanLine = line.replace(/\*\*/g, '').replace(/`/g, '');
    doc.fontSize(11).text(cleanLine);
    doc.moveDown(0.2);
  } else {
    doc.moveDown(0.5);
  }
});

doc.end();
console.log('PDF generated at ' + pdfPath);
