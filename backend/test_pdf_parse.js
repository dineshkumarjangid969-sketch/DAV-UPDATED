const fs = require('fs');
const pdf = require('pdf-parse');

(async () => {
  try {
    let dataBuffer1 = fs.readFileSync('C:\\\\Users\\\\dines\\\\OneDrive\\\\Documents\\\\DAV TRANSPORT\\\\backend\\\\uploads\\\\b216e436-e71e-4bd8-bdfc-5abff90ce168.pdf');
    const data1 = await pdf(dataBuffer1);
    console.log('--- Invoice_3831432.pdf ---');
    console.log(data1.text);
  } catch (e) { console.error(e.message); }

  try {
    let dataBuffer2 = fs.readFileSync('C:\\\\Users\\\\dines\\\\OneDrive\\\\Documents\\\\DAV TRANSPORT\\\\backend\\\\uploads\\\\27481cc7-ea6e-4e23-966d-abba9bd4ae49.pdf');
    const data2 = await pdf(dataBuffer2);
    console.log('--- BT From Mt Wellington.pdf ---');
    console.log(data2.text);
  } catch (e) { console.error(e.message); }
})();
