# 📊 Dashboard Overview API Documentation

## New Comprehensive Dashboard Endpoint

### 📍 Endpoint
```
GET /api/installments/dashboard/overview
```

### 🔐 Authentication
**Required:** Yes (Access Token in Authorization header)

### 📝 Description
Ek single API call mein user ki complete investment overview milti hai:
- Aaj ki pending payments
- Sabhi pending orders ka data
- Total investment stats
- Complete summary

---

## 🎯 Request

### Headers
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### Example Request
```bash
curl -X GET "https://api.epielio.com/api/installments/dashboard/overview" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Dart/Flutter Example
```dart
Future<DashboardOverview> getDashboardOverview() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/dashboard/overview'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return DashboardOverview.fromJson(data['data']);
  } else {
    throw Exception('Failed to load dashboard');
  }
}
```

---

## ✅ Response Structure

```json
{
  "success": true,
  "message": "Dashboard overview retrieved successfully",
  "data": {
    "todayPendingPayments": {
      "count": 5,
      "totalAmount": 280,
      "payments": [
        {
          "orderId": "ORD-20251127-C4DC",
          "productName": "Bouquet",
          "productImage": "https://...",
          "installmentNumber": 2,
          "amount": 50,
          "dueDate": "2025-11-28T06:06:46.718Z"
        }
      ]
    },
    "allPendingOrders": {
      "count": 10,
      "totalPendingAmount": 20000,
      "maxDays": 60,
      "orders": [
        {
          "orderId": "ORD-20251127-3EB0",
          "productName": "Bouquet",
          "productImage": "https://...",
          "totalAmount": 400,
          "totalDays": 60,
          "dailyAmount": 50,
          "createdAt": "2025-11-27T05:37:29.685Z"
        }
      ]
    },
    "totalInvestment": {
      "totalInvested": 280,
      "totalOrderValue": 22000,
      "investmentPercentage": 1,
      "remainingAmount": 21720
    },
    "summary": {
      "totalOrders": 15,
      "activeOrders": 5,
      "completedOrders": 0,
      "pendingOrders": 10,
      "cancelledOrders": 0
    },
    "investmentByStatus": {
      "active": {
        "count": 5,
        "totalValue": 2000,
        "totalPaid": 280
      },
      "completed": {
        "count": 0,
        "totalValue": 0,
        "totalPaid": 0
      },
      "pending": {
        "count": 10,
        "totalValue": 20000,
        "totalPaid": 0
      }
    }
  },
  "meta": {
    "timestamp": "2025-11-28T02:54:22.000Z"
  }
}
```

---

## 📋 Response Fields Explained

### 1️⃣ `todayPendingPayments`
**Aaj ki pending payments**

| Field | Type | Description |
|-------|------|-------------|
| `count` | Number | Aaj kitne payments due hain |
| `totalAmount` | Number | Aaj ki total payment amount |
| `payments` | Array | Aaj ki saari pending payments ki list |

**Payments Array Fields:**
- `orderId`: Order ka unique ID
- `productName`: Product ka naam
- `productImage`: Product ki image URL
- `installmentNumber`: Konsa installment (2, 3, etc.)
- `amount`: Payment ki amount (₹)
- `dueDate`: Kab due hai (ISO date)

### 2️⃣ `allPendingOrders`
**Sabhi PENDING status ke orders (jo abhi start nahi hue)**

| Field | Type | Description |
|-------|------|-------------|
| `count` | Number | Kitne pending orders hain |
| `totalPendingAmount` | Number | Total pending amount (₹) |
| `maxDays` | Number | Sabse zyada days wala order |
| `orders` | Array | Pending orders ki list |

**Orders Array Fields:**
- `orderId`: Order ID
- `productName`: Product naam
- `productImage`: Image URL
- `totalAmount`: Total order amount
- `totalDays`: Kitne days ka plan
- `dailyAmount`: Daily payment amount
- `createdAt`: Kab create hua

### 3️⃣ `totalInvestment`
**User ne total kitna invest kiya hai**

| Field | Type | Description |
|-------|------|-------------|
| `totalInvested` | Number | Ab tak total paid amount (₹) |
| `totalOrderValue` | Number | Sabhi orders ka total value (₹) |
| `investmentPercentage` | Number | Kitna % invest ho chuka (0-100) |
| `remainingAmount` | Number | Kitna abhi baaki hai (₹) |

### 4️⃣ `summary`
**Orders ka complete summary**

| Field | Type | Description |
|-------|------|-------------|
| `totalOrders` | Number | Total orders kitne hain |
| `activeOrders` | Number | Active orders (payment chal rahi) |
| `completedOrders` | Number | Completed orders |
| `pendingOrders` | Number | Pending orders (first payment pending) |
| `cancelledOrders` | Number | Cancelled orders |

### 5️⃣ `investmentByStatus`
**Status-wise investment breakdown**

Har status (active, completed, pending) ke liye:
- `count`: Kitne orders
- `totalValue`: Total value (₹)
- `totalPaid`: Kitna paid (₹)

---

## 🎨 Flutter Model Classes

```dart
class DashboardOverview {
  final TodayPendingPayments todayPendingPayments;
  final AllPendingOrders allPendingOrders;
  final TotalInvestment totalInvestment;
  final OrderSummary summary;
  final InvestmentByStatus investmentByStatus;

