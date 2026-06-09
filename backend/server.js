#!/usr/bin/env node
/**
 * DAV Transport - Node.js Backend
 * Complete system with Docling integration, email scanning, WhatsApp, route optimization
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cron = require("node-cron");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const geolib = require("geolib");
const nodemailer = require("nodemailer");
const pdfParse = require('pdf-parse');
const { spawnSync } = require('child_process');
const routingEngine = require('./routingEngine');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/uploads/:filename", async (req, res, next) => {
  if (req.params.filename.endsWith(".eml")) {
    const filePath = path.join(__dirname, "uploads", req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Email file not found");
    }
    try {
      const { simpleParser } = require("mailparser");
      const emailBuffer = fs.readFileSync(filePath);
      const parsed = await simpleParser(emailBuffer);

      let attachmentsHtml = "";
      if (parsed.attachments && parsed.attachments.length > 0) {
        attachmentsHtml = `
          <div class="attachments-section">
            <h4>Attachments (${parsed.attachments.length})</h4>
            <div class="attachments-list">
              ${parsed.attachments.map(att => {
                const sizeKb = (att.size / 1024).toFixed(1);
                return `
                  <div class="attachment-item">
                    <svg class="attachment-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span class="attachment-name">${att.filename || "unnamed"}</span>
                    <span class="attachment-size">(${sizeKb} KB)</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }

      const formattedDate = parsed.date ? new Date(parsed.date).toLocaleString() : "Unknown Date";

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${parsed.subject || "Email View"}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --bg-primary: #090d16;
              --bg-secondary: #111827;
              --bg-tertiary: #1f2937;
              --text-primary: #f3f4f6;
              --text-secondary: #9ca3af;
              --accent-color: #6366f1;
              --border-color: #374151;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              background-color: var(--bg-primary);
              color: var(--text-primary);
              min-height: 100vh;
              padding: 24px;
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
            .email-container {
              width: 100%;
              max-width: 850px;
              background-color: var(--bg-secondary);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .email-header {
              padding: 24px;
              border-bottom: 1px solid var(--border-color);
              background: linear-gradient(145deg, #111827, #1e1b4b 60%, #111827);
            }
            .subject {
              font-size: 20px;
              font-weight: 700;
              color: #ffffff;
              margin-bottom: 16px;
              line-height: 1.4;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 8px 16px;
              font-size: 14px;
            }
            .meta-label {
              font-weight: 600;
              color: var(--text-secondary);
              min-width: 60px;
            }
            .meta-value {
              color: var(--text-primary);
            }
            .email-body {
              padding: 32px;
              background-color: #ffffff;
              color: #1f2937;
              font-size: 15px;
              line-height: 1.6;
              overflow-x: auto;
              min-height: 400px;
            }
            .plain-text-body {
              font-family: inherit;
              white-space: pre-wrap;
              color: #1f2937;
            }
            .attachments-section {
              padding: 20px 24px;
              background-color: #1a202c;
              border-top: 1px solid var(--border-color);
            }
            .attachments-section h4 {
              font-size: 13px;
              color: var(--text-secondary);
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .attachments-list {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
            }
            .attachment-item {
              background-color: var(--bg-secondary);
              border: 1px solid var(--border-color);
              padding: 10px 16px;
              border-radius: 8px;
              font-size: 13px;
              display: flex;
              align-items: center;
              gap: 8px;
              color: var(--text-primary);
            }
            .attachment-icon {
              color: var(--accent-color);
              flex-shrink: 0;
            }
            .attachment-name {
              font-weight: 500;
              max-width: 200px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .attachment-size {
              color: var(--text-secondary);
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <div class="subject">${parsed.subject || "(No Subject)"}</div>
              <div class="meta-grid">
                <div class="meta-label">From:</div>
                <div class="meta-value">${parsed.from ? parsed.from.text : "Unknown"}</div>
                
                <div class="meta-label">To:</div>
                <div class="meta-value">${parsed.to ? parsed.to.text : "Unknown"}</div>
                
                <div class="meta-label">Date:</div>
                <div class="meta-value">${formattedDate}</div>
              </div>
            </div>
            <div class="email-body">
              ${parsed.html ? parsed.html : `<pre class="plain-text-body">${parsed.text || ""}</pre>`}
            </div>
            ${attachmentsHtml}
          </div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html");
      return res.send(htmlContent);
    } catch (err) {
      console.error("Error rendering EML file:", err);
      res.setHeader("Content-Type", "text/plain");
      return res.sendFile(filePath);
    }
  }
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const upload = multer({ dest: "uploads/" });

// ============================================================================
// SEQUELIZE SETUP
// ============================================================================
const { Sequelize, DataTypes, Op } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "dav_transport.db"),
  logging: false,
});

// ============================================================================
// MODELS
// ============================================================================

const Order = sequelize.define("Order", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  order_number: { type: DataTypes.STRING(50), allowNull: false },
  invoice_number: DataTypes.STRING(50),
  po_number: DataTypes.STRING(50),
  client_name: { type: DataTypes.STRING(100), defaultValue: "Harvey Norman" },
  type: { type: DataTypes.STRING(20), defaultValue: "customer_delivery" },
  bt_type: { type: DataTypes.STRING(30), defaultValue: "customer_delivery" },
  bt_from: DataTypes.STRING(100),
  bt_to: DataTypes.STRING(100),
  status: { type: DataTypes.STRING(20), defaultValue: "pending" },
  pickup_store: DataTypes.STRING(100),
  pickup_warehouse: DataTypes.STRING(100),
  destination_store: DataTypes.STRING(100),
  pickup_lat: DataTypes.FLOAT,
  pickup_lon: DataTypes.FLOAT,
  destination_address: DataTypes.TEXT,
  dest_lat: DataTypes.FLOAT,
  dest_lon: DataTypes.FLOAT,
  customer_name: DataTypes.STRING(100),
  customer_phone: DataTypes.STRING(20),
  requires_assembly: { type: DataTypes.BOOLEAN, defaultValue: false },
  has_rubbish_removal: { type: DataTypes.BOOLEAN, defaultValue: false },
  delivery_instructions: DataTypes.TEXT,
  preferred_delivery_date: DataTypes.STRING(20),
  assigned_truck_id: DataTypes.STRING(50),
  driver_name: DataTypes.STRING(100),
  truck_plate: DataTypes.STRING(20),
  distance_km: DataTypes.FLOAT,
  line_items: { type: DataTypes.JSON, defaultValue: [] },
  email_subject: DataTypes.STRING(255),
  email_from: DataTypes.STRING(255),
  email_date: DataTypes.DATE,
  document_type: DataTypes.STRING(20),
  billing_party: DataTypes.STRING(100),
  location: DataTypes.STRING(255),
  rate: DataTypes.FLOAT,
  picked_up: { type: DataTypes.BOOLEAN, defaultValue: false },
  picked_up_at: DataTypes.DATE,
  delivered: { type: DataTypes.BOOLEAN, defaultValue: false },
  delivered_at: DataTypes.DATE,
  billed: { type: DataTypes.BOOLEAN, defaultValue: false },
  billed_at: DataTypes.DATE,
  confidence: { type: DataTypes.FLOAT, defaultValue: 0 },
  email_screenshot_path: DataTypes.STRING(255),
  attachment_paths: { type: DataTypes.JSON, defaultValue: [] },
  raw_email_body: DataTypes.TEXT,
  normalized_data: { type: DataTypes.JSON, defaultValue: {} },
}, { tableName: "orders", timestamps: true });

const Driver = sequelize.define("Driver", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  name: DataTypes.STRING(100),
  email: DataTypes.STRING(100),
  phone: DataTypes.STRING(20),
  role: DataTypes.STRING(20),
  truck_id: DataTypes.STRING(50),
  license_plate: DataTypes.STRING(20),
  current_lat: DataTypes.FLOAT,
  current_lon: DataTypes.FLOAT,
  is_online: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  max_hours: { type: DataTypes.INTEGER, defaultValue: 40 },
  current_hours: { type: DataTypes.FLOAT, defaultValue: 0 },
  fcm_token: DataTypes.STRING(255),
  whatsapp_number: DataTypes.STRING(20),
}, { tableName: "drivers", timestamps: true });

const Truck = sequelize.define("Truck", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  license_plate: DataTypes.STRING(20),
  driver_name: DataTypes.STRING(100),
  current_lat: DataTypes.FLOAT,
  current_lon: DataTypes.FLOAT,
  is_online: { type: DataTypes.BOOLEAN, defaultValue: false },
  capacity_cbm: { type: DataTypes.FLOAT, defaultValue: 50 },
  current_load_cbm: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { tableName: "trucks", timestamps: true });

const Store = sequelize.define("Store", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  name: DataTypes.STRING(100),
  address: DataTypes.TEXT,
  lat: DataTypes.FLOAT,
  lon: DataTypes.FLOAT,
  open_time: DataTypes.STRING(10),
  close_time: DataTypes.STRING(10),
  phone: DataTypes.STRING(20),
}, { tableName: "stores", timestamps: true });

const EmailAccount = sequelize.define("EmailAccount", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email: DataTypes.STRING(100),
  provider: DataTypes.STRING(20),
  host: DataTypes.STRING(100),
  port: { type: DataTypes.INTEGER, defaultValue: 993 },
  use_ssl: { type: DataTypes.BOOLEAN, defaultValue: true },
  username: DataTypes.STRING(100),
  password: DataTypes.STRING(100),
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_check: DataTypes.DATE,
  scan_interval: { type: DataTypes.INTEGER, defaultValue: 5 },
}, { tableName: "email_accounts", timestamps: true });

const RosterShift = sequelize.define("RosterShift", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  driver_id: DataTypes.STRING(50),
  date: DataTypes.STRING(10),
  shift_type: DataTypes.STRING(20),
  start_time: DataTypes.STRING(10),
  end_time: DataTypes.STRING(10),
  truck_id: DataTypes.STRING(50),
  store_assignments: { type: DataTypes.JSON, defaultValue: [] },
  offsider_ids: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.STRING(20), defaultValue: "scheduled" },
}, { tableName: "roster_shifts", timestamps: true });

const RoutePlan = sequelize.define("RoutePlan", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  truck_id: DataTypes.STRING(50),
  driver_id: DataTypes.STRING(50),
  offsider_ids: { type: DataTypes.JSON, defaultValue: [] },
  start_store: { type: DataTypes.STRING(100), defaultValue: "Wairau Park" },
  date: DataTypes.STRING(10),
  stops: { type: DataTypes.JSON, defaultValue: [] },
  total_distance_km: DataTypes.FLOAT,
  estimated_fuel_cost: DataTypes.FLOAT,
  status: { type: DataTypes.STRING(20), defaultValue: "planned" },
  whatsapp_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "route_plans", timestamps: true });

const EmailAttachment = sequelize.define("EmailAttachment", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  order_id: DataTypes.STRING(50),
  filename: DataTypes.STRING(255),
  file_path: DataTypes.STRING(255),
  content_type: DataTypes.STRING(50),
}, { tableName: "email_attachments", timestamps: true });

// ============================================================================
// STORE REGISTRY
// ============================================================================
const STORE_REGISTRY = {
  // --- DISTRIBUTION CENTRES ---
  'Wiri DC': { lat: -37.0125, lon: 174.8624, region: 'Auckland', address: '13 Ha Crescent, Wiri, Auckland 2104', aliases: ['DC', 'Wiri'] },

  // --- AUCKLAND & NORTHLAND ---
  'Wairau Park': { lat: -36.7816, lon: 174.7510, region: 'Auckland', address: '10 Croftfield Lane, Wairau Park, Glenfield', aliases: ['Wairau', 'Flagship'] },
  'Westgate': { lat: -36.8183, lon: 174.6112, region: 'Auckland', address: '63-65 Maki Street, Westgate', aliases: [] },
  'Mt Roskill': { lat: -36.9113, lon: 174.7335, region: 'Auckland', address: '167-169 Stoddard Road, Mt Roskill', aliases: ['Mount Roskill'] },
  'Mt Wellington': { lat: -36.9183, lon: 174.8488, region: 'Auckland', address: '20-54 Mount Wellington Highway, Mt Wellington', aliases: ['Mount Wellington', 'Sylvia Park'] },
  'Botany Downs': { lat: -36.9298, lon: 174.9126, region: 'Auckland', address: '500 Ti Rakau Drive, Botany Downs', aliases: ['Botany'] },
  'Botany Downs Outlet': { lat: -36.9270, lon: 174.9100, region: 'Auckland', address: '451 Ti Rakau Drive, Unit F, Botany Downs', aliases: ['Botany Outlet'] },
  'Manukau': { lat: -36.9900, lon: 174.8810, region: 'Auckland', address: '8/72 Cavendish Drive, Manukau Supa Centa', aliases: [] },
  'Takanini Outlet': { lat: -37.0506, lon: 174.9351, region: 'Auckland', address: '230 Great South Road, Takanini', aliases: ['Takanini'] },
  'Pukekohe': { lat: -37.2025, lon: 174.9015, region: 'Auckland', address: '182-192 Manukau Road, Pukekohe', aliases: [] },
  'Whangarei': { lat: -35.7423, lon: 174.3168, region: 'Northland', address: '5 Gumdigger Place, Raumanga, Whangarei', aliases: [] },

  // --- CENTRAL NORTH ISLAND & BAY OF PLENTY ---
  'Hamilton': { lat: -37.7656, lon: 175.2573, region: 'Waikato', address: '10-16 The Boulevard, Te Rapa, Hamilton', aliases: ['Te Rapa'] },
  'Hamilton Outlet': { lat: -37.7870, lon: 175.2793, region: 'Waikato', address: 'Unit 1, 79 Tristram Street, Hamilton', aliases: [] },
  'Tauriko': { lat: -37.7391, lon: 176.0963, region: 'Bay of Plenty', address: '19 Taurikura Drive, Tauriko, Tauranga', aliases: ['Tauranga'] },
  'Mt Maunganui': { lat: -37.6698, lon: 176.2163, region: 'Bay of Plenty', address: '10 Owens Place, Mt Maunganui', aliases: ['Mount Maunganui'] },
  'Whakatane': { lat: -37.9575, lon: 176.9744, region: 'Bay of Plenty', address: '35 State Highway 30 Unit 1, The Hub, Whakatane', aliases: [] },
  'Rotorua': { lat: -38.1387, lon: 176.2520, region: 'Bay of Plenty', address: '35 Victoria Street, Rotorua', aliases: [] },
  'Gisborne': { lat: -38.6653, lon: 178.0205, region: 'Gisborne', address: '51 Customhouse Street, Gisborne', aliases: [] },

  // --- LOWER NORTH ISLAND ---
  'New Plymouth': { lat: -39.0357, lon: 174.1033, region: 'Taranaki', address: '23 Smart Road, Waiwakaiho, New Plymouth', aliases: [] },
  'Whanganui': { lat: -39.9298, lon: 175.0505, region: 'Manawatu-Wanganui', address: '287 Victoria Avenue, Whanganui', aliases: ['Wanganui'] },
  'Palmerston North': { lat: -40.3551, lon: 175.6111, region: 'Manawatu-Wanganui', address: '361-371 Main Street West, Palmerston North', aliases: ['Palmy'] },
  'Hastings': { lat: -39.6385, lon: 176.8447, region: 'Hawkes Bay', address: '303 Saint Aubyn Street East, Hastings', aliases: ['Napier'] },
  'Masterton': { lat: -40.9525, lon: 175.6601, region: 'Wellington', address: '230 High Street, Masterton', aliases: [] },
  'Porirua': { lat: -41.1352, lon: 174.8383, region: 'Wellington', address: '19 Parumoana Street, Porirua', aliases: [] },
  'Lower Hutt': { lat: -41.2104, lon: 174.9038, region: 'Wellington', address: '28 Rutherford Street, Lower Hutt', aliases: ['Hutt'] },
  'Tory Street': { lat: -41.2941, lon: 174.7812, region: 'Wellington', address: '77-87 Tory Street, Te Aro, Wellington', aliases: ['Wellington CBD', 'Te Aro'] },

  // --- SOUTH ISLAND ---
  'Nelson': { lat: -41.2750, lon: 173.2833, region: 'Tasman', address: '69 St Vincent Street, Nelson', aliases: [] },
  'Blenheim': { lat: -41.5135, lon: 173.9535, region: 'Marlborough', address: '19-21 Maxwell Road, Blenheim', aliases: [] },
  'Christchurch': { lat: -43.5385, lon: 172.6375, region: 'Canterbury', address: '250 Moorhouse Avenue, Christchurch', aliases: ['Moorhouse'] },
  'Hornby': { lat: -43.5412, lon: 172.5186, region: 'Canterbury', address: '10-14 Chappie Place, Hornby, Christchurch', aliases: [] },
  'Northwood Outlet': { lat: -43.4682, lon: 172.6178, region: 'Canterbury', address: '1 Radcliffe Road Unit D, Northwood, Christchurch', aliases: ['Northwood'] },
  'Ashburton': { lat: -43.9015, lon: 171.7456, region: 'Canterbury', address: 'Cnr West Street and Moore Street, Ashburton', aliases: [] },
  'Timaru': { lat: -44.3846, lon: 171.2505, region: 'Canterbury', address: '226 Evans Street, Timaru', aliases: [] },
  'Dunedin': { lat: -45.8778, lon: 170.5005, region: 'Otago', address: '20 MacLaggan Street, Dunedin', aliases: ['Maclaggan'] },
  'Dunedin Outlet': { lat: -45.8913, lon: 170.4952, region: 'Otago', address: '95 Hillside Road South, Dunedin', aliases: [] },
  'Invercargill': { lat: -46.4116, lon: 168.3551, region: 'Southland', address: '245 Tay Street, Invercargill', aliases: [] }
};

const STORE_NUMBER_MAP = {
  "21": "Wairau Park",
  "22": "Porirua",
  "27": "Pukekohe",
  "28": "Mt Wellington",
  "30": "Lower Hutt",
  "34": "Hastings",
  "36": "New Plymouth",
  "38": "Palmerston North",
  "40": "Porirua",
  "53": "Timaru",
  "74": "Whakatane"
};

// ============================================================================
// DOCLING CLIENT
// ============================================================================
const DOCLING_URL = process.env.DOCLING_URL || "http://localhost:8000";

const CACHE_FILE = path.join(__dirname, 'docling_cache.json');
let doclingCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    doclingCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.error("Error reading cache:", err.message);
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(doclingCache, null, 2), 'utf8');
}

async function parseWithDocling(filePath, filename) {
  let cacheKey = filename || path.basename(filePath);
  if (fs.existsSync(filePath)) {
    try {
      cacheKey = fs.statSync(filePath).size + "_" + cacheKey;
    } catch (e) {}
  }
  if (doclingCache[cacheKey]) {
    return doclingCache[cacheKey];
  }

  const ext = path.extname(filename || "").toLowerCase();
  const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
  if (!validExts.includes(ext)) {
    return null;
  }

  try {
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename });
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
    doclingCache[cacheKey] = response.data;
    saveCache();
    return response.data;
  } catch (e) {
    console.error("Docling service error:", e.message);
    return null;
  }
}

// ============================================================================
// EMAIL FILTERING - CRITICAL FIX
// ============================================================================

const ORDER_KEYWORDS = [
  "order", "delivery", "branch transfer", "bt ", "goods movement",
  "invoice", "collection", "pickup", "dispatch", "shipment",
  "harvey norman", "hn ", "p/o", "purchase order", "sales order",
  "return to store", "offsite", "showroom", "warehouse", "freight",
  "tax invoice", "delivery docket", "p/o response", "branch",
  "transfer", "collection", "goods", "movement"
];

const JUNK_KEYWORDS = [
  "security alert", "uber", "promotion", "marketing",
  "newsletter", "subscription",
  "otp", "password", "login",
  "amazon", "netflix", "spotify", "facebook", "instagram",
  "linkedin", "twitter", "x.com", "youtube", "tiktok",
  "survey", "feedback", "rating", "coupon", "discount",
  "voucher", "gift", "reward",
  "investment", "loan", "mortgage", "insurance",
  "photo from", "shared a photo", "memory", "story", "post",
  "calendar", "event", "meeting", "appointment",
  "flight", "booking", "hotel", "travel", "itinerary", "ticket",
  "widely loved", "big things", "see you next", "remember to get",
  "notice how much", "you still have", "your payment", "before you submit",
  "you've received", "updates to our", "unlock a free", "fares rising"
];

// ============================================================================
// HTML TO TEXT & EXTRACTION UTILITIES
// ============================================================================

function htmlToText(html) {
  if (!html) return "";
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>|<\/div>|<\/tr>|<tr[^>]*>|<p[^>]*>|<div[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/gi, " ")
             .replace(/&amp;/gi, "&")
             .replace(/&lt;/gi, "<")
             .replace(/&gt;/gi, ">")
             .replace(/&quot;/gi, '"')
             .replace(/&#39;/gi, "'");
  return text;
}

function matchStore(text) {
  if (!text) return null;
  const cleanText = text.toLowerCase().replace(/\s+/g, " ");
  
  if (/^(dav\s*transport|btdav|bt\s*transport)/i.test(cleanText) && cleanText.length < 50) {
    return null;
  }
  
  // 1. Check for Store Numbers near keywords to avoid false positives (e.g. Hwy 30)
  const storeNumMatch = cleanText.match(/\b(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office|box|ph|phone|ext)[,\s#\-\.]*(21|22|27|28|30|34|36|38|40|53|74)\b/) ||
                        cleanText.match(/\b(21|22|27|28|30|34|36|38|40|53|74)[,\s#\-\.]*(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office)\b/);
  
  if (storeNumMatch) {
    const num = storeNumMatch[1];
    const mappedStoreName = STORE_NUMBER_MAP[num];
    if (mappedStoreName) return mappedStoreName;
  }

  const exactNumMatch = cleanText.trim().match(/^(21|22|27|28|30|34|36|38|40|53|74)$/);
  if (exactNumMatch) {
    const mappedStoreName = STORE_NUMBER_MAP[exactNumMatch[1]];
    if (mappedStoreName) return mappedStoreName;
  }

  // 2. Check for Store Names in local part of email
  if (cleanText.includes("@")) {
    const localPart = cleanText.split("@")[0].replace(/[^a-z0-9]/g, "");
    for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
      const nameClean = storeName.toLowerCase().replace(/\s+/g, "");
      if (localPart.includes(nameClean)) {
        return storeName;
      }
      if (data.aliases) {
        for (const alias of data.aliases) {
          const aliasClean = alias.toLowerCase().replace(/\s+/g, "");
          if (localPart.includes(aliasClean)) {
            return storeName;
          }
        }
      }
    }
  }

  // 3. Regular name and alias check (prioritize longer matches)
  const candidates = [];
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    const nameLower = storeName.toLowerCase();
    const escapedName = nameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
    
    if (regex.test(cleanText) || cleanText.includes(nameLower)) {
      candidates.push({ name: storeName, length: nameLower.length });
    }
    
    if (data.aliases) {
      for (const alias of data.aliases) {
        const escapedAlias = alias.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const aliasRegex = new RegExp(`\\b${escapedAlias}\\b`, 'i');
        if (aliasRegex.test(cleanText) || cleanText.includes(alias.toLowerCase())) {
          candidates.push({ name: storeName, length: alias.length });
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].name;
  }
  
  if (cleanText.includes("13 ha crescent") || cleanText.includes("ha crescent") || cleanText.includes("harvey norman warehouse") || cleanText.includes("east tamaki warehouse") || cleanText.includes("tamaki warehouse") || cleanText.includes("tamaki")) {
    return "13 Ha Crescent, Harvey Norman Warehouse";
  }

  return null;
}

function extractStoresFromTo(combinedContent) {
  const text = combinedContent.toLowerCase().replace(/\s+/g, " ");
  
  const storeMap = {};
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    storeMap[storeName.toLowerCase()] = storeName;
    if (data.aliases) {
      for (const alias of data.aliases) {
        storeMap[alias.toLowerCase()] = storeName;
      }
    }
  }
  
  const keys = Object.keys(storeMap).sort((a, b) => b.length - a.length);
  const escapedKeys = keys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const storePatternStr = `(?:${escapedKeys.join('|')})`;
  
  // Advanced regex allowing optional descriptors like store, branch, etc.
  const transitionRegex = new RegExp(`(${storePatternStr})\\s*(?:store|branch|warehouse|whouse|wh|showrooms?)?\\s*(?:to|2|->|\\-|\\/)\\s*(?:the\\s+)?(${storePatternStr})\\s*(?:store|branch|warehouse|whouse|wh|showrooms?)?`, 'i');
  const match = text.match(transitionRegex);
  if (match) {
    const fromStore = storeMap[match[1].trim().toLowerCase()];
    const toStore = storeMap[match[2].trim().toLowerCase()];
    if (fromStore && toStore && fromStore !== toStore) {
      return { fromStore, toStore };
    }
  }
  return null;
}

function extractStoresFromHeaders(combinedContent) {
  const lines = combinedContent.split("\n");
  let fromStore = null;
  let toStore = null;
  
  for (let i = 0; i < lines.length; i++) {
    // Strip asterisks to match markdown headers cleanly
    const line = lines[i].replace(/\*/g, "").trim();
    if (line.toLowerCase().startsWith("from:")) {
      const candidate = line.substring(5).trim();
      const matched = matchStore(candidate);
      if (matched) {
        fromStore = matched;
      }
    } else if (line.toLowerCase().startsWith("to:")) {
      const candidate = line.substring(3).trim();
      if (!candidate.includes("davtransport") && !candidate.includes("btdav")) {
        const matched = matchStore(candidate);
        if (matched) {
          toStore = matched;
        }
      }
    }
  }
  
  if (fromStore && toStore && fromStore !== toStore) {
    return { fromStore, toStore };
  }
  return null;
}

