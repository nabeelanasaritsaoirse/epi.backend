#!/bin/bash

echo "🚀 JWT Authentication Setup Script"
echo "===================================="
echo ""

# Check if running in project directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "   Please run this script from your project root directory"
    exit 1
fi

echo "📦 Step 1: Installing jsonwebtoken..."
npm install jsonwebtoken
if [ $? -eq 0 ]; then
    echo "✅ jsonwebtoken installed successfully"
else
    echo "❌ Failed to install jsonwebtoken"
    exit 1
fi
echo ""

echo "🔧 Step 2: Checking .env file..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating..."
    touch .env
    echo "✅ .env file created"
else
    echo "✅ .env file exists"
fi
echo ""

echo "🔑 Step 3: Checking JWT_SECRET..."
if grep -q "JWT_SECRET" .env; then
    echo "✅ JWT_SECRET already exists in .env"
else
    echo "⚠️  JWT_SECRET not found. Adding..."
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo "✅ JWT_SECRET added to .env"
fi
echo ""

echo "📁 Step 4: Checking file structure..."
if [ -d "middlewares" ]; then
    echo "✅ middlewares/ directory exists"
else
    echo "⚠️  Creating middlewares/ directory..."
    mkdir -p middlewares
    echo "✅ middlewares/ directory created"
fi

if [ -d "routes" ]; then
    echo "✅ routes/ directory exists"
else
    echo "⚠️  Creating routes/ directory..."
    mkdir -p routes
    echo "✅ routes/ directory created"
fi

if [ -d "models" ]; then
    echo "✅ models/ directory exists"
else
    echo "⚠️  Creating models/ directory..."
    mkdir -p models
    echo "✅ models/ directory created"
fi
echo ""

echo "💾 Step 5: Backing up existing files..."
if [ -f "middlewares/auth.js" ]; then
    cp middlewares/auth.js middlewares/auth.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up middlewares/auth.js"
fi

if [ -f "routes/auth.js" ]; then
    cp routes/auth.js routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up routes/auth.js"
fi

if [ -f "models/User.js" ]; then
    cp models/User.js models/User.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up models/User.js"
fi
echo ""

echo "📝 Step 6: Ready to copy new files"
echo "   Please manually copy:"
echo "   - auth-with-jwt.js → middlewares/auth.js"
echo "   - authRoutes-with-jwt.js → routes/auth.js"
echo "   - User.js → models/User.js"
echo ""

echo "🧪 Step 7: Testing JWT setup..."
if command -v node &> /dev/null; then
    if [ -f "test-jwt-setup.js" ]; then
        node test-jwt-setup.js
    else
        echo "⚠️  test-jwt-setup.js not found. Skipping test."
    fi
else
    echo "⚠️  Node.js not found. Skipping test."
fi
echo ""

echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Copy the new files (auth-with-jwt.js, authRoutes-with-jwt.js, User.js)"
echo "   2. Restart your server: npm restart"
echo "   3. Test login endpoint"
echo ""
echo "📚 Documentation:"
echo "   - Session Management: SESSION_MANAGEMENT.md"
echo "   - Implementation Checklist: IMPLEMENTATION_CHECKLIST.md"
echo ""