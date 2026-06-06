const express = require('express');
express.application.listen = function() { return this; }; // Stub listen to prevent EADDRINUSE

const { normalizeOrderExtraction, STORE_REGISTRY } = require('./server.js');
const cache = require('./docling_cache.json');
const keys = Object.keys(cache).filter(k => cache[k].raw_markdown && cache[k].raw_markdown.includes('NZ0200000342578'));
const doclings = keys.map(k => cache[k]);

const subject = 'Fwd: Fw: PO# NZ0200000342578 - Order Status = Accepted (Pending)';
const from = 'Bedding, Manukau <Manukau.Bedding@nz.harveynorman.com>';
const body = 'Please collect this BT from Pukekohe store and deliver to Harvey Norman Wairau park warehouse.';

const res = normalizeOrderExtraction(subject, from, body, '', doclings);
console.log(JSON.stringify(res, null, 2));
