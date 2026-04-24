# QUICK WINS - IMMEDIATE IMPLEMENTATION GUIDE

This guide focuses on the highest-impact improvements you can implement TODAY.

## 🚨 CRITICAL - FIX THESE NOW (Before Anything Else)

### 1. Remove Hardcoded JWT Secret (30 minutes)

**Why:** Your authentication is completely compromised with the hardcoded fallback secret.

**File to Edit:** `middlewares/auth.js`

**Current Code (Line 298):**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
```

**Replace With:**
```javascript
// At the top of the file, before any exports
if (!process.env.JWT_SECRET) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ FATAL ERROR: JWT_SECRET is not set!');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error('Generate a secure secret:');
  console.error('node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  console.error('');
  console.error('Then add it to your .env file:');
  console.error('JWT_SECRET=<your-generated-secret>');
  console.error('');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
```

**Steps:**
1. Open terminal
2. Generate a secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Copy the output
4. Add to `.env` file:
   ```
   JWT_SECRET=<paste-your-generated-secret-here>
   ```
5. Update the code in `middlewares/auth.js` as shown above
6. Test: Try starting the server without JWT_SECRET - it should exit with error
7. Add JWT_SECRET back and server should start

**Deployment:**
- Add JWT_SECRET to production environment variables
- Add to GitHub Secrets if using CI/CD
- NEVER commit the actual secret to git

---

### 2. Implement Password Hashing (1 hour)

**Why:** Admin passwords are likely stored in plaintext.

**Files to Edit:**
- `models/User.js`
- `controllers/authController.js` (or wherever login is handled)

**Step 1: Add Bcrypt Hashing to User Model**

Edit `models/User.js`, add this BEFORE the final `module.exports`:

```javascript
const bcrypt = require('bcryptjs');

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};
```

**Step 2: Update Login Logic**

Find your admin login controller (likely in `controllers/authController.js` or similar).

**Replace:**
```javascript
if (user.password !== password) {
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}
```

**With:**
```javascript
const isPasswordValid = await user.comparePassword(password);
if (!isPasswordValid) {
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}
```

**Step 3: Migrate Existing Passwords**

If you have existing admin users with plaintext passwords:

```javascript
// Run this script ONCE to migrate existing passwords
// scripts/migrateAdminPasswords.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

async function migratePasswords() {
  await connectDB();

  const admins = await User.find({
    role: { $in: ['admin', 'super_admin'] },
    password: { $exists: true, $ne: null }
  });

  console.log(`Found ${admins.length} admin users to migrate`);

  for (const admin of admins) {
    // Check if password is already hashed (starts with $2a$ or $2b$)
    if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$')) {
      console.log(`✓ ${admin.email} already hashed`);
      continue;
    }

    // Save will trigger pre-save hook to hash
    await admin.save();
    console.log(`✓ Migrated ${admin.email}`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

migratePasswords().catch(console.error);
```

Run: `node scripts/migrateAdminPasswords.js`

---

### 3. Add Rate Limiting to Auth Endpoints (2 hours)

**Why:** Prevent brute force attacks on login.

**Step 1: Create Rate Limiter Middleware**

Create file: `middlewares/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests (only count failures)
  skipSuccessfulRequests: true,
  // Use IP + user agent for more accurate tracking
  keyGenerator: (req) => {
    return `${req.ip}-${req.headers['user-agent']}`;
  }
});

// Limiter for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment requests per hour
  message: {
    success: false,
    message: 'Too many payment requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aggressive limiter for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after 1 hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  paymentLimiter,
  generalLimiter,
  passwordResetLimiter
};
```

**Step 2: Apply to Routes**

Edit `routes/auth.js`:

```javascript
const { authLimiter, passwordResetLimiter } = require('../middlewares/rateLimiter');

