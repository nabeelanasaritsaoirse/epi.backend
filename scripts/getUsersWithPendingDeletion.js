const axios = require('axios');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function getUsersWithPendingDeletion() {
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

    // Step 3: Filter users with pending deletion requests
    const usersWithPendingDeletion = allUsers.filter(user => {
      return user.deletionRequest &&
             user.deletionRequest.status === 'pending';
    });

    console.log(`📊 Users with PENDING deletion requests: ${usersWithPendingDeletion.length}\n`);
    console.log('='.repeat(100));

    if (usersWithPendingDeletion.length > 0) {
      // Sort by deletion request date (oldest first)
      usersWithPendingDeletion.sort((a, b) => {
        const dateA = new Date(a.deletionRequest.requestedAt);
        const dateB = new Date(b.deletionRequest.requestedAt);
        return dateA - dateB;
      });

      console.log('\n🚨 USERS WITH PENDING DELETION REQUESTS:\n');

      usersWithPendingDeletion.forEach((user, index) => {
        const requestedAt = user.deletionRequest.requestedAt
          ? new Date(user.deletionRequest.requestedAt).toLocaleString()
          : 'N/A';

        const reason = user.deletionRequest.reason || 'No reason provided';

        console.log(`${index + 1}. Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Registered: ${new Date(user.createdAt).toLocaleString()}`);
        console.log(`   ⚠️  DELETION REQUEST:`);
        console.log(`      - Status: ${user.deletionRequest.status}`);
        console.log(`      - Requested At: ${requestedAt}`);
        console.log(`      - Reason: ${reason}`);

        // Calculate days since request
        if (user.deletionRequest.requestedAt) {
          const daysSinceRequest = Math.floor(
            (new Date() - new Date(user.deletionRequest.requestedAt)) / (1000 * 60 * 60 * 24)
          );
          console.log(`      - Days Pending: ${daysSinceRequest} days`);
        }

        console.log('-'.repeat(100));
      });

      // CSV Export
      console.log('\n\n📄 CSV Format (copy and paste to Excel):');
      console.log('Name,Email,Phone,User ID,Role,Registered Date,Deletion Status,Deletion Requested At,Deletion Reason,Days Pending');

      usersWithPendingDeletion.forEach(user => {
        const phone = user.phoneNumber || 'N/A';
        const regDate = new Date(user.createdAt).toISOString();
        const deletionRequestedAt = user.deletionRequest.requestedAt
          ? new Date(user.deletionRequest.requestedAt).toISOString()
          : 'N/A';
        const reason = (user.deletionRequest.reason || 'No reason').replace(/"/g, '""'); // Escape quotes
        const daysPending = user.deletionRequest.requestedAt
          ? Math.floor((new Date() - new Date(user.deletionRequest.requestedAt)) / (1000 * 60 * 60 * 24))
          : 0;

        console.log(`"${user.name}","${user.email}","${phone}","${user._id}","${user.role}","${regDate}","${user.deletionRequest.status}","${deletionRequestedAt}","${reason}",${daysPending}`);
      });

      // Statistics
      console.log('\n\n📈 Statistics:');

      // By Role
      const roleStats = usersWithPendingDeletion.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      console.log('\nUsers with Pending Deletion by Role:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`  - ${role}: ${count}`);
      });

      // By Deletion Reason
      const reasonStats = usersWithPendingDeletion.reduce((acc, user) => {
        const reason = user.deletionRequest.reason || 'No reason provided';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});

      console.log('\nDeletion Requests by Reason:');
      Object.entries(reasonStats)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .forEach(([reason, count]) => {
          console.log(`  - ${reason}: ${count}`);
        });

      // By Days Pending
      const now = new Date();
      const pendingRanges = {
        '0-7 days': 0,
        '8-14 days': 0,
        '15-30 days': 0,
        '31-60 days': 0,
        '60+ days': 0
      };

      usersWithPendingDeletion.forEach(user => {
        if (user.deletionRequest.requestedAt) {
          const daysPending = Math.floor(
            (now - new Date(user.deletionRequest.requestedAt)) / (1000 * 60 * 60 * 24)
          );

          if (daysPending <= 7) pendingRanges['0-7 days']++;
          else if (daysPending <= 14) pendingRanges['8-14 days']++;
          else if (daysPending <= 30) pendingRanges['15-30 days']++;
          else if (daysPending <= 60) pendingRanges['31-60 days']++;
          else pendingRanges['60+ days']++;
        }
      });

      console.log('\nDeletion Requests by Days Pending:');
      Object.entries(pendingRanges).forEach(([range, count]) => {
        console.log(`  - ${range}: ${count}`);
      });

      // Oldest pending request
      if (usersWithPendingDeletion.length > 0) {
        const oldestRequest = usersWithPendingDeletion[0];
        const daysPending = Math.floor(
          (now - new Date(oldestRequest.deletionRequest.requestedAt)) / (1000 * 60 * 60 * 24)
        );

        console.log('\n⏰ Oldest Pending Deletion Request:');
        console.log(`  - User: ${oldestRequest.name} (${oldestRequest.email})`);
        console.log(`  - Requested: ${new Date(oldestRequest.deletionRequest.requestedAt).toLocaleString()}`);
        console.log(`  - Days Pending: ${daysPending} days`);
      }

    } else {
      console.log('✅ No users found with pending deletion requests');
    }

    // Also show summary of all deletion request statuses
    console.log('\n\n📋 Summary of ALL Deletion Requests:');
    const allDeletionRequests = allUsers.filter(user => user.deletionRequest && user.deletionRequest.status);

    const statusStats = allDeletionRequests.reduce((acc, user) => {
      acc[user.deletionRequest.status] = (acc[user.deletionRequest.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`Total users with deletion requests: ${allDeletionRequests.length}`);
    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the function
getUsersWithPendingDeletion();
