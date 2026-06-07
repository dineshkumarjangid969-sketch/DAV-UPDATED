# DAV Transport - Complete Delivery Management System (CORRECTED)

## What Was Wrong (From Your PDF Report)

Your PDF showed these critical bugs:

1. **Junk emails treated as orders** — "Security alert", "Your Uber One benefits", "Big things are here", "You've received it: NZ", "Before You Submit", "Your payment will be", "You still have NZ$80", "Notice how much you sa", "Updates to Our Privacy", "Remember to get your f", "See you next week", "Widely loved and popul", "Photo from Susheel Sin", "Fares rising? Go", "Unlock a free Sal's Cl" — all personal/marketing emails were being processed as orders.

2. **BT Type wrong** — "Fwd: Branch Transfer" showed as `customer_delivery` instead of `branch_transfer`. "Fwd: BT Collection From Lower Hutt" showed as `customer_delivery` with `Lowerhutt` as billing party.

3. **Random strings in Order #** — `vfHaG1W3-3yW`, `mdotH0W2-yID6`, `uf0Nt1ndc2lUML`, `pG238Y`, `nGMY7bBgd` — these were random IDs generated when no order number was found.

4. **Location showing random text** — `vfHaG1W3-3yW`, `Logo`, `pG238Y`, `on`, `nalised`, `mething` — text from email bodies being put in wrong columns.

5. **Products column empty** — Shows `—` for almost everything even when attachments had product data.

6. **Billing Party wrong** — Shows `No` or random store names instead of actual billing party.

7. **Server slow** — Dashboard was fetching ALL records at once, no pagination.

---

## What Was Fixed

### 1. Email Filtering (CRITICAL FIX)
**Before:** Scanner processed ALL emails in inbox.  
**After:** Scanner now filters emails using keyword detection:
- Must contain at least one order keyword: `order`, `delivery`, `branch transfer`, `bt`, `goods movement`, `invoice`, `collection`, `harvey norman`, `p/o`, `purchase order`, `return to store`, etc.
- Must NOT contain junk keywords: `security alert`, `uber`, `payment`, `promotion`, `photo from`, `widely loved`, `big things`, `see you next week`, etc.
- Emails with 2+ junk keywords are automatically skipped.
- Logs show: `[SKIP] Not an order email: "..."` for skipped emails.

### 2. BT Extraction Fixed
**Before:** "Fwd: BT Collection From Lower Hutt" → BT Type = `customer_delivery`, Billing = `Lowerhutt`  
**After:** New regex patterns handle:
- `BT Collection From [Store]`
- `Branch Transfer From [Store] to [Store]`
- `Goods Movement from [Store] to [Store]`
- `BT from [Store] to [Store]`
- `[Store] to [Store] BT`

Result: BT From = `Lower Hutt`, BT Type = `branch_transfer`, Billing Party = destination store.

### 3. Order ID Generation Fixed
**Before:** Random UUID strings when no order number found.  
**After:** Generates meaningful IDs: `BT_LowerH_20260604_1234` (BT + Store + Date + Time).

### 4. Billing Party Logic Fixed
**Before:** Billing party was often wrong or showed `No`.  
**After:**
- **Branch Transfer:** Billing party = BT To (destination store who receives goods)
- **Customer Delivery:** Billing party = Customer name
- **Location:** Properly set from BT To, destination address, or store

### 5. Server Performance Fixed
**Before:** `GET /api/orders` returned ALL records. PDF export included everything.  
**After:**
- Pagination: `?page=1&limit=50` — only fetches 50 records at a time
- Dashboard shows pagination controls (Prev / Next / Page X of Y)
- PDF/Excel export supports date range filtering (`?date_from=2026-06-01&date_to=2026-06-04`)
- Export limited to 500 records max

### 6. Products Extraction
**Before:** Products showed `—` because Docling table extraction wasn't properly integrated.  
**After:** Docling service extracts tables natively and returns structured `line_items` array with SKU, quantity, and description.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  React UI   │────▶│ Node.js API  │────▶│ Docling AI  │
│  (Port 3000)│     │  (Port 5000) │     │ (Port 8000) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   SQLite DB  │
                    │  (Local file)│
                    └──────────────┘
```

## Features

### Document Parsing (Docling AI)
- Replaces brittle Tesseract OCR + regex with IBM Docling structured document understanding
- Extracts tables, text, and metadata from PDFs and images
- Native table extraction for accurate product line items
- Fuzzy store name matching with aliases

### Email Integration
- Scans 2+ Gmail accounts via IMAP (configurable in Settings)
- **Filters out junk emails automatically** (Uber, security alerts, marketing, etc.)
- Correlates email Subject + Body + Attachments
- Saves email screenshots (.eml) and attachments
- Auto-creates orders from email attachments
- Background scanning every 5 minutes

### Dashboard
- Columns: Order #, Invoice #, Subject, Email Date, Products, BT Type, Billing Party, Picked up, Delivered, Billed, Rate, Location
- **Pagination** — 50 records per page (fixes slow loading)
- Search, filter by status/type
- Click any row for full order detail with email + attachments viewer
- Export to PDF and Excel (with date range filter)

### Route Planner
- Greedy nearest-neighbor TSP optimization
- Assigns truck and driver
- Shows start point and ordered stops
- Manual reorder capability (up/down arrows)
- Send route plan to WhatsApp

### WhatsApp Integration (Twilio)
- Send next-day route plans to driver WhatsApp
- Auto-notify customers on delivery status updates
- Update driver location for addon job assignment
- Group messaging via distribution list

### Driver / Offsider Management
- Add/remove drivers and offsiders for any day
- Roster shift management
- WhatsApp number per driver
- Online status tracking

### Delivery Status
- Toggle Picked up / Delivered / Billed on dashboard
- Auto-sends WhatsApp notification to customer on delivery
- Auto-replies to original email sender with status update

## Setup Instructions

### 1. Docling AI Service (Python)

```bash
cd docling-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Service runs on http://localhost:8000