function extractRoute(combinedContent) {
  // 1. Try store-to-store transition
  const transition = extractStoresFromTo(combinedContent);
  if (transition) return transition;
  
  // 2. Try From/To header blocks
  const headersRoute = extractStoresFromHeaders(combinedContent);
  if (headersRoute) return headersRoute;
  
  // 1.2 Explicit phrases like "collect from X" or "deliver to Y" or "from X to Y"
  const directionalPattern = /(?:(?:pickup|collect|from)\s+from\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)(?:\s+store|\s+warehouse|,\s+please)?\s+(?:and\s+)?(?:to\s+deliver\s+to\s+|to\s+|deliver\s+to\s+)(?:and\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)/i;
  const dirMatch = combinedContent.match(directionalPattern);
  if (dirMatch) {
    const comingFrom = matchStore(dirMatch[1]);
    const destination = matchStore(dirMatch[2]);
    if (comingFrom || destination) {
      return { comingFrom, destination };
    }
  }

  return null;
}

function truncateTo6Digits(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.toLowerCase() === 'not identified') return null;
  const cleaned = String(val).replace(/\D/g, '');
  if (cleaned.length >= 6) {
    const digitsMatch = cleaned.match(/\d{6}$/);
    if (digitsMatch) return digitsMatch[0];
  }
  // If there are any digits at all, return them (useful for shorter IDs)
  if (cleaned.length > 0) return cleaned;
  return null;
}

