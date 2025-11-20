# 🚀 Flutter Team - Start Here!

## Welcome to Installment Order System Integration

This guide will help you integrate the installment payment system into your Flutter app.

---

## 📚 Documents Available

We've created **4 documents** for you. Read them in this order:

### 1. **PAYMENT_FLOW_DIAGRAM.md** ⭐ START HERE
**What:** Visual flow diagrams
**Why:** Understand how everything works visually
**Time:** 5 minutes
**You'll learn:** Complete payment flow with diagrams

### 2. **API_ENDPOINTS_SUMMARY.md**
**What:** Quick API reference
**Why:** Fast lookup of all endpoints
**Time:** 5 minutes
**You'll learn:** All endpoints with request/response examples

### 3. **FLUTTER_INTEGRATION_GUIDE.md** ⭐ MAIN GUIDE
**What:** Complete Flutter integration guide
**Why:** Copy-paste ready code for your app
**Time:** 30 minutes
**You'll learn:**
- Complete Flutter code examples
- Razorpay SDK integration
- Error handling
- UI examples

### 4. **INSTALLMENT_POSTMAN_COLLECTION.json**
**What:** Postman collection for testing
**Why:** Test APIs before coding
**Time:** 10 minutes
**You'll learn:** How to test all APIs

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Understand the Flow

**Wallet Payment:**
```
User clicks "Create Order"
    → Flutter calls API
    → ✅ Done! Order created
```

**Razorpay Payment:**
```
User clicks "Create Order"
    → Flutter calls API
    → Backend returns Razorpay details
    → Flutter opens Razorpay SDK
    → User pays
    → Flutter sends response to backend
    → ✅ Done! Payment verified
```

### Step 2: Add Dependencies

Add to `pubspec.yaml`:
```yaml
dependencies:
  razorpay_flutter: ^1.3.4
  http: ^1.1.0
```

### Step 3: Test with Postman

1. Import `INSTALLMENT_POSTMAN_COLLECTION.json`
2. Set your auth token
3. Test creating an order
4. See the responses

### Step 4: Start Coding

Open `FLUTTER_INTEGRATION_GUIDE.md` and copy the code examples!

---

## 🎯 What Backend Handles (You Don't Need To)

✅ **Razorpay Order Creation** - Backend creates all Razorpay orders
✅ **Payment Verification** - Backend verifies signatures
✅ **Wallet Deduction** - Backend handles wallet operations
✅ **Commission Calculation** - Auto-calculated on every payment
✅ **Commission Split** - Auto-split 90% available, 10% locked
✅ **Order Status Updates** - Auto-updated based on payments

**You just:**
- Call APIs
- Show Razorpay SDK
- Display data nicely

---

## 📱 What You Need to Build

### 1. Product Page
- Show daily installment option
- Days selector (30, 60, 90...)
- Payment method selector (Wallet/Razorpay)
- "Create Order" button

### 2. Order Details Page
- Progress bar showing % paid
- Installments paid / total
- "Pay Next Installment" button
- Payment history list

### 3. Orders List Page
- Show all user orders
- Filter by status (Active/Completed)
- Quick pay button for active orders

### 4. Razorpay Integration
- Initialize Razorpay SDK
- Handle success/error callbacks
- Send response to backend

---

## 🔑 Key Information

**Base URL:**
```
http://your-server.com/api/installment
```

**Authentication:**
```
Authorization: Bearer <user_token>
```

**Main Endpoints:**
```
POST   /orders                         → Create order
GET    /orders/:orderId                → Get order details
GET    /orders/:orderId/schedule       → Get payment schedule
POST   /payments/process               → Process payment
POST   /payments/create-razorpay-order → Create Razorpay order
```

---

## 💡 Example: Create Order Flow