### 2. Node.js Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Twilio credentials (optional)
npm install
npm start
```

API runs on http://localhost:5000

### 3. React Frontend

```bash
cd frontend
npm install
npm start
```

UI runs on http://localhost:3000

### 4. Gmail IMAP Setup

1. Go to Gmail Settings → Forwarding and POP/IMAP → Enable IMAP
2. Generate an App Password (2FA required): Google Account → Security → App Passwords
3. Add account in DAV Transport Settings page

### 5. Twilio WhatsApp Setup (Optional)

1. Sign up at https://twilio.com
2. Get a WhatsApp-enabled number
3. Add credentials to backend/.env
4. Set WHATSAPP_GROUP_NUMBERS as comma-separated list

## Data Flow (Corrected)

```
Email arrives in Gmail
    ↓
Background scanner (every 5 min) fetches unseen emails
    ↓
FILTER: Skip if not order-related (Uber, security alerts, marketing, etc.)
    ↓
Email subject + body parsed for BT From/To, order refs, dates
    ↓
Attachments saved to uploads/ and sent to Docling service
    ↓
Docling returns structured data (customer, address, products, etc.)
    ↓
Document data + Email context merged intelligently
    ↓
Order created/updated in SQLite with all dashboard fields
    ↓
Dashboard displays paginated results (50 per page)
```

## Security & Secrets Guidance

- **Do not store email account passwords in plaintext in the database.** Prefer using app-specific passwords and environment variables for credentials. Example: store the account `email` and `username` in the `email_accounts` table but keep `password` in the host's `.env` (or a secrets manager) and reference it at runtime.
- The API no longer returns the `password` field from `/api/email-accounts` responses to reduce accidental exposure.
- For production, use a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) or at minimum limit access to the `.env` file and use OS-level protections.
- When configuring Gmail, use App Passwords (2FA) instead of the main account password.

## Key Improvements Over Old System

| Old System | New System |
|------------|------------|
| Tesseract OCR + brittle regex | Docling AI structured parsing |
| No email filtering (junk in dashboard) | **Keyword filtering skips non-order emails** |
| No email context correlation | Subject + Body + Attachment merge |
| Missing BT From/To fields | **Proper branch transfer extraction** |
| Random IDs in Order # | **Meaningful IDs (BT_Store_Date)** |
| Wrong Billing Party | **Correct logic per order type** |
| No automated scanning | Background cron every 5 minutes |
| No WhatsApp integration | Twilio WhatsApp for routes & status |
| No route optimization | Greedy TSP with manual override |
| No export | PDF + Excel export with date filter |
| No email viewer | Clickable .eml + attachment viewer |
| Single email account | Multiple Gmail accounts |
| Slow (all records loaded) | **Pagination (50 per page)** |

## API Endpoints

### Orders (Paginated)
- `GET /api/orders?page=1&limit=50` - List orders with pagination
- `GET /api/orders/:id` - Get order detail with attachments
- `POST /api/orders` - Create manual order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order
- `PATCH /api/orders/:id/status` - Quick status toggle

### Drivers & Trucks
- `GET /api/drivers` - List drivers
- `POST /api/drivers` - Add driver
- `PUT /api/drivers/:id` - Update driver
- `DELETE /api/drivers/:id` - Remove driver
- `GET /api/trucks` - List trucks
- `POST /api/trucks` - Add truck

### Email & Scanning
- `GET /api/email-accounts` - List configured accounts
- `POST /api/email-accounts` - Add Gmail account
- `POST /api/scan` - Trigger scan for all accounts
- `POST /api/scan-account/:id` - Scan specific account
- `POST /api/parse-document` - Upload & parse PDF/image manually

### Dashboard & Export
- `GET /api/dashboard` - Dashboard summary counts
- `GET /api/dashboard/export/pdf?date_from=2026-06-01&date_to=2026-06-04` - Export PDF
- `GET /api/dashboard/export/excel?date_from=2026-06-01&date_to=2026-06-04` - Export Excel

### Route Planner
- `POST /api/route-plan` - Create optimized route
- `GET /api/route-plans` - List saved routes
- `POST /api/route-plans/:id/send-whatsapp` - Send route via WhatsApp
- `PUT /api/route-plans/:id/reorder` - Manual stop reordering

### Utilities
- `GET /api/nearest-driver?store=Albany` - Find nearest online driver
- `GET /api/health` - System health check

## License
MIT
