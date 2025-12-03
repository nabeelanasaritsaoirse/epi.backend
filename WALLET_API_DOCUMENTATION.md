# Wallet Management API Documentation

Complete guide for implementing wallet add money and withdrawal functionality for both User App and Admin Panel.

---

## Table of Contents

1. [User Wallet APIs](#user-wallet-apis)
   - [Add Money to Wallet](#1-add-money-to-wallet)
   - [Verify Payment](#2-verify-payment)
   - [Withdraw Money](#3-withdraw-money)
   - [Get Wallet Summary](#4-get-wallet-summary)
   - [Get Transaction History](#5-get-transaction-history)
2. [Admin Wallet APIs](#admin-wallet-apis)
   - [Get All Withdrawal Requests](#1-get-all-withdrawal-requests)
   - [Approve Withdrawal Request](#2-approve-withdrawal-request)
   - [Reject Withdrawal Request](#3-reject-withdrawal-request)
   - [Credit Money (Manual)](#4-credit-money-manual)
   - [Debit Money (Manual)](#5-debit-money-manual)
3. [Implementation Guides](#implementation-guides)
   - [User App: Add Money Flow](#user-app-add-money-flow)
   - [User App: Withdrawal Flow](#user-app-withdrawal-flow)
   - [Admin Panel: Withdrawal Management](#admin-panel-withdrawal-management)
4. [Data Models](#data-models)
5. [Status Codes & Error Handling](#status-codes--error-handling)

---

# User Wallet APIs

Base URL: `https://your-api-domain.com/api/wallet`

All user wallet endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Add Money to Wallet

Creates a Razorpay order for adding money to the user's wallet.

### Endpoint
```
POST /api/wallet/add-money
```

### Request Headers
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "amount": 1000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | Number | Yes | Amount to add (in INR, minimum 1) |

### Success Response (200 OK)
```json
{
  "success": true,
  "order_id": "order_MXkj8d9sKLm2Pq",
  "amount": 100000,
  "transaction_id": "6543210abcdef123456789"
}
```

| Field | Type | Description |
|-------|------|-------------|
| order_id | String | Razorpay order ID (use this to open Razorpay checkout) |
| amount | Number | Amount in paise (multiply by 100) |
| transaction_id | String | Internal transaction ID (needed for verification) |

### Error Responses

**400 Bad Request**
```json
{
  "message": "Invalid amount"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## 2. Verify Payment

Verifies the Razorpay payment signature and completes the wallet top-up.

### Endpoint
```
POST /api/wallet/verify-payment
```

### Request Headers
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "razorpay_order_id": "order_MXkj8d9sKLm2Pq",
  "razorpay_payment_id": "pay_MXkjN8kLm2PqRs",
  "razorpay_signature": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "transaction_id": "6543210abcdef123456789"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| razorpay_order_id | String | Yes | Order ID from Razorpay response |
| razorpay_payment_id | String | Yes | Payment ID from Razorpay response |
| razorpay_signature | String | Yes | Signature from Razorpay response |
| transaction_id | String | Yes | Transaction ID from add-money response |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Wallet updated",
  "transaction": {
    "_id": "6543210abcdef123456789",
    "user": "userId123",
    "type": "bonus",
    "amount": 1000,
    "status": "completed",
    "paymentMethod": "razorpay",
    "paymentDetails": {
      "orderId": "order_MXkj8d9sKLm2Pq",
      "paymentId": "pay_MXkjN8kLm2PqRs",
      "signature": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
    },
    "description": "Wallet load",
    "createdAt": "2024-11-28T10:30:00.000Z",
    "updatedAt": "2024-11-28T10:31:00.000Z"
  }
}
```

### Error Responses

**404 Not Found**
```json
{
  "message": "Transaction not found"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## 3. Withdraw Money

Submit a withdrawal request from wallet. Admin approval required.

### Endpoint
```
POST /api/wallet/withdraw
```

### Request Headers
```json
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body (UPI Withdrawal)
```json
{
  "amount": 500,
  "paymentMethod": "upi",
  "upiId": "user@paytm"
}
```

### Request Body (Bank Transfer Withdrawal)
```json
{
  "amount": 1000,
  "paymentMethod": "bank_transfer",
  "bankName": "State Bank of India",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "accountHolderName": "John Doe"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | Number | Yes | Amount to withdraw (minimum 1) |
| paymentMethod | String | Yes | Either "upi" or "bank_transfer" |

**For UPI Withdrawals:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| upiId | String | Yes | UPI ID (e.g., user@paytm, user@phonepe) |

**For Bank Transfer Withdrawals:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| bankName | String | Yes | Name of the bank |
| accountNumber | String | Yes | Bank account number |
| ifscCode | String | Yes | IFSC code of the bank branch |
| accountHolderName | String | Yes | Account holder's name |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Your withdrawal request has been submitted successfully. Money will be credited within 2 days.",
  "withdrawal": {
    "_id": "6543210abcdef123456789",
    "amount": 1000,
    "paymentMethod": "bank_transfer",
    "status": "pending",
    "createdAt": "2024-11-28T10:30:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request - Invalid Amount**
```json
{
  "success": false,
  "message": "Invalid amount"
}
```

**400 Bad Request - Invalid Payment Method**
```json
{
  "success": false,
  "message": "Payment method must be 'upi' or 'bank_transfer'"
}
```

**400 Bad Request - Missing UPI ID**
```json
{
  "success": false,
  "message": "UPI ID is required for UPI withdrawal"
}
```

**400 Bad Request - Missing Bank Details**
```json
{
  "success": false,
  "message": "Bank details required: bankName, accountNumber, ifscCode, accountHolderName"
}
```

**400 Bad Request - Insufficient Balance**
```json
{
  "success": false,
  "message": "Insufficient withdrawable balance"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## 4. Get Wallet Summary

Fetch complete wallet details including balance, transactions, and earnings.

### Endpoint
```
GET /api/wallet/
```

### Request Headers
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Wallet fetched",
  "walletBalance": 5000,
  "totalBalance": 8000,
  "holdBalance": 3000,
  "referralBonus": 2000,
  "investedAmount": 500,
  "requiredInvestment": 1500,
  "availableBalance": 5000,
  "totalEarnings": 2000,
  "transactions": [
    {
      "_id": "txn1",
      "type": "bonus",
      "amount": 1000,
      "status": "completed",
      "paymentMethod": "razorpay",
      "description": "Wallet load",
      "createdAt": "2024-11-28T10:30:00.000Z"
    },
    {
      "_id": "txn2",
      "type": "withdrawal",
      "amount": 500,
      "status": "pending",
      "paymentMethod": "upi",
      "paymentDetails": {
        "upiId": "user@paytm"
      },
      "description": "Wallet withdrawal request",
      "createdAt": "2024-11-28T11:00:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| walletBalance | Number | Available wallet balance |
| totalBalance | Number | Available + Hold balance |
| holdBalance | Number | Balance on hold (locked) |
| referralBonus | Number | Total referral bonus earned |
| investedAmount | Number | Amount invested to unlock referral |
| requiredInvestment | Number | Remaining investment required |
| availableBalance | Number | Balance available for withdrawal |
| totalEarnings | Number | Total earnings (commissions + bonus) |
| transactions | Array | List of all transactions |

---

## 5. Get Transaction History

Fetch detailed transaction history with summary statistics.

### Endpoint
```
GET /api/wallet/transactions
```

### Request Headers
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "transactions": [
    {
      "_id": "txn1",
      "type": "bonus",
      "amount": 1000,
      "status": "completed",
      "paymentMethod": "razorpay",
      "description": "Wallet load",
      "createdAt": "2024-11-28T10:30:00.000Z",
      "updatedAt": "2024-11-28T10:31:00.000Z"
    }
  ],
  "summary": {
    "total": 45,
    "completed": 40,
    "pending": 3,
    "failed": 2,
    "razorpayPayments": 15,
    "walletTransactions": 20,
    "emiPayments": 5,
    "commissions": 5,
    "totalEarnings": 5000,
    "totalSpent": 3000
  }
}
```

---

# Admin Wallet APIs

Base URL: `https://your-api-domain.com/api/admin/wallet`

All admin endpoints require authentication and admin role. Include the JWT token:
```
Authorization: Bearer <admin_jwt_token>
```

---

## 1. Get All Withdrawal Requests

Fetch all withdrawal requests with filtering and pagination.

### Endpoint
```
GET /api/admin/wallet/withdrawals
```

### Request Headers
```json
{
  "Authorization": "Bearer <admin_jwt_token>"
}
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | String | "all" | Filter by status: "pending", "completed", "failed", "cancelled", "all" |
| limit | Number | 50 | Number of records per page |
| page | Number | 1 | Page number |

### Example Requests

```
GET /api/admin/wallet/withdrawals?status=pending
GET /api/admin/wallet/withdrawals?status=completed&limit=20&page=2
GET /api/admin/wallet/withdrawals
```

### Success Response (200 OK)
```json
{
  "success": true,
  "withdrawals": [
    {
      "_id": "6543210abcdef123456789",
      "user": {
        "_id": "userId123",
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "+919876543210"
      },
      "type": "withdrawal",
      "amount": 1000,
      "status": "pending",
      "paymentMethod": "bank_transfer",
      "paymentDetails": {
        "bankName": "State Bank of India",
        "accountNumber": "1234567890",
        "ifscCode": "SBIN0001234",
        "accountHolderName": "John Doe"
      },
      "description": "Wallet withdrawal request",
      "createdAt": "2024-11-28T10:30:00.000Z",
      "updatedAt": "2024-11-28T10:30:00.000Z"
    },
    {
      "_id": "6543210abcdef987654321",
      "user": {
        "_id": "userId456",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phoneNumber": "+919876543211"
      },
      "type": "withdrawal",
      "amount": 500,
      "status": "pending",
      "paymentMethod": "upi",
      "paymentDetails": {
        "upiId": "jane@paytm"
      },
      "description": "Wallet withdrawal request",
      "createdAt": "2024-11-28T11:00:00.000Z",
      "updatedAt": "2024-11-28T11:00:00.000Z"
    }
  ],
  "summary": {
    "total": 120,
    "pending": 15,
    "completed": 100,
    "failed": 3,
    "cancelled": 2,
    "totalPendingAmount": 25000,
    "totalCompletedAmount": 500000
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalRecords": 120,
    "limit": 50
  }
}
```

### Response Fields

**Summary Object:**

| Field | Type | Description |
|-------|------|-------------|
| total | Number | Total withdrawal requests |
| pending | Number | Number of pending withdrawals |
| completed | Number | Number of completed withdrawals |
| failed | Number | Number of failed withdrawals |
| cancelled | Number | Number of cancelled withdrawals |
| totalPendingAmount | Number | Total amount in pending withdrawals |
| totalCompletedAmount | Number | Total amount in completed withdrawals |

**Pagination Object:**

| Field | Type | Description |
|-------|------|-------------|
| currentPage | Number | Current page number |
| totalPages | Number | Total number of pages |
| totalRecords | Number | Total number of records |
| limit | Number | Records per page |

---

## 2. Approve Withdrawal Request

Approve a pending withdrawal request and mark it as completed.

### Endpoint
```
POST /api/admin/wallet/withdrawals/approve
```

### Request Headers
```json
{
  "Authorization": "Bearer <admin_jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "transactionId": "6543210abcdef123456789",
  "adminNotes": "Payment processed via NEFT on 2024-11-28"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| transactionId | String | Yes | ID of the withdrawal transaction |
| adminNotes | String | No | Optional notes from admin |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Withdrawal approved and completed successfully",
  "transaction": {
    "_id": "6543210abcdef123456789",
    "user": {
      "_id": "userId123",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+919876543210"
    },
    "type": "withdrawal",
    "amount": 1000,
    "status": "completed",
    "paymentMethod": "bank_transfer",
    "paymentDetails": {
      "bankName": "State Bank of India",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234",
      "accountHolderName": "John Doe",
      "approvedBy": "adminUserId123",
      "approvedAt": "2024-11-28T12:00:00.000Z"
    },
    "description": "Wallet withdrawal request | Admin Notes: Payment processed via NEFT on 2024-11-28",
    "createdAt": "2024-11-28T10:30:00.000Z",
    "updatedAt": "2024-11-28T12:00:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request - Missing Transaction ID**
```json
{
  "success": false,
  "message": "Transaction ID is required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

**400 Bad Request - Not a Withdrawal**
```json
{
  "success": false,
  "message": "This is not a withdrawal transaction"
}
```

**400 Bad Request - Already Completed**
```json
{
  "success": false,
  "message": "Withdrawal already completed"
}
```

**400 Bad Request - Already Cancelled**
```json
{
  "success": false,
  "message": "Cannot approve cancelled withdrawal"
}
```

---

## 3. Reject Withdrawal Request

Reject a pending withdrawal request.

### Endpoint
```
POST /api/admin/wallet/withdrawals/reject
```

### Request Headers
```json
{
  "Authorization": "Bearer <admin_jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "transactionId": "6543210abcdef123456789",
  "reason": "Invalid bank account details provided"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| transactionId | String | Yes | ID of the withdrawal transaction |
| reason | String | Yes | Reason for rejection |

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Withdrawal request rejected successfully",
  "transaction": {
    "_id": "6543210abcdef123456789",
    "user": {
      "_id": "userId123",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+919876543210"
    },
    "type": "withdrawal",
    "amount": 1000,
    "status": "cancelled",
    "paymentMethod": "bank_transfer",
    "paymentDetails": {
      "bankName": "State Bank of India",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234",
      "accountHolderName": "John Doe",
      "rejectedBy": "adminUserId123",
      "rejectedAt": "2024-11-28T12:00:00.000Z",
      "rejectionReason": "Invalid bank account details provided"
    },
    "description": "Wallet withdrawal request | Rejected - Reason: Invalid bank account details provided",
    "createdAt": "2024-11-28T10:30:00.000Z",
    "updatedAt": "2024-11-28T12:00:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request - Missing Transaction ID**
```json
{
  "success": false,
  "message": "Transaction ID is required"
}
```

**400 Bad Request - Missing Reason**
```json
{
  "success": false,
  "message": "Rejection reason is required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Transaction not found"
}
```

**400 Bad Request - Already Completed**
```json
{
  "success": false,
  "message": "Cannot reject completed withdrawal"
}
```

**400 Bad Request - Already Cancelled**
```json
{
  "success": false,
  "message": "Withdrawal already cancelled"
}
```

---

## 4. Credit Money (Manual)

Manually credit money to a user's wallet (admin operation).

### Endpoint
```
POST /api/admin/wallet/credit
```

### Request Headers
```json
{
  "Authorization": "Bearer <admin_jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "email": "user@example.com",
  "amount": 1000,
  "description": "Promotional bonus for new user"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | String | Yes* | User's email address |
| phone | String | Yes* | User's phone number |
| amount | Number | Yes | Amount to credit |
| description | String | No | Description/reason for credit |

*Either email or phone is required

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Amount credited"
}
```

---

## 5. Debit Money (Manual)

Manually debit money from a user's wallet (admin operation).

### Endpoint
```
POST /api/admin/wallet/debit
```

### Request Headers
```json
{
  "Authorization": "Bearer <admin_jwt_token>",
  "Content-Type": "application/json"
}
```

### Request Body
```json
{
  "email": "user@example.com",
  "amount": 500,
  "description": "Refund reversal"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | String | Yes* | User's email address |
| phone | String | Yes* | User's phone number |
| amount | Number | Yes | Amount to debit |
| description | String | No | Description/reason for debit |

*Either email or phone is required

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Amount deducted"
}
```

---

# Implementation Guides

## User App: Add Money Flow

### Step 1: User Initiates Add Money

When user clicks "Add Money" button:

```javascript
// Frontend code example
const addMoney = async (amount) => {
  try {
    const response = await fetch('/api/wallet/add-money', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });

    const data = await response.json();

    if (data.success) {
      // Open Razorpay checkout
      openRazorpayCheckout(data.order_id, data.amount, data.transaction_id);
    } else {
      showError(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to initiate payment');
  }
};
```

### Step 2: Open Razorpay Checkout

```javascript
const openRazorpayCheckout = (orderId, amount, transactionId) => {
  const options = {
    key: 'YOUR_RAZORPAY_KEY_ID', // Your Razorpay key
    amount: amount, // Amount in paise
    currency: 'INR',
    name: 'Your App Name',
    description: 'Add money to wallet',
    order_id: orderId,
    handler: function (response) {
      // Payment successful, verify on backend
      verifyPayment(
        response.razorpay_order_id,
        response.razorpay_payment_id,
        response.razorpay_signature,
        transactionId
      );
    },
    prefill: {
      name: 'User Name',
      email: 'user@example.com',
      contact: '9999999999'
    },
    theme: {
      color: '#3399cc'
    }
  };

  const razorpay = new Razorpay(options);
  razorpay.open();
};
```

### Step 3: Verify Payment

```javascript
const verifyPayment = async (orderId, paymentId, signature, transactionId) => {
  try {
    const response = await fetch('/api/wallet/verify-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        transaction_id: transactionId
      })
    });

    const data = await response.json();

    if (data.success) {
      showSuccess('Money added to wallet successfully!');
      // Refresh wallet balance
      fetchWalletBalance();
    } else {
      showError('Payment verification failed');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to verify payment');
  }
};
```

---

## User App: Withdrawal Flow

### Step 1: User Enters Withdrawal Details

Create a form with two options: UPI or Bank Transfer

```javascript
// React/Vue example
const WithdrawalForm = () => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi'); // 'upi' or 'bank_transfer'

  // UPI fields
  const [upiId, setUpiId] = useState('');

  // Bank fields
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      amount: parseFloat(amount),
      paymentMethod: method
    };

    if (method === 'upi') {
      payload.upiId = upiId;
    } else {
      payload.bankName = bankName;
      payload.accountNumber = accountNumber;
      payload.ifscCode = ifscCode;
      payload.accountHolderName = accountHolderName;
    }

    await submitWithdrawal(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      <select value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="upi">UPI</option>
        <option value="bank_transfer">Bank Transfer</option>
      </select>

      {method === 'upi' ? (
        <input
          type="text"
          placeholder="UPI ID (e.g., user@paytm)"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          required
        />
      ) : (
        <>
          <input
            type="text"
            placeholder="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="IFSC Code"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Account Holder Name"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            required
          />
        </>
      )}

      <button type="submit">Submit Withdrawal Request</button>
    </form>
  );
};
```

### Step 2: Submit Withdrawal Request

```javascript
const submitWithdrawal = async (payload) => {
  try {
    const response = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      showSuccess(data.message);
      // "Your withdrawal request has been submitted successfully. Money will be credited within 2 days."

      // Redirect to transactions page or show withdrawal details
      showWithdrawalDetails(data.withdrawal);
    } else {
      showError(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to submit withdrawal request');
  }
};
```

### Step 3: Display Withdrawal Status

```javascript
const fetchWithdrawalStatus = async () => {
  try {
    const response = await fetch('/api/wallet/transactions', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    const data = await response.json();

    // Filter withdrawal transactions
    const withdrawals = data.transactions.filter(tx => tx.type === 'withdrawal');

    // Display withdrawals with their status
    displayWithdrawals(withdrawals);
  } catch (error) {
    console.error('Error:', error);
  }
};

const displayWithdrawals = (withdrawals) => {
  withdrawals.forEach(withdrawal => {
    console.log(`
      Amount: ${withdrawal.amount}
      Status: ${withdrawal.status} // pending, completed, cancelled
      Method: ${withdrawal.paymentMethod}
      Created: ${withdrawal.createdAt}
    `);

    // Show different badge colors based on status
    // pending -> yellow/orange
    // completed -> green
    // cancelled -> red
  });
};
```

---

## Admin Panel: Withdrawal Management

### Step 1: Fetch Withdrawal Requests

```javascript
const fetchWithdrawalRequests = async (status = 'pending', page = 1) => {
  try {
    const response = await fetch(
      `/api/admin/wallet/withdrawals?status=${status}&page=${page}&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (data.success) {
      displayWithdrawalTable(data.withdrawals);
      displaySummaryStats(data.summary);
      setupPagination(data.pagination);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Step 2: Display Withdrawal Table

Create a table showing:
- User details (name, email, phone)
- Amount
- Payment method (UPI or Bank Transfer)
- Payment details (UPI ID or bank details)
- Status
- Date created
- Action buttons (Approve / Reject)

```javascript
const displayWithdrawalTable = (withdrawals) => {
  // Example HTML structure
  const tableHTML = withdrawals.map(w => `
    <tr>
      <td>${w.user.name}</td>
      <td>${w.user.email}</td>
      <td>₹${w.amount}</td>
      <td>${w.paymentMethod}</td>
      <td>
        ${w.paymentMethod === 'upi'
          ? `UPI: ${w.paymentDetails.upiId}`
          : `
            Bank: ${w.paymentDetails.bankName}<br>
            A/C: ${w.paymentDetails.accountNumber}<br>
            IFSC: ${w.paymentDetails.ifscCode}<br>
            Name: ${w.paymentDetails.accountHolderName}
          `
        }
      </td>
      <td><span class="badge ${w.status}">${w.status}</span></td>
      <td>${new Date(w.createdAt).toLocaleString()}</td>
      <td>
        ${w.status === 'pending'
          ? `
            <button onclick="approveWithdrawal('${w._id}')">Approve</button>
            <button onclick="rejectWithdrawal('${w._id}')">Reject</button>
          `
          : '-'
        }
      </td>
    </tr>
  `).join('');

  document.getElementById('withdrawalTable').innerHTML = tableHTML;
};
```

### Step 3: Approve Withdrawal

```javascript
const approveWithdrawal = async (transactionId) => {
  const adminNotes = prompt('Enter admin notes (optional):');

  try {
    const response = await fetch('/api/admin/wallet/withdrawals/approve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transactionId,
        adminNotes
      })
    });

    const data = await response.json();

    if (data.success) {
      showSuccess('Withdrawal approved successfully!');
      // Refresh the withdrawal list
      fetchWithdrawalRequests();
    } else {
      showError(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to approve withdrawal');
  }
};
```

### Step 4: Reject Withdrawal

```javascript
const rejectWithdrawal = async (transactionId) => {
  const reason = prompt('Enter rejection reason:');

  if (!reason) {
    showError('Rejection reason is required');
    return;
  }

  try {
    const response = await fetch('/api/admin/wallet/withdrawals/reject', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transactionId,
        reason
      })
    });

    const data = await response.json();

    if (data.success) {
      showSuccess('Withdrawal rejected successfully!');
      // Refresh the withdrawal list
      fetchWithdrawalRequests();
    } else {
      showError(data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to reject withdrawal');
  }
};
```

### Step 5: Display Summary Dashboard

```javascript
const displaySummaryStats = (summary) => {
  // Display these stats in dashboard cards
  const stats = `
    Total Withdrawals: ${summary.total}
    Pending: ${summary.pending} (₹${summary.totalPendingAmount})
    Completed: ${summary.completed} (₹${summary.totalCompletedAmount})
    Failed: ${summary.failed}
    Cancelled: ${summary.cancelled}
  `;

  // Update dashboard UI with these stats
  document.getElementById('totalWithdrawals').textContent = summary.total;
  document.getElementById('pendingCount').textContent = summary.pending;
  document.getElementById('pendingAmount').textContent = `₹${summary.totalPendingAmount}`;
  document.getElementById('completedCount').textContent = summary.completed;
  document.getElementById('completedAmount').textContent = `₹${summary.totalCompletedAmount}`;
};
```

---

# Data Models

## Transaction Model

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  type: String, // "withdrawal", "bonus", etc.
  amount: Number,
  status: String, // "pending", "completed", "failed", "cancelled"
  paymentMethod: String, // "upi", "bank_transfer", "razorpay", etc.
  paymentDetails: {
    // For Razorpay
    orderId: String,
    paymentId: String,
    signature: String,

    // For UPI withdrawal
    upiId: String,

    // For bank transfer withdrawal
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,

    // For admin approval/rejection
    approvedBy: ObjectId (ref: User),
    approvedAt: Date,
    rejectedBy: ObjectId (ref: User),
    rejectedAt: Date,
    rejectionReason: String
  },
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Transaction Types

- `referral_commission` - 20% per EMI from referrals
- `installment_commission` - 10% per EMI (own orders)
- `withdrawal` - Money withdrawn from wallet
- `refund` - Refunds to wallet
- `bonus` - Add money / promotional credit
- `investment` - Investment to unlock referral hold
- `commission` - Other commission types
- `purchase` - Purchase transactions
- `emi_payment` - EMI payments made

## Transaction Status

- `pending` - Awaiting admin approval/completion
- `completed` - Successfully completed
- `failed` - Failed transaction
- `cancelled` - Cancelled/rejected transaction

## Payment Methods

- `razorpay` - Via Razorpay
- `upi` - UPI withdrawal
- `bank_transfer` - Bank transfer withdrawal
- `system` - System credit/debit (admin operations)

---

# Status Codes & Error Handling

## HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid parameters, validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User doesn't have permission (not admin) |
| 404 | Not Found | Resource not found (user, transaction, etc.) |
| 500 | Internal Server Error | Server-side error |

## Common Error Messages

### User Wallet Errors

```json
// Invalid amount
{
  "success": false,
  "message": "Invalid amount"
}

// Insufficient balance
{
  "success": false,
  "message": "Insufficient withdrawable balance"
}

// Missing payment method
{
  "success": false,
  "message": "Payment method must be 'upi' or 'bank_transfer'"
}

// Missing UPI ID
{
  "success": false,
  "message": "UPI ID is required for UPI withdrawal"
}

// Missing bank details
{
  "success": false,
  "message": "Bank details required: bankName, accountNumber, ifscCode, accountHolderName"
}
```

### Admin Errors

```json
// Not authorized
{
  "success": false,
  "message": "Access denied. Admin only."
}

// Transaction not found
{
  "success": false,
  "message": "Transaction not found"
}

// Invalid operation
{
  "success": false,
  "message": "Withdrawal already completed"
}

{
  "success": false,
  "message": "Cannot approve cancelled withdrawal"
}
```

---

## Important Notes

### For Frontend Developers

1. **Authentication**: Always include JWT token in Authorization header for all API calls
2. **Error Handling**: Always check `success` field in response and handle errors appropriately
3. **Amount Display**: Display amounts with currency symbol (₹) and proper formatting
4. **Status Colors**: Use consistent color coding for transaction statuses:
   - Pending: Yellow/Orange
   - Completed: Green
   - Failed/Cancelled: Red
5. **Validation**: Validate all inputs on frontend before sending to API
6. **UPI ID Format**: Validate UPI ID format (example@bank)
7. **IFSC Code**: Validate IFSC code format (11 characters, alphanumeric)

### For Admin Panel

1. **Pagination**: Implement proper pagination for withdrawal requests
2. **Filters**: Add filters for status, date range, amount range
3. **Search**: Add search functionality by user name, email, phone
4. **Confirmation**: Always show confirmation dialog before approving/rejecting
5. **Details View**: Show complete user and payment details before taking action
6. **Audit Trail**: Log all admin actions (approvals, rejections)
7. **Notifications**: Send notifications to users when withdrawal status changes

### Wallet Balance Calculation

- **Available Balance**: Amount that can be withdrawn
- **Hold Balance**: Amount on hold (locked, cannot be withdrawn)
- **Total Balance**: Available + Hold balance
- When withdrawal is **pending**: Amount is NOT deducted from available balance
- When withdrawal is **approved**: Amount is deducted from available balance
- When withdrawal is **rejected**: Amount remains in available balance (no change)

### Security Considerations

1. Always verify Razorpay signatures on backend
2. Never expose Razorpay secret key on frontend
3. Validate all payment details before processing
4. Implement rate limiting on withdrawal endpoints
5. Log all withdrawal requests and admin actions
6. Send email/SMS notifications for all withdrawal status changes
7. Implement 2FA for admin approval actions (recommended)

---

## Testing Checklist

### User App Testing

- [ ] User can view wallet balance
- [ ] User can add money using Razorpay
- [ ] Payment verification works correctly
- [ ] User can request withdrawal with UPI
- [ ] User can request withdrawal with bank transfer
- [ ] Form validation works for all fields
- [ ] User receives proper success/error messages
- [ ] Transaction history displays correctly
- [ ] Withdrawal status updates are visible

### Admin Panel Testing

- [ ] Admin can view all withdrawal requests
- [ ] Filtering by status works correctly
- [ ] Pagination works correctly
- [ ] Admin can approve pending withdrawals
- [ ] Admin can reject pending withdrawals
- [ ] Cannot approve/reject already processed withdrawals
- [ ] Summary statistics are accurate
- [ ] User details display correctly
- [ ] Payment details display correctly (UPI & Bank)
- [ ] Admin notes are saved correctly
- [ ] Rejection reasons are saved correctly

### Edge Cases

- [ ] Withdrawal amount exceeds available balance
- [ ] Invalid UPI ID format
- [ ] Invalid IFSC code
- [ ] Missing required fields
- [ ] Concurrent approval attempts
- [ ] Network failures during Razorpay payment
- [ ] Payment verification timeout

---

## Support & Contact

For any API-related issues or questions, please contact:
- Backend Team: backend@yourcompany.com
- Technical Documentation: docs@yourcompany.com

---

**Last Updated**: 2024-11-28
**API Version**: 1.0
**Document Version**: 1.0
