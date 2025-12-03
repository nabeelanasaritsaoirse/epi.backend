const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

// Decode JWT payload (base64)
const payload = token.split('.')[1];
const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());

console.log('🔓 Decoded JWT Payload:');
console.log(JSON.stringify(decoded, null, 2));
console.log('\n📝 User ID:', decoded.userId);
console.log('📏 User ID Length:', decoded.userId.length);
console.log('✅ Valid MongoDB ObjectId Length?', decoded.userId.length === 24 ? 'Yes' : 'No');

// Check for invisible characters
const bytes = Buffer.from(decoded.userId);
console.log('\n🔍 Hex representation:', bytes.toString('hex'));
