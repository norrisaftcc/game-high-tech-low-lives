#!/usr/bin/env node
// Verifies the CARTRIDGE object embedded in index.html parses to the same
// data as the standalone cartridge.json (deliverable requirement: "the
// inline copy must be byte-equal JSON when parsed").
'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const jsonFile = JSON.parse(fs.readFileSync(path.join(dir, 'cartridge.json'), 'utf8'));

const marker = 'var CARTRIDGE = ';
const start = html.indexOf(marker);
if (start === -1) throw new Error('CARTRIDGE assignment not found in index.html');
const jsonStart = start + marker.length;
const end = html.indexOf(';\n/* ===================== end CARTRIDGE', jsonStart);
if (end === -1) throw new Error('end-of-CARTRIDGE marker not found in index.html');
const inlineText = html.slice(jsonStart, end);
const inlineParsed = JSON.parse(inlineText);

const a = JSON.stringify(inlineParsed);
const b = JSON.stringify(jsonFile);

if (a !== b) {
  console.error('MISMATCH: inline CARTRIDGE and cartridge.json differ when parsed and re-serialized.');
  process.exit(1);
}
console.log('OK: inline CARTRIDGE (index.html) is byte-equal, when parsed, to cartridge.json.');
console.log('Scenes:', Object.keys(jsonFile.scenes).length);
