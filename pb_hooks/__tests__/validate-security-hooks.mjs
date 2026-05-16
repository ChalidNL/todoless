#!/usr/bin/env node
// Static regression checks for security-critical PocketBase hooks.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '..', 'main.pb.js'), 'utf-8');

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

console.log('Security Hook Validation\n');

console.log('Syntax:');
try {
  const stubbed = `
    const routerAdd = function(){};
    const onRecordCreateRequest = function(){};
    const onRecordUpdateRequest = function(){};
    const onRecordAfterCreateSuccess = function(){};
    const BadRequestError = function(message){ this.message = message; };
    const $app = { findRecordsByFilter:()=>[], save:()=>{} };
    ${source}
  `;
  new Function(stubbed);
  check('JavaScript syntax valid', true);
} catch (err) {
  check('JavaScript syntax valid', false);
  console.log(`    Error: ${err.message}`);
}

console.log('\nBootstrap endpoint:');
check('Safe setup-status route exists', source.includes("'/api/todoless/setup-status'"));
check('Setup-status exposes only booleans', source.includes('has_users') && source.includes('setup_complete'));

console.log('\nInvite-only registration:');
check('User create hook registered', source.includes('onRecordCreateRequest') && source.includes("}, 'users')"));
check('First user forced admin', source.includes("e.record.set('role', 'admin')"));
check('Invite users forced regular user', source.includes("e.record.set('role', 'user')"));
check('Invite users cannot submit family_id', source.includes("e.record.set('family_id', '')"));
check('Missing invite is rejected', source.includes('Invite code is required for registration'));
check('Invite code marked used after successful create', source.includes('onRecordAfterCreateSuccess') && source.includes("inviteRecord.set('used', true)"));

console.log('\nProtected user fields:');
check('User update hook registered', source.includes('onRecordUpdateRequest'));
check('Direct role update blocked', source.includes('body.role !== undefined'));
check('Direct family update blocked', source.includes('body.family_id !== undefined'));
check('Direct invite_code update blocked', source.includes('body.invite_code !== undefined'));
check('Superuser update path allowed', source.includes('hasSuperuserAuth'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
