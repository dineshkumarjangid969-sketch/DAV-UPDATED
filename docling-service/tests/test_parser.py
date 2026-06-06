import pytest
from app import DoclingParser

parser = DoclingParser()

def test_extract_order_number_from_tax_invoice():
    text = """
    TAX INVOICE\n
    Invoice No: 12345\n
    Customer: John Doe\n
    Delivery Address: 123 Example St\n
    Order Ref: HN-98765\n
    """
    res = parser.extract_order_data(text, [])
    assert res["invoice_number"] == "12345" or res["order_number"] == "HN-98765"


def test_detect_purchase_order_and_po_number():
    text = """
    PURCHASE ORDER PO123456\n
    Supplier Invoice: 998877\n
    Please Deliver To: 55 Test Ave\n    """
    res = parser.extract_order_data(text, [])
    assert res["document_type"] == "purchase_order"
    assert res["po_number"] == "PO123456"


def test_branch_transfer_bt_from_to():
    text = """
    Branch Transfer from Albany to Hastings\n
    Order Ref: BT-2026-01\n
    """
    res = parser.extract_order_data(text, [])
    assert res["type"] == "branch_transfer"
    assert res["bt_type"] == "branch_transfer"
    assert res["bt_from"] == "Albany"
    assert res["bt_to"] == "Hastings"


def test_branch_transfer_bt_1_from_to():
    text = """
    BT 1 from Albany to Hastings\n
    Order Ref: BT-2026-02\n
    """
    res = parser.extract_order_data(text, [])
    assert res["type"] == "branch_transfer"
    assert res["bt_type"] == "branch_transfer"
    assert res["bt_from"] == "Albany"
    assert res["bt_to"] == "Hastings"


def test_line_item_extraction_from_text():
    text = """
    * ABC123 2 Wooden Table\n
    DEF456 1 Chair\n
    """
    res = parser.extract_order_data(text, [])
    assert len(res.get("line_items", [])) >= 1