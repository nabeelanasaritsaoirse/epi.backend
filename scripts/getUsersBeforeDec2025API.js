const axios = require('axios');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function getUsersBeforeDate() {
  try {
    console.log('🔐 Logging in as admin...\n');

    // Step 1: Login as admin
    const loginResponse = await axios.post(`${API_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.accessToken;

    if (!token) {
      console.error('❌ No token found in response');
      return;
    }

    console.log('✅ Login successful!\n');

    // Step 2: Fetch all users
    console.log('📥 Fetching all users...\n');
    const usersResponse = await axios.get(`${API_URL}/users/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const allUsers = usersResponse.data;
    console.log(`Total users in database: ${allUsers.length}\n`);

    // Step 3: Filter users registered before December 1, 2025
    const targetDate = new Date('2025-12-01T00:00:00.000Z');

    const filteredUsers = allUsers.filter(user => {
      const userCreatedAt = new Date(user.createdAt);
      return userCreatedAt < targetDate;
    });

    console.log(`📊 Users registered before Dec 1, 2025: ${filteredUsers.length}\n`);
    console.log('='.repeat(100));

    if (filteredUsers.length > 0) {
      // Sort by creation date (oldest first)
      filteredUsers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      filteredUsers.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Auth Method: ${user.authMethod || 'N/A'}`);
        console.log(`   Registered: ${new Date(user.createdAt).toLocaleString()}`);
        console.log(`   User ID: ${user._id}`);
        console.log('-'.repeat(100));
      });

      // CSV Export
      console.log('\n\n📄 CSV Format (copy and paste to Excel):');
      console.log('Name,Email,Phone,Role,Auth Method,Registration Date,User ID');
      filteredUsers.forEach(user => {
        const phone = user.phoneNumber || 'N/A';
        const authMethod = user.authMethod || 'N/A';
        const regDate = new Date(user.createdAt).toISOString();
        console.log(`"${user.name}","${user.email}","${phone}","${user.role}","${authMethod}","${regDate}","${user._id}"`);
      });

      // Statistics
      console.log('\n\n📈 Statistics:');

      // By Role
      const roleStats = filteredUsers.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      console.log('\nUsers by Role:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`  - ${role}: ${count}`);
      });

      // By Auth Method
      const authStats = filteredUsers.reduce((acc, user) => {
        const method = user.authMethod || 'unknown';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});

      console.log('\nUsers by Auth Method:');
      Object.entries(authStats).forEach(([method, count]) => {
        console.log(`  - ${method}: ${count}`);
      });

      // By Month
      const monthStats = filteredUsers.reduce((acc, user) => {
        const date = new Date(user.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {});

      console.log('\nUsers by Registration Month:');
      Object.entries(monthStats)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([month, count]) => {
          console.log(`  - ${month}: ${count}`);
        });

    } else {
      console.log('❌ No users found registered before December 1, 2025');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the function
getUsersBeforeDate();
