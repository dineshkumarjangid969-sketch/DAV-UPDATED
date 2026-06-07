import sys
import os

sys.path.insert(0, r'c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\docling-service')
from app import DoclingParser

parser = DoclingParser()

pdf_files = [
    r"C:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\uploads\e91af231-113b-468e-b6c2-82fc0bd917a4.pdf",
    r"C:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\uploads\e602fc31-dedf-4cb4-9127-b4a301f394e5.pdf",
    r"C:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\uploads\7854576c-f9d2-4def-93b2-f1d349bd14dc.pdf",
    r"C:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\uploads\2004e289-0841-4532-a01a-86ef8168643d.pdf"
]

for pdf in pdf_files:
    print(f"\n============================")
    print(f"Parsing {pdf}...")
    res = parser.parse_file(pdf)
    print("Document Type:", res.get('document_type'))
    print("Order Number:", res.get('order_number'))
    print("Invoice Number:", res.get('invoice_number'))
    print("Line Items:", res.get('line_items'))
    
    # Print the first 1000 chars of text to see the layout
    text = res.get('raw_markdown', '')
    print("--- RAW TEXT START ---")
    print(text[:2000])
    print("--- RAW TEXT END ---")