### Flutter Code:
```dart
// User clicks "Create Order"
final response = await http.post(
  Uri.parse('http://your-server.com/api/installment/orders'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'productId': '64a1b2c3d4e5f6789012345',
    'totalDays': 30,
    'paymentMethod': 'WALLET', // or 'RAZORPAY'
    'deliveryAddress': { /* address */ }
  }),
);

final data = jsonDecode(response.body);

if (data['success']) {
  // Order created!
  print('Order ID: ${data['data']['order']['orderId']}');
}
```

**If Wallet:** ✅ Done! Order created, first payment deducted

**If Razorpay:**
1. Backend returns Razorpay order details
2. Open Razorpay SDK with those details
3. User pays
4. Send payment response back to verify

---

## 🎨 UI Screenshots Needed

You'll need to design:

1. **Installment Option on Product Page**
   - Daily amount display
   - Days selector
   - Payment method toggle

2. **Order Progress Card**
   - Progress bar (0-100%)
   - Amount paid / Total
   - "Pay Next" button

3. **Payment Schedule List**
   - ✅ Paid installments (green)
   - ⏳ Pending installments (gray)
   - Dates and amounts

4. **Order Status Badges**
   - ACTIVE (blue)
   - COMPLETED (green)
   - PENDING (yellow)

---

## ⚠️ Important Rules

### Order Creation:
- Min days: **5**
- Min daily amount: **₹50**
- Max days: **100-365** (based on product price)
- First payment: **Immediate** (no option to skip)

### Daily Payments:
- Users **can skip days** (no penalty)
- Users **can pay multiple** installments in one day
- Payment amount is **fixed** (daily amount)

### Order Status:
- **PENDING** → First payment not done
- **ACTIVE** → Accepting payments
- **COMPLETED** → All paid, awaiting approval
- **CANCELLED** → User cancelled

---

## 🐛 Common Issues & Solutions

### Issue: "Insufficient wallet balance"
**Solution:** Show "Add Money to Wallet" option

### Issue: Razorpay popup doesn't open
**Solution:** Ensure Razorpay SDK is initialized in initState()

### Issue: Payment verification fails
**Solution:** Make sure you're sending all 3 values from Razorpay:
- razorpayOrderId
- razorpayPaymentId
- razorpaySignature

### Issue: Order not found
**Solution:** Use the `orderId` from response (e.g., "ORD-20241120-A3F2"), not the MongoDB `_id`

---

## 📞 Need Help?

### API Errors:
Check the error response:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance",
    "details": { /* helpful info */ }
  }
}
```

Use `error.code` to show appropriate messages to users.

### Common Error Codes:
- `INSUFFICIENT_BALANCE` → Show "Add money" option
- `ORDER_NOT_FOUND` → Invalid order ID
- `ORDER_ALREADY_COMPLETED` → Show "Order complete" message
- `VALIDATION_ERROR` → Check error.details.errors for field-specific errors

---

## ✅ Testing Checklist

Before going live, test:

- [ ] Create order with wallet
- [ ] Create order with Razorpay
- [ ] View order details
- [ ] View payment schedule
- [ ] Pay installment with wallet
- [ ] Pay installment with Razorpay
- [ ] View order list
- [ ] Handle "insufficient balance" error
- [ ] Handle "order complete" scenario
- [ ] Order cancellation

---

## 🎯 Your Next Steps

1. ✅ Read **PAYMENT_FLOW_DIAGRAM.md** (5 min)
2. ✅ Import **Postman collection** and test APIs (10 min)
3. ✅ Add Razorpay dependency to Flutter (2 min)
4. ✅ Read **FLUTTER_INTEGRATION_GUIDE.md** (30 min)
5. ✅ Copy code examples and start building! 🚀

---

## 🎉 Summary

**Backend:** Handles all complex logic (Razorpay, wallet, commission, verification)
**Flutter:** Simple API calls + show Razorpay SDK + nice UI
**Result:** Clean, secure, easy integration!

**Ready to start?** → Open `PAYMENT_FLOW_DIAGRAM.md` first! 📖

---

**Questions?** Check the guides or contact backend team.

**Good luck!** 🚀
