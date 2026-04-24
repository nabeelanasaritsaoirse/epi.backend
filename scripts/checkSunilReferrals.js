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

    // Phone numbers from the expected referral list
    const phoneNumbers = [
      '8618448657',   // Sangitha
      '7676737637',   // Veeresh
      '9113623659',   // Jayam
      '9900396946',   // Prabhakar
      '8197373164',   // Sanjana
      '6361678276',   // Sunil
      '8105620492',   // Sharanu
      '8431484775',   // Revansidda
      '9686062492',   // Kashinath
      '7760471328',   // Vijay kalavid
      '9113539985',   // Narasimh
      '8971234704',   // Ashu
      '9845319498',   // Chowdaya
      '9731492177',   // Babu
      '8971235899',   // Devindrapa
      '6363688724',   // Vikash
      '9731756199',   // Mallu
      '7411034763',   // Vinod
      '8050007872',   // Sai
      '8867554608',   // Pavan
      '7259672772',   // Uday
      '9972679990',   // Ramesh
    ];

    const sunilId = '693a98f06b96469dc79aba35';

    // Find users matching these phones
    const matchingUsers = users.filter(u => {
      if (!u.phoneNumber) return false;
      const normalizedPhone = u.phoneNumber.replace(/[^0-9]/g, '').slice(-10);
      return phoneNumbers.some(p => normalizedPhone === p);
    });

    console.log('=== USERS MATCHING THE PHONE NUMBERS ===');
    matchingUsers.forEach(u => {
      console.log('');
      console.log('Name:', u.name);
      console.log('Phone:', u.phoneNumber);
      console.log('User ID:', u._id);
      console.log('ReferredBy:', u.referredBy || 'NOT SET');
      console.log('Is referredBy Sunil?', u.referredBy === sunilId ? 'YES' : 'NO');
      console.log('Created:', u.createdAt);
    });

    console.log('');
    console.log('=== SUMMARY ===');
    console.log('Total matching users found:', matchingUsers.length);
    console.log('Users with referredBy set to Sunil:', matchingUsers.filter(u => u.referredBy === sunilId).length);
    console.log('Users with NO referredBy:', matchingUsers.filter(u => !u.referredBy).length);
    console.log('Users with DIFFERENT referrer:', matchingUsers.filter(u => u.referredBy && u.referredBy !== sunilId).length);

    // Also check if any users have referredBy set to Sunil
    console.log('');
    console.log('=== ALL USERS WITH referredBy = Sunil Kumar ===');
    const referredBySunil = users.filter(u => u.referredBy === sunilId);
    console.log('Total:', referredBySunil.length);
    referredBySunil.forEach(u => {
      console.log(`- ${u.name} (${u.phoneNumber || 'no phone'}) - ID: ${u._id} - Created: ${u.createdAt}`);
    });

    // Check Sunil's referredUsers array
    const sunil = users.find(u => u._id === sunilId);
    if (sunil) {
      console.log('');
      console.log('=== SUNIL referredUsers ARRAY ===');
      console.log('Count:', sunil.referredUsers ? sunil.referredUsers.length : 0);
      if (sunil.referredUsers) {
        sunil.referredUsers.forEach(id => {
          const refUser = users.find(u => u._id === id);
          if (refUser) {
            console.log(`- ${refUser.name} (${refUser.phoneNumber || 'no phone'}) - ID: ${id}`);
          } else {
            console.log(`- ID: ${id} (user not found)`);
          }
        });
      }
    }
  });
});

req.on('error', console.error);
req.end();
