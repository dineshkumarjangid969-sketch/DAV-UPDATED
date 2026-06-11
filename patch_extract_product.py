import sys
import re

def main():
    with open('docling-service/app.py', 'r') as f:
        content = f.read()

    new_extract_logic = r"""SKU_RE = re.compile(r"^[A-Z0-9\-\_]{3,}$", re.I)   # strong SKU token pattern
PRICE_RE = re.compile(r"\$?\s*([\d{1,3}(?:,\d{3})*]+\.\d{2})")
QTY_PATTERNS = [
    re.compile(r"\bQTY[:\s]*([0-9]+)\b", re.I),
    re.compile(r"\bQty[:\s]*([0-9]+)\b", re.I),
    re.compile(r"\bx\s*([0-9]+)\b", re.I),
    re.compile(r"\bX\s*([0-9]+)\b", re.I),
    re.compile(r"(\d+)\s*$")  # trailing number fallback
]

def _clean_ocr_line(s: str) -> str:
    # common OCR fixes: replace similar chars, remove weird control chars
    s = s.replace('\u2013', '-').replace('\u2014', '-')
    s = s.replace('—', '-').replace('–', '-')
    s = re.sub(r'[^\x20-\x7E\n]', '', s)  # remove non-ascii noise
    s = re.sub(r'\s{2,}', ' ', s).strip()
    return s

def _extract_qty_from_text(block: str) -> Tuple[int,int]:
    \"\"\"Return (qty, confidence)\"\"\"
    for p in QTY_PATTERNS:
        m = p.search(block)
        if m:
            try:
                return int(m.group(1)), 95
            except:
                continue
    return 1, 20  # default qty 1 with low confidence

def _extract_price_from_text(block: str) -> Tuple[float,int]:
    m = PRICE_RE.search(block)
    if m:
        try:
            val = float(m.group(1).replace(',', ''))
            return val, 90
        except:
            return None, 30
    return None, 0

def _is_likely_sku(token: str) -> bool:
    token = token.strip().upper()
    # allow leading * or #
    token = token.lstrip('*#')
    return bool(SKU_RE.match(token))

def _split_columns_by_whitespace(line: str) -> List[str]:
    # heuristic: split by 2+ spaces which often separate columns in OCR text
    parts = re.split(r'\s{2,}', line)
    return [p.strip() for p in parts if p.strip()]

def _try_table_parse(lines: List[str]) -> Tuple[List[Dict[str,Any]], int]:
    \"\"\"
    Attempt to parse a table when header row exists.
    Returns (lines, confidence)
    \"\"\"
    # find header index
    header_idx = None
    for i, ln in enumerate(lines):
        if re.search(r"\b(Product Code|Product|Items|Description)\b", ln, re.I) and re.search(r"\b(QTY|Qty|Quantity)\b", ln, re.I):
            header_idx = i
            break
    parsed = []
    if header_idx is None:
        return [], 0
    # parse rows below header until blank or footer
    for row in lines[header_idx+1:header_idx+200]:
        if not row.strip():
            break
        cols = _split_columns_by_whitespace(row)
        # common patterns:
        # [SKU, Description, Qty, Price]
        sku, desc, qty, price = "", "", None, None
        if len(cols) >= 3:
            # try to detect SKU in first column
            if _is_likely_sku(cols[0]):
                sku = cols[0]
                desc = " ".join(cols[1:-2]) if len(cols) > 3 else cols[1]
                # qty may be last or second last
                last = cols[-1]
                second_last = cols[-2] if len(cols) >= 3 else ""
                # detect qty
                q = None
                for candidate in (last, second_last):
                    m = re.search(r'\b(\d+)\b', candidate)
                    if m:
                        q = int(m.group(1)); break
                qty = q or 1
                # price detection
                price_val, price_conf = _extract_price_from_text(row)
                parsed.append({"sku": sku, "description": desc.strip(), "quantity": qty, "unit_price": price_val, "line_confidence": 90})
            else:
                # fallback: maybe no SKU column, description first
                desc = " ".join(cols[:-1])
                qty_match = re.search(r'\b(\d+)\b', cols[-1])
                qty = int(qty_match.group(1)) if qty_match else 1
                price_val, price_conf = _extract_price_from_text(row)
                parsed.append({"sku": "", "description": desc.strip(), "quantity": qty, "unit_price": price_val, "line_confidence": 70})
        else:
            # short row fallback
            m = re.search(r"(\*?\s*[A-Z0-9\-\_]{3,})\s+(.+?)\s+x(\d+)", row, re.I)
            if m:
                parsed.append({"sku": m.group(1).strip(), "description": m.group(2).strip(), "quantity": int(m.group(3)), "unit_price": None, "line_confidence": 85})
            else:
                # try price+desc
                price_val, price_conf = _extract_price_from_text(row)
                if price_val:
                    desc = re.sub(r'\$[\d,]+\.\d{2}', '', row).strip()
                    parsed.append({"sku": "", "description": desc, "quantity": 1, "unit_price": price_val, "line_confidence": 65})
    return parsed, 90 if parsed else 0

def _extract_product_lines(text: str) -> Tuple[List[Dict[str,Any]], int]:
    \"\"\"
    Robust multi-heuristic product extraction.
    Returns (list_of_lines, overall_confidence)
    \"\"\"
    # Pre-clean OCR noise
    raw_lines = [ _clean_ocr_line(ln) for ln in text.splitlines() if ln.strip() ]
    # 1) Try table parse
    parsed, conf = _try_table_parse(raw_lines)
    if parsed:
        return parsed, conf

    # 2) SKU + xN inline pattern across whole doc
    parsed = []
    for ln in raw_lines:
        # pattern: SKU  DESCRIPTION  xN
        m = re.search(r"(\*?\s*[A-Z0-9\-\_]{3,})\s+(.+?)\s+x\s*(\d+)\b", ln, re.I)
        if m:
            sku = m.group(1).strip()
            desc = m.group(2).strip()
            qty = int(m.group(3))
            parsed.append({"sku": sku, "description": desc, "quantity": qty, "unit_price": None, "line_confidence": 88})
    if parsed:
        return parsed, 85

    # 3) Price + description grouping: find lines with $ and group with previous line if needed
    parsed = []
    for i, ln in enumerate(raw_lines):
        if PRICE_RE.search(ln):
            price_val, price_conf = _extract_price_from_text(ln)
            # description may be previous line if previous line is not price
            desc = raw_lines[i-1] if i-1 >= 0 and not PRICE_RE.search(raw_lines[i-1]) else ln
            qty, qty_conf = _extract_qty_from_text(ln + " " + desc)
            parsed.append({"sku": "", "description": desc.strip(), "quantity": qty, "unit_price": price_val, "line_confidence": 70 + (price_conf//3)})
    if parsed:
        return parsed, 70

    # 4) Fallback: look for lines that end with a number (likely qty) or contain 'Qty'
    parsed = []
    for ln in raw_lines:
        qty, qty_conf = _extract_qty_from_text(ln)
        # avoid capturing lines that are addresses or dates by simple heuristics
        if qty_conf > 20 and len(ln) > 6 and not re.search(r'\b(Phone|Date|Invoice|GST|Order|Address)\b', ln, re.I):
            # try to extract sku token at start
            tokens = ln.split()
            sku_candidate = tokens[0] if tokens else ""
            sku = sku_candidate if _is_likely_sku(sku_candidate) else ""
            desc = ln
            parsed.append({"sku": sku, "description": desc.strip(), "quantity": qty, "unit_price": None, "line_confidence": 50 + qty_conf//2})
    if parsed:
        return parsed, 50

    # 5) Nothing found
    return [], 10
"""
    
    # We need to replace the old _extract_product_lines
    # Find start and end of the old function
    old_def_start = content.find("def _extract_product_lines(text: str) -> Tuple[List[Dict[str, Any]], int]:")
    if old_def_start == -1:
        print("Could not find old _extract_product_lines")
        return
        
    old_def_end = content.find("def _aggregate_confidence", old_def_start)
    if old_def_end == -1:
        print("Could not find end of old _extract_product_lines")
        return

    content = content[:old_def_start] + new_extract_logic + content[old_def_end:]
    
    with open('docling-service/app.py', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
