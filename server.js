require('dotenv').config();

// Set timezone to India (IST)
process.env.TZ = 'Asia/Kolkata';

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