// Apply to login endpoints
router.post('/login', authLimiter, login);
router.post('/signup', authLimiter, signup);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
```

Edit `routes/adminAuth.js`:

```javascript
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/login', authLimiter, adminLogin);
```

Edit `routes/payments.js`:

```javascript
const { paymentLimiter } = require('../middlewares/rateLimiter');

router.post('/razorpay/create-order', verifyToken, paymentLimiter, createOrder);
router.post('/razorpay/verify', verifyToken, paymentLimiter, verifyPayment);
```

**Step 3: Apply General Limiter Globally**

Edit `index.js`:

```javascript
const { generalLimiter } = require('./middlewares/rateLimiter');

// Add AFTER trust proxy, BEFORE routes
app.use('/api/', generalLimiter);
```

**Test:**
1. Try logging in with wrong password 6 times
2. 6th attempt should be blocked
3. Wait 15 minutes or restart server to reset

---

## ⚡ HIGH IMPACT - DO THIS WEEK

### 4. Add Input Validation (4 hours)

**Step 1: Create Validation Middleware**

Create file: `middlewares/validator.js`

```javascript
const { validationResult } = require('express-validator');

/**
 * Middleware to check validation errors
 * Use after express-validator rules
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.path || err.param,
          message: err.msg,
          value: err.value
        }))
      }
    });
  }

  next();
};
```

**Step 2: Create Validation Rules**

Create file: `validators/productValidator.js`

```javascript
const { body, param, query } = require('express-validator');
const { validate } = require('../middlewares/validator');

exports.createProductValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 3, max: 200 }).withMessage('Name must be 3-200 characters'),

  body('description.short')
    .trim()
    .notEmpty().withMessage('Short description is required')
    .isLength({ min: 10, max: 500 }).withMessage('Short description must be 10-500 characters'),

  body('brand')
    .trim()
    .notEmpty().withMessage('Brand is required'),

  body('pricing.regularPrice')
    .isNumeric().withMessage('Regular price must be a number')
    .isFloat({ min: 0 }).withMessage('Price cannot be negative'),

  body('category.mainCategoryId')
    .notEmpty().withMessage('Main category is required')
    .isMongoId().withMessage('Invalid category ID'),

  validate
];

exports.updateProductValidator = [
  param('id')
    .isMongoId().withMessage('Invalid product ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Name must be 3-200 characters'),

  body('pricing.regularPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Price cannot be negative'),

  validate
];

exports.getProductValidator = [
  param('id')
    .isMongoId().withMessage('Invalid product ID'),
  validate
];

exports.listProductsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  validate
];
```

**Step 3: Apply Validation to Routes**

Edit `routes/productRoutes.js`:

```javascript
const {
  createProductValidator,
  updateProductValidator,
  getProductValidator,
  listProductsValidator
} = require('../validators/productValidator');

router.get('/products', listProductsValidator, getProducts);
router.get('/products/:id', getProductValidator, getProduct);
router.post('/products', verifyToken, isAdmin, createProductValidator, createProduct);
router.put('/products/:id', verifyToken, isAdmin, updateProductValidator, updateProduct);
```

**Step 4: Create More Validators**

Create similar validators for:
- `validators/userValidator.js`
- `validators/orderValidator.js`
- `validators/authValidator.js`

---

### 5. Fix Money Handling (2 hours)

**Why:** JavaScript floats cause rounding errors in financial calculations.

**Step 1: Create Money Utility**

Create file: `utils/moneyUtils.js`

```javascript
/**
 * Money utility for handling currency calculations
 * Stores all amounts in paise (smallest unit) to avoid floating point errors
 */

class Money {
  /**
   * Convert rupees to paise
   * @param {number} rupees - Amount in rupees
   * @returns {number} Amount in paise
   */
  static toPaise(rupees) {
    return Math.round(rupees * 100);
  }

  /**
   * Convert paise to rupees
   * @param {number} paise - Amount in paise
   * @returns {number} Amount in rupees
   */
  static toRupees(paise) {
    return paise / 100;
  }

