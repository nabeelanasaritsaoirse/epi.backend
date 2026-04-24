const http = require('http');

function postReq(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const d = JSON.stringify(data);
        const req = http.request({
            hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }, timeout: 15000
        }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b))); });
        req.on('error', reject); req.write(d); req.end();
    });
}

function getReq(url, token) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const h = token ? { 'Authorization': `Bearer ${token}` } : {};
        const req = http.request({
            hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET',
            headers: h, timeout: 15000
        }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b))); });
        req.on('error', reject); req.end();
    });
}

async function test() {
    const login = await postReq('http://13.127.15.87:8080/api/admin-auth/login', { email: "admin@epi.com", password: "@Saoirse123" });
    const token = login.data.accessToken;

    // Get ALL products as admin and check exact listingStatus values
    const admin = await getReq('http://13.127.15.87:8080/api/products?limit=100&page=1', token);

    console.log("Admin products count:", admin.data.length);

    // Check the EXACT listingStatus field on each product
    const statusMap = {};
    const typeofMap = {};
    admin.data.forEach(p => {
        const v = p.listingStatus;
        const t = typeof v;
        const key = `"${v}" (${t})`;
        statusMap[key] = (statusMap[key] || 0) + 1;

        // Check for hidden chars
        if (v && typeof v === 'string') {
            const charCodes = [...v].map(c => c.charCodeAt(0));
            const ccKey = charCodes.join(',');
            typeofMap[ccKey] = (typeofMap[ccKey] || 0) + 1;
        }
    });

    console.log("\nlistingStatus distribution:");
    console.log(statusMap);

    console.log("\nChar codes of listingStatus values:");
    console.log(typeofMap);

    // Check if listingStatus field even exists in the schema correctly
    // Check hasOwnProperty
    const sample = admin.data[0];
    console.log("\nSample product keys:", Object.keys(sample).filter(k => k.includes('listing') || k.includes('status') || k.includes('Deleted')));
    console.log("  listingStatus:", JSON.stringify(sample.listingStatus));
    console.log("  isDeleted:", JSON.stringify(sample.isDeleted));
    console.log("  status:", JSON.stringify(sample.status));

    // THE REAL TEST: Does the admin controller NOT apply listingStatus filter?
    // Let's check if getAllProducts for admin has different behavior
    // In the admin endpoint, listingStatus filter is NOT set. For non-admin, it IS set.
    // But the admin endpoint ALSO doesn't set listingStatus filter and it returns 75.
    // So the question is: does listingStatus: "published" match what's in DB?

    // Check: is the field actually called something else?
    console.log("\n--- Checking if listingStatus exists on product document ---");
    console.log("sample._id:", sample._id);
    console.log("Has listingStatus:", 'listingStatus' in sample);
    console.log("listingStatus value:", sample.listingStatus);
    console.log("listingStatus === 'published':", sample.listingStatus === 'published');
}

test().catch(e => console.error("Error:", e.message));
