const axios = require('axios');

async function getSkipped() {
  try {
    const response = await axios.get('http://localhost:5000/api/health-check/json');
    const skipped = response.data.results.filter(r => r.status === 'SKIPPED');

    console.log(`\n=== ${skipped.length} SKIPPED ENDPOINTS ===\n`);

    skipped.forEach(r => {
      const key = `'${r.method} ${r.path}'`;
      console.log(`${key}: { requiresAuth: false },`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getSkipped();