  /**
   * Add two amounts (in paise)
   * @param {number} amount1 - First amount in paise
   * @param {number} amount2 - Second amount in paise
   * @returns {number} Sum in paise
   */
  static add(amount1, amount2) {
    return amount1 + amount2;
  }

  /**
   * Subtract two amounts (in paise)
   */
  static subtract(amount1, amount2) {
    return amount1 - amount2;
  }

  /**
   * Multiply amount by a factor
   */
  static multiply(amount, factor) {
    return Math.round(amount * factor);
  }

  /**
   * Divide amount by a divisor
   */
  static divide(amount, divisor) {
    return Math.round(amount / divisor);
  }

  /**
   * Calculate percentage
   */
  static percentage(amount, percent) {
    return Math.round((amount * percent) / 100);
  }

  /**
   * Format amount for display
   * @param {number} paise - Amount in paise
   * @param {string} currency - Currency code
   * @returns {string} Formatted string
   */
  static format(paise, currency = 'INR') {
    const rupees = this.toRupees(paise);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rupees);
  }

  /**
   * Validate amount
   */
  static isValid(amount) {
    return typeof amount === 'number' && !isNaN(amount) && amount >= 0;
  }
}

module.exports = Money;
```

**Step 2: Usage in Controllers**

```javascript
const Money = require('../utils/moneyUtils');

// Example: Order creation
exports.createOrder = async (req, res) => {
  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);

  // Convert price to paise
  const priceInPaise = Money.toPaise(product.pricing.finalPrice);
  const totalInPaise = Money.multiply(priceInPaise, quantity);

  // Store in paise
  const order = await Order.create({
    user: req.user.id,
    product: productId,
    quantity,
    orderAmount: totalInPaise, // Store as integer (paise)
    paymentStatus: 'pending'
  });

  res.json({
    success: true,
    data: {
      order,
      amountFormatted: Money.format(totalInPaise) // Display formatted
    }
  });
};

// Example: Commission calculation
const commissionRate = 5; // 5%
const orderAmount = 50000; // in paise (₹500)
const commission = Money.percentage(orderAmount, commissionRate); // 2500 paise = ₹25
```

**Step 3: Update Model Comments**

Add comments to clarify money fields store paise:

```javascript
// models/Order.js
orderAmount: {
  type: Number,
  required: true,
  comment: 'Amount in paise (₹1 = 100 paise)'
}

// models/Product.js
pricing: {
  regularPrice: {
    type: Number,
    min: 0,
    comment: 'Price in paise'
  },
  // ...
}
```

**Note:** For existing data, you'll need a migration script to convert rupees to paise.

---

### 6. Add Helmet for Security Headers (5 minutes)

**Install:**
```bash
npm install helmet
```

**Edit `index.js`:**

```javascript
const helmet = require('helmet');

// Add AFTER app initialization, BEFORE routes
app.use(helmet());

// Optional: Custom CSP if you have specific needs
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:", "http:"],
    connectSrc: ["'self'", "https://api.razorpay.com"],
  }
}));
```

---

### 7. Add Compression (5 minutes)

**Install:**
```bash
npm install compression
```

**Edit `index.js`:**

```javascript
const compression = require('compression');

// Add AFTER helmet, BEFORE routes
app.use(compression());
```

This will reduce response sizes by 70-90%.

---

## 🧪 TESTING - START TODAY

### 8. Set Up Jest (1 hour)

**Install:**
```bash
npm install --save-dev jest supertest @shelf/jest-mongodb mongodb-memory-server
```

**Update `package.json`:**

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "controllers/**/*.js",
      "services/**/*.js",
      "utils/**/*.js",
      "!node_modules/**"
    ],
    "testMatch": [
      "**/tests/**/*.test.js"
    ],
    "preset": "@shelf/jest-mongodb"
  }
}
```

**Create test config:** `tests/setup/testDb.js`

