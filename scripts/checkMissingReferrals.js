const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTE1ZTc1NmE3YjAzNmFhMjJhZjNkNDYiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE3NjcwMTIwNDUsImV4cCI6MTc2NzYxNjg0NX0.cUY0tQp27LDtmKL-7j0f7le5rIjgn69yt6S-vbkqC-I';

const options = {
  hostname: 'api.epielio.com',
  path: '/api/users',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const users = JSON.parse(data);
    const sunilId = '693a98f06b96469dc79aba35';

    // Search by name for missing users
    const missingNames = [
      'sharanu',
      'revansidda',
      'kashinath',
      'vijay',
      'chowdaya',
      'babu',
      'devindrapa',
      'mallu',
      'vinod',
      'sai',
      'pavan',
      'uday',
      'ramesh'
    ];

    console.log('=== SEARCHING FOR MISSING USERS BY NAME ===\n');

    missingNames.forEach(name => {
      const matches = users.filter(u =>
        u.name && u.name.toLowerCase().includes(name.toLowerCase())
      );

      if (matches.length > 0) {
        console.log(`"${name}" - FOUND ${matches.length} matches:`);
        matches.forEach(u => {
          console.log(`  - ${u.name} | Phone: ${u.phoneNumber || 'none'} | ID: ${u._id}`);
          console.log(`    ReferredBy: ${u.referredBy || 'NOT SET'}`);
          console.log(`    Is Sunil's referral: ${u.referredBy === sunilId ? 'YES' : 'NO'}`);
          console.log(`    Created: ${u.createdAt}`);
        });
        console.log('');
      } else {
        console.log(`"${name}" - NOT FOUND in database`);
      }
    });

    // Also check users created from Dec 23 to Dec 26 (the dates of missing referrals)
    console.log('\n=== USERS CREATED DEC 23-26 (period of missing referrals) ===\n');

    const dec23 = new Date('2025-12-23T00:00:00Z');
    const dec27 = new Date('2025-12-27T00:00:00Z');

    const usersInPeriod = users.filter(u => {
      const created = new Date(u.createdAt);
      return created >= dec23 && created < dec27;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    console.log(`Total users created Dec 23-26: ${usersInPeriod.length}`);
    console.log('');

    usersInPeriod.forEach(u => {
      const isSunilRef = u.referredBy === sunilId;
      console.log(`${u.name} | ${u.phoneNumber || 'no phone'} | Created: ${u.createdAt.slice(0,10)}`);
      console.log(`  ReferredBy: ${u.referredBy || 'NOT SET'} ${isSunilRef ? '(SUNIL)' : ''}`);
    });
  });
});

req.on('error', console.error);
req.end();