  DashboardOverview({
    required this.todayPendingPayments,
    required this.allPendingOrders,
    required this.totalInvestment,
    required this.summary,
    required this.investmentByStatus,
  });

  factory DashboardOverview.fromJson(Map<String, dynamic> json) {
    return DashboardOverview(
      todayPendingPayments: TodayPendingPayments.fromJson(json['todayPendingPayments']),
      allPendingOrders: AllPendingOrders.fromJson(json['allPendingOrders']),
      totalInvestment: TotalInvestment.fromJson(json['totalInvestment']),
      summary: OrderSummary.fromJson(json['summary']),
      investmentByStatus: InvestmentByStatus.fromJson(json['investmentByStatus']),
    );
  }
}

class TodayPendingPayments {
  final int count;
  final double totalAmount;
  final List<PendingPayment> payments;

  TodayPendingPayments({
    required this.count,
    required this.totalAmount,
    required this.payments,
  });

  factory TodayPendingPayments.fromJson(Map<String, dynamic> json) {
    return TodayPendingPayments(
      count: json['count'],
      totalAmount: json['totalAmount'].toDouble(),
      payments: (json['payments'] as List)
          .map((p) => PendingPayment.fromJson(p))
          .toList(),
    );
  }
}

class PendingPayment {
  final String orderId;
  final String productName;
  final String productImage;
  final int installmentNumber;
  final double amount;
  final DateTime dueDate;

  PendingPayment({
    required this.orderId,
    required this.productName,
    required this.productImage,
    required this.installmentNumber,
    required this.amount,
    required this.dueDate,
  });

  factory PendingPayment.fromJson(Map<String, dynamic> json) {
    return PendingPayment(
      orderId: json['orderId'],
      productName: json['productName'],
      productImage: json['productImage'] ?? '',
      installmentNumber: json['installmentNumber'],
      amount: json['amount'].toDouble(),
      dueDate: DateTime.parse(json['dueDate']),
    );
  }
}

class AllPendingOrders {
  final int count;
  final double totalPendingAmount;
  final int maxDays;
  final List<PendingOrder> orders;

  AllPendingOrders({
    required this.count,
    required this.totalPendingAmount,
    required this.maxDays,
    required this.orders,
  });

  factory AllPendingOrders.fromJson(Map<String, dynamic> json) {
    return AllPendingOrders(
      count: json['count'],
      totalPendingAmount: json['totalPendingAmount'].toDouble(),
      maxDays: json['maxDays'],
      orders: (json['orders'] as List)
          .map((o) => PendingOrder.fromJson(o))
          .toList(),
    );
  }
}

