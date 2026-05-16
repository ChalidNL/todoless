#!/usr/bin/env node
// Validate paperless.js hook structure and logic patterns
// Run with: node pb_hooks/routes/__tests__/validate-paperless.mjs

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hookPath = join(__dirname, '..', 'paperless.js');

const source = readFileSync(hookPath, 'utf-8');
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

console.log('Paperless Hook Validation\n');

// Syntax check via parser (wrap in function to handle top-level statements)
console.log('Syntax:');
try {
  // Replace PocketBase globals with stubs for Node.js parsing
  const stubbed = `
    const routerAdd = function(){};
    const $request = {body:()=>({get:()=>''}),header:()=>''};
    const $app = {dao:{findRecordsByFilter:()=>[],findCollectionByNameOrId:{},saveRecord:()=>{}}};
    const $apis = {requireRecordAuth:()=>{}};
    const $env = {get:()=>''};
    const $now = '';
    const c = {json:()=>{},get:()=>null,pathParam:()=>''};
    const Record = function(){};
    const RecordUpsertAction = function(){return{set:()=>this,submit:()=>this,loadRequest:()=>this}};
    const Fetch = function(){return{header:()=>this,get:()=>this}};
    ${source}
  `;
  new Function(stubbed);
  check('JavaScript syntax valid', true);
} catch (e) {
  check('JavaScript syntax valid', false);
  console.log(`    Error: ${e.message}`);
}

// Required endpoints
console.log('\nEndpoints:');
check('POST webhook endpoint', source.includes("'/api/integrations/paperless/webhook'"));
check('GET poll endpoint', source.includes("'/api/integrations/paperless/poll'"));
check('GET test endpoint', source.includes("'/api/integrations/paperless/test'"));
check('POST config endpoint', source.includes("'/api/integrations/paperless/config'"));
check('POST sync endpoint', source.includes("'/api/integrations/paperless/sync'"));

// Security
console.log('\nSecurity:');
check('Webhook secret required (not optional)', !source.includes('if (secret) {'));
check('Webhook secret missing returns 503', source.includes('503') && source.includes('Webhook secret not configured'));
check('Webhook secret is read from headers only', source.includes('X-Paperless-Webhook-Secret') && !source.includes("body.get('secret')"));
check('Webhook supports Bearer auth header', source.includes('Authorization') && source.includes('Bearer'));
check('Auth check on poll', source.includes("c.get('authRecord')") && source.includes("'/api/integrations/paperless/poll'"));
check('Auth check on config', source.includes('requireRecordAuth'));

// Logic
console.log('\nLogic:');
check('Tag checking (hasTodoTag)', source.includes('hasTodoTag'));
check('Dedup check (isDocumentProcessed)', source.includes('isDocumentProcessed'));
check('Sync tracking (paperless_sync)', source.includes('paperless_sync'));
check('Task creation', source.includes("findCollectionByNameOrId('tasks')"));
check('HTTP fetch helper', source.includes('paperlessFetch'));
check('Error recording', source.includes('recordProcessed'));
check('Skipped docs tracking', source.includes("'skipped'"));

// Tag name check
console.log('\nTag Handling:');
check('Default todo tag', source.includes("'todo'"));
check('Configurable tag name', source.includes('todo_tag'));
check('Case-insensitive tag match', source.includes('toLowerCase()'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
