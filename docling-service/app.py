#!/usr/bin/env python3
"""
Docling Document Parsing Microservice
Receives PDF/image files via HTTP POST, returns structured JSON.
"""
import os
import re
import tempfile
import shutil
from typing import Dict, List, Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
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

# Store Registry
STORE_REGISTRY = {
    'Wairau Park': {'lat': -36.7816, 'lon': 174.7510, 'region': 'Auckland', 'aliases': ['Wairau']},
    'Albany': {'lat': -36.7263, 'lon': 174.6994, 'region': 'Auckland', 'aliases': []},
    'Westgate': {'lat': -36.8183, 'lon': 174.6112, 'region': 'Auckland', 'aliases': []},
    'Hastings': {'lat': -39.6396, 'lon': 176.8392, 'region': 'Hawkes Bay', 'aliases': []},
    'Palmerston North': {'lat': -40.3523, 'lon': 175.6082, 'region': 'Manawatu', 'aliases': ['Palmy']},
    'Hamilton': {'lat': -37.7870, 'lon': 175.2793, 'region': 'Waikato', 'aliases': []},
    'Whanganui': {'lat': -39.9334, 'lon': 175.0479, 'region': 'Manawatu', 'aliases': ['Wanganui']},
    'Whakatane': {'lat': -37.9534, 'lon': 176.9908, 'region': 'Bay of Plenty', 'aliases': []},
    'Lower Hutt': {'lat': -41.2092, 'lon': 174.9081, 'region': 'Wellington', 'aliases': ['Hutt']},
    'Whangarei': {'lat': -35.7251, 'lon': 174.3237, 'region': 'Northland', 'aliases': []},
}

class ParseResult(BaseModel):
    document_type: str = "tax_invoice"
    client_name: str = "Harvey Norman"
    pickup_store: str = ""
    pickup_warehouse: str = ""
    destination_store: str = ""
    bt_from: str = ""
    bt_to: str = ""
    order_number: str = ""
    invoice_number: str = ""
    po_number: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    destination_address: str = ""
    requires_assembly: bool = False
    has_rubbish_removal: bool = False
    delivery_instructions: str = ""
    preferred_delivery_date: str = ""
    line_items: List[dict] = []
    type: str = "customer_delivery"
    bt_type: str = "customer_delivery"
    billing_party: str = ""
    location: str = ""
    confidence: float = 0.0
    raw_markdown: Optional[str] = ""
    raw_tables: Optional[List[List[List[str]]]] = []


