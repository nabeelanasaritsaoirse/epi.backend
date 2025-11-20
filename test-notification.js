const http = require('http');

// Test 1: Create notification
console.log('\n📝 Test 1: Creating notification...');
const createData = JSON.stringify({
  title: "Test Notification",
  message: "This is a test message",
  type: "inapp",
  link: "https://example.com/offer",
  priority: "high"
});

const createOptions = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/notifications',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(createData)
  }
};

const createReq = http.request(createOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ Create Response:', JSON.parse(data));
    
    // Extract notification ID for further tests
    try {
      const result = JSON.parse(data);
      if (result.data && result.data._id) {
        const notifId = result.data._id;
        
        // Test 2: Get all notifications
        console.log('\n📋 Test 2: Getting all notifications...');
        const getAllOptions = {
          hostname: '127.0.0.1',
          port: 3000,
          path: '/api/notifications/admin/all',
          method: 'GET'
        };
        
        const getAllReq = http.request(getAllOptions, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            console.log('✅ Get All Response:', JSON.parse(data));
            
            // Test 3: Get in-app notifications
            console.log('\n📱 Test 3: Getting in-app notifications...');
            const getInAppOptions = {
              hostname: '127.0.0.1',
              port: 3000,
              path: '/api/notifications/public/inapp',
              method: 'GET'
            };
            
            const getInAppReq = http.request(getInAppOptions, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                console.log('✅ Get In-App Response:', JSON.parse(data));
                
                // Test 4: Mark as read
                console.log(`\n✔️ Test 4: Marking notification ${notifId} as read...`);
                const readData = JSON.stringify({
                  userId: 'test-user-123'
                });
                
                const readOptions = {
                  hostname: '127.0.0.1',
                  port: 3000,
                  path: `/api/notifications/${notifId}/read`,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(readData)
                  }
                };
                
                const readReq = http.request(readOptions, (res) => {
                  let data = '';
                  res.on('data', (chunk) => { data += chunk; });
                  res.on('end', () => {
                    console.log('✅ Mark as Read Response:', JSON.parse(data));
                    process.exit(0);
                  });
                });
                
                readReq.on('error', (e) => console.error('❌ Error:', e));
                readReq.write(readData);
                readReq.end();
              });
            });
            
            getInAppReq.on('error', (e) => console.error('❌ Error:', e));
            getInAppReq.end();
          });
        });
        
        getAllReq.on('error', (e) => console.error('❌ Error:', e));
        getAllReq.end();
      }
    } catch (e) {
      console.error('❌ Parse error:', e);
    }
  });
});

createReq.on('error', (e) => console.error('❌ Error:', e));
createReq.write(createData);
createReq.end();