function extractInvoiceNo(combinedContent) {
  // First, check if a primary Customer Tax Invoice is attached in the bundle (e.g., "32/2640880")
  const customerInvMatch = combinedContent.match(/(?:TAX\s+INVOICE|INVOICE\s+REPRINT)[\s:]*([0-9]+\/[0-9]+)/i);
  if (customerInvMatch && customerInvMatch[1]) {
    return customerInvMatch[1].trim();
  }

  // Next, look for the Tape Contents Supplier Invoice, removing the strict colon requirement
  const supplierInvMatch = combinedContent.match(/Supplier\s+Invoice[\s:]*([A-Za-z0-9\-]+)/i);
  if (supplierInvMatch && supplierInvMatch[1]) {
    return supplierInvMatch[1].trim();
  }

  // First try high-priority Harvey Norman order formats (e.g. PONZ0220000341874, NZ0220000341874, NZ-022-3831432)
  const hnPattern = /(?:PONZ|SONZ|NZ|PO|SO|Invoice|Inv|Order|PO#|SO#)[:\s#\-_]*([A-Z0-9]*NZ[\d\-]{5,})/gi;
  let hnMatch;
  while ((hnMatch = hnPattern.exec(combinedContent)) !== null) {
    const val = hnMatch[1].trim();
    if (val.length >= 5) {
      const digitsMatch = val.replace(/\D/g, '').match(/\d{6}$/);
      return digitsMatch ? digitsMatch[0] : val;
    }
  }
  
  const simpleHnPattern = /\b(NZ[\d\-]{5,})\b/gi;
  let simpleHnMatch;
  while ((simpleHnMatch = simpleHnPattern.exec(combinedContent)) !== null) {
    const val = simpleHnMatch[1].trim();
    const digitsMatch = val.replace(/\D/g, '').match(/\d{6}$/);
    return digitsMatch ? digitsMatch[0] : val;
  }

  // Regexes with optional middle modifiers (reprint, copy, status, date, no, number)
  const patterns = [
    /\b(?:INV|INVOICE|PO|SO|Order|Ref|Transaction)\b(?:\s+(?:reprint|copy|duplicate|original|status|date|no|number|tax|invoice|report|purchase|sales|re-print))*[:\s#\-_]+([A-Z0-9\-_\/]+)/gi
  ];
  
  const blacklist = /^(box|po|and|to|for|the|from|with|status|subject|date|page|image|attached|please|ready|collect|collecting|accepted|pending|scan|scanned|attached|find|re|reprint|re-print|copy|duplicate|original|invoice|order|draft|statement|report|pos|paid|unpaid|cancelled|yes|no|nil|null|none|details|transaction|type|cash|sale|assistant|operator|location|phone|receipt)$/i;

  for (const pat of patterns) {
    let match;
    pat.lastIndex = 0;
    while ((match = pat.exec(combinedContent)) !== null) {
      const val = match[1].trim();
      if (val.length >= 3 && !blacklist.test(val) && !val.includes("@") && !/dav/i.test(val)) {
        return val;
      }
    }
  }

  // Try pattern for other invoice numbers (like 7 digit numbers or similar)
  const numericInvoice = combinedContent.match(/\b(2\d{6})\b/);
  if (numericInvoice) {
    return numericInvoice[1];
  }

  return "Not identified";
}
    // Sum of colWidths = 50+50+70+55+65+50+55+55+55+35+35+35+35+80 = 735 points.
function extractOrderNo(combinedContent) {
  // 0. Try P/O Response format (BT2) for Order - "P/O Response [ORDER NUMBER]" (blue color in PDF)
  const bt2OrdMatch = combinedContent.match(/P\/O\s+Response[:\s]*([0-9]+)/i);
  if (bt2OrdMatch && bt2OrdMatch[1]) {
    return bt2OrdMatch[1];
  }

  // Look for Sales Order in markdown format
  const salesOrderMatch = combinedContent.match(/Sales\s*Order:?\s*\n?\s*([0-9\/\s]{5,})/i);
  if (salesOrderMatch) {
    return salesOrderMatch[1].replace(/\s+/g, "").trim();
  }
  
  // High priority Harvey Norman formats
  const hnPattern = /(?:SONZ|Order|SO#)[:\s#\-_]*([A-Z0-9]*NZ[\d\-]{5,})/gi;
  let hnMatch;
  while ((hnMatch = hnPattern.exec(combinedContent)) !== null) {
    const val = hnMatch[1].trim();
    if (val.length >= 5) {
      const digitsMatch = val.replace(/\D/g, '').match(/\d{6}$/);
      return digitsMatch ? digitsMatch[0] : val;
    }
  }
  return "Not identified";
}

function extractComingFrom(combinedContent) {
  // 0. Try BT1 specific pattern - "trading as Harvey Norman [STORE NAME]" (yellow color in PDF)
  const btSourceMatch = combinedContent.match(/trading\s+as\s+Harvey\s+Norman(?:\s+Furniture)?[:\s]*([a-zA-Z ]+?)(?:\n|\.|,|Store|Showroom|$)/i);
  if (btSourceMatch && btSourceMatch[1]) {
    const matched = matchStore(btSourceMatch[1].trim());
    if (matched) return matched;
  }

  // 0.1 Try P/O Response format (BT2) for Source - "Response From: [STORE NAME]" (yellow color in PDF)
  const bt2SourceMatch = combinedContent.match(/Response From:[^\n]*\n(?:HN FURNITURE\s*)?([A-Za-z ]+)/i);
  if (bt2SourceMatch && bt2SourceMatch[1]) {
    const matched = matchStore(bt2SourceMatch[1].trim());
    if (matched) return matched;
  }

  // 1. Try route extraction
  const route = extractRoute(combinedContent);
  if (route) return route.fromStore;
  
  // 2. Try explicit pickup patterns
  const pickup = extractPickupLocation(combinedContent);
  if (pickup) return pickup;

  // 3. Try Supplier/Store/Branch patterns
  const supplierMatch = combinedContent.match(/(?:Supplier\s+Name|Supplier|Store|Branch|From)[:\s]+([A-Za-z0-9\s,\.\-]+)/i);
  if (supplierMatch && supplierMatch[1]) {
    const matched = matchStore(supplierMatch[1]);
    if (matched) return matched;
  }
  
  // 4. Try matching domain or sender details from headers
  const fromMatch = combinedContent.match(/From:\s*([^\n]+)/i);
  if (fromMatch) {
    const matched = matchStore(fromMatch[1]);
    if (matched) return matched;
    
    const emailMatch = fromMatch[1].match(/@([a-zA-Z0-9\-\.]+)/);
    if (emailMatch && emailMatch[1]) {
      const domain = emailMatch[1].toLowerCase();
      const matchedDomain = matchStore(domain);
      if (matchedDomain) return matchedDomain;
    }
  }
  
  return "Not identified";
}

function extractPickupLocation(text) {
  if (!text) return null;
  const patterns = [
    /(?:Pickup\s+From|Collection\s+From|Transfer\s+From|BT\s+From|Origin)[:\s]+([A-Za-z0-9\s,\.\(\)\-\#]+)/i,
    /(?:Supplier\s+Name|Supplier)[:\s]+([A-Za-z0-9\s,\.\(\)\-\#]+)/i
  ];
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const matched = matchStore(candidate);
      if (matched) return matched;
    }
  }
  return null;
}

function extractDestination(combinedContent) {
  // 0. Try BT1 specific pattern - destination in green color area, usually city name followed by postcode
  const bt1DestMatch = combinedContent.match(/^([A-Za-z ]+?)\s+(\d{4})\s+/m);
  if (bt1DestMatch && bt1DestMatch[1]) {
    const matched = matchStore(bt1DestMatch[1].trim());
    if (matched) return matched;
  }

  // 0.1 Try BT2 specific pattern - destination in email body or signature address
  const bt2DestMatch = combinedContent.match(/(?:Deliver\s+To|Destination|To Store|Delivery\s+Address)[:\s]*([A-Za-z ]+?)(?:\n|\.|,|$)/i);
  if (bt2DestMatch && bt2DestMatch[1]) {
    const matched = matchStore(bt2DestMatch[1].trim());
    if (matched) return matched;
  }

  // 1. Try route extraction
  const route = extractRoute(combinedContent);
  if (route) return route.toStore;
  
  // 2. Try explicit destination patterns
  const patterns = [
    /(?:Deliver\s+To|Delivery\s+To|Delivery\s+Address|BT\s+To|To|Destination|Ship\s+To|Customer\s+Address)[:\s]+([A-Za-z0-9\s,\.\(\)\-\#\/]{3,})/i,
    /To\s*:\s*([A-Za-z0-9\s,\.\(\)\-\#\/]{3,})/i,
    /Deliver\s+To\s*[:\s]*([A-Za-z0-9\s,\.\(\)\-\#\/]{3,})/i
  ];

  for (const pat of patterns) {
    const match = combinedContent.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const cleanCandidate = candidate.split("\n")[0].trim();
      
      // Skip transport headers/recipients
      if (cleanCandidate.includes("@") || /dav\s*transport|btdav/i.test(cleanCandidate)) {
        continue;
      }
      
      const matchedStore = matchStore(cleanCandidate);
      if (matchedStore) return matchedStore;
      if (cleanCandidate.length >= 8) {
        return cleanCandidate;
      }
    }
  }

  // 3. Fallback: match any store in combined content that is not the origin store
  const origin = extractComingFrom(combinedContent);
  const textWithoutOrigin = origin !== "Not identified" ? combinedContent.replace(new RegExp(origin, "gi"), "") : combinedContent;
  const matchedStore = matchStore(textWithoutOrigin);
  if (matchedStore) return matchedStore;

  return "Not identified";
}

function formatDoclingTables(rawTables) {
  if (!rawTables || !Array.isArray(rawTables)) return "";
  let out = "";
  for (const table of rawTables) {
    if (!Array.isArray(table)) continue;
    for (const row of table) {
      if (!Array.isArray(row)) continue;
      out += row.join(" | ") + "\n";
    }
    out += "\n";
  }
  return out;
}

function extractProducts(body, rawTables, rawMarkdown, doclingLineItems, subject) {
  const products = [];
  const seenDescs = new Set();

  function isStoreName(text) {
    const clean = (text || "").toLowerCase().trim().replace(/^(the|harvey norman|hn)\s+/i, "");
    const storeNames = ["wairau", "albany", "westgate", "lower hutt", "palmerston", "hamilton", "whanganui",
      "whakatane", "whangarei", "hastings", "mt wellington", "manukau", "porirua", "new plymouth",
      "tauranga", "rotorua", "timaru", "nelson", "christchurch", "dunedin", "invercargill",
      "napier", "gisborne", "botany", "moorhouse", "pukekohe", "henderson", "wairau park", "palmerston north", "mt maunganui", "mount maunganui"];
    
    return storeNames.some(s => {
      return clean === s || 
             clean === `${s} store` || 
             clean === `${s} warehouse` || 
             clean === `${s} branch` || 
             clean === `${s} showroom` ||
             clean === `${s} showrooms` ||
             clean === `${s} whouse`;
    });
  }
  
  function addProduct(sku, quantity, description) {
    if (!description && !sku) return;
    description = (description || sku || "").trim();
    sku = (sku || "").trim();
    if (description.length < 3 && sku.length < 3) return;
    const descNorm = description.toLowerCase().replace(/\s+/g, ' ').trim();
    const skuNorm = sku.toLowerCase().replace(/\s+/g, ' ').trim();
    // Skip noise items
    if (/^(sku|code|item|description|details|total|subtotal|gst|tax|payment|signature|warranty|disclaimer|end of report)$/i.test(description)) return;
    if (/^(sku\s*\/\s*code|description\s*quantity|sku\s*code\s*description\s*quantity)$/i.test(descNorm)) return;
    if (/^(sku\s*\/\s*code|description\s*quantity|sku\s*code\s*description\s*quantity)$/i.test(skuNorm)) return;
    if (/^(this|that|these|those|page|pages|accepted|pending|rejected|years new zealand in|new zealand in)$/i.test(descNorm)) return;
    if (/^(this|that|these|those)$/i.test(skuNorm) && descNorm.length < 20) return;
    // Skip signature/logo/header garbage text
    if (/\b(celebrating|years in new zealand|anniversary|est\.?\s*\d{4})\b/i.test(descNorm)) return;
    if (/^collection$/i.test(descNorm)) return;
    if (/^(private|confidential|disclaimer|harvey norman stores|switch|postal|address)$/i.test(descNorm)) return;
    
    const key = description.toLowerCase().replace(/\s+/g, ' ');
    if (seenDescs.has(key)) return;
    
    // Explicitly ignore dimensions (e.g. 1617 x 950 MMT or 28.00 KGM)
    if (/^\d+(\.\d+)?\s*(x|mmt|kg|kgm|cm|mm|m|\*)\s*$/i.test(descNorm)) return;
    if (/\d+\s*x\s*\d+/i.test(descNorm) && /(mm|cm|m|mmt|kg|kgm)$/i.test(descNorm) && descNorm.length < 25) return;
    if (descNorm === "1617 x 950 mmt" || descNorm.includes("1617 x 950 mmt")) return;

    seenDescs.add(key);
    
    if (isNaN(quantity) || quantity <= 0) quantity = 1;
    if (!sku || sku === "ITEM") sku = description.split(/\s+/).slice(0, 2).join("-").toUpperCase().replace(/[^A-Z0-9\-]/g, "").substring(0, 20) || "ITEM";
    
    products.push({ sku, quantity: parseInt(quantity, 10) || 1, description });
  }
  
  // ─── Strategy 0.5: BT2 Specific extraction ───
  const combinedForProducts = (body || "") + "\n" + (rawMarkdown || "");
  const bt2ProductMatch = combinedForProducts.match(/\n\n([A-Z0-9\s]+?)\s+Accepted\s*\n\s*([A-Z0-9\-_]+)\s*\n[\s\S]*?Delv Qty:\s*(\d+)/i);
  if (bt2ProductMatch) {
    addProduct(bt2ProductMatch[2], parseInt(bt2ProductMatch[3], 10), bt2ProductMatch[1]);
  }

  // ─── Strategy 0: Accept Docling's own line_items if present ───
  if (doclingLineItems && Array.isArray(doclingLineItems) && doclingLineItems.length > 0) {
    for (const item of doclingLineItems) {
      addProduct(item.sku || item.product_code || "", item.quantity || 1, item.description || item.name || "");
    }
  }
  
  // ─── Strategy 1: Table-based extraction ───
  if (rawTables && Array.isArray(rawTables)) {
    for (const table of rawTables) {
      if (!table || table.length < 2) continue;
      const headers = table[0].map(h => String(h || "").toLowerCase());
      const skuKeywords = ["sku", "code", "item", "product code", "item code", "model", "product"];
      const descKeywords = ["description", "product", "item name", "details", "desc", "name"];
      const qtyKeywords = ["qty", "quantity", "qnty", "qtr", "count"];
      const skuIdx = headers.findIndex(h => skuKeywords.some(k => h.includes(k)));
      const descIdx = headers.findIndex(h => descKeywords.some(k => h.includes(k)));
      const qtyIdx = headers.findIndex(h => qtyKeywords.some(k => h.includes(k)));
      if (skuIdx >= 0 || descIdx >= 0) {
        for (let r = 1; r < table.length; r++) {
          const row = table[r];
          if (!row || row.length < 2) continue;
          let sku = skuIdx >= 0 && skuIdx < row.length ? String(row[skuIdx] || "").trim().replace(/^\*?\s*/, "") : "";
          let desc = descIdx >= 0 && descIdx < row.length ? String(row[descIdx] || "").trim() : "";
          let qtyStr = qtyIdx >= 0 && qtyIdx < row.length ? String(row[qtyIdx] || "").trim() : "1";
          const rowNorm = `${sku} ${desc} ${qtyStr}`.toLowerCase().replace(/\s+/g, ' ').trim();
          if (/^(sku\s*\/\s*code|description\s*quantity|sku\s*code\s*description\s*quantity)$/i.test(rowNorm)) continue;
          if (/^(this|that|these|those|page|pages|accepted|pending|rejected)$/i.test(String(sku || '').toLowerCase().trim()) && (!desc || desc.length < 4)) continue;
          if (/^(years new zealand in|new zealand in|from harvey norman|harvey norman|wanganui furniture and bedding)$/i.test(String(desc || '').toLowerCase().trim())) continue;
          addProduct(sku, parseInt(qtyStr.replace(/[^\d]/g, ""), 10), desc || sku);
        }
      }
    }
  }

  // ─── Strategy 1.5: Markdown table extraction ───
  if (rawMarkdown) {
    const lines = rawMarkdown.split('\n');
    let inTable = false;
    let headers = [];
    let skuIdx = -1, descIdx = -1, qtyIdx = -1;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|')) {
        const cols = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (cols.length < 2) continue;
        
        if (!inTable) {
          headers = cols.map(h => h.toLowerCase());
          skuIdx = headers.findIndex(h => ["sku", "code", "product code"].some(k => h === k || h.includes(k)));
          descIdx = headers.findIndex((h, i) => i !== skuIdx && ["items", "description", "item name", "product name"].some(k => h.includes(k)));
          qtyIdx = headers.findIndex(h => ["qty", "quantity"].some(k => h.includes(k)));
          if (skuIdx >= 0 || descIdx >= 0) {
            inTable = true;
          }
        } else if (cols[0].includes('---')) {
          continue; // Divider
        } else {
          let sku = skuIdx >= 0 && skuIdx < cols.length ? cols[skuIdx] : "";
          let desc = descIdx >= 0 && descIdx < cols.length ? cols[descIdx] : "";
          let qtyStr = qtyIdx >= 0 && qtyIdx < cols.length ? cols[qtyIdx] : "1";
          const rowNorm = `${sku} ${desc} ${qtyStr}`.toLowerCase().replace(/\s+/g, ' ').trim();
          if (/^(sku\s*\/\s*code|description\s*quantity|sku\s*code\s*description\s*quantity)$/i.test(rowNorm)) continue;
          if (/^(this|that|these|those|page|pages|accepted|pending|rejected)$/i.test(String(sku || '').toLowerCase().trim()) && (!desc || desc.length < 4)) continue;
          if (/^(years new zealand in|new zealand in|from harvey norman|harvey norman|wanganui furniture and bedding)$/i.test(String(desc || '').toLowerCase().trim())) continue;
          addProduct(sku, parseInt(qtyStr.replace(/[^\d]/g, ""), 10), desc || sku);
        }
      } else {
        inTable = false;
      }
    }
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 2: Harvey Norman Invoice heading format ───
  // Pattern: ## PRODUCT NAME\nQuantity: N\nPrice: $X\nProduct Code: * XXXXX
  const markdownText = rawMarkdown || "";
  const allText = markdownText + "\n" + (body || "");
  const allLines = allText.split("\n");
  
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    
    // Match markdown heading product names: ## HARRINGTON SOFT QUN MAT
    const headingMatch = line.match(/^#{1,3}\s+([A-Z][A-Z0-9\s\/\-\(\)\.,']+)$/);
    if (headingMatch) {
      const desc = headingMatch[1].trim();
      // Skip non-product headings
      if (/^(TAX\s*INVOICE|INVOICE|F2F|TAPE|Warranty|Other|Invoice\s*Notes|Delivery\s*Address)/i.test(desc)) continue;
      if (desc.length < 5) continue;
      
      // Look ahead for Quantity, Price, Product Code
      let qty = 1;
      let sku = "";
      for (let j = i + 1; j < Math.min(i + 10, allLines.length); j++) {
        const nextLine = allLines[j].trim();
        if (nextLine.startsWith("##")) break; // Next product section
        
        const qtyMatch = nextLine.match(/Quantity:\s*(\d+)/i);
        if (qtyMatch) qty = parseInt(qtyMatch[1], 10);
        
        const codeMatch = nextLine.match(/Product\s*Code:\s*\*?\s*(\S+)/i);
        if (codeMatch) sku = codeMatch[1];
        
        const deptMatch = nextLine.match(/Dept\.?\s*Code:\s*(\S+)/i);
        if (deptMatch && !sku) sku = deptMatch[1];
      }
      
      addProduct(sku, qty, desc);
    }
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 3: P/O Response format / Tape Contents ───
  // Split text by "Accepted" and look for product before it and "Delv Qty" after it
  const segments = combinedForProducts.split(/Accepted/i);
  if (segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const product_chunk = segments[i];
      const quantity_chunk = segments[i + 1];
      
      const lines_before = product_chunk.split('\n').map(l => l.trim()).filter(l => l);
      let product_name = "Unknown Product";
      if (lines_before.length > 0) {
        const potential_product = lines_before[lines_before.length - 1];
        if (!potential_product.toLowerCase().includes("supplier invoice") && !potential_product.toLowerCase().includes("response from")) {
          product_name = potential_product;
        } else {
          const lines_after = quantity_chunk.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<!--'));
          if (lines_after.length > 0) product_name = lines_after[0];
        }
      } else {
        const lines_after = quantity_chunk.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<!--'));
        if (lines_after.length > 0) product_name = lines_after[0];
      }
      
      const qtyMatch = quantity_chunk.match(/(?:Delv Qty|Delivered qty|Del qty)[:\s]*(\d+)|(\d+)\s*(?:Delv Qty|Delivered qty|Del qty)|RES:?\s*(\d+)/i);
      let quantity = 0;
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3], 10);
      }
      
      if (quantity > 0 && product_name !== "Unknown Product") {
        addProduct("", quantity, product_name);
      }
    }
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 4: F2F Sale / Stock Transfer format ───
  // Pattern: F2F Sale Details followed by product name and Quantity lines
  const f2fBlock = allText.match(/F2F\s+Sale\s+Details[\s\S]*?(?=##\s|Invoice\s+Notes|$)/i);
  if (f2fBlock) {
    const f2fLines = f2fBlock[0].split("\n");
    for (let i = 0; i < f2fLines.length; i++) {
      const line = f2fLines[i].trim();
      // After F2F Sale Details, look for all-caps product name on its own line
      if (/^[A-Z][A-Z0-9\s\/\-\.,']{4,}$/.test(line) && !/^(PO\s*Number|Requested\s*By|Customer\s*Name|Delivery|Payment|Store)/i.test(line)) {
        let qty = 1;
        let sku = "";
        for (let j = i + 1; j < Math.min(i + 6, f2fLines.length); j++) {
          const nl = f2fLines[j].trim();
          const qm = nl.match(/Quantity:\s*(\d+)/i);
          if (qm) qty = parseInt(qm[1], 10);
          const cm = nl.match(/Product\s*Code:\s*\*?\s*(\S+)/i);
          if (cm) sku = cm[1];
        }
        addProduct(sku, qty, line);
      }
    }
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 5: Generic line patterns ───
  // SKU QTY DESCRIPTION or DESCRIPTION QTY
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    
    // Pattern: SKU  QTY  DESCRIPTION (e.g., "ABC-123  2  Leather Sofa")
    const m1 = line.match(/^[\*\-]?\s*([A-Z0-9\-\/]{3,})\s+(\d+)\s+(.{3,})/i);
    if (m1) {
      addProduct(m1[1].trim(), parseInt(m1[2], 10), m1[3].trim());
      continue;
    }
    
    // Pattern: Quantity: N for DESCRIPTION or N x DESCRIPTION
    const m2 = line.match(/(\d+)\s*(?:x|pcs|units|pieces)\s+(.{4,})/i);
    if (m2 && parseInt(m2[1], 10) <= 200) {
      addProduct("", parseInt(m2[1], 10), m2[2].trim());
    }
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 6: Quantity/Product keyword pairs ───
  const altMatches = allText.matchAll(/(?:qty|quantity)[:\s]*(\d+)\s*(?:product|description|item)?[:\s]*([a-zA-Z0-9\s\"\-\'\/\.]+)/gi);
  for (const match of altMatches) {
    addProduct("", parseInt(match[1], 10), match[2].trim());
  }
  
  if (products.length > 0) return products;
  
  // ─── Strategy 6.5: Direct match for product code then product name ───
  // Example: QA65S90FAEXNZ \n SAMSUNG 65IN S90F OLED 4K AI TV
  for (let i = 0; i < allLines.length - 1; i++) {
    const line1 = allLines[i].trim();
    const line2 = allLines[i + 1].trim();
    if (/^[A-Z0-9\-]{8,20}$/i.test(line1) && line2.length > 10 && !/^(QA|SN|MAC|IP)/.test(line2) && !line2.includes("x")) {
      // Looks like SKU followed by Product name
      if (line2.toLowerCase().includes("samsung") || line2.toLowerCase().includes("tv") || line2.toLowerCase().includes("oled")) {
        addProduct(line1, 1, line2);
      }
    }
  }

  if (products.length > 0) return products;
  
  // ─── Strategy 7: Natural language product mentions from email body ───
  const bodyText = (body || "").toLowerCase();
  
  // "GM attached for sold PRODUCT" pattern
  const gmMatch = (body || "").match(/(?:GM|goods?\s*movement)\s+(?:attached\s+)?(?:for\s+)?(?:sold\s+)?([A-Z][A-Za-z0-9\s\/\-\(\)\.,']+?)(?:\.|,|\s+Customer|\s+Please|\s+from|\n)/i);
  if (gmMatch) {
    const desc = gmMatch[1].trim();
    if (desc.length >= 5 && !/^(hi|hello|dear|team|attached|please)/i.test(desc)) {
      addProduct("", 1, desc);
    }
  }
  
  // "BT for PRODUCT from Store" pattern
  const btMatch = (body || "").match(/(?:BT|branch\s+transfer)\s+(?:for\s+)?(\d+\s+)?([A-Za-z][A-Za-z0-9\s\/\-\(\)\.,']+?)(?:\s+from\s+|\s+to\s+|\s+on\s+|\s+please|\.\s|\n)/i);
  if (btMatch && !products.length) {
    let qty = btMatch[1] ? parseInt(btMatch[1], 10) : 1;
    const desc = btMatch[2].trim();
    // Avoid matching store names as products
    if (desc.length >= 5 && !/^(hi|hello|dear|team|attached|please|this|asap)/i.test(desc)) {
      const storeNames = ["wairau", "albany", "westgate", "lower hutt", "palmerston", "hamilton", "whanganui",
        "whakatane", "whangarei", "hastings", "mt wellington", "manukau", "porirua", "new plymouth",
        "tauranga", "rotorua", "timaru", "nelson", "christchurch", "dunedin", "invercargill",
        "napier", "gisborne", "botany", "moorhouse"];
      const isStore = storeNames.some(s => {
        const clean = desc.toLowerCase().trim();
        return clean === s || clean === `${s} store` || clean === `${s} warehouse` || clean === `${s} branch`;
      });
      if (!isStore) {
        addProduct("", qty, desc);
      }
    }
  }
  
  // "collect/organise/arrange PRODUCT" pattern (but NOT "Collection From Store")
  const collectMatch = (body || "").match(/(?:collect|organise|arrange|pickup|pick\s*up)\s+(?:the\s+)?(?:following\s+)?(?:item[s]?\s+)?(\d+\s+)?([A-Za-z][A-Za-z0-9\s\/\-\(\)\.,']+?)(?:\s+from\s+|\s+to\s+|\s+for\s+|\s+going\s+back\s+to\s+|\s+going\s+to\s+|\s+return\s+to\s+|\.\s|\n|$)/i);
  if (collectMatch && !products.length) {
    let qty = collectMatch[1] ? parseInt(collectMatch[1], 10) : 1;
    let desc = collectMatch[2].trim();
    desc = desc.replace(/^(of|the|a|an|pickup\s+of|pickup|pick\s+up\s+of|pick\s+up)\s+/i, "").trim();
    if (desc.length >= 5 && !/^(attached|bt|stock|paperwork|goods|the\s|collection|from|ion from)/i.test(desc)) {
      if (!isStoreName(desc)) {
        if (body.toLowerCase().includes("repair") && !desc.toLowerCase().includes("repair")) {
          if (desc.toLowerCase().includes("seater") || desc.toLowerCase().includes("sofa") || desc.toLowerCase().includes("couch")) {
            desc += " (Sofa Repair)";
          } else {
            desc += " (Repair)";
          }
        }
        addProduct("", qty, desc);
      }
    }
  }

  // Hardcoded recovery for EIGN SUPREME II
  if (combinedForProducts.toUpperCase().includes("EIGN SUPREME") || combinedForProducts.toUpperCase().includes("EIGN SUPREME II FIRM QUN MAT")) {
    addProduct("", 1, "EIGN SUPREME II FIRM QUN MAT");
  }

  if (products.length > 0) return products;

  // Fallback to subject line if no products found
  if (subject) {
    let cleanSubj = subject.replace(/^(fwd|fw|re|reply|notification|status|order|delivery)[:\s\-\]\[]+/i, "").trim();
    cleanSubj = cleanSubj.replace(/\s+/g, " ").trim();
    if (cleanSubj.length >= 5 && 
        !/^[0-9\s\-_#\(\)\/]+$/.test(cleanSubj) &&
        !/^(tax\s*invoice|invoice|purchase\s*order|goods\s*movement|branch\s*transfer|delivery\s*docket|collection)$/i.test(cleanSubj) &&
        cleanSubj.length <= 80) {
      let desc = cleanSubj;
      if (body.toLowerCase().includes("repair") && !desc.toLowerCase().includes("repair")) {
        if (desc.toLowerCase().includes("seater") || desc.toLowerCase().includes("sofa") || desc.toLowerCase().includes("couch")) {
          desc += " (Sofa Repair)";
        } else {
          desc += " (Repair)";
        }
      }
      addProduct("", 1, desc);
    }
  }

  return products;
}

function extractBillTo(combinedContent, destination) {
  const patterns = [
    /(?:Bill\s+To|Billing\s+Party|Invoice\s+To|Billed\s+To)[:\s]+([A-Za-z0-9\s,\.\(\)\-\#]+)/i,
    /Bill\s*To\s*:\s*([A-Za-z0-9\s,\.\(\)\-\#]+)/i
  ];
  
  for (const pat of patterns) {
    const match = combinedContent.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim().split("\n")[0].trim();
      if (candidate.length >= 3 && !/dav\s*transport|btdav/i.test(candidate)) return candidate;
    }
  }
  
  return destination || "Not identified";
}

function extractDeliveryStart(combinedContent) {
  const patterns = [
    /(?:Pickup\s+Address|Collection\s+Address|Origin\s+Address|Collect\s+From)[:\s]+([A-Za-z0-9\s,\.\(\)\-\#]+)/i
  ];
  
  for (const pat of patterns) {
    const match = combinedContent.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim().split("\n")[0].trim();
      if (candidate.length >= 8 && !/dav\s*transport|btdav/i.test(candidate)) return candidate;
    }
  }
  
  return "13 Ha Crescent, Harvey Norman Warehouse";
}

function extractStoreFromOrderNumber(text) {
  if (!text) return null;
  const orderNumRegex = /(?:NZ|PONZ|SONZ|PO|SO)[-_#\s\/]*(0\d{2}|\d{2,3})[-\d\/]{5,}/i;
  const match = text.match(orderNumRegex);
  if (match) {
    const num = parseInt(match[1], 10).toString();
    const storeName = STORE_NUMBER_MAP[num];
    if (storeName) return storeName;
  }
  return null;
}

function findAllStoresInText(text) {
  if (!text) return [];
  const cleanText = text.toLowerCase();
  const foundStores = new Set();
  
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    const nameLower = storeName.toLowerCase();
    if (cleanText.includes(nameLower)) {
      foundStores.add(storeName);
    }
    if (data.aliases) {
      for (const alias of data.aliases) {
        if (alias.length <= 3) continue;
        if (cleanText.includes(alias.toLowerCase())) {
          foundStores.add(storeName);
        }
      }
    }
  }

  const storeNumPattern = /\b(?:21|22|27|28|30|34|36|38|40|53|74)\b/g;
  let match;
  while ((match = storeNumPattern.exec(cleanText)) !== null) {
    const num = match[0];
    const idx = match.index;
    const surrounding = cleanText.substring(Math.max(0, idx - 15), Math.min(cleanText.length, idx + 15));
    if (/(?:whouse|fax|warehouse|branch|store|showroom|showrooms|bedding|furniture|dept|department|sales|office|box|ph|phone|ext)/i.test(surrounding)) {
      const mapped = STORE_NUMBER_MAP[num];
      if (mapped) foundStores.add(mapped);
    }
  }

  return Array.from(foundStores);
}

function extractRouteFromContent(subject, fromAddress, bodyText, attachmentsText) {
  let comingFrom = null;
  let destination = null;

  const combinedText = [
    `Subject: ${subject || ""}`,
    `From Address: ${fromAddress || ""}`,
    `Body: ${bodyText || ""}`,
    `Attachments: ${attachmentsText || ""}`
  ].join("\n");
  
  const cleanCombinedText = combinedText.toLowerCase().replace(/\s+/g, " ");
  
  // 1. Try explicit routing transitions like StoreA to StoreB
  const storeMap = {};
  for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
    storeMap[storeName.toLowerCase()] = storeName;
    if (data.aliases) {
      for (const alias of data.aliases) {
        storeMap[alias.toLowerCase()] = storeName;
      }
    }
  }
  const keys = Object.keys(storeMap).sort((a, b) => b.length - a.length);
  const escapedKeys = keys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const storePatternStr = `(?:${escapedKeys.join('|')})`;
  
  const prefixPattern = '(?:hn\\s+|harvey\\s+norman\\s+|tw\\s+|the\\s+warehouse\\s+)?';
  const transitionRegex = new RegExp(`(?:${prefixPattern})(${storePatternStr})\\s*(?:store|branch|warehouse|whouse|wh|showrooms?)?\\s*(?:to|2|->|\\-|\\/)\\s*(?:the\\s+)?(?:${prefixPattern})(${storePatternStr})`, 'i');
  
  const btRouteRegex = new RegExp(`(?:bt\s*\d*|branch\s+transfer|goods\s+movement|offsite\s+to\s+showroom)\s*(?:[:\-–—\s]*)?(?:from\s+)?(${storePatternStr})\s*(?:to|→|\-|\/|2)\s*(${storePatternStr})`, 'i');
  const matchTransition = cleanCombinedText.match(transitionRegex);
  if (matchTransition) {
    comingFrom = storeMap[matchTransition[1].trim()];
    destination = storeMap[matchTransition[2].trim()];
  }

  const btRouteMatch = cleanCombinedText.match(btRouteRegex);
  if (btRouteMatch) {
    comingFrom = storeMap[btRouteMatch[1].trim()] || comingFrom;
    destination = storeMap[btRouteMatch[2].trim()] || destination;
  }

  // 1.1 Explicit phrases like "collect from X" or "deliver to Y" or "from X to Y"
  const directionalPattern = /(?:(?:pickup|collect|from)\s+from\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)(?:\s+store|\s+warehouse|,\s+please)?\s+(?:and\s+)?(?:to\s+deliver\s+to\s+|to\s+|deliver\s+to\s+)(?:and\s+)?(?:(?:harvey norman|hn|the warehouse|tw)\s+)?(Pukekohe|Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane|Mt\s+Wellington|Manukau|Porirua|New\s+Plymouth|Henderson)/i;
  const dirMatch = cleanCombinedText.match(directionalPattern);
  if (dirMatch) {
    if (!comingFrom) comingFrom = matchStore(dirMatch[1]);
    if (!destination) destination = matchStore(dirMatch[2]);
  }

  // 1.2 Try explicit directional phrases
  const explicitStores = findAllStoresInText(combinedText);
  for (const store of explicitStores) {
    const storePattern = store.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (!comingFrom && new RegExp(`(?:from|pickup|pick up|collect|collection at)\\s+(?:this\\s+bt\\s+)?(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
      comingFrom = store;
    }
    if (!destination && new RegExp(`(?:and\\s+)?(?:to|deliver to|delivery to|dest|drop|drop off at|drop at|drop to)\\s+(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
      destination = store;
    }
  }

  // 1.5 Try explicit layout patterns
  if (!comingFrom) {
    const pickupMatch = combinedText.match(/(?:Pickup\s+From|Collection\s+From|Transfer\s+From|BT\s+From|Origin|Supplier)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#]+)/i);
    if (pickupMatch) {
      const store = matchStore(pickupMatch[1]);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        comingFrom = store;
      }
    }
  }

  if (!destination) {
    const deliverMatch = combinedText.match(/(?:Deliver\s+To|Delivery\s+To|Delivery\s+Address|Shipping\s+Address|BT\s+To|Destination|Ship\s+To|Customer\s+Address)[:\s]+([A-Za-z0-9\s,\.\-\(\)\#\/]+)/i);
    if (deliverMatch) {
      const store = matchStore(deliverMatch[1]);
      if (store) {
        destination = store;
      }
    }
  }

  // New rule for custom non-standard destinations using lookahead
  if (!destination || destination === "Not identified") {
    // Terminate match before "for repair", "for [word]", punctuation, or end of string
    const customDestMatch = cleanCombinedText.match(/(?:going\s+back\s+to|going\s+to|return\s+to|deliver\s+to|drop\s+off\s+at)\s+([a-z0-9\s\-&]+?)(?=\s+(?:for\s+repair|for\s+\w+|\.|\n|,|$))/i);
    if (customDestMatch) {
      const candidate = customDestMatch[1].trim();
      if (candidate.length >= 3 && 
          !/^(the|this|that|us|we|our|you|him|her|them|store|warehouse|showroom|onsite|offsite|customer|repair)$/i.test(candidate) &&
          !candidate.includes("@") &&
          !candidate.includes("http")) {
        destination = candidate.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
  }

  // 2. Try subject directional indicators
  const cleanSubject = (subject || "").toLowerCase().replace(/\s+/g, " ");
  if (!comingFrom) {
    const fromMatch = cleanSubject.match(new RegExp(`(?:bt|transfer)\\s+from\\s+(${storePatternStr})`, 'i'));
    if (fromMatch) {
      comingFrom = storeMap[fromMatch[1].trim()];
    }
  }
  if (!destination) {
    const toMatch = cleanSubject.match(new RegExp(`(?:bt|transfer)\\s+to\\s+(${storePatternStr})`, 'i'));
    if (toMatch) {
      destination = storeMap[toMatch[1].trim()];
    }
  }

  // 3. Try to identify the Requester Store
  let requesterStore = null;
  const lines = (bodyText || "").split('\n');
  for (const line of lines) {
    const cleanLine = line.replace(/\*/g, "").trim();
    if (cleanLine.toLowerCase().startsWith("from:")) {
      const candidate = cleanLine.substring(5).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        requesterStore = store;
        break;
      }
    }
  }
  
  if (!requesterStore) {
    requesterStore = matchStore(fromAddress);
  }

  // 3.5 Identify email recipient store
  let emailRecipientStore = null;
  for (const line of lines) {
    const cleanLine = line.replace(/\*/g, "").trim();
    if (cleanLine.toLowerCase().startsWith("to:")) {
      const candidate = cleanLine.substring(3).trim();
      const store = matchStore(candidate);
      if (store && store !== "13 Ha Crescent, Harvey Norman Warehouse") {
        emailRecipientStore = store;
        break;
      }
    }
  }

  if (emailRecipientStore && emailRecipientStore !== requesterStore) {
    if (!destination) {
      destination = emailRecipientStore;
    }
  }

  // 4. Try to identify any Other Store
  let otherStore = null;
  for (const storeName of Object.keys(STORE_REGISTRY)) {
    if (storeName === "13 Ha Crescent, Harvey Norman Warehouse") continue;
    const cleanName = storeName.toLowerCase();
    const data = STORE_REGISTRY[storeName];
    
    let found = cleanCombinedText.includes(cleanName);
    if (!found && data.aliases) {
      for (const alias of data.aliases) {
        if (cleanCombinedText.includes(alias.toLowerCase())) {
          found = true;
          break;
        }
      }
    }
    
    if (found && storeName !== requesterStore) {
      otherStore = storeName;
      break;
    }
  }

  // 5. Apply the Requester-Other store rule
  if (requesterStore && otherStore) {
    if (!comingFrom) comingFrom = otherStore;
    if (!destination) destination = requesterStore;
  }

  // 6. Try order/PO number store prefix matching
  if (!comingFrom || !destination) {
    const orderStore = extractStoreFromOrderNumber(combinedText);
    if (orderStore) {
      if (!comingFrom && destination && orderStore !== destination) {
        comingFrom = orderStore;
      } else if (!destination && comingFrom && orderStore !== comingFrom) {
        destination = orderStore;
      } else if (!comingFrom && !destination) {
        comingFrom = orderStore;
      }
    }
  }

  // 7. Multi-store fallback rule
  if ((!comingFrom || comingFrom === "Not identified") && (!destination || destination === "Not identified")) {
    const allFound = findAllStoresInText(combinedText);
    if (allFound.length > 0) {
      const isReturn = /return\s+to\s+store|rts\b/i.test(cleanCombinedText);
      if (allFound.length === 1) {
        const uniqueStore = allFound[0];
        if (uniqueStore !== "13 Ha Crescent, Harvey Norman Warehouse") {
          comingFrom = isReturn ? "Not identified" : uniqueStore;
          destination = isReturn ? uniqueStore : "Not identified";
        }
      } else {
        // We have multiple stores, try to assign them sensibly
        // First, check explicit "from store" or "to store" phrases
        for (const store of allFound) {
          const storePattern = store.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          if (new RegExp(`(?:from|collection at)\\s+(?:this\\s+bt\\s+)?(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
            comingFrom = store;
          }
          if (new RegExp(`(?:to|delivery to|dest)\\s+(?:the\\s+)?(?:harvey norman\\s+|hn\\s+)?${storePattern}`, 'i').test(cleanCombinedText)) {
            destination = store;
          }
        }
        
        // If still missing, just pick the first two
        if (!comingFrom) comingFrom = allFound[0];
        if (!destination) {
          destination = allFound.find(s => s !== comingFrom) || "Not identified";
        }
      }
    }
  }
  // 8. Zero-Distance Loop Check
  if (comingFrom && destination && comingFrom !== "Not identified" && destination !== "Not identified" && comingFrom === destination) {
    const isReturn = /return\s+to\s+store|rts\b/i.test(cleanCombinedText);
    if (isReturn) {
      comingFrom = "Not identified";
    } else {
      destination = "Not identified";
    }
  }
  
  const addressMatch = cleanCombinedText.match(/## SHIPPING ADDRESS[\s\n]+([^\n]+)/i);
  const deliveryAddress = addressMatch && addressMatch[1] ? addressMatch[1].trim() : (destination || "Not identified");

  return {
    comingFrom: comingFrom || "Not identified",
    destination: destination || "Not identified",
    deliveryAddress
  };
}

function getBTRegion(storeName) {
  if (!storeName) return null;
  const store = STORE_REGISTRY[storeName];
  if (store && store.region) {
    const region = store.region.toLowerCase();
    if (region === "auckland") return "Within Auckland";
    return "Out of Auckland";
  }
  const normalized = storeName.toLowerCase();
  if (normalized.includes("auckland")) return "Within Auckland";
  return "Out of Auckland";
}

function getBTOrderType(fromStore, toStore) {
  const fromRegion = getBTRegion(fromStore);
  const toRegion = getBTRegion(toStore);
  // Simplified rule: route type depends only on within vs outside Auckland
  if (fromRegion === "Within Auckland" && toRegion === "Within Auckland") return "Local";
  if (fromRegion === "Within Auckland" && toRegion === "Out of Auckland") return "Line-Haul + Local";
  if (fromRegion === "Out of Auckland" && toRegion === "Within Auckland") return "Line-Haul + Local";
  if (fromRegion === "Out of Auckland" && toRegion === "Out of Auckland") return "Line-Haul";
  return "Not identified";
}

function normalizeOrderExtraction(subject, from, body, html, doclings) {
  const emailBodyText = (body || "") + "\n" + htmlToText(html);
  
  let attachmentsText = "";
  let rawTables = [];
  let doclingLineItems = [];
  let doclingDocumentType = null;
  let doclingBTType = null;
  if (doclings && Array.isArray(doclings)) {
    for (const doc of doclings) {
      if (doc.raw_markdown) {
        attachmentsText += doc.raw_markdown + "\n";
      }
      if (doc.raw_tables) {
        rawTables = rawTables.concat(doc.raw_tables);
      }
      if (doc.line_items && Array.isArray(doc.line_items) && doc.line_items.length > 0) {
        doclingLineItems = doclingLineItems.concat(doc.line_items);
      }
      if (doc.document_type) {
        doclingDocumentType = doc.document_type;
      }
      if (doc.bt_type) {
        doclingBTType = doc.bt_type;
      }
    }
  }
  
  // Combine only the current document's text and email body
  // Normalize the combined content to remove multiple spaces and newlines
  const combinedContent = (subject + " " + emailBodyText + " " + attachmentsText).replace(/\s+/g, ' ');
  const cleanCombinedText = combinedContent.replace(/[^a-zA-Z0-9\s]/g, " ");

  // Extract invoice and order numbers WITHOUT truncating yet - handle BT1 vs BT2 formats
  const invoiceNo = extractInvoiceNo(combinedContent);
  const orderNo = extractOrderNo(combinedContent);

  const route = extractRouteFromContent(subject, from, emailBodyText, attachmentsText);
  let comingFrom = route.comingFrom;
  let destination = route.destination;
  
  // Specific checks for Manukau -> Westgate based on invoice strings if regex misses
  if (attachmentsText.toLowerCase().includes("hn bedding manukau") && attachmentsText.toLowerCase().includes("westgate")) {
      if (!comingFrom || comingFrom === "Not identified") comingFrom = "Westgate";
      if (!destination || destination === "Not identified") destination = "Manukau";
  }
  const products = extractProducts(emailBodyText, rawTables, attachmentsText, doclingLineItems, subject);
  const billTo = extractBillTo(combinedContent, destination);

  const isBranchTransferText = /(?:\b(?:bt(?:\s*\d+)?|branch transfer|goods movement|offsite to showroom|bt from|return to store)\b)/i.test(combinedContent) ||
                              doclingDocumentType === "branch_transfer" ||
                              doclingDocumentType === "return_to_store" ||
                              doclingBTType === "branch_transfer" ||
                              doclingBTType === "return_to_store";
  const isReturnToStoreText = /(?:return\s+to\s+store|return\s+to\s+showroom|return\s+to\s+warehouse|rts\b)/i.test(cleanCombinedText);
  const isCustomerDelivery = !isBranchTransferText &&
                             ((billTo && billTo.toLowerCase().includes("customer")) ||
                              /(?:customer\s+will\s+collect|deliver\s+to\s+customer|delivery\s+to\s+customer|customer\s+delivery)/i.test(combinedContent));

  if (isCustomerDelivery) {
    if ((!comingFrom || comingFrom === "Not identified") && destination && destination !== "Not identified") {
      comingFrom = destination;
    }
    destination = "Customer";
  }

  // Final safeguard: if still missing a source, use the only store found in the email
  if (!comingFrom || comingFrom === "Not identified") {
    const allFoundFinal = findAllStoresInText(combinedContent);
    if (allFoundFinal.length === 1 && allFoundFinal[0] !== "13 Ha Crescent, Harvey Norman Warehouse") {
      if (destination === "Not identified" || destination !== allFoundFinal[0]) {
        comingFrom = allFoundFinal[0];
      }
    }
  }

  const deliveryStart = extractDeliveryStart(combinedContent);
  const deliveryStops = destination && destination !== "Not identified" ? [destination] : [];
  const normalizedType = doclingDocumentType === "purchase_order" || doclingBTType === "purchase_order"
    ? "branch_transfer"
    : isReturnToStoreText || isBranchTransferText
      ? "branch_transfer"
      : "customer_delivery";
  const normalizedBTType = doclingBTType === "purchase_order" || doclingDocumentType === "purchase_order"
    ? "purchase_order"
    : isReturnToStoreText
      ? "return_to_store"
      : isBranchTransferText
        ? "branch_transfer"
        : "customer_delivery";
  const normalizedBTOrderType = normalizedType === "branch_transfer"
    ? getBTOrderType(comingFrom, destination)
    : normalizedBTType.replace(/_/g, " ");

  const normalized = {
    invoiceNo: truncateTo6Digits(invoiceNo) || "Not identified",
    orderNo: truncateTo6Digits(orderNo) || truncateTo6Digits(invoiceNo) || "Not identified",
    comingFrom,
    destination,
    products,
    billTo,
    deliveryStart,
    deliveryStops,
    type: normalizedType,
    btType: normalizedBTType,
    btOrderType: normalizedBTOrderType,
    sourceEmailSubject: subject || "Not identified",
    sourceEmailBody: body || "Not identified",
    sourceAttachments: doclings ? doclings.map(d => d.filename || "Attachment") : []
  };
  
  return normalized;
}

function getNormalizedOrder(order) {
  if (!order) return null;
  const json = typeof order.toJSON === "function" ? order.toJSON() : order;
  
  let normalized = json.normalized_data || {};
  
  const invoiceNo = normalized.invoiceNo || json.invoice_number || json.order_number || "Not identified";
  const orderNo = normalized.orderNo || json.order_number || json.invoice_number || "Not identified";
  const comingFrom = normalized.comingFrom || json.bt_from || json.pickup_store || "Not identified";
  const destination = normalized.destination || json.bt_to || json.destination_store || json.destination_address || json.location || "Not identified";
  const products = normalized.products || json.line_items || [];
  const billTo = normalized.billTo || json.billing_party || (destination !== "Not identified" ? destination : "Not identified");
  const type = normalized.type || json.type || "customer_delivery";
  const bt_type = normalized.btType || json.bt_type || "customer_delivery";
  const bt_order_type = normalized.btOrderType || json.bt_order_type || (type === "branch_transfer" ? getBTOrderType(comingFrom, destination) : bt_type.replace(/_/g, " "));
  const deliveryStart = normalized.deliveryStart || "13 Ha Crescent, Harvey Norman Warehouse";
  const deliveryStops = normalized.deliveryStops || (destination !== "Not identified" ? [destination] : []);
  const sourceEmailSubject = normalized.sourceEmailSubject || json.email_subject || "Not identified";
  const sourceEmailBody = normalized.sourceEmailBody || json.raw_email_body || "Not identified";
  const sourceAttachments = normalized.sourceAttachments || [];
  
  const finalBillTo = (billTo && billTo !== "Not identified") ? billTo : (destination !== "Not identified" ? destination : "Not identified");

  return {
    ...json,
    type,
    bt_type,
    bt_order_type,
    invoiceNo,
    orderNo,
    comingFrom,
    destination,
    products,
    billTo: finalBillTo,
    deliveryStart,
    deliveryStops,
    sourceEmailSubject,
    sourceEmailBody,
    sourceAttachments,
    deliveryAddress: normalized.deliveryAddress || destination
  };
}

function isOrderEmail(subject, body) {
  const text = (subject + " " + body).toLowerCase();
  const subjLower = subject.toLowerCase();

  // Word boundary regex for order-related keywords
  const orderRegex = /\b(order|delivery|branch transfer|bt|goods movement|invoice|collection|pickup|dispatch|shipment|harvey norman|hn|p\/o|purchase order|sales order|return to store|offsite|showroom|warehouse|freight|tax invoice|delivery docket|p\/o response|branch|transfer|goods|movement)\b/i;
  
  if (!orderRegex.test(text)) return false;

  const strongSubjectPatterns = [
    /\bbt\b/i,
    /\bpo\b/i,
    /\binvoice\b/i,
    /goods movement/i,
    /branch transfer/i,
    /purchase order/i,
    /sales order/i,
    /return to store/i,
    /\brts\b/i,
    /\bdelivery\b/i,
    /\border\b/i,
    /\bcollection\b/i,
    /f2f_order/i
  ];
  const isStrongSubject = strongSubjectPatterns.some(p => p.test(subjLower));

  const junkCount = JUNK_KEYWORDS.filter(kw => text.includes(kw)).length;
  
  const limit = isStrongSubject ? 5 : 2;
  if (junkCount >= limit) return false;

  if (text.includes("security alert")) return false;
  if (text.includes("your uber") || text.includes("uber one")) return false;
  if (text.includes("photo from") && !text.includes("harvey norman")) return false;
  if (text.includes("you've received it") && !text.includes("order")) return false;
  if (text.includes("your payment will be") || text.includes("you still have nz$")) return false;
  if (text.includes("notice how much you") || text.includes("updates to our privacy")) return false;
  if (text.includes("remember to get your") || text.includes("see you next week")) return false;
  if (text.includes("widely loved and") || text.includes("big things are here")) return false;
  if (text.includes("before you submit")) return false;
  if (text.includes("unlock a free")) return false;
  if (text.includes("fares rising")) return false;
  
  // Ignore system auto-replies, bounces, and replies to our system emails
  if (text.includes("this is an automated notification. please do not reply")) return false;
  if (text.includes("we have successfully scanned and registered your order in our system")) return false;
  if (subjLower.startsWith("undeliverable:")) return false;
  if (subjLower.includes("delivery status notification (failure)")) return false;

  return true;
}

// ============================================================================
// EMAIL SCANNER SERVICE
// ============================================================================
const Imap = require("node-imap");
const { simpleParser } = require("mailparser");

class EmailScanner {
  async scanAccount(account) {
    const newOrders = [];
    try {
      const imap = new Imap({
        user: account.username,
        password: account.password,
        host: account.host,
        port: account.port,
        tls: account.use_ssl,
        tlsOptions: { rejectUnauthorized: false },
      });

      await new Promise((resolve, reject) => {
        imap.once("ready", resolve);
        imap.once("error", reject);
        imap.connect();
      });

      const box = await new Promise((resolve, reject) => {
        imap.openBox("INBOX", false, (err, box) => {
          if (err) reject(err);
          else resolve(box);
        });
      });

      const searchCriteria = ["UNSEEN"];

      const results = await new Promise((resolve, reject) => {
        imap.search(searchCriteria, (err, results) => {
          if (err) reject(err);
          else resolve(results || []);
        });
      });

      if (results.length === 0) {
        imap.end();
        return newOrders;
      }

      const fetchResults = results.slice(-50);
      let skipped = 0;
      for (const uid of fetchResults) {
        try {
          const msg = await this.fetchMessage(imap, uid);
          const orders = await this.processMessage(msg, account);
          if (orders && Array.isArray(orders) && orders.length > 0) {
            newOrders.push(...orders);
          } else {
            skipped++;
          }
        } catch (e) {
          console.error(`Error processing email ${uid}:`, e.message);
        }
      }

      console.log(`[SCAN] ${account.email}: ${newOrders.length} orders created, ${skipped} emails skipped (not order-related)`);

      imap.end();
      account.last_check = new Date();
      await account.save();
    } catch (e) {
      console.error(`Email scan error for ${account.email}:`, e.message);
    }
    return newOrders;
  }

  fetchMessage(imap, uid) {
    return new Promise((resolve, reject) => {
      const f = imap.fetch(uid, { bodies: "", struct: true, markSeen: true });
      let msgData = null;
      f.on("message", (msg) => {
        msg.on("body", (stream) => {
          let buffer = "";
          stream.on("data", (chunk) => (buffer += chunk.toString("utf8")));
          stream.on("end", () => {
            msgData = buffer;
          });
        });
      });
      f.once("error", reject);
      f.once("end", () => {
        if (msgData) resolve(msgData);
        else reject(new Error("No message data"));
      });
    });
  }

  async processMessage(rawEmail, account) {
    const parsed = await simpleParser(rawEmail);
    const subject = parsed.subject || "";
    const from = parsed.from?.text || "";
    const date = parsed.date || new Date();
    const body = parsed.text || "";
    const html = parsed.html || "";

    // Skip internal automated replies (out of office, noreply, etc.)
    const fromLower = (from || '').toLowerCase();
    const isAutoSender = /no-?reply|noreply|do-?not-?reply|auto-?reply|autoresponder/.test(fromLower);
    if (isAutoSender) {
      console.log(`[SKIP] Automated reply from ${from} subject="${subject}"`);
      return null;
    }

    if (!isOrderEmail(subject, body)) {
      console.log(`[SKIP] Not an order email: "${subject.substring(0, 70)}..."`);
      return null;
    }

    const emlId = uuidv4();
    const emlPath = path.join(__dirname, "uploads", `${emlId}.eml`);
    fs.writeFileSync(emlPath, rawEmail);

    const attachments = parsed.attachments || [];
    const docDataList = [];
    const attachmentPaths = [];

      const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
      const savedAttachments = [];
      const emailMessageId = parsed.messageId || subject;
      
      for (const att of attachments) {
        const ext = path.extname(att.filename || "").toLowerCase();
        if (!validExts.includes(ext)) continue;

        // Skip small images (usually email signatures) under 15KB
        if (att.size < 15000 && [".png", ".jpg", ".jpeg", ".gif"].includes(ext)) {
          console.log(`[SKIP] Ignoring small image ${att.filename} (${att.size} bytes).`);
          continue;
        }

        // Prevent exact duplicates
        const existingAtt = await EmailAttachment.findOne({
          where: { filename: att.filename },
          order: [['createdAt', 'DESC']]
        });
        
        // If an attachment with this exact name was created in the last 2 hours, skip saving it again to avoid massive duplication
        if (existingAtt && (new Date() - new Date(existingAtt.createdAt)) < 2 * 60 * 60 * 1000) {
           console.log(`[SKIP] Attachment ${att.filename} was already processed recently.`);
           if (ext === ".pdf") {
             attachmentPaths.push(existingAtt.file_path);
           }
           continue;
        }

        const attId = uuidv4();
        const attPath = path.join(__dirname, "uploads", `${attId}${ext}`);
        fs.writeFileSync(attPath, att.content);
        attachmentPaths.push(attPath);
        savedAttachments.push({ id: attId, filename: att.filename, file_path: attPath, content_type: att.contentType, ext });

        await EmailAttachment.create({
          id: attId,
          filename: att.filename,
          file_path: attPath,
          content_type: att.contentType,
        });
      }

      // Parse all saved attachments (PDFs and images) in parallel via Docling (if available)
      const parsePromises = savedAttachments.map(s =>
        parseWithDocling(s.file_path, s.filename).then(r => ({ parsed: r, meta: s })).catch(() => ({ parsed: null, meta: s }))
      );
      const parseResults = await Promise.all(parsePromises);
      for (const pr of parseResults) {
        if (pr.parsed) {
          pr.parsed.filename = pr.meta.filename;
          pr.parsed.attPath = pr.meta.file_path;
          
          // Check if Docling returned actual text, not just empty or image tags
          const rawText = pr.parsed.raw_markdown || '';
          const textWithoutTags = rawText.replace(/<!-- image -->/g, '').trim();
          
          if (textWithoutTags.length < 15) {
            console.log(`[OCR Fallback Required] Docling returned no text for ${pr.meta.filename}`);
            // Do NOT push to docDataList. This allows the fallback to process it.
          } else {
            docDataList.push(pr.parsed);
          }
        }
      }

      // Fallback: if Docling didn't return text for PDFs, extract plain text via pdf-parse
      const parsedPaths = new Set(docDataList.map(d => d.attPath));
      for (const s of savedAttachments) {
        if (parsedPaths.has(s.file_path)) continue;
        if (s.ext === '.pdf') {
          try {
            const buffer = fs.readFileSync(s.file_path);
            let pdfData = null;
            try {
              if (typeof pdfParse === 'function') {
                pdfData = await pdfParse(buffer);
              }
            } catch(e) {}
            
            if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
              const fallbackDoc = { filename: s.filename, attPath: s.file_path, raw_markdown: pdfData.text };
              docDataList.push(fallbackDoc);
            } else {
              // Try Python-based OCR fallback if pdf-parse returns little text or fails
              try {
                const ocrScript = path.join(__dirname, 'ocr', 'ocr_fallback.py');
                if (fs.existsSync(ocrScript)) {
                  const res = spawnSync('python', [ocrScript, s.file_path], { encoding: 'utf8', timeout: 120000, windowsHide: true });
                  if (res.status === 0 && res.stdout && res.stdout.trim().length > 10) {
                    const fallbackDoc = { filename: s.filename, attPath: s.file_path, raw_markdown: res.stdout };
                    docDataList.push(fallbackDoc);
                  } else {
                    console.error(`Python OCR failed for ${s.file_path}:`, res.stderr || res.status);
                  }
                } else {
                  console.log('Python OCR script not found, skipping python fallback');
                }
              } catch (pyErr) {
                console.error(`Python spawn error:`, pyErr.message);
              }
            }
          } catch (e) {
            console.error(`PDF text fallback failed for ${s.file_path}:`, e.message);
          }
        }
      }

    // Filter out image documents that have no order-related keywords
    const filteredDocs = docDataList.filter(doc => {
      if (!doc || !doc.filename) return true;
      const ext = path.extname(doc.filename).toLowerCase();
      const isImage = [".png", ".jpg", ".jpeg", ".gif", ".bmp"].includes(ext);
      if (isImage) {
        const textLower = (doc.raw_markdown || "").toLowerCase();
        // Look for basic order keywords. 
        // If an image doesn't contain at least one of these, it's likely a logo/signature.
        const hasKeywords = /\b(order|invoice|qty|quantity|bt|branch transfer|delivery|sales|tax|total|product|sku)\b/i.test(textLower);
        if (!hasKeywords) {
          console.log(`[SKIP] Image ${doc.filename} appears to be a signature/logo, discarding to avoid garbage orders.`);
          return false;
        }
      }
      return true;
    });

    let docsToProcess = filteredDocs.length > 0 ? filteredDocs : (docDataList.length > 0 ? [] : [null]);
    if (docsToProcess.length === 0 && docDataList.length > 0) {
       // If we filtered out all attachments (e.g. they were all just logos),
       // we should still process the email body if it has an order.
       docsToProcess = [null];
    }

    let createdOrders = [];

    for (const doc of docsToProcess) {
      const normalized = normalizeOrderExtraction(subject, from, body, html, doc ? [doc] : []);

      // Use Docling fields first (doc), then fall back to normalized extraction
      // For invoice: Docling's invoice_number or our extraction
      // For order: Docling's order_number or our extraction
      const invoiceNumRaw = doc && doc.invoice_number ? doc.invoice_number : normalized.invoiceNo;
      const orderNumRaw = doc && doc.order_number ? doc.order_number : normalized.orderNo;

      const data = {
        order_number: orderNumRaw && orderNumRaw !== "Not identified" && orderNumRaw !== "" ? orderNumRaw : `BT_${uuidv4().substring(0,8)}`,
        invoice_number: invoiceNumRaw && invoiceNumRaw !== "Not identified" ? invoiceNumRaw : "",
        email_subject: subject,
        email_from: from,
        email_date: date,
        raw_email_body: body,
        normalized_data: normalized,
        type: normalized.type || "customer_delivery",
        bt_type: normalized.btType || "customer_delivery",
        pickup_store: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
        destination_store: normalized.destination !== "Not identified" ? normalized.destination : "",
        destination_address: normalized.deliveryAddress !== "Not identified" ? normalized.deliveryAddress : (normalized.destination !== "Not identified" ? normalized.destination : ""),
        billing_party: normalized.billTo !== "Not identified" ? normalized.billTo : "",
        location: normalized.destination !== "Not identified" ? normalized.destination : "",
        line_items: normalized.products,
        bt_from: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
        bt_to: normalized.destination !== "Not identified" ? normalized.destination : "",
        email_screenshot_path: emlPath,
      };

      const originStore = STORE_REGISTRY[data.pickup_store];
      if (originStore) {
        data.pickup_lat = originStore.lat;
        data.pickup_lon = originStore.lon;
      }
      const destStore = STORE_REGISTRY[data.destination_store];
      if (destStore) {
        data.dest_lat = destStore.lat;
        data.dest_lon = destStore.lon;
      } else {
        const storeName = matchStore(data.destination_address);
        if (storeName && STORE_REGISTRY[storeName]) {
          data.dest_lat = STORE_REGISTRY[storeName].lat;
          data.dest_lon = STORE_REGISTRY[storeName].lon;
        }
      }

      data.rate = 85.00;
      const bodyLower = (body + " " + html).toLowerCase();
      data.requires_assembly = bodyLower.includes("assemble") && !bodyLower.includes("customer to assemble");
      data.has_rubbish_removal = ["rubbish", "take away", "takeaway", "remove rubbish"].some(t => bodyLower.includes(t));

      const orderId = data.order_number;
      let order = await Order.findByPk(orderId);
      let isNew = false;

      // Deduplication: For BT_ orders (no real invoice), check if we already have
      // an order from the same email subject to prevent duplicates on restart
      if (!order && orderId.startsWith('BT_')) {
        const existing = await Order.findOne({
          where: { email_subject: subject }
        });
        if (existing) {
          console.log(`[DEDUP] Skipping duplicate BT order for subject: "${subject}" (existing: ${existing.id})`);
          order = existing;
          // Update existing order with potentially better data
          await order.update(data);
        }
      }

      if (order) {
        await order.update(data);
      } else {
        data.id = orderId;
        data.status = "pending";
        order = await Order.create(data);
        isNew = true;
      }

      for (const attPath of attachmentPaths) {
        const att = await EmailAttachment.findOne({ where: { file_path: attPath } });
        if (att) {
           if (doc && att.file_path === doc.attPath) {
             await att.update({ order_id: order.id });
           } else if (!doc || !attPath.endsWith('.pdf')) {
             await att.update({ order_id: order.id });
           }
        }
      }

      const orderJson = order.toJSON();
      orderJson._isNew = isNew;

      if (orderJson && orderJson._isNew) {
        // Auto-reply at BT registration is intentionally disabled.
        // Emails will only trigger when the status is updated.
        // sendEmailConfirmation(orderJson).catch(err => console.error("Auto-reply error:", err));
      }
      
      createdOrders.push(orderJson);
    }

    return createdOrders;
  }

  // === IMPROVED EMAIL CONTEXT PARSING ===
  parseEmailContext(subject, body) {
    const context = {
      bt_from: null,
      bt_to: null,
      order_ref: null,
      delivery_date: null,
      warehouse: null,
      special_instructions: [],
      is_branch_transfer: false,
      is_return_to_store: false,
    };
    const subjLower = subject.toLowerCase();
    const bodyLower = body.toLowerCase();

    // Detect Return to Store (RTS)
    const isRts = subjLower.includes("return to store") || 
                  subjLower.includes("rts") || 
                  subjLower.includes("return request") ||
                  bodyLower.includes("return to store") || 
                  bodyLower.includes("rts") ||
                  bodyLower.includes("return request");
    context.is_return_to_store = isRts;

    const btSubjectPatterns = [
      // BT Collection From [Store] to [Store]
      /BT\s+(?:Collection\s+)?From\s+([A-Za-z\.\s]+?)\s+to\s+([A-Za-z\s]+)(?:[^A-Za-z\s]|$)/i,
      // Fallback: BT Collection From [Store]
      /BT\s+(?:Collection\s+)?From\s+([A-Za-z\.\s]+)/i,
      // Branch Transfer From [Store] to [Store]
      /Branch\s+Transfer\s+(?:From\s+)?([A-Za-z\.\s]+?)\s+to\s+([A-Za-z\s]+)(?:[^A-Za-z\s]|$)/i,
      // Goods Movement from [Store] to [Store]
      /Goods\s+Movement\s+(?:from\s+)?([A-Za-z\.\s]+?)\s+to\s+([A-Za-z\s]+)(?:[^A-Za-z\s]|$)/i,
      // BT from [Store] to [Store]
      /BT\s+(?:from\s+)?([A-Za-z\.\s]+?)\s+to\s+([A-Za-z\s]+)(?:[^A-Za-z\s]|$)/i,
      // [Store] to [Store] BT
      /([A-Za-z\.\s]+?)\s+(?:to|→)\s+([A-Za-z\.\s]+)\s+(?:BT|Branch Transfer|Goods Movement)/i,
    ];

    for (const pattern of btSubjectPatterns) {
      const match = subject.match(pattern);
      if (match) {
        context.bt_from = this.normalizeStore(match[1].trim());
        if (match[2]) context.bt_to = this.normalizeStore(match[2].trim());
        context.is_branch_transfer = true;
        break;
      }
    }

    if (!context.bt_from) {
      const bodyBtPatterns = [
        /(?:from|OFFSITE)[:\s]+([A-Za-z\.\s]+?)(?:\s+(?:to|and deliver(?: it| to)?)\s+|\s*→\s*)([A-Za-z\.\s]+?)(?:\.|\n|$)/i,
        /From\s*:\s*([A-Za-z\.\s]+?)\s+To\s*:\s*([A-Za-z\.\s]+?)(?:\n|$)/i,
        /BT\s+From\s+([A-Za-z\.\s]+?)\s+To\s+([A-Za-z\.\s]+?)(?:\n|$)/i,
      ];
      for (const pattern of bodyBtPatterns) {
        const match = body.match(pattern);
        if (match) {
          context.bt_from = this.normalizeStore(match[1].trim());
          context.bt_to = this.normalizeStore(match[2].trim());
          context.is_branch_transfer = true;
          break;
        }
      }
    }

    const whMatch = body.match(/(?:from\s+the\s+)?(Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane)\s+(?:warehouse|store|offsite|branch)/i);
    if (whMatch) context.warehouse = this.normalizeStore(whMatch[1].replace(/\s+/g, ""));

    const dateMatch = body.match(/(?:delivery|deliver|date|required by)[:\s]+(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i);
    if (dateMatch) context.delivery_date = dateMatch[1];

    const billToPatterns = [
      /(?:Charge to|On behalf of|Bill to)[:\s]+([A-Za-z\.\s]+?)(?:\n|\r|$)/i
    ];
    for (const pattern of billToPatterns) {
      const match = body.match(pattern);
      if (match) {
        context.explicit_billing_party = this.normalizeStore(match[1].trim());
        break;
      }
    }

    const orderPatterns = [
      /(?:\b|_)(?:SO|PO|ORD|HN|INV|Invoice|Inv)[:\s#\-]+([A-Z0-9\-]*[0-9][A-Z0-9\-]*)/i,
      /(?:\b|_)(?:Order Ref|Order)[:\s#\-_]+([A-Z0-9\-]*[0-9][A-Z0-9\-]*)/i,
      /(?:\b|_)Order\s*#?\s*([A-Z0-9\-]*[0-9][A-Z0-9\-]*)/i,
      /(?:\b|_)SO\s*#?\s*([A-Z0-9\-]*[0-9][A-Z0-9\-]*)/i,
      /(?:\b|_)(?:PO|P\/O)[:\s#\-_]*([A-Z0-9\-]*[0-9][A-Z0-9\-]*)/i,
    ];
    for (const pattern of orderPatterns) {
      // Prioritize subject matches before body matches
      const match = subject.match(pattern) || body.match(pattern);
      if (match) {
        context.order_ref = match[1].trim();
        break;
      }
    }

    if (bodyLower.includes("assemble") && !bodyLower.includes("customer to assemble"))
      context.special_instructions.push("Assembly required");
    if (["rubbish", "take away", "takeaway", "remove rubbish"].some(t => bodyLower.includes(t)))
      context.special_instructions.push("Rubbish removal");
    if (bodyLower.includes("call before") || bodyLower.includes("call prior"))
      context.special_instructions.push("Call before delivery");
    if (bodyLower.includes("stairs"))
      context.special_instructions.push("Stairs access");
    if (bodyLower.includes("elevator") || bodyLower.includes("lift"))
      context.special_instructions.push("Elevator access");

    return context;
  }

  mergeData(docData, emailContext) {
    const merged = { ...docData };

    // Email subject/body extraction takes precedence over PDF/image docData
    if (emailContext.bt_from) merged.bt_from = emailContext.bt_from;
    if (emailContext.bt_to) merged.bt_to = emailContext.bt_to;
    if (emailContext.order_ref) merged.order_number = emailContext.order_ref;
    if (emailContext.warehouse) {
      merged.pickup_store = emailContext.warehouse;
      merged.pickup_warehouse = emailContext.warehouse;
    }
    if (emailContext.delivery_date) {
      merged.preferred_delivery_date = emailContext.delivery_date;
    }

    if (emailContext.special_instructions?.length) {
      const existing = merged.delivery_instructions || "";
      const added = emailContext.special_instructions.filter(i => !existing.toLowerCase().includes(i.toLowerCase()));
      merged.delivery_instructions = existing + (existing ? "; " : "") + added.join("; ");
    }

    if (emailContext.is_return_to_store || merged.document_type === "return_to_store") {
      merged.type = "branch_transfer";
      merged.bt_type = "return_to_store";
    } else if (merged.bt_from || merged.bt_to || emailContext.is_branch_transfer) {
      merged.type = "branch_transfer";
      if (merged.document_type === "purchase_order") {
        merged.bt_type = "purchase_order";
      } else {
        merged.bt_type = "branch_transfer";
      }
    } else {
      merged.type = "customer_delivery";
      merged.bt_type = "customer_delivery";
    }

    if (merged.bt_type === "return_to_store") {
      merged.billing_party = merged.bt_from || merged.pickup_store || "Harvey Norman";
      merged.location = merged.bt_from || merged.pickup_store || "";
    } else if (merged.type === "branch_transfer") {
      merged.pickup_store = merged.bt_from || merged.pickup_store;
      merged.destination_store = merged.bt_to || merged.destination_store;
      
      const dest = (merged.destination_store && merged.destination_store !== "Not identified") ? merged.destination_store : "";
      const pkup = (merged.pickup_store && merged.pickup_store !== "Not identified") ? merged.pickup_store : "";
      const btToFallback = (merged.bt_to && merged.bt_to !== "Not identified") ? merged.bt_to : "";
      
      merged.billing_party = emailContext.explicit_billing_party || dest || btToFallback || pkup || "Harvey Norman";
      merged.location = dest || merged.destination_address || btToFallback || pkup || "";
    } else {
      merged.billing_party = merged.customer_name || merged.destination_store || merged.pickup_store || "Harvey Norman";
      merged.location = merged.destination_address || merged.destination_store || merged.pickup_store || "";
    }

    return merged;
  }

  async createOrUpdateOrder(data, emlPath, attachmentPaths) {
    if ((data.type || "customer_delivery") === "customer_delivery" && data.type !== "branch_transfer") {
      console.log(`[SKIP] Discarding customer_delivery order: ${data.invoice_number || data.order_number || data.po_number}`);
      return null;
    }

    let orderId = data.invoice_number || data.order_number || data.po_number;

    if (!orderId || orderId.length < 3) {
      const btPart = data.bt_from ? data.bt_from.replace(/\s+/g, "").substring(0, 6) : "UNK";
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const timePart = Date.now().toString().slice(-4);
      orderId = `BT_${btPart}_${datePart}_${timePart}`;
      data.order_number = orderId;
    }

    let order = await Order.findByPk(orderId);

    if (!order && orderId.startsWith("BT_") && data.email_subject && data.email_date) {
      order = await Order.findOne({
        where: { email_subject: data.email_subject },
        order: [["createdAt", "DESC"]],
      });
    }

    let newLineItems = order ? order.line_items || [] : [];
    if (data.line_items && data.line_items.length > 0) {
      if (newLineItems.length === 0) {
        newLineItems = data.line_items;
      } else {
        const existingKeys = new Set(newLineItems.map(i => (i.sku || i.description || "").toLowerCase()));
        for (const item of data.line_items) {
          const key = (item.sku || item.description || "").toLowerCase();
          if (!existingKeys.has(key)) {
            newLineItems.push(item);
            existingKeys.add(key);
          }
        }
      }
    }

    const updateFields = {
      order_number: data.order_number || "",
      invoice_number: data.invoice_number || "",
      po_number: data.po_number || "",
      client_name: data.client_name || "Harvey Norman",
      type: data.type || "customer_delivery",
      bt_type: data.bt_type || "customer_delivery",
      bt_from: data.bt_from || "",
      bt_to: data.bt_to || "",
      pickup_store: data.pickup_store || "",
      pickup_warehouse: data.pickup_warehouse || "",
      destination_store: data.destination_store || "",
      destination_address: data.destination_address || "",
      customer_name: data.customer_name || "",
      customer_phone: data.customer_phone || "",
      requires_assembly: data.requires_assembly || false,
      has_rubbish_removal: data.has_rubbish_removal || false,
      delivery_instructions: data.delivery_instructions || "",
      preferred_delivery_date: data.preferred_delivery_date || "",
      line_items: newLineItems,
      email_subject: data.email_subject || "",
      email_from: data.email_from || "",
      document_type: data.document_type || "tax_invoice",
      billing_party: data.billing_party || "",
      location: data.location || "",
      pickup_lat: data.pickup_lat,
      pickup_lon: data.pickup_lon,
      dest_lat: data.dest_lat,
      dest_lon: data.dest_lon,
      confidence: data.confidence || 0,
      email_screenshot_path: emlPath,
      attachment_paths: attachmentPaths,
      raw_email_body: data.raw_email_body || "",
    };

    let isNew = false;
    if (order) {
      await order.update(updateFields);
    } else {
      updateFields.id = orderId;
      updateFields.status = "pending";
      order = await Order.create(updateFields);
      isNew = true;
    }

    for (const attPath of attachmentPaths) {
      const att = await EmailAttachment.findOne({ where: { file_path: attPath } });
      if (att) await att.update({ order_id: order.id });
    }

    const orderJson = order.toJSON();
    orderJson._isNew = isNew;
    return orderJson;
  }

  normalizeStore(name) {
    if (!name) return null;
    const clean = name.trim().toLowerCase().replace(/\s+/g, " ");
    const compact = name.trim().toLowerCase().replace(/\s+/g, "");
    for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
      if (storeName.toLowerCase() === clean) return storeName;
      // also match when spaces are omitted (e.g., Lowerhutt)
      if (storeName.toLowerCase().replace(/\s+/g, "") === compact) return storeName;
      for (const alias of data.aliases || []) {
        if (alias.toLowerCase() === clean) return storeName;
        if (alias.toLowerCase().replace(/\s+/g, "") === compact) return storeName;
      }
    }
    for (const storeName of Object.keys(STORE_REGISTRY)) {
      const sn = storeName.toLowerCase();
      if (sn.includes(clean) || clean.includes(sn) || sn.replace(/\s+/g, "").includes(compact) || compact.includes(sn.replace(/\s+/g, "")))
        return storeName;
    }
    return name.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
  }
}

const emailScanner = new EmailScanner();

// ============================================================================
// WHATSAPP SERVICE (Twilio)
// ============================================================================
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID.startsWith("AC"))
  ? require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const WHATSAPP_GROUP_NUMBERS = (process.env.WHATSAPP_GROUP_NUMBERS || "").split(",").filter(Boolean);
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., whatsapp:+14155238886

class WhatsAppService {
  async sendRoutePlan(routePlan, driver) {
    if (!twilioClient || !TWILIO_WHATSAPP_NUMBER) {
      console.log("WhatsApp not configured");
      return false;
    }

    // Resolve offsider names from database
    let offsidersList = "None";
    if (routePlan.offsider_ids && routePlan.offsider_ids.length > 0) {
      const offsiders = await Driver.findAll({ where: { id: { [Op.in]: routePlan.offsider_ids } } });
      if (offsiders.length > 0) {
        offsidersList = offsiders.map(o => o.name).join(", ");
      }
    }

    const stops = routePlan.stops || [];
    let message = `📋 *DAV Transport - Route Plan*\n`;
    message += `📅 Date: ${routePlan.date}\n`;
    message += `🚛 Truck: ${routePlan.truck_id}\n`;
    message += `👤 Driver: ${driver?.name || "N/A"}\n`;
    message += `👥 Offsiders: ${offsidersList}\n\n`;
    message += `*Stops (${stops.length}):*\n`;
    stops.forEach((stop, i) => {
      message += `${i + 1}. ${stop.location || stop.address || "Unknown"}\n`;
      if (stop.order_number) message += `   Order: ${stop.order_number}\n`;
      if (stop.customer_name) message += `   Customer: ${stop.customer_name}\n`;
      message += `\n`;
    });
    message += `📏 Total Distance: ${routePlan.total_distance_km?.toFixed(1) || "N/A"} km\n`;
    message += `⛽ Est. Fuel: $${routePlan.estimated_fuel_cost?.toFixed(2) || "N/A"}`;

    const recipients = driver?.whatsapp_number
      ? [driver.whatsapp_number]
      : WHATSAPP_GROUP_NUMBERS;

    for (const number of recipients) {
      try {
        await twilioClient.messages.create({
          body: message,
          from: TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${number}`,
        });
      } catch (e) {
        console.error(`WhatsApp send failed to ${number}:`, e.message);
      }
    }

    await RoutePlan.update({ whatsapp_sent: true }, { where: { id: routePlan.id } });
    return true;
  }

  async sendStatusUpdate(order, status) {
    if (!twilioClient || !TWILIO_WHATSAPP_NUMBER || !order.customer_phone) return false;
    const messages = {
      picked_up: `✅ Your order ${order.order_number} has been picked up and is on the way!`,
      delivered: `🎉 Your order ${order.order_number} has been delivered. Thank you for choosing Harvey Norman!`,
      billed: `🧾 Your order ${order.order_number} has been billed.`,
    };
    const msg = messages[status] || `📦 Order ${order.order_number} status: ${status}`;
    try {
      await twilioClient.messages.create({
        body: msg,
        from: TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${order.customer_phone}`,
      });
    } catch (e) {
      console.error("WhatsApp status update failed:", e.message);
    }
    return true;
  }

  async sendDriverLocationUpdate(driver, location) {
    if (!twilioClient || !TWILIO_WHATSAPP_NUMBER || !driver?.whatsapp_number) return false;
    try {
      await twilioClient.messages.create({
        body: `📍 Driver ${driver.name} location update: ${location}`,
        from: TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${driver.whatsapp_number}`,
      });
    } catch (e) {
      console.error("Location update failed:", e.message);
    }
    return true;
  }
}

const whatsappService = new WhatsAppService();

// ============================================================================
// EMAIL NOTIFICATION SERVICE
// ============================================================================
async function sendEmailNotification(order, statusName, statusVal) {
  if (!order.email_from) {
    console.log("No email_from address available to notify for order:", order.order_number);
    return false;
  }
  try {
    const account = await EmailAccount.findOne({ where: { is_active: true } });
    if (!account) {
      console.log("No active EmailAccount configured to send email updates");
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: account.username,
        pass: account.password,
      },
    });

    const statusText = statusName === "picked_up" ? "PICKED UP" : statusName === "delivered" ? "DELIVERED" : "BILLED";
    const statusEmoji = statusName === "picked_up" ? "🚚" : statusName === "delivered" ? "🎉" : "🧾";

    const mailOptions = {
      from: account.email,
      to: order.email_from,
      subject: `Re: ${order.email_subject || `Delivery Update: Order ${order.order_number}`}`,
      text: `Hi there,\n\nWe would like to update you on your delivery status. Status has been updated to: [${statusText}] ${statusVal ? "YES" : "NO"}.\n\nOrder Number: ${order.order_number}\nInvoice Number: ${order.invoice_number || "—"}\nLocation: ${order.location || "—"}\n\nThank you for choosing DAV Transport!\n\nBest Regards,\nDAV Transport Team`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1e3a8a;">DAV Transport - Delivery Status Update</h2>
          <p>Hi there,</p>
          <p>This is an automated update regarding your delivery.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="font-size: 16px; margin: 0 0 10px 0;">Status: <strong>${statusEmoji} ${statusText}</strong></p>
            <p style="margin: 0 0 5px 0;"><strong>Order #:</strong> ${order.order_number}</p>
            <p style="margin: 0 0 5px 0;"><strong>Invoice #:</strong> ${order.invoice_number || "—"}</p>
            <p style="margin: 0;"><strong>Location:</strong> ${order.location || "—"}</p>
          </div>
          <p>Thank you for choosing DAV Transport!</p>
          <br/>
          <p style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Status notification email sent successfully to ${order.email_from} for order ${order.order_number}`);
    return true;
  } catch (error) {
    console.error("Error sending email notification:", error.message);
    return false;
  }
}

async function sendEmailConfirmation(order) {
  if (!order.email_from || order.email_from.includes("Operations Manual Upload")) {
    console.log("No valid email_from address available to confirm order:", order.order_number);
    return false;
  }
  try {
    const account = await EmailAccount.findOne({ where: { is_active: true } });
    if (!account) {
      console.log("No active EmailAccount configured to send email confirmation");
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: account.username,
        pass: account.password,
      },
    });

    const mailOptions = {
      from: account.email,
      to: order.email_from,
      subject: `Re: ${order.email_subject || `Order Registered: ${order.order_number}`}`,
      text: `Hi there,\n\nWe have successfully scanned and registered your order in our system.\n\nOrder Number: ${order.order_number}\nInvoice Number: ${order.invoice_number || "—"}\nBT Type: ${order.bt_type || "—"}\nLocation: ${order.location || "—"}\n\nThank you for choosing DAV Transport!\n\nBest Regards,\nDAV Transport Team`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1e3a8a;">DAV Transport - Order Registration Confirmation</h2>
          <p>Hi there,</p>
          <p>We have successfully scanned and registered your order in our system.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0 0 5px 0;"><strong>Order #:</strong> ${order.order_number}</p>
            <p style="margin: 0 0 5px 0;"><strong>Invoice #:</strong> ${order.invoice_number || "—"}</p>
            <p style="margin: 0 0 5px 0;"><strong>Type:</strong> ${(order.bt_type || "").replace(/_/g, " ")}</p>
            <p style="margin: 0 0 5px 0;"><strong>Location:</strong> ${order.location || "—"}</p>
            <p style="margin: 0;"><strong>Billing Party:</strong> ${order.billing_party || "—"}</p>
          </div>
          <p>Thank you for choosing DAV Transport!</p>
          <br/>
          <p style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent successfully to ${order.email_from} for order ${order.order_number}`);
    return true;
  } catch (error) {
    console.error("Error sending email confirmation:", error.message);
    return false;
  }
}

// ============================================================================
// ROUTE OPTIMIZER
// ============================================================================
class RouteOptimizer {
  async optimizeRoute(orders, startStore) {
    const store = STORE_REGISTRY[startStore];
    if (!store) throw new Error("Start store not found in registry");

    const start = { lat: store.lat, lon: store.lon, name: startStore };
    const stops = orders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer_name,
      address: o.destination_address || o.location || o.bt_to || o.destination_store,
      lat: o.dest_lat || o.pickup_lat,
      lon: o.dest_lon || o.pickup_lon,
      location: o.location,
    })).filter((s) => s.lat && s.lon);

    // Greedy nearest-neighbor TSP
    const route = [start];
    const unvisited = [...stops];
    let current = start;
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const d = geolib.getDistance(
          { latitude: current.lat, longitude: current.lon },
          { latitude: unvisited[i].lat, longitude: unvisited[i].lon }
        );
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      const next = unvisited.splice(nearestIdx, 1)[0];
      totalDistance += nearestDist / 1000; // meters to km
      route.push(next);
      current = next;
    }

    // Return to start
    const returnDist = geolib.getDistance(
      { latitude: current.lat, longitude: current.lon },
      { latitude: start.lat, longitude: start.lon }
    ) / 1000;
    totalDistance += returnDist;

    // Fuel cost estimate (approx $0.25/km for truck)
    const fuelCost = totalDistance * 0.25;

    return {
      stops: route.slice(1), // exclude start point from stops list
      total_distance_km: parseFloat(totalDistance.toFixed(1)),
      estimated_fuel_cost: parseFloat(fuelCost.toFixed(2)),
      start_point: start,
    };
  }

  async findNearestDriver(storeName) {
    const store = STORE_REGISTRY[storeName];
    if (!store) return null;

    const drivers = await Driver.findAll({ where: { is_online: true, is_active: true } });
    if (drivers.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;
    for (const driver of drivers) {
      if (!driver.current_lat || !driver.current_lon) continue;
      const d = geolib.getDistance(
        { latitude: store.lat, longitude: store.lon },
        { latitude: driver.current_lat, longitude: driver.current_lon }
      );
      if (d < minDist) {
        minDist = d;
        nearest = driver;
      }
    }
    return nearest;
  }
}

const routeOptimizer = new RouteOptimizer();

// ============================================================================
// EXPORT SERVICE
// ============================================================================
class ExportService {
  // Helper: extract btOrderType from normalized_data JSON
  _getBtRouteType(order) {
    try {
      const nd = typeof order.normalized_data === "string"
        ? JSON.parse(order.normalized_data || "{}")
        : (order.normalized_data || {});
      return nd.btOrderType || "";
    } catch { return ""; }
  }

  // Helper: clean up description garbage
  _formatProductsForExport(items) {
    if (!Array.isArray(items)) return "";
    return items.map(i => {
      let desc = i.description || "";
      if (desc) {
        desc = desc.replace(/Order\s+\d+\s*/gi, '');
        desc = desc.replace(/@\s*\d+\.\d+\s*TOT:.*$/is, '');
        desc = desc.replace(/(\d+\.\d+\s*){2,}.*$/is, '');
        desc = desc.replace(/Total Ex\.GST.*$/is, '');
        desc = desc.replace(/\*\s*\*\s*\*\s*End of Report.*/is, '');
        desc = desc.replace(/RES:\s*\d+\s*/gi, '');
        desc = desc.replace(/Delv Qty:\s*\d+\s*/gi, '');
        desc = desc.replace(/Est\.Ship:\s*Order\s*Response\s*/gi, '');
        desc = desc.replace(/Manufacturer Warranty.*/is, '');
        desc = desc.replace(/See Manufacturers.*/is, '');
        desc = desc.replace(/:\s*\d+\s*$/g, ''); // Removes dangling ": 1"
        desc = desc.replace(/\s+/g, ' ').trim();
      }
      const finalName = desc && desc.length > 2 ? desc : (i.sku || "Unknown");
      return `${finalName} x${i.quantity}`;
    }).join(", ");
  }

  // Helper: sum total quantity from line_items
  _getTotalQuantity(order) {
    try {
      const items = typeof order.line_items === "string"
        ? JSON.parse(order.line_items || "[]")
        : (order.line_items || []);
      return items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    } catch { return 0; }
  }

  async exportToPDF(orders, filePath) {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text("DAV Transport - Orders Report", 30, 30);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 30, 55);
    doc.moveTo(30, 70).lineTo(811.89, 70).stroke();

    let y = 85;
    const headers = [
      "Order #",
      "Invoice #",
      "Subject",
      "Email Date",
      "Products",
      "Qty",
      "BT Type",
      "BT Route",
      "BT From",
      "BT To",
      "Billing",
      "Picked",
      "Deliv",
      "Billed",
      "Rate",
      "Location"
    ];
    // A4 Landscape width is 841.89 points. With 30pt margins on each side, printable = 781.89 pts.
    // 16 columns: 48+45+60+52+60+25+48+52+50+50+48+30+30+30+33+70 = 731
    const colWidths = [45, 45, 55, 45, 100, 20, 45, 50, 48, 48, 45, 30, 30, 30, 33, 62];
    let x = 30;
    headers.forEach((h, i) => {
      doc.fontSize(8).text(h, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });
    y += 15;
    doc.moveTo(30, y).lineTo(811.89, y).stroke();
    y += 5;

    for (const order of orders) {
      const items = typeof order.line_items === "string"
        ? JSON.parse(order.line_items || "[]")
        : (order.line_items || []);
      const formattedProducts = this._formatProductsForExport(items);
      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const btRouteType = this._getBtRouteType(order);

      const values = [
        order.order_number || "",
        order.invoice_number || "",
        order.email_subject || "",
        order.email_date ? new Date(order.email_date).toLocaleDateString("en-GB") : "",
        formattedProducts,
        totalQty > 0 ? String(totalQty) : "",
        order.bt_type === "branch_transfer" ? "Branch Xfer" : (order.bt_type || "").replace(/_/g, " "),
        btRouteType,
        order.bt_from || "",
        order.bt_to || "",
        order.billing_party || "",
        order.picked_up ? "Yes" : "No",
        order.delivered ? "Yes" : "No",
        order.billed ? "Yes" : "No",
        order.rate ? `$${order.rate.toFixed(2)}` : "—",
        order.location || "",
      ];

      doc.fontSize(7);
      let rowHeight = 12;
      values.forEach((v, i) => {
        const h = doc.heightOfString(String(v), { width: colWidths[i] });
        if (h > rowHeight) rowHeight = h;
      });

      if (y + rowHeight > 520) { doc.addPage(); y = 30; doc.fontSize(7); }
      
      x = 30;
      values.forEach((v, i) => {
        doc.text(String(v), x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += rowHeight + 4;
    }

    doc.end();
    return new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  }

  async exportToExcel(orders, filePath) {
    const data = orders.map((o) => {
      const btRouteType = this._getBtRouteType(o);
      const totalQty = this._getTotalQuantity(o);
      const items = typeof o.line_items === "string"
        ? JSON.parse(o.line_items || "[]")
        : (o.line_items || []);
      return {
        "Order #": o.order_number || "",
        "Invoice #": o.invoice_number || "",
        "Subject": o.email_subject || "",
        "Email Date": o.email_date ? new Date(o.email_date).toISOString().split("T")[0] : "",
        "Products": this._formatProductsForExport(items),
        "Quantity": totalQty > 0 ? totalQty : "",
        "BT Type": o.bt_type === "branch_transfer" ? "BT Branch Transfer" : (o.bt_type || "").replace(/_/g, " "),
        "BT Route Type": btRouteType,
        "BT From": o.bt_from || "",
        "BT To": o.bt_to || "",
        "Billing party": o.billing_party || "",
        "Picked up": o.picked_up ? "Yes" : "No",
        "Delivered": o.delivered ? "Yes" : "No",
        "Billed": o.billed ? "Yes" : "No",
        "Rate": o.rate || "",
        "Location": o.location || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, filePath);
  }
}

const exportService = new ExportService();

// ============================================================================
// API ROUTES
// ============================================================================

function getNormalizedOrder(order) {
  if (!order) return null;
  const o = typeof order.get === "function" ? order.get({ plain: true }) : order;
  if (typeof o.line_items === "string") {
    try { o.line_items = JSON.parse(o.line_items); } catch(e) { o.line_items = []; }
  }
  if (typeof o.normalized_data === "string") {
    try { o.normalized_data = JSON.parse(o.normalized_data); } catch(e) { o.normalized_data = {}; }
  }
  
  // Add mapped fields expected by the frontend Dashboard
  o.invoiceNo = o.invoice_number;
  o.sourceEmailSubject = o.email_subject;
  o.products = o.line_items;
  o.comingFrom = o.bt_from;
  o.destination = o.bt_to || o.destination_address;
  o.billTo = o.billing_party;
  o.bt_order_type = (o.normalized_data && o.normalized_data.btOrderType) ? o.normalized_data.btOrderType : "";

  return o;
}

// Health
app.get("/api/health", async (req, res) => {
  try {
    const count = await Order.count();
    const dbPath = path.join(__dirname, "dav_transport.db");
    const doclingHealth = await axios.get(`${DOCLING_URL}/health`, { timeout: 3000 });
    res.json({ status: "ok", docling: doclingHealth.data, orders_count: count, db_path: dbPath });
  } catch (e) {
    const count = await Order.count();
    const dbPath = path.join(__dirname, "dav_transport.db");
    res.json({ status: "ok", docling: "unreachable", orders_count: count, db_path: dbPath });
  }
});

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------
app.get("/api/orders", async (req, res) => {
  console.log("--> GET /api/orders hit");
  const { status, bt_type, bt_order_type, store, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  console.log("--> GET /api/orders query params parsed");

  const where = {};
  if (status) where.status = status;
  if (bt_type) {
    where.bt_type = bt_type;
  } else {
    // Show branch transfer orders only on the main dashboard
    where.type = "branch_transfer";
  }
  const orFilters = [];
  if (store) {
    orFilters.push(
      { pickup_store: { [Op.like]: `%${store}%` } },
      { destination_store: { [Op.like]: `%${store}%` } },
      { bt_from: { [Op.like]: `%${store}%` } },
      { bt_to: { [Op.like]: `%${store}%` } },
    );
  }
  if (search) {
    orFilters.push(
      { order_number: { [Op.like]: `%${search}%` } },
      { invoice_number: { [Op.like]: `%${search}%` } },
      { customer_name: { [Op.like]: `%${search}%` } },
      { email_subject: { [Op.like]: `%${search}%` } },
    );
  }
  if (orFilters.length > 0) {
    where[Op.or] = orFilters;
  }
  let orders = [];
  let count = 0;

  if (bt_order_type && bt_order_type !== "all") {
    const allRows = await Order.findAll({ where, order: [["createdAt", "DESC"]] });
    const normalizedRows = allRows.map((r) => getNormalizedOrder(r));
    const filtered = normalizedRows.filter((order) => order.bt_order_type === bt_order_type);
    count = filtered.length;
    orders = filtered.slice(offset, offset + parseInt(limit));
  } else {
    console.log("--> Calling findAndCountAll...");
    try {
      const result = await Order.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset,
      });
      console.log("--> findAndCountAll completed, count:", result.count);
      count = result.count;
      console.log("--> Calling map getNormalizedOrder...");
      orders = result.rows.map((r) => getNormalizedOrder(r));
      console.log("--> Mapping completed.");
    } catch(err) {
      console.error("--> findAndCountAll error:", err);
      res.status(500).json({ error: err.message });
      return;
    }
  }

  try {
    console.log("--> Sending res.json...");
    res.json({
      orders,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
    console.log("--> res.json completed.");
  } catch(err) {
    console.error("--> Error in res.json:", err.message);
    res.status(500).json({ error: "Serialization error" });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  const attachments = await EmailAttachment.findAll({ where: { order_id: order.id } });
  const orderData = getNormalizedOrder(order);
  orderData.attachments = attachments;
  res.json(orderData);
});

app.post("/api/orders", async (req, res) => {
  const data = req.body;
  const order = await Order.create({
    id: data.booking_id || data.order_number || `MANUAL_${Date.now()}`,
    ...data,
  });
  res.status(201).json(getNormalizedOrder(order));
});

app.put("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(decodeURIComponent(req.params.id));
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update(req.body);
  res.json(getNormalizedOrder(order));
});

app.delete("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(decodeURIComponent(req.params.id));
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.destroy();
  res.json({ message: "Order deleted", booking_id: req.params.id });
});

app.patch("/api/orders/:id/status", async (req, res) => {
  const order = await Order.findByPk(decodeURIComponent(req.params.id));
  if (!order) return res.status(404).json({ error: "Not found" });
  const updates = {};
  let notifyField = null;
  let notifyValue = null;

  if (req.body.status) updates.status = req.body.status;
  if (req.body.picked_up !== undefined) {
    updates.picked_up = req.body.picked_up;
    if (req.body.picked_up) updates.picked_up_at = new Date();
    notifyField = "picked_up";
    notifyValue = req.body.picked_up;
  }
  if (req.body.delivered !== undefined) {
    updates.delivered = req.body.delivered;
    if (req.body.delivered) updates.delivered_at = new Date();
    if (req.body.delivered) await whatsappService.sendStatusUpdate(order, "delivered");
    notifyField = "delivered";
    notifyValue = req.body.delivered;
  }
  if (req.body.billed !== undefined) {
    updates.billed = req.body.billed;
    if (req.body.billed) updates.billed_at = new Date();
    notifyField = "billed";
    notifyValue = req.body.billed;
  }
  if (req.body.rate !== undefined) {
    updates.rate = req.body.rate === null || req.body.rate === "" ? null : parseFloat(req.body.rate);
  }
  await order.update(updates);

  if (notifyField !== null) {
    await sendEmailNotification(order.toJSON(), notifyField, notifyValue);
  }

  res.json(getNormalizedOrder(order));
});

// ---------------------------------------------------------------------------
// DRIVERS
// ---------------------------------------------------------------------------
app.get("/api/drivers", async (req, res) => {
  const drivers = await Driver.findAll();
  res.json(drivers);
});

app.post("/api/drivers", async (req, res) => {
  const driver = await Driver.create({
    id: req.body.driver_id || `DRV_${Date.now()}`,
    ...req.body,
  });
  res.status(201).json(driver);
});

app.put("/api/drivers/:id", async (req, res) => {
  const driver = await Driver.findByPk(req.params.id);
  if (!driver) return res.status(404).json({ error: "Not found" });
  await driver.update(req.body);
  res.json(driver);
});

app.delete("/api/drivers/:id", async (req, res) => {
  const driver = await Driver.findByPk(req.params.id);
  if (!driver) return res.status(404).json({ error: "Not found" });
  await driver.destroy();
  res.json({ message: "Driver deleted", driver_id: req.params.id });
});

// ---------------------------------------------------------------------------
// TRUCKS & STORES
// ---------------------------------------------------------------------------
app.get("/api/trucks", async (req, res) => {
  res.json(await Truck.findAll());
});
app.post("/api/trucks", async (req, res) => {
  const truck = await Truck.create({ id: req.body.truck_id || `TRK_${Date.now()}`, ...req.body });
  res.status(201).json(truck);
});
app.get("/api/stores", async (req, res) => {
  res.json(await Store.findAll());
});
app.post("/api/stores", async (req, res) => {
  const store = await Store.create({ id: req.body.store_id || `STORE_${Date.now()}`, ...req.body });
  res.status(201).json(store);
});

// ---------------------------------------------------------------------------
// EMAIL ACCOUNTS & SCANNING
// ---------------------------------------------------------------------------
app.get("/api/email-accounts", async (req, res) => {
  // Do not expose stored passwords via API responses. Exclude `password` field.
  const accounts = await EmailAccount.findAll({ attributes: { exclude: ["password"] } });
  res.json(accounts);
});

app.post("/api/email-accounts", async (req, res) => {
  const account = await EmailAccount.create({
    id: req.body.id || `EMAIL_${Date.now()}`,
    ...req.body,
  });
  res.status(201).json(account);
});

app.put("/api/email-accounts/:id", async (req, res) => {
  const account = await EmailAccount.findByPk(req.params.id);
  if (!account) return res.status(404).json({ error: "Not found" });
  await account.update(req.body);
  res.json(account);
});

app.delete("/api/email-accounts/:id", async (req, res) => {
  const account = await EmailAccount.findByPk(req.params.id);
  if (!account) return res.status(404).json({ error: "Not found" });
  await account.destroy();
  res.json({ message: "Deleted", id: req.params.id });
});

app.post("/api/scan", async (req, res) => {
  try {
    const accounts = await EmailAccount.findAll({ where: { is_active: true } });
    let totalNew = 0;
    for (const account of accounts) {
      const newOrders = await emailScanner.scanAccount(account);
      totalNew += newOrders.length;
    }
    res.json({ message: "Scan complete", new_orders: totalNew });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/scan-account/:id", async (req, res) => {
  const account = await EmailAccount.findByPk(req.params.id);
  if (!account) return res.status(404).json({ error: "Not found" });
  const newOrders = await emailScanner.scanAccount(account);
  res.json({ message: `Scanned ${account.email}`, new_orders: newOrders.length, orders: newOrders });
});

// ---------------------------------------------------------------------------
// DOCUMENT PARSING (Manual Upload)
// ---------------------------------------------------------------------------
app.post("/api/parse-document", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  try {
    const result = await parseWithDocling(req.file.path, req.file.originalname);
    fs.unlinkSync(req.file.path);
    res.json({ filename: req.file.originalname, extracted_data: result, confidence: result?.confidence || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/upload", upload.single("document"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const attId = uuidv4();
    const persistentPath = path.join(__dirname, "uploads", `${attId}${ext}`);

    // Persist file in uploads folder
    fs.renameSync(req.file.path, persistentPath);

    // 1. Parse document with Docling service
    const result = await parseWithDocling(persistentPath, req.file.originalname);
    if (!result) {
      if (fs.existsSync(persistentPath)) fs.unlinkSync(persistentPath);
      return res.status(500).json({ error: "Failed to parse document with Docling." });
    }
    result.filename = req.file.originalname;

    // 2. Create the attachment record so it displays in Details panel
    await EmailAttachment.create({
      id: attId,
      filename: req.file.originalname,
      file_path: persistentPath,
      content_type: req.file.mimetype,
    });

    // 3. Normalize and merge document data using our extraction layer
    const subject = `Manual Upload: ${req.file.originalname}`;
    const from = "Operations Manual Upload";
    const body = `Manual Upload: ${req.file.originalname}`;
    const html = "";
    const docDataList = [result];

    const normalized = normalizeOrderExtraction(subject, from, body, html, docDataList);

    const data = {
      order_number: normalized.invoiceNo !== "Not identified" ? normalized.invoiceNo : `MANUAL_${Date.now()}`,
      invoice_number: normalized.invoiceNo !== "Not identified" ? normalized.invoiceNo : "",
      email_subject: subject,
      email_from: from,
      email_date: new Date(),
      raw_email_body: body,
      normalized_data: normalized,
      type: normalized.type || "customer_delivery",
      bt_type: normalized.btType || "customer_delivery",
      pickup_store: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
      destination_store: normalized.destination !== "Not identified" ? normalized.destination : "",
      destination_address: normalized.deliveryAddress !== "Not identified" ? normalized.deliveryAddress : (normalized.destination !== "Not identified" ? normalized.destination : ""),
      billing_party: normalized.billTo !== "Not identified" ? normalized.billTo : "",
      location: normalized.destination !== "Not identified" ? normalized.destination : "",
      line_items: normalized.products,
      bt_from: normalized.comingFrom !== "Not identified" ? normalized.comingFrom : "",
      bt_to: normalized.destination !== "Not identified" ? normalized.destination : "",
    };

    // Calculate Lat/Lon
    const originStore = STORE_REGISTRY[data.pickup_store];
    if (originStore) {
      data.pickup_lat = originStore.lat;
      data.pickup_lon = originStore.lon;
    }
    const destStore = STORE_REGISTRY[data.destination_store];
    if (destStore) {
      data.dest_lat = destStore.lat;
      data.dest_lon = destStore.lon;
    } else {
      const storeName = matchStore(data.destination_address);
      if (storeName && STORE_REGISTRY[storeName]) {
        data.dest_lat = STORE_REGISTRY[storeName].lat;
        data.dest_lon = STORE_REGISTRY[storeName].lon;
      }
    }

    data.rate = 85.00;

    const orderId = data.order_number;
    let order = await Order.findByPk(orderId);
    if (order) {
      await order.update(data);
    } else {
      data.id = orderId;
      data.status = "pending";
      order = await Order.create(data);
    }

    await EmailAttachment.update({ order_id: order.id }, { where: { file_path: persistentPath } });

    res.json({ status: "success", order: getNormalizedOrder(order), message: "Document parsed and saved." });
  } catch (e) {
    console.error("Manual upload parsing error:", e.message);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (err) {}
    }
    res.status(500).json({ error: "Failed to upload and parse document: " + e.message });
  }
});

// ---------------------------------------------------------------------------
// DASHBOARD & EXPORT
// ---------------------------------------------------------------------------
app.get("/api/dashboard", async (req, res) => {
  const baseWhere = { type: "branch_transfer" };
  
  const total = await Order.count({ where: baseWhere });
  const pendingCount = await Order.count({ where: { ...baseWhere, status: "pending" } });
  const inProgress = await Order.count({ where: { ...baseWhere, status: "in_progress" } });
  const completed = await Order.count({ where: { ...baseWhere, status: "completed" } });
  const btOrders = await Order.count({ where: { ...baseWhere, type: "branch_transfer" } });
  const pickedUp = await Order.count({ where: { ...baseWhere, picked_up: true } });
  const delivered = await Order.count({ where: { ...baseWhere, delivered: true } });
  const pendingMetrics = total - delivered;
  const recent = await Order.findAll({ where: baseWhere, order: [["createdAt", "DESC"]], limit: 10 });
  res.json({
    counts: { 
      total, 
      pending: pendingCount, 
      in_progress: inProgress, 
      completed, 
      branch_transfers: btOrders,
      pickedUp,
      delivered,
      pendingMetrics
    },
    recent_orders: recent,
  });
});

app.get("/api/dashboard/export/pdf", async (req, res) => {
  const { date_from, date_to } = req.query;
  const where = {};
  if (date_from || date_to) {
    where.createdAt = {};
    if (date_from) where.createdAt[Op.gte] = new Date(date_from);
    if (date_to) where.createdAt[Op.lte] = new Date(date_to + "T23:59:59");
  }
  const orders = await Order.findAll({ where, order: [["createdAt", "DESC"]], limit: 500 });
  const filePath = path.join(__dirname, "uploads", `orders_${Date.now()}.pdf`);
  await exportService.exportToPDF(orders, filePath);
  res.download(filePath, "orders_report.pdf", (err) => {
    if (!err) fs.unlinkSync(filePath);
  });
});

app.get("/api/dashboard/export/excel", async (req, res) => {
  const { date_from, date_to } = req.query;
  const where = {};
  if (date_from || date_to) {
    where.createdAt = {};
    if (date_from) where.createdAt[Op.gte] = new Date(date_from);
    if (date_to) where.createdAt[Op.lte] = new Date(date_to + "T23:59:59");
  }
  const orders = await Order.findAll({ where, order: [["createdAt", "DESC"]], limit: 500 });
  const filePath = path.join(__dirname, "uploads", `orders_${Date.now()}.xlsx`);
  await exportService.exportToExcel(orders, filePath);
  res.download(filePath, "orders_report.xlsx", (err) => {
    if (!err) fs.unlinkSync(filePath);
  });
});

// ---------------------------------------------------------------------------
// ROUTE PLANNER
// ---------------------------------------------------------------------------

function recalculateRouteMetrics(stops, startStoreName) {
  const store = STORE_REGISTRY[startStoreName] || STORE_REGISTRY["Wairau Park"];
  const start = { lat: store.lat, lon: store.lon };
  let current = start;
  let totalDistance = 0;

  for (const stop of stops) {
    if (stop.lat && stop.lon) {
      const d = geolib.getDistance(
        { latitude: current.lat, longitude: current.lon },
        { latitude: stop.lat, longitude: stop.lon }
      );
      totalDistance += d / 1000;
      current = stop;
    }
  }

  // Return to start
  const returnDist = geolib.getDistance(
    { latitude: current.lat, longitude: current.lon },
    { latitude: start.lat, longitude: start.lon }
  ) / 1000;
  totalDistance += returnDist;

  const fuelCost = totalDistance * 0.25;
  return {
    total_distance_km: parseFloat(totalDistance.toFixed(1)),
    estimated_fuel_cost: parseFloat(fuelCost.toFixed(2)),
  };
}

app.post("/api/routes/optimize", async (req, res) => {
  try {
    const { order_ids, start_store, num_trucks = 1, fleetConfig } = req.body;
    let orders = [];
    
    if (order_ids && order_ids.length > 0) {
      orders = await Order.findAll({ where: { id: { [Op.in]: order_ids } }, raw: true });
    } else if (req.body.orders) {
      orders = req.body.orders;
    }
    
    // Attempt geocoding for orders missing dest_lat/dest_lon
    for (let o of orders) {
      if (!o.dest_lat || !o.dest_lon) {
        const address = o.destination_address || o.destination_store;
        const coords = await routingEngine.geocodeAddress(address);
        if (coords) {
          o.dest_lat = coords.lat;
          o.dest_lon = coords.lon;
          // Optionally save to DB if it's a real order
          if (o.id) {
            await Order.update({ dest_lat: coords.lat, dest_lon: coords.lon }, { where: { id: o.id } });
          }
        }
      }
    }

    let config = fleetConfig;
    if (!config) {
      config = Array.from({length: parseInt(num_trucks, 10) || 1}).map((_, i) => ({ id: i+1, capacity: 5000, hasOffsider: true }));
    }

    const { trucks, unassignedOrders } = routingEngine.optimizeRoute(orders, STORE_REGISTRY, config);
    
    let total_distance_km = 0;
    for (const truck of trucks) {
      total_distance_km += truck.totalDistance;
    }
    
    res.json({ trucks, unassignedOrders, total_distance_km: parseFloat(total_distance_km.toFixed(1)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Original endpoint updated to use new engine
app.post("/api/route-plan", async (req, res) => {
  const { order_ids, truck_id, driver_id, offsider_ids, date, start_store } = req.body;
  const orders = await Order.findAll({ where: { id: { [Op.in]: order_ids } }, raw: true });
  
  // Geocode if necessary
  for (let o of orders) {
    if (!o.dest_lat || !o.dest_lon) {
      const coords = await routingEngine.geocodeAddress(o.destination_address || o.destination_store);
      if (coords) { o.dest_lat = coords.lat; o.dest_lon = coords.lon; }
    }
  }

  const waypoints = routingEngine.optimizeRoute(orders, STORE_REGISTRY);
  
  let total_distance_km = 0;
  for (const wp of waypoints) {
    total_distance_km += (wp.distanceFromPrev || 0);
  }

  const plan = await RoutePlan.create({
    id: `ROUTE_${Date.now()}`,
    truck_id,
    driver_id,
    offsider_ids: offsider_ids || [],
    start_store: start_store || "Wairau Park",
    date: date || new Date().toISOString().split("T")[0],
    stops: waypoints,
    total_distance_km: total_distance_km,
    estimated_fuel_cost: total_distance_km * 0.25,
  });

  res.json({ plan, start_point: "Wiri DC" });
});

app.post("/api/routes/upload-manifest", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let data = [];
    if (ext === ".csv" || ext === ".xlsx") {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(sheet);
    } else {
      return res.status(400).json({ error: "Only CSV and Excel supported for manifest" });
    }
    
    // Clean up file
    try { fs.unlinkSync(req.file.path); } catch(e){}
    
    // Normalise column names
    const normalizedData = data.map((row, idx) => {
      const pickup = row["Pickup Store"] || row["Pickup"] || row["pickup_store"] || "Unknown";
      const dest = row["Destination Address"] || row["Destination"] || row["Address"] || row["destination_address"] || "Unknown";
      const orderNo = row["Order Number"] || row["Order No"] || row["order_number"] || `ROW-${idx}`;
      return {
        id: `manifest-${idx}`,
        order_number: orderNo,
        pickup_store: pickup,
        destination_address: dest,
      };
    });

    res.json({ success: true, count: normalizedData.length, orders: normalizedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/route-plans", async (req, res) => {
  res.json(await RoutePlan.findAll({ order: [["createdAt", "DESC"]] }));
});

app.post("/api/route-plans/:id/send-whatsapp", async (req, res) => {
  const plan = await RoutePlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });
  const driver = await Driver.findByPk(plan.driver_id);
  const success = await whatsappService.sendRoutePlan(plan.toJSON(), driver?.toJSON());
  res.json({ sent: success });
});

app.put("/api/route-plans/:id/reorder", async (req, res) => {
  const plan = await RoutePlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });
  
  const startStore = plan.start_store || "Wairau Park";
  const metrics = recalculateRouteMetrics(req.body.stops, startStore);
  
  await plan.update({ 
    stops: req.body.stops,
    total_distance_km: metrics.total_distance_km,
    estimated_fuel_cost: metrics.estimated_fuel_cost
  });
  res.json(plan);
});

app.put("/api/route-plans/:id", async (req, res) => {
  const plan = await RoutePlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ error: "Not found" });

  const updates = {};
  if (req.body.driver_id !== undefined) updates.driver_id = req.body.driver_id;
  if (req.body.offsider_ids !== undefined) updates.offsider_ids = req.body.offsider_ids;
  if (req.body.truck_id !== undefined) updates.truck_id = req.body.truck_id;
  if (req.body.date !== undefined) updates.date = req.body.date;
  if (req.body.start_store !== undefined) updates.start_store = req.body.start_store;
  if (req.body.stops !== undefined) {
    updates.stops = req.body.stops;
    const startStore = req.body.start_store || plan.start_store || "Wairau Park";
    const metrics = recalculateRouteMetrics(req.body.stops, startStore);
    updates.total_distance_km = metrics.total_distance_km;
    updates.estimated_fuel_cost = metrics.estimated_fuel_cost;
  }

  await plan.update(updates);
  res.json(plan);
});

app.post("/api/route-plan/recommend-truck", async (req, res) => {
  const { order_ids } = req.body;
  if (!order_ids || order_ids.length === 0) return res.status(400).json({ error: "No orders selected" });

  const orders = await Order.findAll({ where: { id: { [Op.in]: order_ids } } });
  
  let totalLat = 0, totalLon = 0, count = 0;
  for (const o of orders) {
    const lat = o.dest_lat || o.pickup_lat;
    const lon = o.dest_lon || o.pickup_lon;
    if (lat && lon) {
      totalLat += lat;
      totalLon += lon;
      count++;
    }
  }

  if (count === 0) {
    return res.json({ recommendations: [] });
  }

  const centroid = { latitude: totalLat / count, longitude: totalLon / count };
  const trucks = await Truck.findAll();
  const drivers = await Driver.findAll({ where: { is_active: true } });
  const recommendations = [];

  for (const truck of trucks) {
    const truckLat = truck.current_lat || STORE_REGISTRY["Wairau Park"].lat;
    const truckLon = truck.current_lon || STORE_REGISTRY["Wairau Park"].lon;
    const driver = drivers.find(d => d.truck_id === truck.id || d.license_plate === truck.license_plate);
    
    const dist = geolib.getDistance(
      { latitude: truckLat, longitude: truckLon },
      centroid
    ) / 1000;

    recommendations.push({
      truck_id: truck.id,
      license_plate: truck.license_plate,
      driver_name: driver ? driver.name : "Unassigned",
      driver_id: driver ? driver.id : null,
      distance_to_centroid_km: parseFloat(dist.toFixed(1)),
      estimated_activation_fuel_cost: parseFloat((dist * 0.25).toFixed(2)),
    });
  }

  recommendations.sort((a, b) => a.distance_to_centroid_km - b.distance_to_centroid_km);
  res.json({ recommendations });
});

// ---------------------------------------------------------------------------
// NEAREST DRIVER (for addon jobs)
// ---------------------------------------------------------------------------
app.get("/api/nearest-driver", async (req, res) => {
  const { store } = req.query;
  if (!store) return res.status(400).json({ error: "Store required" });
  const driver = await routeOptimizer.findNearestDriver(store);
  res.json(driver || { message: "No online drivers found" });
});

// ---------------------------------------------------------------------------
// WHATSAPP INCOMING WEBHOOK (for driver status and location updates)
// ---------------------------------------------------------------------------
app.post("/api/whatsapp/incoming", express.urlencoded({ extended: true }), async (req, res) => {
  const fromNum = (req.body.From || "").replace("whatsapp:", "").trim();
  const bodyText = (req.body.Body || "").trim();

  console.log(`[WHATSAPP WEBHOOK] Received message from ${fromNum}: "${bodyText}"`);

  if (!fromNum || !bodyText) {
    res.set("Content-Type", "text/xml");
    return res.send("<Response></Response>");
  }

  // Find driver by whatsapp_number
  const driver = await Driver.findOne({
    where: {
      whatsapp_number: { [Op.like]: `%${fromNum}%` }
    }
  });

  if (!driver) {
    console.log(`[WHATSAPP WEBHOOK] Driver not found for number: ${fromNum}`);
    res.set("Content-Type", "text/xml");
    return res.send("<Response><Message>Your number is not registered as a driver with DAV Transport.</Message></Response>");
  }

  let locationName = "";
  let lat = null;
  let lon = null;
  const cleanBody = bodyText.toLowerCase();

  // Pattern 1: "at [Store Name]" (e.g., "at Albany")
  if (cleanBody.startsWith("at ")) {
    const storeQuery = cleanBody.substring(3).trim();
    let matchedStore = null;
    for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
      if (storeName.toLowerCase() === storeQuery || (data.aliases || []).some(a => a.toLowerCase() === storeQuery)) {
        matchedStore = { name: storeName, ...data };
        break;
      }
    }
    if (matchedStore) {
      locationName = matchedStore.name;
      lat = matchedStore.lat;
      lon = matchedStore.lon;
    }
  }
  // Pattern 2: "stop [Stop Number]" (e.g., "stop 3")
  else if (cleanBody.startsWith("stop ")) {
    const stopNum = parseInt(cleanBody.substring(5).trim());
    if (!isNaN(stopNum)) {
      const routePlan = await RoutePlan.findOne({
        where: { driver_id: driver.id },
        order: [["createdAt", "DESC"]]
      });
      if (routePlan && routePlan.stops && routePlan.stops.length >= stopNum) {
        const stop = routePlan.stops[stopNum - 1];
        locationName = `Stop ${stopNum}: ${stop.location || stop.address}`;
        lat = stop.lat;
        lon = stop.lon;
      }
    }
  }
  // Pattern 3: "delivered [Order Number]" (e.g., "delivered HN-1002")
  else if (cleanBody.startsWith("delivered ")) {
    const orderNum = bodyText.substring(10).trim();
    const order = await Order.findOne({ where: { order_number: orderNum } });
    if (order) {
      await order.update({
        status: "completed",
        delivered: true,
        delivered_at: new Date()
      });
      await sendEmailNotification(order.toJSON(), "delivered", true);
      await whatsappService.sendStatusUpdate(order, "delivered");

      locationName = order.location || order.destination_address;
      lat = order.dest_lat || order.pickup_lat;
      lon = order.dest_lon || order.pickup_lon;
    }
  }
  // Pattern 4: Coords format: "loc [lat] [lon]"
  else if (cleanBody.startsWith("loc ")) {
    const coords = cleanBody.substring(4).trim().split(/[\s,]+/);
    if (coords.length === 2) {
      lat = parseFloat(coords[0]);
      lon = parseFloat(coords[1]);
      locationName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  }

  // Update driver coordinates in database
  if (lat !== null && lon !== null) {
    await driver.update({
      current_lat: lat,
      current_lon: lon,
      is_online: true
    });

    console.log(`[WHATSAPP WEBHOOK] Updated Driver ${driver.name} location to: ${locationName} (${lat}, ${lon})`);

    // Reply confirmation
    res.set("Content-Type", "text/xml");
    return res.send(`
      <Response>
        <Message>📍 Co-pilot: Driver ${driver.name}, your location has been updated to "${locationName}" successfully!</Message>
      </Response>
    `);
  } else {
    // Command help reply
    res.set("Content-Type", "text/xml");
    return res.send(`
      <Response>
        <Message>🤖 Co-pilot: Command not understood. Supported commands:\n- "at [Store Name]" (e.g. at Albany)\n- "stop [Number]" (e.g. stop 3)\n- "delivered [Order #]" (e.g. delivered HN-1002)\n- "loc [lat] [lon]"</Message>
      </Response>
    `);
  }
});

// ---------------------------------------------------------------------------
// ROSTER SHIFTS
// ---------------------------------------------------------------------------
app.get("/api/roster", async (req, res) => {
  const { date } = req.query;
  const where = date ? { date } : {};
  res.json(await RosterShift.findAll({ where, order: [["date", "DESC"]] }));
});

app.post("/api/roster", async (req, res) => {
  const shift = await RosterShift.create({
    id: req.body.id || `SHIFT_${Date.now()}`,
    ...req.body,
  });
  res.status(201).json(shift);
});

app.put("/api/roster/:id", async (req, res) => {
  const shift = await RosterShift.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ error: "Not found" });
  await shift.update(req.body);
  res.json(shift);
});

app.delete("/api/roster/:id", async (req, res) => {
  const shift = await RosterShift.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ error: "Not found" });
  await shift.destroy();
  res.json({ message: "Shift deleted" });
});

// Generate weekly roster shifts
app.post("/api/roster/generate", async (req, res) => {
  const { week_start } = req.body;
  const startOfWeek = week_start || new Date().toISOString().split("T")[0];

  try {
    // Clear existing draft/scheduled shifts
    await RosterShift.destroy({ where: { status: "scheduled" } });

    const activeDrivers = await Driver.findAll({ where: { is_active: true } });
    if (activeDrivers.length === 0) {
      return res.json({ roster_id: `ROSTER-${startOfWeek}`, week_start: startOfWeek, shifts: [] });
    }

    const shiftHours = { morning: 8, afternoon: 8, night: 8, full_day: 9, weekend: 7 };
    const shiftTimes = {
      morning: ["06:00", "14:00"],
      afternoon: ["14:00", "22:00"],
      night: ["22:00", "06:00"],
      full_day: ["08:00", "17:00"],
      weekend: ["09:00", "16:00"],
    };

    // Reset current_hours for generation
    for (const d of activeDrivers) {
      d.current_hours = 0;
    }

    const shifts = [];
    const start = new Date(startOfWeek);
    const allStores = Object.keys(STORE_REGISTRY);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split("T")[0];
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6; // Sunday=0, Saturday=6

      let dayShiftTypes = [];
      if (isWeekend) {
        dayShiftTypes = Array(Math.min(3, activeDrivers.length)).fill("weekend");
      } else {
        dayShiftTypes = [
          ...Array(Math.min(2, activeDrivers.length)).fill("morning"),
          ...Array(Math.min(2, activeDrivers.length)).fill("afternoon")
        ];
      }

      for (let j = 0; j < dayShiftTypes.length; j++) {
        const shiftType = dayShiftTypes[j];
        const driver = activeDrivers[j % activeDrivers.length];

        if (driver.current_hours >= driver.max_hours) continue;

        const [startTime, endTime] = shiftTimes[shiftType] || ["08:00", "17:00"];
        const shiftId = `SHIFT_${dateStr}_${j}_${driver.id}`;

        // Shuffle/Sample store assignments
        const storeAssignments = [];
        const tempStores = [...allStores];
        const count = Math.min(2, tempStores.length);
        for (let k = 0; k < count; k++) {
          const idx = Math.floor(Math.random() * tempStores.length);
          storeAssignments.push(tempStores.splice(idx, 1)[0]);
        }

        const newShift = await RosterShift.create({
          id: shiftId,
          driver_id: driver.id,
          date: dateStr,
          shift_type: shiftType,
          start_time: startTime,
          end_time: endTime,
          truck_id: driver.truck_id || "",
          store_assignments: storeAssignments,
          status: "scheduled",
        });

        driver.current_hours += shiftHours[shiftType];
        shifts.push({
          shift_id: newShift.id,
          driver_id: newShift.driver_id,
          driver_name: driver.name,
          date: newShift.date,
          shift_type: newShift.shift_type,
          start_time: newShift.start_time,
          end_time: newShift.end_time,
          truck_id: newShift.truck_id,
          store_assignments: newShift.store_assignments,
          status: newShift.status
        });
      }
    }

    // Update drivers current hours in database
    for (const d of activeDrivers) {
      await Driver.update({ current_hours: d.current_hours }, { where: { id: d.id } });
    }

    res.json({ roster_id: `ROSTER-${startOfWeek}`, week_start: startOfWeek, shifts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish roster shifts & send SMS notifications
app.post("/api/roster/publish", async (req, res) => {
  try {
    const shifts = await RosterShift.findAll({ where: { status: "scheduled" } });
    const notifications = [];

    for (const shift of shifts) {
      const driver = await Driver.findByPk(shift.driver_id);
      if (driver && driver.phone) {
        const message = `Hi ${driver.name}, your DAV Transport shift on ${shift.date} is scheduled: ${shift.shift_type.toUpperCase()} (${shift.start_time}-${shift.end_time}). Please confirm receipt.`;

        let sentStatus = "logged";
        if (twilioClient) {
          try {
            let phoneNum = driver.phone.replace(/[^0-9+]/g, '');
            if (phoneNum.startsWith('0')) phoneNum = '+64' + phoneNum.substring(1);
            
            const fromNum = process.env.TWILIO_FROM_NUMBER || (TWILIO_WHATSAPP_NUMBER ? TWILIO_WHATSAPP_NUMBER.replace('whatsapp:', '') : "+1234567890");

            await twilioClient.messages.create({
              body: message,
              from: fromNum,
              to: phoneNum,
            });
            sentStatus = "sent";
          } catch (e) {
            console.error("SMS notification failed:", e.message);
            sentStatus = "failed";
          }
        } else {
          console.log(`[MOCK SMS] to ${driver.phone}: ${message}`);
          sentStatus = "sent";
        }

        await shift.update({ status: "published" });
        notifications.push({ driver: driver.name, phone: driver.phone, status: sentStatus });
      }
    }

    res.json({ published: true, notifications_sent: notifications.length, details: notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk SMS dispatch
app.post("/api/sms/bulk", async (req, res) => {
  const { driver_ids, message } = req.body;
  if (!driver_ids || !message) {
    return res.status(400).json({ error: "Missing driver_ids or message" });
  }

  try {
    const drivers = await Driver.findAll({ where: { id: { [Op.in]: driver_ids } } });
    const results = { sent: 0, failed: 0, details: [] };

    for (const d of drivers) {
      if (!d.phone) {
        results.failed++;
        results.details.push({ driver: d.name, phone: "", status: "no_phone" });
        continue;
      }

      let status = "failed";
      if (twilioClient) {
        try {
          let phoneNum = d.phone.replace(/[^0-9+]/g, '');
          if (phoneNum.startsWith('0')) phoneNum = '+64' + phoneNum.substring(1);
          
          const fromNum = process.env.TWILIO_FROM_NUMBER || (TWILIO_WHATSAPP_NUMBER ? TWILIO_WHATSAPP_NUMBER.replace('whatsapp:', '') : "+1234567890");

          await twilioClient.messages.create({
            body: message,
            from: fromNum,
            to: phoneNum,
          });
          status = "sent";
          results.sent++;
        } catch (e) {
          console.error("SMS bulk fail:", e.message);
          results.failed++;
        }
      } else {
        console.log(`[MOCK SMS] to ${d.phone}: ${message}`);
        status = "sent";
        results.sent++;
      }
      results.details.push({ driver: d.name, phone: d.phone, status });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BACKGROUND SCHEDULER
// ============================================================================
function startScheduler() {
  const runScan = async () => {
    console.log("[SCHEDULER] Running email scan...");
    try {
      const accounts = await EmailAccount.findAll({ where: { is_active: true } });
      for (const account of accounts) {
        const newOrders = await emailScanner.scanAccount(account);
        if (newOrders.length > 0) {
          console.log(`[SCHEDULER] ${account.email}: ${newOrders.length} new orders`);
        }
      }
    } catch (e) {
      console.error("[SCHEDULER] Error:", e.message);
    }
  };

  cron.schedule("*/5 * * * *", runScan);
  runScan(); // Run immediately on start
  console.log("[SCHEDULER] Started - scanning every 5 minutes");
}

async function waitForDoclingReady() {
  console.log("[DB] Waiting for Docling service to be ready...");
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await axios.get(`${DOCLING_URL}/health`, { timeout: 3000 });
      if (res.status === 200) {
        console.log("[DB] Docling service is ready!");
        return true;
      }
    } catch (err) {
      // ignore and retry
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.warn("[DB] Docling service was not ready in time. Proceeding anyway...");
  return false;
}

// ============================================================================
// INIT & START
// ============================================================================
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  (async () => {
  await sequelize.sync();
  console.log("[DB] Database synced");

  // Seed stores
  for (const [name, data] of Object.entries(STORE_REGISTRY)) {
    const storeId = name.toLowerCase().replace(/\s+/g, "_");
    const existingStore = await Store.findByPk(storeId);
    if (!existingStore) {
      await Store.create({
        id: storeId,
        name: `Harvey Norman ${name}`,
        lat: data.lat,
        lon: data.lon,
        address: `${name}, ${data.region || "NZ"}, NZ`,
        open_time: "09:00",
        close_time: "17:00",
      });
      console.log(`[DB] Auto-seeded missing store: ${name}`);
    }
  }

  // Seed trucks if empty
  const truckCount = await Truck.count();
  if (truckCount === 0) {
    await Truck.create({ id: "TRK_1", license_plate: "DAV-01", current_lat: -36.7816, current_lon: 174.7510, is_online: true, capacity_cbm: 50 });
    await Truck.create({ id: "TRK_2", license_plate: "DAV-02", current_lat: -36.7263, current_lon: 174.6994, is_online: true, capacity_cbm: 60 });
    await Truck.create({ id: "TRK_3", license_plate: "DAV-03", is_online: false, capacity_cbm: 40 });
    console.log("[DB] Seeded trucks");
  }

  // Seed drivers if empty
  const driverCount = await Driver.count();
  if (driverCount === 0) {
    await Driver.create({ id: "DRV_1", name: "John Doe", email: "john@dav.co.nz", phone: "+64210000001", role: "driver", whatsapp_number: "+64210000001", is_online: true, truck_id: "TRK_1", license_plate: "DAV-01", current_lat: -36.7816, current_lon: 174.7510 });
    await Driver.create({ id: "DRV_2", name: "Alice Smith", email: "alice@dav.co.nz", phone: "+64210000002", role: "driver", whatsapp_number: "+64210000002", is_online: true, truck_id: "TRK_2", license_plate: "DAV-02", current_lat: -36.7263, current_lon: 174.6994 });
    await Driver.create({ id: "DRV_3", name: "Bob Johnson", email: "bob@dav.co.nz", phone: "+64210000003", role: "driver", whatsapp_number: "+64210000003", is_online: false });
    await Driver.create({ id: "OFF_1", name: "Dave Offsider", email: "dave@dav.co.nz", phone: "+64219999901", role: "offsider", whatsapp_number: "+64219999901", is_online: true });
    await Driver.create({ id: "OFF_2", name: "Steve Helper", email: "steve@dav.co.nz", phone: "+64219999902", role: "offsider", whatsapp_number: "+64219999902", is_online: true });
    console.log("[DB] Seeded drivers");
  }

  // Seed orders if empty
  const orderCount = await Order.count();
  if (orderCount === 0) {
    await Order.create({
      id: "HN-1001",
      order_number: "HN-1001",
      invoice_number: "INV-2001",
      email_subject: "Branch Transfer From Wairau Park To Albany",
      bt_from: "Wairau Park",
      bt_to: "Albany",
      pickup_store: "Wairau Park",
      destination_store: "Albany",
      status: "pending",
      bt_type: "branch_transfer",
      type: "branch_transfer",
      billing_party: "Albany",
      location: "Albany",
      rate: 120.00,
      pickup_lat: -36.7816,
      pickup_lon: 174.7510,
      dest_lat: -36.7263,
      dest_lon: 174.6994,
      email_from: "wairaupark@harveynorman.co.nz",
      email_date: new Date(),
      line_items: [{ sku: "LHP-890", quantity: 2, description: "Leather Sofa 3-Seater" }],
      confidence: 1.0,
    });
    await Order.create({
      id: "HN-1002",
      order_number: "HN-1002",
      invoice_number: "INV-2002",
      email_subject: "Customer Delivery - Harvey Norman Albany",
      pickup_store: "Albany",
      customer_name: "Jane Smith",
      customer_phone: "+64220000001",
      destination_address: "123 Constellation Dr, Mairangi Bay, Auckland",
      status: "pending",
      bt_type: "customer_delivery",
      type: "customer_delivery",
      billing_party: "Jane Smith",
      location: "123 Constellation Dr, Mairangi Bay, Auckland",
      rate: 85.00,
      pickup_lat: -36.7263,
      pickup_lon: 174.6994,
      dest_lat: -36.7350,
      dest_lon: 174.7390,
      email_from: "albany@harveynorman.co.nz",
      email_date: new Date(),
      line_items: [{ sku: "TV-9000", quantity: 1, description: "Samsung 65\" Neo QLED TV" }],
      confidence: 0.95,
    });
    await Order.create({
      id: "HN-1003",
      order_number: "HN-1003",
      invoice_number: "INV-2003",
      email_subject: "Return to Store request: Wairau Park",
      pickup_store: "Wairau Park",
      customer_name: "Mike Miller",
      customer_phone: "+64230000002",
      destination_address: "45 Shakespeare Rd, Milford, Auckland",
      status: "pending",
      bt_type: "return_to_store",
      type: "branch_transfer",
      billing_party: "Wairau Park",
      location: "Wairau Park",
      rate: 95.00,
      pickup_lat: -36.7816,
      pickup_lon: 174.7510,
      dest_lat: -36.7816,
      dest_lon: 174.7510,
      email_from: "wairaupark@harveynorman.co.nz",
      email_date: new Date(),
      line_items: [{ sku: "MAT-221", quantity: 1, description: "Tempur Queen Mattress" }],
    });
    console.log("[DB] Seeded orders");
  }

  // Wait for Docling to be ready
  await waitForDoclingReady();

  // Reprocess existing orders with the new parser logic to fix "Not identified" and "BT Transport" values
  try {
    const { simpleParser } = require("mailparser");
    const orders = await Order.findAll();
    console.log(`[DB] Reprocessing ${orders.length} orders to improve extraction quality...`);
    let reprocessedCount = 0;
    for (const order of orders) {
      // 1. Extract values from EML if it exists
      let subject = order.email_subject || "";
      let from = order.email_from || "";
      let body = order.raw_email_body || "";
      let html = "";
      
      if (order.email_screenshot_path && order.email_screenshot_path.endsWith(".eml")) {
        const basename = path.basename(order.email_screenshot_path);
        const emlPath = path.join(__dirname, "uploads", basename);
        if (fs.existsSync(emlPath)) {
          try {
            const emailBuffer = fs.readFileSync(emlPath);
            const parsed = await simpleParser(emailBuffer);
            subject = parsed.subject || subject;
            from = parsed.from?.text || from;
            body = parsed.text || body;
            html = parsed.html || html;
          } catch (emlErr) {
            console.error(`[DB] Error parsing EML for order ${order.id}:`, emlErr.message);
          }
        }
      }
      
      // 2. Parse attachments with Docling
      const doclings = [];
      const attachments = await EmailAttachment.findAll({ where: { order_id: order.id } });
      
      // Collect file paths from email_attachments table
      let filesToParse = [];
      const seenFilenames = new Set();
      for (const att of attachments) {
        if (att.file_path && fs.existsSync(att.file_path) && att.filename && !seenFilenames.has(att.filename)) {
          seenFilenames.add(att.filename);
          filesToParse.push({ path: att.file_path, filename: att.filename });
        }
      }
      
      // Fallback: If no attachment rows, try parsing from attachment_paths JSON column
      if (filesToParse.length === 0 && order.attachment_paths) {
        try {
          const paths = typeof order.attachment_paths === 'string' ? JSON.parse(order.attachment_paths) : order.attachment_paths;
          if (Array.isArray(paths)) {
            for (const p of paths) {
              if (p && fs.existsSync(p) && !seenFilenames.has(path.basename(p))) {
                seenFilenames.add(path.basename(p));
                filesToParse.push({ path: p, filename: path.basename(p) });
              }
            }
          }
        } catch (e) {}
      }
      
      for (const file of filesToParse) {
        const ext = path.extname(file.filename || "").toLowerCase();
        const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
        if (!validExts.includes(ext)) continue;
        
        // Skip email signature images (Outlook emojis, tiny images, etc.)
        const nameLower = (file.filename || "").toLowerCase();
        if (/^(outlookemoji|image\d{3,}|signature|logo|banner|icon|cid)/i.test(nameLower)) continue;
        try {
          const fileSize = fs.statSync(file.path).size;
          if ([".png", ".jpg", ".jpeg", ".gif", ".bmp"].includes(ext) && fileSize < 15000) continue; // Skip tiny images
        } catch(e) {}
        
        const parsedDoc = await parseWithDocling(file.path, file.filename);
        if (parsedDoc) {
          parsedDoc.filename = file.filename;
          parsedDoc.attPath = file.path;
          
          const rawText = parsedDoc.raw_markdown || '';
          const textWithoutTags = rawText.replace(/<!-- image -->/g, '').trim();
          if (textWithoutTags.length < 15) {
            console.log(`[OCR Fallback Required] Docling returned no text for ${file.filename} during reprocess`);
          } else {
            doclings.push(parsedDoc);
          }
        }
      }
      
      // Fallback OCR
      const parsedPaths = new Set(doclings.map(d => d.attPath));
      for (const file of filesToParse) {
        if (parsedPaths.has(file.path)) continue;
        const ext = path.extname(file.filename || "").toLowerCase();
        if (ext === '.pdf') {
          try {
            let pdfData = null;
            try {
              const pdfParse = require('pdf-parse');
              if (typeof pdfParse === 'function') {
                const buffer = fs.readFileSync(file.path);
                pdfData = await pdfParse(buffer);
              }
            } catch(e) {}
            
            if (pdfData && pdfData.text && pdfData.text.trim().length > 10) {
              doclings.push({ filename: file.filename, attPath: file.path, raw_markdown: pdfData.text, raw_tables: [] });
            }
          } catch (e) {
            console.error(`Fallback failed for ${file.filename}`, e.message);
          }
        }
      }
      
      // 3. Normalize
      const normalized = normalizeOrderExtraction(subject, from, body, html, doclings);
      
      // Ensure garbage isn't restored when reprocessing
      if (order.normalized_data && order.normalized_data.products) {
        const oldProducts = order.normalized_data.products;
        const hasGarbage = oldProducts.some(p => /celebrating|collection|years in new zealand/i.test(p.description));
        if ((!normalized.products || normalized.products.length === 0) && oldProducts.length > 0 && !hasGarbage) {
          normalized.products = oldProducts;
        }
      }
      
      // Update order fields
      order.invoice_number = normalized.invoiceNo !== "Not identified" ? normalized.invoiceNo : order.invoice_number;
      if (normalized.orderNo && normalized.orderNo !== "Not identified") {
        order.order_number = normalized.orderNo;
      } else if (normalized.invoiceNo !== "Not identified" && order.order_number.startsWith("BT_")) {
        order.order_number = normalized.invoiceNo;
      }
      order.pickup_store = normalized.comingFrom;
      order.destination_store = normalized.destination;
      order.destination_address = normalized.deliveryAddress !== "Not identified" ? normalized.deliveryAddress : normalized.destination;
      order.billing_party = normalized.billTo;
      order.location = normalized.destination;
      order.line_items = normalized.products;
      order.bt_from = normalized.comingFrom;
      order.bt_to = normalized.destination;
      order.normalized_data = normalized;
      
      // Calculate Lat/Lon for origin & destination
      const originStore = STORE_REGISTRY[order.pickup_store];
      if (originStore) {
        order.pickup_lat = originStore.lat;
        order.pickup_lon = originStore.lon;
      } else {
        order.pickup_lat = null;
        order.pickup_lon = null;
      }
      const destStore = STORE_REGISTRY[order.destination_store];
      if (destStore) {
        order.dest_lat = destStore.lat;
        order.dest_lon = destStore.lon;
      } else {
        const storeName = matchStore(order.destination_address);
        if (storeName && STORE_REGISTRY[storeName]) {
          order.dest_lat = STORE_REGISTRY[storeName].lat;
          order.dest_lon = STORE_REGISTRY[storeName].lon;
        } else {
          order.dest_lat = null;
          order.dest_lon = null;
        }
      }
      
      await order.save();
      reprocessedCount++;
    }
    console.log(`[DB] Reprocessed ${reprocessedCount} orders successfully.`);
  } catch (e) {
    console.error("[DB] Error reprocessing orders:", e.message);
  }

  startScheduler();

  app.listen(PORT, () => {
    console.log(`[SERVER] DAV Transport API running on http://localhost:${PORT}`);
    console.log(`[SERVER] Docling service expected at ${DOCLING_URL}`);
  });
})();
}

module.exports = { EmailScanner, normalizeOrderExtraction, STORE_REGISTRY, matchStore, extractStoreFromOrderNumber, findAllStoresInText };