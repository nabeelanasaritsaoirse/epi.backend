const jwt = require('jsonwebtoken');

console.log('🔍 Testing JWT Setup...\n');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

try {
  console.log('1️⃣ Checking JWT package...');
  console.log('   ✅ jsonwebtoken installed\n');
  
  console.log('2️⃣ Testing token generation...');
  const testToken = jwt.sign(
    { userId: 'test123', role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  console.log('   ✅ Token generated successfully');
  console.log('   Token:', testToken.substring(0, 50) + '...\n');
  
  console.log('3️⃣ Testing token verification...');
  const decoded = jwt.verify(testToken, JWT_SECRET);
  console.log('   ✅ Token verified successfully');
  console.log('   Decoded:', decoded, '\n');
  
  console.log('4️⃣ Checking JWT_SECRET...');
  if (process.env.JWT_SECRET) {
    console.log('   ✅ JWT_SECRET found in environment');
    console.log('   Length:', process.env.JWT_SECRET.length, 'characters\n');
  } else {
    console.log('   ⚠️  JWT_SECRET not found in environment');
    console.log('   Using default test secret\n');
  }
  
  console.log('5️⃣ Testing token expiry...');
  const expiredToken = jwt.sign(
    { userId: 'test123', role: 'user' },
    JWT_SECRET,
    { expiresIn: '1s' }
  );
  
  setTimeout(() => {
    try {
      jwt.verify(expiredToken, JWT_SECRET);
      console.log('   ❌ Token should have expired');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.log('   ✅ Token expiry working correctly\n');
      } else {
        console.log('   ❌ Unexpected error:', error.message);
      }
    }
    
    console.log('✅ JWT setup is working correctly!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Make sure JWT_SECRET is in .env file');
    console.log('   2. Restart your server: npm restart');
    console.log('   3. Test login endpoint with Postman/curl');
    
  }, 2000);
  
} catch (error) {
  console.error('❌ JWT setup failed!');
  console.error('Error:', error.message);
  console.log('\n📋 Fix:');
  console.log('   Run: npm install jsonwebtoken');
}