<USER_REQUEST>
For the Product description we do not need these details like SQU code, dimesnsion, allocated by and qty. these are seprate things and this shouldn't be there on description tab. description means product.

eg like for order 114582
For order product is AUBURN CNR PC FAB L/G, rest everything goes off!

also does this helps:   #!/usr/bin/env python3
"""
Docling Document Parsing Microservice
Receives PDF/image files via HTTP POST, returns structured JSON.
"""
import os
import re
import csv
import tempfile
import shutil
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel

try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False
    print("WARNING: Docling not installed")

app = FastAPI(title="DAV Transport Docling Service", version="2.0.0")

# --- CATALOG MATCHING ENGINE ---
class ProductCatalog:
    def __init__(self, csv_path="products.csv"):
        self.sku_index = {}
        self.id_index = {}
        self.word_index = defaultdict(list)
        self.is_loaded = False
        self._load_data(csv_path)
        
    def _tokenize(self, text):
        """Extracts alphanumeric words for fast fuzzy matching."""
        return set(re.findall(r'[a-z0-9]{2,}', str(text).lower()))
        
    def _load_data(self, csv_path):
        if not os.path.exists(csv_path):
            print(f"Catalog file {csv_path} not found. Operating without catalog validation.")
            return
            
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if not row.get('Model Code') or not row.get('Name'):
        
<truncated 15994 bytes>
tinue
                product_name = line
                break
            qty_match = re.search(r"(?:Delv Qty|Delivered qty|Del qty|ORD)[:\s]*(\d+)", segments[i + 1], re.IGNORECASE)
            extracted_lines.append({"sku": "", "description": product_name, "quantity": int(qty_match.group(1)) if qty_match else 1})
        result["line_items"] = extracted_lines

parser = DoclingParser()

@app.post("/parse", response_model=ParseResult)
async def parse_document(file: UploadFile = File(...)):
    temp_path = None
    try:
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"docling_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{file.filename}")
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        result = parser.parse_file(temp_path)
        return ParseResult(**result)
    except Exception as e:
        raise HTTPException(500, f"Parse error: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000). 
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-06-11T05:39:48+12:00.

The user's current state is as follows:
Active Document: c:\Users\dines\.gemini\config\mcp_config.json (LANGUAGE_JSON)
Cursor is on line: 1
Other open documents:
- c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\docling-service\app.py (LANGUAGE_PYTHON)
- c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\ecosystem.config.js (LANGUAGE_JAVASCRIPT)
- c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\debug_route.js (LANGUAGE_JAVASCRIPT)
- c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\fix_specific_eml.js (LANGUAGE_JAVASCRIPT)
- c:\Users\dines\OneDrive\Documents\DAV TRANSPORT\backend\fix_eml_paths_fast.js (LANGUAGE_JAVASCRIPT)
Browser State:
  Page 6CCD48BC2C4A01032BAB0C04B327F487 (DAV Transport Dashboard) - http://localhost:3000/ [ACTIVE]
    Viewport: 1536x730, Page Height: 729
</ADDITIONAL_METADATA>