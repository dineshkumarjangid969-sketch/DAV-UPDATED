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

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/uploads/:filename", (req, res, next) => {
  if (req.params.filename.endsWith(".eml")) {
    const filePath = path.join(__dirname, "uploads", req.params.filename);
    res.setHeader("Content-Type", "text/plain");
    return res.sendFile(filePath);
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
  "Wairau Park": { lat: -36.7816, lon: 174.7510, region: "Auckland", aliases: ["Wairau", "wairau park", "commercial wairau"] },
  "Albany": { lat: -36.7263, lon: 174.6994, region: "Auckland", aliases: ["albany"] },
  "Westgate": { lat: -36.8183, lon: 174.6112, region: "Auckland", aliases: ["westgate"] },
  "Lower Hutt": { lat: -41.2092, lon: 174.9081, region: "Wellington", aliases: ["lower hutt", "hutt"] },
  "Palmerston North": { lat: -40.3523, lon: 175.6082, region: "Manawatu", aliases: ["palmerston north", "palmy"] },
  "Hamilton": { lat: -37.7870, lon: 175.2793, region: "Waikato", aliases: ["hamilton"] },
  "Whanganui": { lat: -39.9334, lon: 175.0479, region: "Manawatu", aliases: ["whanganui", "wanganui"] },
  "Whakatane": { lat: -37.9534, lon: 176.9908, region: "Bay of Plenty", aliases: ["whakatane"] },
  "Whangarei": { lat: -35.7251, lon: 174.3237, region: "Northland", aliases: ["whangarei"] },
  "Hastings": { lat: -39.6396, lon: 176.8392, region: "Hawkes Bay", aliases: ["hastings", "akina"] },
  "Mt Wellington": { lat: -36.8939, lon: 174.8470, region: "Auckland", aliases: ["mt wellington", "mount wellington"] },
  "Manukau": { lat: -36.9896, lon: 174.8696, region: "Auckland", aliases: ["manukau"] },
  "Porirua": { lat: -41.1337, lon: 174.8406, region: "Wellington", aliases: ["porirua"] },
  "New Plymouth": { lat: -39.0556, lon: 174.0752, region: "Taranaki", aliases: ["new plymouth"] },
  "Pukekohe": { lat: -37.2005, lon: 174.9010, region: "Auckland", aliases: ["pukekohe"] },
  "Mt Maunganui": { lat: -37.6600, lon: 176.2200, region: "Bay of Plenty", aliases: ["mt maunganui", "mount maunganui"] },
  "Botany": { lat: -36.9300, lon: 174.9100, region: "Auckland", aliases: ["botany"] },
  "Rotorua": { lat: -38.1400, lon: 176.2500, region: "Bay of Plenty", aliases: ["rotorua"] },
  "Masterton": { lat: -40.9500, lon: 175.6600, region: "Wellington", aliases: ["masterton"] },
  "Mt Roskill": { lat: -36.9100, lon: 174.7300, region: "Auckland", aliases: ["mt roskill", "mount roskill"] },
  "Dargaville": { lat: -35.9300, lon: 173.8700, region: "Northland", aliases: ["dargaville"] },
};

// ============================================================================
// DOCLING CLIENT
// ============================================================================
const DOCLING_URL = process.env.DOCLING_URL || "http://localhost:8000";

