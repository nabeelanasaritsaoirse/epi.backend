/**
 * Cancel User Deletion Request by Phone Number (via Production API)
 *
 * Usage: node scripts/cancelDeletionByPhone.js <phoneNumber>
 */

const BASE_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function loginAsAdmin() {
  console.log('Logging in as admin...');
  const res = await fetch(`${BASE_URL}/admin-auth/login`, {
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

async function findUserByPhone(token, phone) {
  const res = await fetch(`${BASE_URL}/admin/referrals/all-users?search=${encodeURIComponent(phone)}&limit=10`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await res.json();
  if (!data.success || !data.data?.users?.length) return null;

  // Find exact phone match
  return data.data.users.find(u => u.phoneNumber === phone);
}

async function cancelDeletion(token, userId) {
  const res = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function main() {
  const phoneNumber = process.argv[2];
  if (!phoneNumber) {
    console.error('Usage: node scripts/cancelDeletionByPhone.js <phoneNumber>');
    process.exit(1);
  }

  try {
    const token = await loginAsAdmin();

    console.log(`Searching for phone: ${phoneNumber}`);
    const user = await findUserByPhone(token, phoneNumber);

    if (!user) {
      console.log('User NOT FOUND with this phone number.');
      process.exit(1);
    }

    const userId = user.userId || user._id;
    console.log(`Found: ${user.name} (${user.email || 'no email'})`);
    console.log(`ID: ${userId}\n`);

    const result = await cancelDeletion(token, userId);
    if (result.success) {
      console.log('✅ Deletion request CANCELLED. User can login now.');
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