class DoclingParser:
    def __init__(self):
        if DOCLING_AVAILABLE:
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_table_structure = True
            pipeline_options.do_ocr = True
            self.converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                }
            )
        else:
            self.converter = None

    def parse_file(self, file_path: str) -> Dict:
        if not DOCLING_AVAILABLE or not self.converter:
            return self._fallback_parse(file_path)
        try:
            result = self.converter.convert(file_path)
            markdown = result.document.export_to_markdown()
            tables = self._extract_tables(result.document)
            extracted = self.extract_order_data(markdown, tables)
            extracted["raw_markdown"] = markdown
            extracted["raw_tables"] = tables
            return extracted
        except Exception as e:
            print(f"Docling parse error: {e}")
            return {}

    def _extract_tables(self, document) -> List[List[List[str]]]:
        tables = []
        try:
            for table in document.tables:
                table_data = []
                for row in table.data:
                    row_data = [str(cell.text).strip() for cell in row]
                    table_data.append(row_data)
                tables.append(table_data)
        except Exception as e:
            print(f"Table extraction error: {e}")
        return tables

    def extract_order_data(self, text: str, tables: List[List[List[str]]]) -> Dict:
        text_upper = text.upper()
        doc_type = "tax_invoice" # Default
        
        # --- NEW CLASSIFICATION ROUTER ---
        if "SALES ORDER" in text_upper and "BT" in text_upper:
            doc_type = "bt_sales_order"
        elif "TAPE CONTENTS" in text_upper:
            doc_type = "bt_tape_contents"
        elif "PURCHASE ORDER" in text_upper or "P/O RESPONSE" in text_upper:
            doc_type = "purchase_order"
        elif re.search(r"\b(?:GOODS MOVEMENT|BRANCH TRANSFER|OFFSITE TO SHOWROOM|BT(?:\s*\d*)?(?:\s+FROM|\b))\b", text_upper):
            doc_type = "branch_transfer"
        elif any(x in text_upper for x in ["RETURN TO STORE", "RETURN TO SHOWROOM", "RETURN TO WAREHOUSE", "CUSTOMER RETURN"]):
            doc_type = "return_to_store"

        # Initialize the result dictionary (keep your existing setup)
        result = {
            "document_type": doc_type,
            "client_name": "Harvey Norman",
            "pickup_store": "", "pickup_warehouse": "", "destination_store": "",
            "bt_from": "", "bt_to": "",
            "order_number": "", "invoice_number": "", "po_number": "",
            "customer_name": "", "customer_phone": "", "destination_address": "",
            "requires_assembly": False, "has_rubbish_removal": False,
            "delivery_instructions": "", "preferred_delivery_date": "",
            "line_items": [], "type": "customer_delivery", "bt_type": "customer_delivery",
            "billing_party": "", "location": "", "confidence": 0,
        }

        # --- EXECUTE THE CORRECT RULESET ---
        if doc_type == "bt_sales_order":
            self._parse_bt_sales_order(text, tables, result)
        elif doc_type == "bt_tape_contents":
            self._parse_bt_tape_contents(text, result)
        elif doc_type == "tax_invoice":
            self._parse_tax_invoice(text, tables, result)
        elif doc_type == "purchase_order":
            self._parse_purchase_order(text, tables, result)
        elif doc_type == "branch_transfer":
            self._parse_goods_movement(text, tables, result)
        elif doc_type == "return_to_store":
            self._parse_return_to_store(text, tables, result)

        self._extract_store_info(text, result)
        self._extract_phone(text, result)
        self._extract_flags(text.lower(), result)
        self._extract_line_items_from_tables(tables, result)
        self._set_coordinates(result)
        self._calculate_billing_and_location(result)
        result["confidence"] = self._calculate_confidence(result)
        return result

    def _parse_return_to_store(self, text: str, tables, result: Dict):
        result["type"] = "branch_transfer"
        result["bt_type"] = "return_to_store"
        
        order_match = re.search(r"(?:Order Ref|SO|ORD|Order)[:\s#]*([A-Z0-9\-]+)", text, re.IGNORECASE)
        if order_match:
            result["order_number"] = order_match.group(1).strip()
            
        inv_match = re.search(r"INVOICE\s*(?:NO|NUMBER|#)?[:\s]*(\d[\d/\-]+)", text, re.IGNORECASE)
        if inv_match:
            result["invoice_number"] = inv_match.group(1).strip()

        store_match = re.search(r"Harvey\s+Norman\s+(?:Home\s+Furnishings\s+)?([A-Za-z\s]+?)(?=\s+\d+|$)", text, re.IGNORECASE)
        if store_match:
            result["pickup_store"] = self._normalize_store(store_match.group(1).strip())
            result["bt_from"] = result["pickup_store"]
            result["bt_to"] = result["pickup_store"]
            result["destination_store"] = result["pickup_store"]
            
        cust_match = re.search(r"Customer\s+Name[:\s]+([A-Za-z\s]+?)(?=\s+Customer\s+Phone|\s+Please\s+Deliver|$)", text, re.IGNORECASE)
        if cust_match:
            result["customer_name"] = cust_match.group(1).strip()
            
        phone_match = re.search(r"Customer\s+Phone[:\s]+(\d+)", text, re.IGNORECASE)
        if phone_match:
            result["customer_phone"] = phone_match.group(1).strip()

        pickup_match = re.search(r"(?:Pickup\s+From|Customer\s+Address|From)[:\s]+(.*?)(?=\s*(?:Product|Signature|Authorised|$))", text, re.IGNORECASE | re.DOTALL)
        if pickup_match:
            result["destination_address"] = pickup_match.group(1).strip().replace("\n", ", ")

    def _parse_tax_invoice(self, text: str, tables, result: Dict):
        inv_patterns = [
            r"INVOICE\s+REPRINT\s+(\d{2}/\d+)",
            r"INVOICE\s*(?:NO|NUMBER|#)?[:\s]*(\d[\d/\-]+)",
            r"INVOICE\s*#?\s*(\d+)",
        ]
        for pattern in inv_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result["invoice_number"] = match.group(1).strip()
                break

        cust_patterns = [
            r"Customer\s*:\s*([A-Z][A-Za-z\s\.\-]+?)(?=\n|Phone|Address|Location|Sales|Date|Product|$)",
            r"Sold\s+To\s*:\s*([A-Z][A-Za-z\s\.\-]+?)(?=\n|Phone|Address|$)",
            r"(?:Name|Customer\s+Name)\s*:\s*([A-Z][A-Za-z\s\.\-]+?)(?=\n|Phone|Address|$)",
            r"Delivery\s+To\s*:\s*([A-Z][A-Za-z\s\.\-]+?)(?=\n|Address|Phone|$)",
        ]
        for pattern in cust_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if len(name) > 3 and not any(x in name.upper() for x in ["TAX INVOICE", "INVOICE REPRINT", "PRODUCT", "QTY", "SKU"]):
                    result["customer_name"] = name
                    break

        order_patterns = [
            r"(?:Order|SO|Sales Order)[:\s#-]*([A-Z0-9\-]+)",
            r"Order\s+Ref[:\s#]*([A-Z0-9\-]+)",
            r"SO\s*#?\s*([A-Z0-9\-]+)",
        ]
        for pattern in order_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                if len(candidate) > 2:
                    result["order_number"] = candidate
                    break

        addr_patterns = [
            r"Delivery\s+Address\s*:\s*(.*?)(?=\n\s*(?:Delivery Instructions|Phone|Product|Invoice|GST|Customer|Signature|SALES ORDER|----------|##? |$))",
            r"Deliver\s+To\s*:\s*(.*?)(?=\n\s*(?:Instructions|Phone|Product|Invoice|##? |$))",
            r"Address\s*:\s*(.*?)(?=\n\s*(?:Instructions|Phone|Product|##? |$))",
        ]
        for pattern in addr_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                addr = match.group(1).strip().replace("\n", ", ")
                addr = re.sub(r"\s{2,}", " ", addr)
                if len(addr) > 10 and not addr.upper().startswith("PRODUCT"):
                    result["destination_address"] = addr
                    break

        instr_patterns = [
            r"Delivery\s+Instructions\s*:\s*(.*?)(?=\n\s*(?:Address|Phone|Product|Invoice|GST|Signature|##? |$))",
            r"Instructions\s*:\s*(.*?)(?=\n\s*(?:Address|Phone|Product|##? |$))",
        ]
        for pattern in instr_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                instr = match.group(1).strip().replace("\n", " ")
                instr = re.sub(r"\s{2,}", " ", instr)
                if len(instr) > 3:
                    result["delivery_instructions"] = instr
                    break

        if not result["line_items"]:
            self._extract_line_items_from_text(text, result)

    def _parse_purchase_order(self, text: str, tables, result: Dict):
        po_match = re.search(r"PURCHASE\s+ORDER\s+(\S+)", text, re.IGNORECASE)
        if po_match:
            result["po_number"] = po_match.group(1).strip()
        por_match = re.search(r"P/O\s+Response\s+(\d+)", text, re.IGNORECASE)
        if por_match:
            result["order_number"] = por_match.group(1).strip()
        supp_match = re.search(r"Supplier\s+Invoice[:\s]+(\d+)", text, re.IGNORECASE)
        if supp_match:
            result["invoice_number"] = supp_match.group(1).strip()
        cust_match = re.search(r"Customer\s+Name[:\s]+([A-Za-z\s]+?)(?=\s+Customer\s+Phone|\s+Please\s+Deliver|$)", text, re.IGNORECASE)
        if cust_match:
            result["customer_name"] = cust_match.group(1).strip()
        phone_match = re.search(r"Customer\s+Phone[:\s]+(\d+)", text, re.IGNORECASE)
        if phone_match:
            result["customer_phone"] = phone_match.group(1).strip()
        deliver_match = re.search(r"Please\s+Deliver\s+To[:\s]+(.*?)(?=Authorised|$)", text, re.IGNORECASE | re.DOTALL)
        if deliver_match:
            result["destination_address"] = deliver_match.group(1).strip().replace("\n", ", ")
        store_match = re.search(r"Harvey\s+Norman\s+(?:Home\s+Furnishings\s+)?([A-Za-z\s]+?)(?=\s+\d+|$)", text, re.IGNORECASE)
        if store_match:
            result["pickup_store"] = self._normalize_store(store_match.group(1).strip())
        result["type"] = "branch_transfer"
        result["bt_type"] = "purchase_order"
        result["destination_store"] = result["pickup_store"]

    def _parse_goods_movement(self, text: str, tables, result: Dict):
        result["type"] = "branch_transfer"
        result["bt_type"] = "branch_transfer"
        bt_patterns = [
            r"(?:from|OFFSITE)[:\s]+([A-Za-z\s]+?)(?:\s+to\s+|\s*→\s*)([A-Za-z\s]+)",
            r"From\s*:\s*([A-Za-z\s]+?)\s+To\s*:\s*([A-Za-z\s]+)",
            r"BT(?:\s*\d*)?\s*(?:Collection\s+)?From\s+([A-Za-z\s]+?)\s+To\s+([A-Za-z\s]+)",
            r"BT(?:\s*\d*)?\s+From\s+([A-Za-z\s]+?)\s+To\s+([A-Za-z\s]+)",
            r"Branch\s+Transfer\s+(?:From\s+)?([A-Za-z\s]+?)\s+(?:To\s+)([A-Za-z\s]+)",
            r"Goods\s+Movement\s+(?:from\s+)?([A-Za-z\s]+?)\s+(?:to\s+)([A-Za-z\s]+)",
        ]
        for pattern in bt_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result["bt_from"] = self._normalize_store(match.group(1).strip())
                result["bt_to"] = self._normalize_store(match.group(2).strip())
                result["pickup_store"] = result["bt_from"]
                result["destination_store"] = result["bt_to"]
                break
        order_match = re.search(r"(?:Order Ref|SO|ORD|Order)[:\s#]*([A-Z0-9\-]+)", text, re.IGNORECASE)
        if order_match:
            result["order_number"] = order_match.group(1).strip()
        if not result["line_items"]:
            self._extract_line_items_from_text(text, result)
        
        if not result["line_items"]:
            result["line_items"].append({"sku": "GM", "quantity": 1, "description": "Goods movement"})

    def _parse_bt_sales_order(self, text: str, tables: List[List[List[str]]], result: Dict):
        """Ruleset 1: Parses structured Sales Order layouts"""
        result["type"] = "branch_transfer"
        result["bt_type"] = "sales_order"
        
        # 1. Origin Store
        origin_match = re.search(r"trading as Harvey Norman Furniture\s+([A-Za-z\s]+)", text, re.IGNORECASE)
        if origin_match:
            result["bt_from"] = self._normalize_store(origin_match.group(1).strip())
            result["pickup_store"] = result["bt_from"]

        # 2 & 3. Destination Store & Address (Look below GST No.)
        # This regex looks for GST No, then grabs the next line (Store) and the line after (Address)
        dest_match = re.search(r"GST No\.\s*[\d\.]+\s*\n\s*([^\n]+)\n\s*([^\n]+)", text, re.IGNORECASE)
        if dest_match:
            result["bt_to"] = self._normalize_store(dest_match.group(1).strip())
            result["destination_store"] = result["bt_to"]
            result["destination_address"] = dest_match.group(2).strip()

        # 4. Purchase Order (Last 6 digits)
        po_match = re.search(r"Purchase Order[:\s]*.*?(\d{6})\b", text, re.IGNORECASE)
        if po_match:
            result["order_number"] = po_match.group(1).strip()
            
        # 5. Products & Quantity (Using table structures)
        if tables:
            for table in tables:
                if not table or len(table) < 2:
                    continue
                headers = [str(h).lower() for h in table[0]]
                if "items" in headers and "qty" in headers:
                    item_idx = headers.index("items")
                    qty_idx = headers.index("qty")
                    
                    for row in table[1:]:
                        if len(row) > max(item_idx, qty_idx):
                            desc = str(row[item_idx]).strip()
                            qty_str = str(row[qty_idx]).strip()
                            if desc:
                                try:
                                    qty = int(qty_str) if qty_str else 1
                                except ValueError:
                                    qty = 1
                                result["line_items"].append({"description": desc, "quantity": qty, "sku": ""})

    def _parse_bt_tape_contents(self, text: str, result: Dict):
        """Ruleset 2: Parses unstructured Tape Contents layouts"""
        result["type"] = "branch_transfer"
        result["bt_type"] = "tape_contents"

        # 1. Extract Order Number
        order_match = re.search(r"P/O Response\s+(\d+)", text, re.IGNORECASE)
        if order_match:
            result["order_number"] = order_match.group(1).strip()

        # 2. Extract Origin Store (Listed underneath "Response From:")
        origin_match = re.search(r"Response From:\s*[^\n]+\n\s*([A-Za-z\s]+)", text, re.IGNORECASE)
        if origin_match:
            result["bt_from"] = self._normalize_store(origin_match.group(1).strip())
            result["pickup_store"] = result["bt_from"]

        # 3. Extract Invoice Number (Ultra-Robust dual-priority)
        # First, check if a primary Customer Tax Invoice is attached in the bundle (e.g., "32/2640880")
        customer_inv_match = re.search(r"(?:TAX\s+INVOICE|INVOICE\s+REPRINT)[\s:]*(\d+/\d+)", text, re.IGNORECASE)
        # Next, look for the Tape Contents Supplier Invoice
        supplier_inv_match = re.search(r"Supplier\s+Invoice[\s:]*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
        if customer_inv_match:
            # Prioritize the main customer invoice if the PDF contains multiple merged pages
            result["invoice_number"] = customer_inv_match.group(1).strip()
        elif supplier_inv_match:
            # Fallback to the internal supplier invoice (e.g., 2860269)
            result["invoice_number"] = supplier_inv_match.group(1).strip()

        # 4 & 5. Products and Quantities Loop
        # Split text using case-insensitive 'Accepted'
        segments = re.split(r"(?i)Accepted", text)
        
        for i in range(len(segments) - 1):
            product_chunk = segments[i]
            quantity_chunk = segments[i + 1]
            
            # Product: Grab the last non-empty line BEFORE "Accepted"
            lines_before = [line.strip() for line in product_chunk.split('\n') if line.strip()]
            if lines_before:
                # Avoid picking up header junk if it's the very first loop
                potential_product = lines_before[-1]
                if not "Supplier Invoice" in potential_product and not "Response From" in potential_product: 
                    product_name = potential_product
                else:
                    # Look AFTER "Accepted"
                    lines_after = [line.strip() for line in quantity_chunk.split('\n') if line.strip() and not line.startswith('<!--')]
                    if lines_after:
                        product_name = lines_after[0]
                    else:
                        product_name = "Unknown Product"
            else:
                lines_after = [line.strip() for line in quantity_chunk.split('\n') if line.strip() and not line.startswith('<!--')]
                product_name = lines_after[0] if lines_after else "Unknown Product"
                
            # Quantity: Search for Delivered Qty or RES: AFTER "Accepted"
            qty_match = re.search(r"(?:Delv Qty|Delivered qty|Del qty)[:\s]*(\d+)|(\d+)\s*(?:Delv Qty|Delivered qty|Del qty)|RES:?\s*(\d+)", quantity_chunk, re.IGNORECASE)
            quantity = 0
            if qty_match:
                q_str = qty_match.group(1) or qty_match.group(2) or qty_match.group(3)
                try:
                    quantity = int(q_str)
                except ValueError:
                    pass
            
            # Only append if we found a valid quantity (prevents empty trailing chunks from adding junk)
            if quantity > 0:
                result["line_items"].append({
                    "description": product_name,
                    "quantity": quantity,
                    "sku": ""
                })

    def _extract_store_info(self, text: str, result: Dict):
        header = text[:3000]
        header_lower = header.lower()
        for store_name, data in STORE_REGISTRY.items():
            if store_name.lower() in header_lower:
                if not result["pickup_store"]:
                    result["pickup_store"] = store_name
                break
            for alias in data.get("aliases", []):
                if alias.lower() in header_lower:
                    if not result["pickup_store"]:
                        result["pickup_store"] = store_name
                    break

    def _extract_phone(self, text: str, result: Dict):
        phone_patterns = [
            r"SMS\s+Delivery\s+Updates\s+To\s+(\d[\d\s\-]{6,14})",
            r"(?:Customer\s+)?Phone[:\s]+(\d[\d\s\-]{6,14})",
            r"Customer\s*:\s*(\d[\d\s\-]{6,14})",
            r"(?:Mobile|Ph|Cell|Contact)[:\s]+(\d[\d\s\-]{6,14})",
            r"(\+?64[\s\-]?[2-9]\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d)",
            r"(0[2-9]\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d)",
            r"(02[\s\-]?\d{3}[\s\-]?\d{4})",
            r"(02[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{3})",
        ]
        for pattern in phone_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                phone = match.group(1).strip().replace(" ", "").replace("-", "")
                if len(phone) >= 8 and len(phone) <= 15:
                    result["customer_phone"] = phone
                    break

    def _extract_flags(self, text_lower: str, result: Dict):
        if "assemble" in text_lower and "customer to assemble" not in text_lower:
            result["requires_assembly"] = True
        if any(t in text_lower for t in ["rubbish", "take away", "takeaway", "remove rubbish"]):
            result["has_rubbish_removal"] = True

    def _extract_line_items_from_tables(self, tables, result: Dict):
        if not tables or result["line_items"]:
            return
        for table in tables:
            if not table or len(table) < 2:
                continue
            headers = [h.lower() for h in table[0]]
            header_text = " ".join(headers)
            sku_keywords = ["sku", "code", "item", "product code", "item code", "product"]
            desc_keywords = ["description", "product", "item name", "details", "desc"]
            qty_keywords = ["qty", "quantity", "qnty", "qtr"]
            has_sku = any(k in header_text for k in sku_keywords)
            has_desc = any(k in header_text for k in desc_keywords)
            has_qty = any(k in header_text for k in qty_keywords)
            if has_sku or (has_desc and has_qty):
                sku_idx = next((i for i, h in enumerate(headers) if any(k in h for k in sku_keywords)), -1)
                desc_idx = next((i for i, h in enumerate(headers) if any(k in h for k in desc_keywords)), -1)
                qty_idx = next((i for i, h in enumerate(headers) if any(k in h for k in qty_keywords)), -1)
                for row in table[1:]:
                    if len(row) < 2:
                        continue
                    sku = row[sku_idx] if sku_idx >= 0 and sku_idx < len(row) else ""
                    desc = row[desc_idx] if desc_idx >= 0 and desc_idx < len(row) else ""
                    qty_str = row[qty_idx] if qty_idx >= 0 and qty_idx < len(row) else "1"
                    sku = re.sub(r"^\*?\s*", "", sku).strip()
                    if sku and len(sku) >= 3 and sku.lower() not in ["sku", "code", "item"]:
                        try:
                            qty = int(qty_str) if qty_str and qty_str.strip() else 1
                        except:
                            qty = 1
                        result["line_items"].append({"sku": sku, "quantity": qty, "description": desc})

    def _extract_line_items_from_text(self, text: str, result: Dict):
        lines = text.split("\n")
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Skip common headers and BT Route lines
            if any(x in line.upper() for x in ["TAX INVOICE", "BRANCH TRANSFER", "INVOICE REPRINT", "TRADING AS"]):
                continue
            if re.search(r"BT\s+from\s+.*?\s+to\s+", line, re.IGNORECASE):
                continue

            # Format 3: SKU followed by multiple Prices and then a final Quantity (Order 140375)
            # e.g., DVH9-09W	1699.04 1699.04 254.86 1953.90	1
            match3 = re.match(r"^([A-Z0-9\-_\.]{3,})\s+(?:[\d,.]+\s+){3,}(\d+)\s*$", line)
            if match3:
                sku = match3.group(1).strip()
                qty = int(match3.group(2))
                result["line_items"].append({"sku": sku, "quantity": qty, "description": ""})
                continue

            # Format 1: SKU QTY DESCRIPTION (Standard)
            match1 = re.match(r"^\*?\s*([A-Z0-9\-_\.]{3,})\s+(\d+)\s+(.*)", line)
            if match1:
                sku = match1.group(1).strip()
                qty = int(match1.group(2))
                desc = match1.group(3).strip()
                if len(desc) < 5 and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if not next_line.startswith("$") and not re.match(r"^\d", next_line) and len(next_line) > 3:
                        desc = next_line
                result["line_items"].append({"sku": sku, "quantity": qty, "description": desc})
                continue

            # Format 2: Price/Total Details before Description (Order 124099, 716194)
            # e.g., 268.50 268.50 0.00 268.50 THE INCREDI-BED DBL BASE
            match2 = re.match(r"^(?:[\$\d,.]+\s+){2,}(.*?)(?:\s+Deliver|$|STOCK)", line)
            if match2:
                desc = match2.group(1).strip()
                if desc and len(desc) > 5 and not desc.upper().startswith("GST"):
                    qty = 1
                    qty_match = re.search(r"QTY\s*(\d+)", line, re.IGNORECASE)
                    if qty_match:
                        qty = int(qty_match.group(1))
                    result["line_items"].append({"sku": "", "quantity": qty, "description": desc})
                continue

    def _set_coordinates(self, result: Dict):
        if result["pickup_store"] in STORE_REGISTRY:
            store = STORE_REGISTRY[result["pickup_store"]]
            result["pickup_lat"] = store["lat"]
            result["pickup_lon"] = store["lon"]
        if result["destination_store"] in STORE_REGISTRY:
            store = STORE_REGISTRY[result["destination_store"]]
            result["dest_lat"] = store["lat"]
            result["dest_lon"] = store["lon"]

    def _calculate_billing_and_location(self, result: Dict):
        if result["type"] == "branch_transfer" or result.get("bt_from") or result.get("bt_to"):
            result["billing_party"] = result.get("bt_to") or result.get("destination_store") or result.get("pickup_store") or "Harvey Norman"
            result["location"] = result.get("bt_to") or result.get("destination_store") or result.get("destination_address") or result.get("pickup_store")
        else:
            result["billing_party"] = result.get("customer_name") or result.get("destination_store") or result.get("pickup_store")
            result["location"] = result.get("destination_address") or result.get("destination_store") or result.get("pickup_store")

    def _normalize_store(self, name: str) -> Optional[str]:
        if not name:
            return None
        name_clean = name.strip().lower().replace("  ", " ")
        for store_name, data in STORE_REGISTRY.items():
            if store_name.lower() == name_clean:
                return store_name
            for alias in data.get("aliases", []):
                if alias.lower() == name_clean:
                    return store_name
        for store_name in STORE_REGISTRY.keys():
            if store_name.lower() in name_clean:
                return store_name
        return name.strip().title()

    def _calculate_confidence(self, extracted: Dict) -> float:
        score = 0
        checks = [
            (extracted.get("order_number") or extracted.get("po_number"), 0.20),
            (extracted.get("invoice_number"), 0.15),
            (extracted.get("pickup_store") or extracted.get("bt_from"), 0.15),
            (extracted.get("customer_name") or extracted.get("bt_to"), 0.15),
            (extracted.get("customer_phone"), 0.10),
            (extracted.get("destination_address") or extracted.get("bt_to"), 0.15),
            (len(extracted.get("line_items", [])) > 0, 0.10),
        ]
        for val, weight in checks:
            if val:
                score += weight
        return round(min(score, 1.0), 2)

    def _fallback_parse(self, file_path: str) -> Dict:
        print(f"WARNING: Docling not available. Cannot parse {file_path}")
        return {}


parser = DoclingParser()

@app.post("/parse", response_model=ParseResult)
async def parse_document(file: UploadFile = File(...)):
    """Parse a PDF or image file and return structured order data."""
    ext = os.path.splitext(file.filename)[1].lower()
    valid_exts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif", ".webp", ".docx"]
    if ext not in valid_exts:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    temp_path = None
    try:
        temp_dir = tempfile.gettempdir()
        safe_name = re.sub(r"[^a-zA-Z0-9.\-]", "_", file.filename)
        temp_path = os.path.join(temp_dir, f"docling_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{safe_name}")
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        result = parser.parse_file(temp_path)
        return ParseResult(**result)
    except Exception as e:
        raise HTTPException(500, f"Parse error: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
async def health():
    return {"status": "ok", "docling_available": DOCLING_AVAILABLE}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
