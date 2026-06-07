const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const pdf_files = [
    "C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\e91af231-113b-468e-b6c2-82fc0bd917a4.pdf",
    "C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\e602fc31-dedf-4cb4-9127-b4a301f394e5.pdf",
    "C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\7854576c-f9d2-4def-93b2-f1d349bd14dc.pdf",
    "C:\\Users\\dines\\OneDrive\\Documents\\DAV TRANSPORT\\backend\\uploads\\2004e289-0841-4532-a01a-86ef8168643d.pdf"
];

async function parseAll() {
    for (const pdf of pdf_files) {
        console.log(`\n============================`);
        console.log(`Parsing ${pdf}...`);
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(pdf));

            const res = await axios.post('http://127.0.0.1:8000/parse', formData, {
                headers: formData.getHeaders(),
                timeout: 60000 // 60s timeout
            });

            const data = res.data;
            console.log("Document Type:", data.document_type);
            console.log("Order Number:", data.order_number);
            console.log("Invoice Number:", data.invoice_number);
            console.log("Line Items:", JSON.stringify(data.line_items));
            
            const text = data.raw_markdown || '';
            console.log("--- RAW TEXT START ---");
            console.log(text.substring(0, 1500));
            console.log("--- RAW TEXT END ---");
        } catch (e) {
            console.error("Failed:", e.message);
            if (e.response && e.response.data) {
                 console.error(e.response.data);
            }
        }
    }
}

parseAll();