```javascript
const mongoose = require('mongoose');

beforeAll(async () => {
  // MongoDB Memory Server will be automatically started by preset
});

afterAll(async () => {
  await mongoose.connection.close();
});

afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

**Create your first test:** `tests/unit/utils/moneyUtils.test.js`

```javascript
const Money = require('../../../utils/moneyUtils');

describe('Money Utils', () => {
  describe('toPaise', () => {
    it('should convert rupees to paise correctly', () => {
      expect(Money.toPaise(100)).toBe(10000);
      expect(Money.toPaise(1.50)).toBe(150);
      expect(Money.toPaise(0.01)).toBe(1);
    });
  });

  describe('toRupees', () => {
    it('should convert paise to rupees correctly', () => {
      expect(Money.toRupees(10000)).toBe(100);
      expect(Money.toRupees(150)).toBe(1.5);
      expect(Money.toRupees(1)).toBe(0.01);
    });
  });

  describe('add', () => {
    it('should add two amounts correctly', () => {
      expect(Money.add(100, 200)).toBe(300);
      expect(Money.add(0, 100)).toBe(100);
    });
  });

  describe('percentage', () => {
    it('should calculate percentage correctly', () => {
      expect(Money.percentage(10000, 10)).toBe(1000); // 10% of ₹100
      expect(Money.percentage(50000, 5)).toBe(2500); // 5% of ₹500
    });
  });

  describe('format', () => {
    it('should format amount correctly', () => {
      expect(Money.format(10000)).toContain('100');
      expect(Money.format(150)).toContain('1.50');
    });
  });
});
```

**Run tests:**
```bash
npm test
```

---

## 📈 MONITORING - SET UP TODAY

### 9. Better Logging with Winston (30 minutes)

**Install:**
```bash
npm install winston winston-daily-rotate-file
```

**Create:** `utils/logger.js`

```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'epi-backend' },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m'
    }),
    // Combined logs
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m'
    })
  ]
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

**Replace console.log with logger:**

```javascript
// OLD
console.log('User created successfully');
console.error('Error creating user:', error);

// NEW
const logger = require('../utils/logger');
logger.info('User created successfully', { userId: user._id });
logger.error('Error creating user', { error: error.message, stack: error.stack });
```

---

## ✅ CHECKLIST

Copy this to track your progress:

```
🔴 CRITICAL (Do Today):
[ ] Remove hardcoded JWT secret
[ ] Implement password hashing
[ ] Add rate limiting to auth endpoints
[ ] Test: Try brute force attack - should be blocked

⚡ HIGH IMPACT (This Week):
[ ] Add input validation to all endpoints
[ ] Fix money handling (use paise)
[ ] Add Helmet security headers
[ ] Add compression middleware
[ ] Set up Jest testing
[ ] Replace console.log with Winston logger

📝 VERIFICATION:
[ ] JWT_SECRET is in .env (not hardcoded)
[ ] Admin passwords are hashed in database
[ ] Login rate limiting works (test with 6 failed attempts)
[ ] At least 10 tests written and passing
[ ] All API responses are gzipped (check Network tab)

🚀 DEPLOYMENT:
[ ] JWT_SECRET added to production env vars
[ ] Production logs directory created
[ ] PM2 restart after changes
[ ] Test production endpoints
```

---

## 🆘 TROUBLESHOOTING

**Rate limiting not working?**
- Check `app.set('trust proxy', 1)` is set in index.js
- Verify you're behind nginx/load balancer

**Tests failing?**
- Check MongoDB Memory Server installed: `npm list mongodb-memory-server`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Logging errors?**
- Create logs directory: `mkdir logs`
- Check write permissions: `chmod 755 logs`

---

## 📞 NEED HELP?

If you encounter issues:
1. Check error logs: `pm2 logs epi-backend`
2. Check application logs: `tail -f logs/error-*.log`
3. Verify environment variables: `pm2 env 0`

---

**Next Steps:** After completing these quick wins, move on to the full roadmap in BACKEND_ANALYSIS_AND_RECOMMENDATIONS.md
