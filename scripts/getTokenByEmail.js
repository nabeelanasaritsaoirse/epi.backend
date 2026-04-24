/**
 * Developer Script: Get Access Token for Any User by Email or Phone
 *
 * Usage:
 *   node scripts/getTokenByEmail.js <email>
 *   node scripts/getTokenByEmail.js <phoneNumber>
 *
 * Examples:
 *   node scripts/getTokenByEmail.js john@example.com
 *   node scripts/getTokenByEmail.js 9876543210
 *   node scripts/getTokenByEmail.js +919876543210
 *
 * How it works:
 *   1. Logs in as super admin using API
 *   2. Finds the user by email OR phone using admin API
 *   3. Generates a JWT access token for that user
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const jwt = require('jsonwebtoken');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL    = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASS  = '@Saoirse123';
const JWT_SECRET  = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
// ──────────────────────────────────────────────────────────────────────────────

// Detect if input is phone number or email
function detectInputType(input) {
  // Phone: digits only, or starts with +
  if (/^[+\d][\d]{6,14}$/.test(input)) return 'phone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return 'email';
  return 'unknown';
}

// Simple HTTP helper
function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) })
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const input = process.argv[2];

  if (!input) {
    console.error('\n❌  Usage:');
    console.error('    node scripts/getTokenByEmail.js <email>');
    console.error('    node scripts/getTokenByEmail.js <phoneNumber>\n');
    console.error('  Examples:');
    console.error('    node scripts/getTokenByEmail.js john@example.com');
    console.error('    node scripts/getTokenByEmail.js 9876543210');
    console.error('    node scripts/getTokenByEmail.js +919876543210\n');
    process.exit(1);
  }

  const inputType = detectInputType(input);
  const isPhone = inputType === 'phone';
  const isEmail = inputType === 'email';

  if (!isPhone && !isEmail) {
    console.error(`\n❌  Could not detect if "${input}" is an email or phone number.`);
    console.error('    Phone must be digits only (e.g. 9876543210 or +919876543210)');
    console.error('    Email must be valid (e.g. john@example.com)\n');
    process.exit(1);
  }

  console.log('\n════════════════════════════════════════════');
  console.log('  Developer Token Generator');
  console.log('════════════════════════════════════════════');
  console.log(`  Input        : ${input}`);
  console.log(`  Type         : ${isPhone ? 'Phone Number' : 'Email'}`);
  console.log(`  Server       : ${BASE_URL}`);
  console.log('════════════════════════════════════════════\n');

  // ── STEP 1: Admin Login ──────────────────────────────────────────────────
  console.log('⏳  Step 1: Logging in as admin...');

  const loginRes = await apiCall('POST', '/api/admin-auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS
  });

  if (!loginRes.body?.success) {
    console.error('❌  Admin login failed:', loginRes.body?.message || loginRes.body);
    process.exit(1);
  }

  const adminToken = loginRes.body.data.accessToken;
  console.log('✅  Admin login successful\n');

  // ── STEP 2: Find User by Email or Phone ─────────────────────────────────
  console.log(`⏳  Step 2: Looking up user by ${isPhone ? 'phone' : 'email'}...`);

  const checkPayload = isPhone
    ? { phoneNumber: input }
    : { email: input };

  const checkRes = await apiCall('POST', '/api/auth/checkUserExists', checkPayload);

  if (!checkRes.body?.exists) {
    console.error(`❌  No user found with ${isPhone ? 'phone' : 'email'}: ${input}`);
    process.exit(1);
  }

  const userId = checkRes.body.data?.userId;
  console.log(`✅  User found  →  ID: ${userId}\n`);

  // ── STEP 3: Get Full User Details (role needed for token) ────────────────
  console.log('⏳  Step 3: Fetching user role and details...');

  const userRes = await apiCall('GET', `/api/users/${userId}`, null, adminToken);

  if (!userRes.body || userRes.status !== 200) {
    console.error('❌  Failed to fetch user details:', userRes.body?.message || userRes.status);
    process.exit(1);
  }

  const user = userRes.body.user || userRes.body;
  const userRole = user.role || 'user';

  console.log('✅  User details fetched');
  console.log(`   Name   : ${user.name}`);
  console.log(`   Email  : ${user.email}`);
  console.log(`   Phone  : ${user.phoneNumber || 'N/A'}`);
  console.log(`   Role   : ${userRole}\n`);

  // ── STEP 4: Generate JWT Token ───────────────────────────────────────────
  console.log('⏳  Step 4: Generating JWT token...');

  const accessToken = jwt.sign(
    { userId: userId.toString(), role: userRole },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: userId.toString(), type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  // ── OUTPUT ───────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════');
  console.log('  ✅  TOKENS GENERATED');
  console.log('════════════════════════════════════════════\n');

  console.log('📋  User Info:');
  console.log(`   User ID  : ${userId}`);
  console.log(`   Name     : ${user.name}`);
  console.log(`   Email    : ${user.email}`);
  console.log(`   Phone    : ${user.phoneNumber || 'N/A'}`);
  console.log(`   Role     : ${userRole}`);

  console.log('\n🔑  Access Token (valid 7 days):');
  console.log(accessToken);

  console.log('\n🔄  Refresh Token (valid 30 days):');
  console.log(refreshToken);

  console.log('\n📬  Use in Postman / APIdog:');
  console.log('   Header : Authorization');
  console.log(`   Value  : Bearer ${accessToken}`);

  console.log('\n════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌  Unexpected error:', err.message);
  process.exit(1);
});
