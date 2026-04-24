const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUzYzVlMmFkNjAxMDIwMDY0MWE3MmIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDYxODAxOCwiZXhwIjoxNzcxMjIyODE4fQ.ohmIJDpE_5zOyurN-vx0-bcU7ClwRuPJjTEhMMewvMQ';

async function main() {
  try {
    console.log('Checking user profile...\n');

    const response = await axios.get(`${BASE_URL}/api/users/profile`, {
      headers: { 'Authorization': `Bearer ${USER_TOKEN}` }
    });

    console.log('User Profile:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