class PendingOrder {
  final String orderId;
  final String productName;
  final String productImage;
  final double totalAmount;
  final int totalDays;
  final double dailyAmount;
  final DateTime createdAt;

  PendingOrder({
    required this.orderId,
    required this.productName,
    required this.productImage,
    required this.totalAmount,
    required this.totalDays,
    required this.dailyAmount,
    required this.createdAt,
  });

  factory PendingOrder.fromJson(Map<String, dynamic> json) {
    return PendingOrder(
      orderId: json['orderId'],
      productName: json['productName'],
      productImage: json['productImage'] ?? '',
      totalAmount: json['totalAmount'].toDouble(),
      totalDays: json['totalDays'],
      dailyAmount: json['dailyAmount'].toDouble(),
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

class TotalInvestment {
  final double totalInvested;
  final double totalOrderValue;
  final int investmentPercentage;
  final double remainingAmount;

  TotalInvestment({
    required this.totalInvested,
    required this.totalOrderValue,
    required this.investmentPercentage,
    required this.remainingAmount,
  });

  factory TotalInvestment.fromJson(Map<String, dynamic> json) {
    return TotalInvestment(
      totalInvested: json['totalInvested'].toDouble(),
      totalOrderValue: json['totalOrderValue'].toDouble(),
      investmentPercentage: json['investmentPercentage'],
      remainingAmount: json['remainingAmount'].toDouble(),
    );
  }
}

class OrderSummary {
  final int totalOrders;
  final int activeOrders;
  final int completedOrders;
  final int pendingOrders;
  final int cancelledOrders;

  OrderSummary({
    required this.totalOrders,
    required this.activeOrders,
    required this.completedOrders,
    required this.pendingOrders,
    required this.cancelledOrders,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    return OrderSummary(
      totalOrders: json['totalOrders'],
      activeOrders: json['activeOrders'],
      completedOrders: json['completedOrders'],
      pendingOrders: json['pendingOrders'],
      cancelledOrders: json['cancelledOrders'],
    );
  }
}

class InvestmentByStatus {
  final StatusInvestment active;
  final StatusInvestment completed;
  final StatusInvestment pending;

  InvestmentByStatus({
    required this.active,
    required this.completed,
    required this.pending,
  });

  factory InvestmentByStatus.fromJson(Map<String, dynamic> json) {
    return InvestmentByStatus(
      active: StatusInvestment.fromJson(json['active']),
      completed: StatusInvestment.fromJson(json['completed']),
      pending: StatusInvestment.fromJson(json['pending']),
    );
  }
}

class StatusInvestment {
  final int count;
  final double totalValue;
  final double totalPaid;

  StatusInvestment({
    required this.count,
    required this.totalValue,
    required this.totalPaid,
  });

  factory StatusInvestment.fromJson(Map<String, dynamic> json) {
    return StatusInvestment(
      count: json['count'],
      totalValue: json['totalValue'].toDouble(),
      totalPaid: json['totalPaid'].toDouble(),
    );
  }
}
```

---

## 💡 Usage Examples

### Example 1: Dashboard Home Screen
```dart
class DashboardScreen extends StatefulWidget {
  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardOverview? overview;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    loadDashboard();
  }

  Future<void> loadDashboard() async {
    try {
      final data = await getDashboardOverview();
      setState(() {
        overview = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load dashboard: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: loadDashboard,
      child: ListView(
        padding: EdgeInsets.all(16),
        children: [
          // Today's Pending Payments Card
          _buildTodayPaymentsCard(),

          SizedBox(height: 16),

          // Investment Progress Card
          _buildInvestmentCard(),

          SizedBox(height: 16),

          // Summary Stats
          _buildSummaryCard(),

          SizedBox(height: 16),

          // Pending Orders List
          _buildPendingOrdersList(),
        ],
      ),
    );
  }

  Widget _buildTodayPaymentsCard() {
    final today = overview!.todayPendingPayments;

    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Today\'s Pending Payments',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              '${today.count} payments due',
              style: TextStyle(color: Colors.grey[600]),
            ),
            SizedBox(height: 8),
            Text(
              '₹${today.totalAmount.toStringAsFixed(0)}',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: today.count > 0 ? Colors.orange : Colors.green,
              ),
            ),
            if (today.count > 0) ...[
              SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  // Navigate to payment screen
                },
                child: Text('Pay Now'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInvestmentCard() {
    final investment = overview!.totalInvestment;

    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Total Investment',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            LinearProgressIndicator(
              value: investment.investmentPercentage / 100,
              minHeight: 8,
            ),
            SizedBox(height: 8),
            Text(
              '${investment.investmentPercentage}% Complete',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Invested', style: TextStyle(color: Colors.grey)),
                    Text(
                      '₹${investment.totalInvested.toStringAsFixed(0)}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Remaining', style: TextStyle(color: Colors.grey)),
                    Text(
                      '₹${investment.remainingAmount.toStringAsFixed(0)}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard() {
    final summary = overview!.summary;

    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatItem('Total', summary.totalOrders, Colors.blue),
                _buildStatItem('Active', summary.activeOrders, Colors.green),
                _buildStatItem('Pending', summary.pendingOrders, Colors.orange),
                _buildStatItem('Done', summary.completedOrders, Colors.purple),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, int value, Color color) {
    return Column(
      children: [
        Text(
          value.toString(),
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(color: Colors.grey),
        ),
      ],
    );
  }

  Widget _buildPendingOrdersList() {
    final pending = overview!.allPendingOrders;

    if (pending.count == 0) {
      return SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Pending Orders (${pending.count})',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        SizedBox(height: 8),
        Text(
          'Total: ₹${pending.totalPendingAmount.toStringAsFixed(0)}',
          style: TextStyle(color: Colors.grey),
        ),
        SizedBox(height: 16),
        ...pending.orders.map((order) => Card(
          child: ListTile(
            leading: order.productImage.isNotEmpty
                ? Image.network(order.productImage, width: 50)
                : Icon(Icons.shopping_bag),
            title: Text(order.productName),
            subtitle: Text('${order.totalDays} days • ₹${order.dailyAmount}/day'),
            trailing: Text(
              '₹${order.totalAmount.toStringAsFixed(0)}',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        )).toList(),
      ],
    );
  }
}
```

---

## 🎯 Key Benefits

### 1. **Single API Call**
Ek hi call mein saara data mil jata hai - multiple API calls ki zarurat nahi

### 2. **Complete Overview**
- Aaj ki payments
- Pending orders
- Investment progress
- Complete summary

### 3. **Real-time Data**
Server-side calculated, always up-to-date

### 4. **Performance**
Optimized queries, fast response

---

## ⚠️ Error Responses

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## 🔄 Refresh Strategy

```dart
// Pull to refresh
RefreshIndicator(
  onRefresh: () async {
    await loadDashboard();
  },
  child: YourDashboardWidget(),
)

// Auto refresh every 5 minutes
Timer.periodic(Duration(minutes: 5), (timer) {
  loadDashboard();
});

// Refresh on app resume
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  if (state == AppLifecycleState.resumed) {
    loadDashboard();
  }
}
```

---

## ✅ Testing

### Current Test Data
```
User ID: 691d6035962542bf4120f30b
Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Expected Response:
- Total Orders: 15
- Active Orders: 5
- Pending Orders: 10
- Total Investment: ₹280 (1%)
- Today's Pending: Will show after 11:36 AM IST
```

---

## 📞 Support

Questions? Contact backend team for:
- API access
- Testing credentials
- Integration support
- Bug reports

---

**Version:** 1.0
**Last Updated:** November 28, 2025
**Status:** ✅ Ready for Integration
