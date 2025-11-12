# 🔐 How to Get JWT Token for Categories

## Problem
Category creation requires a JWT token, but you don't have one yet.

## Solution: Get Your JWT Token

### Quick Step-by-Step

1. **Open Terminal** in your backend directory:
   ```bash
   cd /Users/rida/Documents/GitHub/epi.backend
   ```

2. **Make sure MongoDB is running:**
   ```bash
   # Check if MongoDB is running
   brew services list | grep mongodb
   
   # If not running, start it:
   brew services start mongodb-community
   ```

3. **Start your backend server** (if not already running):
   ```bash
   npm run dev
   ```

4. **Create an admin user and get token:**
   ```bash
   node scripts/create-admin.js
   ```

5. **Copy the JWT token** from the output

6. **Paste it in the dashboard:**
   - Open `/admin-dashboard.html`
   - Find "Admin JWT Token" field at the top
   - Paste your token there
   - Click "Test Connection"

---

## Example Token Output

When you run `node scripts/create-admin.js`, you'll see:

```
✅ Admin user created successfully!
Email: admin@example.com
Password: GeneratedPassword123
JWT Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDcwOTMwOWUzYjY3MDAwMTY4ZjNmNDYiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNjMwNzAyMDAwfQ.abcd1234efgh5678ijkl9012mnop3456
```

**Copy this entire JWT Token** (the long `eyJ...` part)

---

## Using the Token

### In Dashboard

1. Scroll to top of `/admin-dashboard.html`
2. Find this field:
   ```
   Admin JWT Token (Optional - for category management & admin endpoints)
   ```
3. Paste your full JWT token
4. Now you can create/edit/delete categories! ✅

### In cURL Command

```bash
# Create category with token
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name": "Electronics",
    "description": "All electronic products"
  }'
```

Replace `YOUR_JWT_TOKEN_HERE` with your actual token.

---

## What the Token Looks Like

It's a long string with 3 parts separated by dots:

```
Header.Payload.Signature
↓      ↓       ↓
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJ1c2VySWQiOiI2MDcwOTMwOWUzYjY3MDAwMTY4ZjNmNDYiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNjMwNzAyMDAwfQ . abcd1234efgh5678ijkl9012mnop3456
```

---

## Token Expiration

Tokens expire after a set time (usually 24 hours). If you get:
```
❌ Token is invalid or expired
```

Just run the script again to get a new token:
```bash
node scripts/create-admin.js
```

---

## Troubleshooting

### ❌ "No such file or directory: scripts/create-admin.js"
Make sure you're in the correct directory:
```bash
cd /Users/rida/Documents/GitHub/epi.backend
```

### ❌ "MongoDB connection failed"
Start MongoDB first:
```bash
brew services start mongodb-community
```

### ❌ "Token shows undefined in dashboard"
You might have pasted it incorrectly. Clear the field and try again:
1. Click the token field
2. Clear all text (Cmd+A, Delete)
3. Paste fresh token
4. Check for extra spaces

### ❌ "Still can't create categories"
Try testing the connection:
1. Paste token
2. Click "Test Connection" button
3. Should show "✅ Connection successful!"
4. Then try creating category

---

## Complete Workflow

```bash
# 1. Start MongoDB
brew services start mongodb-community

# 2. Start backend server
npm run dev

# 3. Create admin user and get token
node scripts/create-admin.js

# Copy the JWT token from output

# 4. Open admin dashboard
# file:///Users/rida/Documents/GitHub/epi.backend/admin-dashboard.html

# 5. Paste token in the dashboard

# 6. Create categories! 🎉
```

---

## What Happens With Token

**WITH Token:**
- ✅ Create categories
- ✅ Edit categories
- ✅ Delete categories
- ✅ Reorder categories

**WITHOUT Token:**
- ❌ Can't create categories
- ❌ Can't edit categories
- ❌ Can't delete categories
- ✅ Can create products (products don't need token)

---

## Security Note

🔒 **Keep your token safe:**
- Don't share it publicly
- Don't commit it to Git
- Don't paste it in unsecured places
- Only use it in your local development

In production, implement proper authentication with:
- Login endpoint
- Refresh tokens
- Secure HTTP-only cookies

---

**Need Help?** Check `AUTHENTICATION_GUIDE.md` for more details!
