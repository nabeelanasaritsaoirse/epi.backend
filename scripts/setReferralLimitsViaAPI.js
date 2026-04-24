const axios = require('axios');

const API_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

const usersToUpdate = [
  { name: 'Malicherla Ganesh', email: 'ganeshmalicherla123@gmail.com', phone: '9133022362' },
  { name: 'Gorle Sriramamurty', email: 'srirammurthygorle555@gmail.com', phone: '9849504420' },
  { name: 'Shaik Mohiddin Shareef', email: 'shareefmohiddin145@gmail.com', phone: '9515314523' },
  { name: 'Kaduru Lokesh', email: 'kadurulokesh@gmail.com', phone: '9390495756' }
];

async function setReferralLimits() {
  try {
    console.log('=== Logging in as Admin ===\n');

    // Login as admin
    const loginResponse = await axios.post(`${API_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const adminToken = loginResponse.data.data.accessToken;
    console.log('✓ Admin login successful');
    console.log(`Admin Name: ${loginResponse.data.data.name}`);
    console.log(`Admin ID: ${loginResponse.data.data.userId}`);
    console.log(`Admin Role: ${loginResponse.data.data.role}\n`);

    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    console.log('=== Getting All Users ===\n');

    // Get all users
    const allUsersResponse = await axios.get(`${API_URL}/api/users`, { headers });
    const allUsers = Array.isArray(allUsersResponse.data) ? allUsersResponse.data : [];

    console.log(`Total users in database: ${allUsers.length}\n`);

    console.log('=== Finding and Updating Users ===\n');

    for (const userData of usersToUpdate) {
      try {
        console.log(`\nSearching for: ${userData.name} (${userData.email})`);

        // Search for user by email
        let user = allUsers.find(u => u.email && u.email.toLowerCase() === userData.email.toLowerCase());

        // If not found by email, try by phone
        if (!user && userData.phone) {
          const normalizedPhone = userData.phone.replace(/\s+/g, '').replace('+91', '');
          user = allUsers.find(u => {
            if (!u.phoneNumber) return false;
            const userPhone = u.phoneNumber.replace(/\s+/g, '').replace('+91', '');
            return userPhone === normalizedPhone;
          });
        }

        if (user) {
          console.log(`Found: ${user.name} (ID: ${user._id})`);
          console.log(`Current referral limit: ${user.referralLimit || 0}`);

          // Update referral limit
          const updateResponse = await axios.put(
            `${API_URL}/api/users/admin/${user._id}`,
            { referralLimit: 500 },
            { headers }
          );

          console.log(`✓ UPDATED: Referral limit set to 500`);
          console.log(`  User: ${updateResponse.data.user.name}`);
          console.log(`  Email: ${updateResponse.data.user.email}`);
          console.log(`  New Limit: ${updateResponse.data.user.referralLimit}`);
        } else {
          console.log(`✗ NOT FOUND: ${userData.name}`);
          console.log(`  Email searched: ${userData.email}`);
          console.log(`  Phone searched: ${userData.phone}`);
        }
      } catch (error) {
        console.error(`Error updating ${userData.name}:`, error.response?.data || error.message);
      }
    }

    console.log('\n\n=== Verification ===\n');
    console.log('Checking all users to verify updates...\n');

    // Get fresh user data after updates
    const updatedUsersResponse = await axios.get(`${API_URL}/api/users`, { headers });
    const updatedUsers = Array.isArray(updatedUsersResponse.data) ? updatedUsersResponse.data : [];

    for (const userData of usersToUpdate) {
      const user = updatedUsers.find(u => u.email && u.email.toLowerCase() === userData.email.toLowerCase());
      if (user) {
        console.log(`${user.name}: Referral Limit = ${user.referralLimit || 0}`);
      } else {
        console.log(`${userData.name}: NOT FOUND`);
      }
    }

    console.log('\n=== Admin User Check ===\n');
    const adminUser = updatedUsers.find(u => u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (adminUser) {
      console.log(`Admin: ${adminUser.name}`);
      console.log(`Admin ID: ${adminUser._id}`);
      console.log(`Admin Referral Limit: ${adminUser.referralLimit || 0}`);
      console.log(`Admin Role: ${adminUser.role}`);
    } else {
      console.log('Admin user not found!');
    }

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

setReferralLimits();
