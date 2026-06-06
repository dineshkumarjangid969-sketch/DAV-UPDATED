#!/usr/bin/env python3
"""
Simple OCR fallback using pdf2image + pytesseract.
Usage: python ocr_fallback.py /path/to/file.pdf
Outputs plain text to stdout.
"""
import sys
import os

def main():
    try:
        from pdf2image import convert_from_path
        try:
            import pytesseract
            HAVE_PYTESSERACT = True
        except Exception:
            HAVE_PYTESSERACT = False
        try:
            import easyocr
            HAVE_EASYOCR = True
        except Exception:
            HAVE_EASYOCR = False
    except Exception as e:
        sys.stderr.write(f"Missing python dependencies: {e}\n")
        sys.exit(2)

    if len(sys.argv) < 2:
        sys.stderr.write("Usage: ocr_fallback.py <pdf_path>\n")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        sys.stderr.write("File not found: %s\n" % pdf_path)
        sys.exit(1)

    try:
        pages = convert_from_path(pdf_path, dpi=200)
        texts = []
        for p in pages:
            txt = ''
            if HAVE_PYTESSERACT:
                try:
                    txt = pytesseract.image_to_string(p)
                except Exception:
                    txt = ''
            if (not txt or len(txt.strip()) < 20) and HAVE_EASYOCR:
                try:
                    reader = easyocr.Reader(['en'], gpu=False)
                    import numpy as np
                    arr = np.array(p)
                    res = reader.readtext(arr, detail=0)
                    txt = '\n'.join(res)
                except Exception:
                    pass
            texts.append(txt)
        out = "\n\n".join(texts)
        print(out)
    except Exception as e:
        sys.stderr.write(f"OCR error: {e}\n")
        sys.exit(3)

if __name__ == '__main__':
    main()
