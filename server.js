require('dotenv').config();

// Set timezone to India (IST)
process.env.TZ = 'Asia/Kolkata';

const app = require('./index');

const PORT = process.env.PORT || 5000;

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});
