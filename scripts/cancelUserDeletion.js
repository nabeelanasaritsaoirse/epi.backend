/**
 * Cancel User Deletion Request Script (via Production API)
 *
 * Usage:
 *   Single user:  node scripts/cancelUserDeletion.js user@example.com
 *   Multiple:     node scripts/cancelUserDeletion.js user1@example.com user2@example.com
 */

const BASE_URL = process.env.CANCEL_SERVER_URL || 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function loginAsAdmin() {
  console.log('Logging in as admin...');
  const res = await fetch(`${BASE_URL}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Admin login failed: ${data.message}`);
  }

  console.log('Admin login successful.\n');
  return data.data.accessToken;
}

async function findUserByEmail(token, email) {
  const res = await fetch(`${BASE_URL}/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const users = await res.json();
  if (!Array.isArray(users)) return null;

  // Find exact email match (case-insensitive)
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase());
}

async function cancelDeletion(token, userId) {
  const res = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function main() {
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.error('Usage: node scripts/cancelUserDeletion.js <email1> [email2] ...');
    process.exit(1);
  }

  try {
    const token = await loginAsAdmin();

    for (const email of emails) {
      console.log(`--- ${email} ---`);

      const user = await findUserByEmail(token, email);
      if (!user) {
        console.log('  User NOT FOUND. Skipping.\n');
        continue;
      }

      const userId = user.userId || user._id;
      console.log(`  Found: ${user.name} (ID: ${userId})`);

      const result = await cancelDeletion(token, userId);
      if (result.success) {
        console.log('  Deletion request CANCELLED. User can login now.\n');
      } else {
        console.log(`  Failed: ${result.message}\n`);
      }
    }

    console.log('Done.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
