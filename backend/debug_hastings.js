const express = require('express');
express.application.listen = function() { return this; }; // Stub listen to prevent EADDRINUSE

const { normalizeOrderExtraction } = require('./server.js');

const subject = 'Fwd: Goods Movement for SOLD ITEM- Harvey Norman Hastings';
const from = 'Some Sender <sender@nz.harveynorman.com>';
const body = 'Please find attached the goods movement for sold item. To be delivered to customer in Hastings.';

const res = normalizeOrderExtraction(subject, from, body, '', []);
console.log(JSON.stringify(res, null, 2));
