const axios = require('axios');
const fs = require('fs');

const API_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function exportAffectedUsers() {
  try {
    console.log('🔐 Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful!\n');

    // Fetch all users to get phone numbers
    console.log('📥 Fetching all users...');
    const usersResponse = await axios.get(`${API_URL}/users/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const allUsers = usersResponse.data;

    // Read the anomalies report
    const reportPath = fs.readdirSync('./backups')
      .filter(f => f.startsWith('wallet-anomalies-report'))
      .sort()
      .reverse()[0];

    const report = JSON.parse(fs.readFileSync(`./backups/${reportPath}`, 'utf8'));

    // Combine extreme values and inconsistent data
    const affectedUserIds = [
      ...report.anomalies.extremeValues.map(u => u.userId),
      ...report.anomalies.inconsistentData.map(u => u.userId)
    ];

    // Get full user details
    const affectedUsers = allUsers.filter(u => affectedUserIds.includes(u._id));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`   LIST OF ${affectedUsers.length} AFFECTED USERS`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('DETAILED LIST:\n');
    affectedUsers.forEach((user, index) => {
      const anomaly = [
        ...report.anomalies.extremeValues,
        ...report.anomalies.inconsistentData
      ].find(a => a.userId === user._id);

      console.log(`${index + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
      console.log(`   User ID: ${user._id}`);

      if (anomaly.field === 'balance') {
        console.log(`   ⚠️  CRITICAL: Extreme balance value!`);
        console.log(`   Balance: ${anomaly.value}`);
      } else {
        console.log(`   Issue: Balance Mismatch`);
        console.log(`   Total Balance: ₹${anomaly.totalBalance}`);
        console.log(`   Wallet Balance: ₹${anomaly.walletBalance}`);
        console.log(`   Difference: ₹${anomaly.difference}`);
      }
      console.log('─'.repeat(70));
    });

    // Export CSV
    console.log('\n\n📄 CSV FORMAT (Copy to Excel):\n');
    console.log('No,Name,Email,Phone,User ID,Total Balance,Wallet Balance,Difference,Issue Type');

    affectedUsers.forEach((user, index) => {
      const anomaly = [
        ...report.anomalies.extremeValues,
        ...report.anomalies.inconsistentData
      ].find(a => a.userId === user._id);

      const phone = user.phoneNumber || 'N/A';
      const issueType = anomaly.field === 'balance' ? 'EXTREME VALUE' : 'BALANCE MISMATCH';
      const totalBal = anomaly.totalBalance !== undefined ? anomaly.totalBalance : 0;
      const walletBal = anomaly.walletBalance !== undefined ? anomaly.walletBalance : anomaly.value;
      const diff = anomaly.difference !== undefined ? anomaly.difference : walletBal;

      console.log(`${index + 1},"${user.name}","${user.email}","${phone}","${user._id}",${totalBal},${walletBal},${diff},"${issueType}"`);
    });

    // Export just emails and phones
    console.log('\n\n📧 EMAILS ONLY:\n');
    affectedUsers.forEach(user => {
      if (!user.email.includes('@temp.user')) {
        console.log(user.email);
      }
    });

    console.log('\n\n📱 PHONE NUMBERS ONLY:\n');
    affectedUsers.forEach(user => {
      if (user.phoneNumber) {
        console.log(user.phoneNumber);
      }
    });

    // Save to file
    const outputContent = {
      timestamp: new Date().toISOString(),
      totalAffected: affectedUsers.length,
      users: affectedUsers.map(user => {
        const anomaly = [
          ...report.anomalies.extremeValues,
          ...report.anomalies.inconsistentData
        ].find(a => a.userId === user._id);

        return {
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userId: user._id,
          createdAt: user.createdAt,
          issue: anomaly.field === 'balance' ? 'EXTREME VALUE' : 'BALANCE MISMATCH',
          totalBalance: anomaly.totalBalance,
          walletBalance: anomaly.walletBalance || anomaly.value,
          difference: anomaly.difference
        };
      })
    };

    fs.writeFileSync(
      './backups/affected-users-contact-list.json',
      JSON.stringify(outputContent, null, 2)
    );

    console.log('\n\n✅ Full list saved to: scripts/backups/affected-users-contact-list.json');

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

exportAffectedUsers();