async function parseWithDocling(filePath, filename) {
  try {
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename });
    const response = await axios.post(`${DOCLING_URL}/parse`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });
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
          const order = await this.processMessage(msg, account);
          if (order) {
            newOrders.push(order);
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
      const f = imap.fetch(uid, { bodies: "", struct: true });
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

    // === CRITICAL FIX: Filter out non-order emails ===
    if (!isOrderEmail(subject, body)) {
      console.log(`[SKIP] Not an order email: "${subject.substring(0, 70)}..."`);
      return null;
    }

    // Save email screenshot (raw email as .eml)
    const emlId = uuidv4();
    const emlPath = path.join(__dirname, "uploads", `${emlId}.eml`);
    fs.writeFileSync(emlPath, rawEmail);

    // Parse email context
    const emailContext = this.parseEmailContext(subject, body);
    emailContext.email_date = date;
    emailContext.email_subject = subject;
    emailContext.raw_email_body = body;

    // Process attachments
    const attachments = parsed.attachments || [];
    let docData = {};
    const attachmentPaths = [];

    for (const att of attachments) {
      const ext = path.extname(att.filename || "").toLowerCase();
      const validExts = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"];
      if (!validExts.includes(ext)) continue;

      const attId = uuidv4();
      const attPath = path.join(__dirname, "uploads", `${attId}${ext}`);
      fs.writeFileSync(attPath, att.content);
      attachmentPaths.push(attPath);

      // Parse with Docling
      const parsedDoc = await parseWithDocling(attPath, att.filename);
      if (parsedDoc) {
        docData = { ...docData, ...parsedDoc };
      }

      // Save attachment record
      await EmailAttachment.create({
        id: attId,
        filename: att.filename,
        file_path: attPath,
        content_type: att.contentType,
      });
    }

    // Merge data
    const merged = this.mergeData(docData, emailContext);
    merged.email_from = from;
    merged.email_date = date;
    merged.email_subject = subject;
    merged.raw_email_body = body;

    // If no attachments and no meaningful data from email, skip
    if (attachments.length === 0 && !merged.order_number && !merged.bt_from && !merged.bt_to && !merged.customer_name) {
      console.log(`[SKIP] No extractable order data from: "${subject.substring(0, 70)}..."`);
      return null;
    }

    // Create or update order
    const result = await this.createOrUpdateOrder(merged, emlPath, attachmentPaths);

    // Auto-reply confirmation to the sender if it is a new order
    if (result && result._isNew) {
      sendEmailConfirmation(result).catch(err => console.error("Auto-reply error:", err));
    }
    return result;
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
      is_goods_movement: false,
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
      // BT Collection From [Store]
      /BT\s+(?:Collection\s+)?From\s+([A-Za-z\s]+?)(?:\s+to\s+([A-Za-z\s]+))?/i,
      // Branch Transfer From [Store] to [Store]
      /Branch\s+Transfer\s+(?:From\s+)?([A-Za-z\s]+?)\s+(?:to\s+)([A-Za-z\s]+)/i,
      // Goods Movement from [Store] to [Store]
      /Goods\s+Movement\s+(?:from\s+)?([A-Za-z\s]+?)\s+(?:to\s+)([A-Za-z\s]+)/i,
      // BT from [Store] to [Store]
      /BT\s+(?:from\s+)?([A-Za-z\s]+?)\s+(?:to\s+)([A-Za-z\s]+)/i,
      // [Store] to [Store] BT
      /([A-Za-z\s]+?)\s+(?:to|→)\s+([A-Za-z\s]+)\s+(?:BT|Branch Transfer|Goods Movement)/i,
    ];

    for (const pattern of btSubjectPatterns) {
      const match = subject.match(pattern);
      if (match) {
        context.bt_from = this.normalizeStore(match[1].trim());
        if (match[2]) context.bt_to = this.normalizeStore(match[2].trim());
        context.is_goods_movement = true;
        break;
      }
    }

    if (!context.bt_from) {
      const bodyBtPatterns = [
        /(?:from|OFFSITE)[:\s]+([A-Za-z\s]+?)(?:\s+to\s+|\s*→\s*)([A-Za-z\s]+)/i,
        /From\s*:\s*([A-Za-z\s]+?)\s+To\s*:\s*([A-Za-z\s]+)/i,
        /BT\s+From\s+([A-Za-z\s]+?)\s+To\s+([A-Za-z\s]+)/i,
      ];
      for (const pattern of bodyBtPatterns) {
        const match = body.match(pattern);
        if (match) {
          context.bt_from = this.normalizeStore(match[1].trim());
          context.bt_to = this.normalizeStore(match[2].trim());
          context.is_goods_movement = true;
          break;
        }
      }
    }

    const whMatch = body.match(/(?:from\s+the\s+)?(Albany|Wairau\s+Park|Westgate|Lower\s+Hutt|Hamilton|Palmerston\s+North|Whangarei|Whanganui|Hastings|Whakatane)\s+(?:warehouse|store|offsite|branch)/i);
    if (whMatch) context.warehouse = this.normalizeStore(whMatch[1].replace(/\s+/g, ""));

    const dateMatch = body.match(/(?:delivery|deliver|date|required by)[:\s]+(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i);
    if (dateMatch) context.delivery_date = dateMatch[1];

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
    } else if (merged.bt_from || merged.bt_to || emailContext.is_goods_movement) {
      merged.type = "branch_transfer";
      if (emailContext.is_goods_movement || (merged.document_type === "goods_movement")) {
        merged.bt_type = "goods_movement";
      } else if (merged.document_type === "purchase_order") {
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
      merged.billing_party = merged.bt_to || merged.destination_store || merged.pickup_store || "Harvey Norman";
      merged.location = merged.bt_to || merged.destination_store || merged.destination_address || merged.pickup_store || "";
    } else {
      merged.billing_party = merged.customer_name || merged.destination_store || merged.pickup_store || "Harvey Norman";
      merged.location = merged.destination_address || merged.destination_store || merged.pickup_store || "";
    }

    return merged;
  }

  async createOrUpdateOrder(data, emlPath, attachmentPaths) {
    let orderId = data.order_number || data.po_number || data.invoice_number;

    if (!orderId || orderId.length < 3) {
      const btPart = data.bt_from ? data.bt_from.replace(/\s+/g, "").substring(0, 6) : "UNK";
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const timePart = Date.now().toString().slice(-4);
      orderId = `BT_${btPart}_${datePart}_${timePart}`;
      data.order_number = orderId;
    }

    let order = await Order.findByPk(orderId);

    if (!order && data.email_subject && data.email_date) {
      order = await Order.findOne({
        where: { email_subject: data.email_subject },
        order: [["createdAt", "DESC"]],
      });
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
      line_items: data.line_items || [],
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
    for (const [storeName, data] of Object.entries(STORE_REGISTRY)) {
      if (storeName.toLowerCase() === clean) return storeName;
      for (const alias of data.aliases || []) {
        if (alias.toLowerCase() === clean) return storeName;
      }
    }
    for (const storeName of Object.keys(STORE_REGISTRY)) {
      if (storeName.toLowerCase().includes(clean) || clean.includes(storeName.toLowerCase()))
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
      "BT Type",
      "BT From",
      "BT To",
      "Billing party",
      "Picked up",
      "Delivered",
      "Billed",
      "Rate",
      "Location"
    ];
    // A4 Landscape width is 841.89 points. With 30pt margins on left & right, total printable width is 781.89 points.
    // Sum of colWidths = 50+50+70+55+65+50+55+55+60+35+35+35+35+80 = 730 points.
    const colWidths = [50, 50, 70, 55, 65, 50, 55, 55, 60, 35, 35, 35, 35, 80];
    let x = 30;
    headers.forEach((h, i) => {
      doc.fontSize(9).text(h, x, y, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });
    y += 15;
    doc.moveTo(30, y).lineTo(811.89, y).stroke();
    y += 5;

    for (const order of orders) {
      if (y > 520) { doc.addPage(); y = 30; }
      x = 30;
      
      const formattedProducts = (order.line_items || [])
        .map(i => `${i.sku} x${i.quantity}`)
        .join(", ");

      const values = [
        order.order_number || "",
        order.invoice_number || "",
        (order.email_subject || "").substring(0, 15),
        order.email_date ? new Date(order.email_date).toLocaleDateString("en-GB") : "",
        formattedProducts.substring(0, 15),
        (order.bt_type || "").replace(/_/g, " "),
        (order.bt_from || "").substring(0, 12),
        (order.bt_to || "").substring(0, 12),
        (order.billing_party || "").substring(0, 12),
        order.picked_up ? "Yes" : "No",
        order.delivered ? "Yes" : "No",
        order.billed ? "Yes" : "No",
        order.rate ? `$${order.rate.toFixed(2)}` : "—",
        (order.location || "").substring(0, 18),
      ];

      values.forEach((v, i) => {
        doc.fontSize(8).text(String(v), x, y, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      y += 12;
    }

    doc.end();
    return new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  }

  async exportToExcel(orders, filePath) {
    const data = orders.map((o) => ({
      "Order #": o.order_number || "",
      "Invoice #": o.invoice_number || "",
      "Subject": o.email_subject || "",
      "Email Date": o.email_date ? new Date(o.email_date).toISOString().split("T")[0] : "",
      "Products": (o.line_items || []).map(i => `${i.sku} x${i.quantity}`).join(", "),
      "BT Type": (o.bt_type || "").replace(/_/g, " "),
      "BT From": o.bt_from || "",
      "BT To": o.bt_to || "",
      "Billing party": o.billing_party || "",
      "Picked up": o.picked_up ? "Yes" : "No",
      "Delivered": o.delivered ? "Yes" : "No",
      "Billed": o.billed ? "Yes" : "No",
      "Rate": o.rate || "",
      "Location": o.location || "",
    }));
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
  const { status, bt_type, store, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) where.status = status;
  if (bt_type) where.bt_type = bt_type;
  if (store) {
    where[Op.or] = [
      { pickup_store: { [Op.like]: `%${store}%` } },
      { destination_store: { [Op.like]: `%${store}%` } },
      { bt_from: { [Op.like]: `%${store}%` } },
      { bt_to: { [Op.like]: `%${store}%` } },
    ];
  }
  if (search) {
    where[Op.or] = [
      { order_number: { [Op.like]: `%${search}%` } },
      { invoice_number: { [Op.like]: `%${search}%` } },
      { customer_name: { [Op.like]: `%${search}%` } },
      { email_subject: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    orders: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    },
  });
});

app.get("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  const attachments = await EmailAttachment.findAll({ where: { order_id: order.id } });
  const orderData = order.toJSON();
  orderData.attachments = attachments;
  res.json(orderData);
});

app.post("/api/orders", async (req, res) => {
  const data = req.body;
  const order = await Order.create({
    id: data.booking_id || data.order_number || `MANUAL_${Date.now()}`,
    ...data,
  });
  res.status(201).json(order);
});

app.put("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update(req.body);
  res.json(order);
});

app.delete("/api/orders/:id", async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.destroy();
  res.json({ message: "Order deleted", booking_id: req.params.id });
});

app.patch("/api/orders/:id/status", async (req, res) => {
  const order = await Order.findByPk(req.params.id);
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
    // Auto-notify customer via WhatsApp
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
  await order.update(updates);

  // Trigger email notification to original sender
  if (notifyField !== null) {
    await sendEmailNotification(order.toJSON(), notifyField, notifyValue);
  }

  res.json(order);
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
  res.json(await EmailAccount.findAll());
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

    // 2. Create the attachment record so it displays in Details panel
    await EmailAttachment.create({
      id: attId,
      filename: req.file.originalname,
      file_path: persistentPath,
      content_type: req.file.mimetype,
    });

    // 3. Normalize and merge document data using email scanner helper logic
    const emailContext = {
      bt_from: null, bt_to: null, order_ref: null,
      delivery_date: null, warehouse: null,
      special_instructions: [], is_goods_movement: false,
      is_return_to_store: false,
    };
    
    const parsedData = emailScanner.mergeData(result, emailContext);
    parsedData.email_subject = `Manual Upload: ${req.file.originalname}`;
    parsedData.email_from = "Operations Manual Upload";
    parsedData.email_date = new Date();

    // 4. Save order using emailScanner's DB helper
    const order = await emailScanner.createOrUpdateOrder(parsedData, null, [persistentPath]);
    
    res.json({ status: "success", order, message: "Document parsed and saved." });
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
  const total = await Order.count();
  const pendingCount = await Order.count({ where: { status: "pending" } });
  const inProgress = await Order.count({ where: { status: "in_progress" } });
  const completed = await Order.count({ where: { status: "completed" } });
  const btOrders = await Order.count({ where: { type: "branch_transfer" } });
  const pickedUp = await Order.count({ where: { picked_up: true } });
  const delivered = await Order.count({ where: { delivered: true } });
  const pendingMetrics = total - delivered;
  const recent = await Order.findAll({ order: [["createdAt", "DESC"]], limit: 10 });
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

app.post("/api/route-plan", async (req, res) => {
  const { order_ids, truck_id, driver_id, offsider_ids, date, start_store } = req.body;
  const orders = await Order.findAll({ where: { id: { [Op.in]: order_ids } } });
  const optimized = await routeOptimizer.optimizeRoute(orders, start_store || "Wairau Park");

  const plan = await RoutePlan.create({
    id: `ROUTE_${Date.now()}`,
    truck_id,
    driver_id,
    offsider_ids: offsider_ids || [],
    start_store: start_store || "Wairau Park",
    date: date || new Date().toISOString().split("T")[0],
    stops: optimized.stops,
    total_distance_km: optimized.total_distance_km,
    estimated_fuel_cost: optimized.estimated_fuel_cost,
  });

  res.json({ plan, start_point: optimized.start_point });
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
        if (twilioClient && TWILIO_WHATSAPP_NUMBER) {
          try {
            await twilioClient.messages.create({
              body: message,
              from: process.env.TWILIO_FROM_NUMBER || "+1234567890",
              to: driver.phone,
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
          await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_FROM_NUMBER || "+1234567890",
            to: d.phone,
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
  cron.schedule("*/5 * * * *", async () => {
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
  });
  console.log("[SCHEDULER] Started - scanning every 5 minutes");
}

// ============================================================================
// INIT & START
// ============================================================================
const PORT = process.env.PORT || 5000;

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
      confidence: 0.95,
    });
    console.log("[DB] Seeded orders");
  }

  startScheduler();

  app.listen(PORT, () => {
    console.log(`[SERVER] DAV Transport API running on http://localhost:${PORT}`);
    console.log(`[SERVER] Docling service expected at ${DOCLING_URL}`);
  });
})();
