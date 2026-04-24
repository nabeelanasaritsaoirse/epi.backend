const jwt = require('jsonwebtoken');

const USER_ID = '698ad0c598104dd8464e00f8';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production'; // Update this from your .env

const token = jwt.sign(
  { userId: USER_ID, role: 'user' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('\n=== USER JWT TOKEN ===\n');
console.log('User ID:', USER_ID);
console.log('Phone: 1234567899');
console.log('\nToken (valid for 7 days):');
console.log(token);
console.log('\n=== USE THIS IN APIDOG ===');
console.log('Header: Authorization');
console.log('Value: Bearer ' + token);
console.log('\n========================\n');
