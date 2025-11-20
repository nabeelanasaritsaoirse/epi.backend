# Product Variant Support - Guide

## ✅ Variant Support Added!

The installment order system now **fully supports product variants**. When a user orders a product with variants (like size, color, material), the system tracks which specific variant was ordered.

---

## 🎯 What Are Variants?

Variants are different versions of the same product with different attributes:
- **Size:** Small, Medium, Large, XL
- **Color:** Red, Blue, Black, White
- **Material:** Cotton, Polyester, Silk
- **Price:** Each variant can have its own price

**Example:**
- Product: "T-Shirt"
  - Variant 1: Size M, Color Red, ₹500
  - Variant 2: Size L, Color Blue, ₹550
  - Variant 3: Size XL, Color Black, ₹600

---

## 📦 What Gets Stored in Order

When a user orders a product with a variant, the system stores:

### Order Fields:
```javascript
{
  orderId: "ORD-20241120-A3F2",
  productId: "64a1b2c3d4e5f6789012345", // Main product ID
  productName: "Premium T-Shirt",
  productPrice: 550, // Variant price (not base product price)

  // Variant Information
  variantId: "var_001", // Variant identifier
  variantDetails: {
    sku: "TSH-L-BLU-001",
    attributes: {
      size: "L",
      color: "Blue",
      material: "Cotton"
    },
    price: 550,
    description: "Large Blue Cotton T-Shirt"
  }
}
```

---

## 🔄 How It Works

### Step 1: User Selects Product Variant

User browses product and selects:
- Size: Large
- Color: Blue

### Step 2: Flutter Sends Variant ID

When creating order, include `variantId` in request:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/orders'),
  body: jsonEncode({
    'productId': '64a1b2c3d4e5f6789012345',
    'variantId': 'var_001', // ✅ Add this for variants
    'totalDays': 30,
    'paymentMethod': 'WALLET',
    'deliveryAddress': {...}
  }),
);
```

### Step 3: Backend Handles Everything

Backend automatically:
- ✅ Validates variant exists
- ✅ Checks variant is active
- ✅ Verifies variant stock > 0
- ✅ Uses **variant price** (not product price)
- ✅ Stores variant details in order
- ✅ Calculates daily amount from variant price

---

## 📱 API Changes

### Create Order Endpoint

**POST** `/api/installment/orders`

**Request Body:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "variantId": "var_001",  // ✅ NEW OPTIONAL FIELD
  "totalDays": 30,
  "dailyAmount": 18,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "Premium T-Shirt",
      "productPrice": 550,
      "variantId": "var_001",
      "variantDetails": {
        "sku": "TSH-L-BLU-001",
        "attributes": {
          "size": "L",
          "color": "Blue",
          "material": "Cotton"
        },
        "price": 550,
        "description": "Large Blue Cotton T-Shirt"
      },
      "dailyPaymentAmount": 18,
      "totalDays": 30
    }
  }
}
```

---

## 🎨 Flutter Implementation

### 1. Get Product with Variants

First, fetch the product to see available variants:

```dart
// Assuming you have a product API
final product = await getProduct('64a1b2c3d4e5f6789012345');

// Product has variants array
if (product['variants'] != null && product['variants'].length > 0) {
  // Show variant selector to user
}
```

### 2. Display Variant Selector

```dart
class VariantSelector extends StatefulWidget {
  final List<dynamic> variants;
  final Function(String) onVariantSelected;

  VariantSelector({required this.variants, required this.onVariantSelected});

  @override
  _VariantSelectorState createState() => _VariantSelectorState();
}

class _VariantSelectorState extends State<VariantSelector> {
  String? selectedVariantId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Select Variant:', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        SizedBox(height: 8),
        ...widget.variants.map((variant) {
          final attributes = variant['attributes'];
          final price = variant['salePrice'] ?? variant['price'];
          final stock = variant['stock'];
          final isActive = variant['isActive'];
          final isAvailable = isActive && stock > 0;

          return RadioListTile(
            title: Text(
              '${attributes['size']} - ${attributes['color']} - ₹$price',
              style: TextStyle(
                color: isAvailable ? Colors.black : Colors.grey,
              ),
            ),
            subtitle: Text(
              isAvailable ? 'In Stock ($stock available)' : 'Out of Stock',
              style: TextStyle(
                color: isAvailable ? Colors.green : Colors.red,
              ),
            ),
            value: variant['variantId'],
            groupValue: selectedVariantId,
            onChanged: isAvailable
                ? (value) {
                    setState(() {
                      selectedVariantId = value as String;
                    });
                    widget.onVariantSelected(selectedVariantId!);
                  }
                : null,
          );
        }).toList(),
      ],
    );
  }
}
```

### 3. Create Order with Selected Variant

```dart
Future<void> createOrderWithVariant(String productId, String? variantId) async {
  final requestBody = {
    'productId': productId,
    'totalDays': 30,
    'paymentMethod': 'WALLET',
    'deliveryAddress': {
      'name': 'John Doe',
      'phoneNumber': '9876543210',
      'addressLine1': '123 Street',
      'city': 'Mumbai',
      'state': 'Maharashtra',
      'pincode': '400001',
    },
  };

  // Add variantId only if selected
  if (variantId != null) {
    requestBody['variantId'] = variantId;
  }

  final response = await http.post(
    Uri.parse('$baseUrl/orders'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode(requestBody),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Order created with variant
    print('Variant ordered: ${data['data']['order']['variantDetails']}');
  }
}
```

### 4. Display Variant in Order Details

```dart
Widget buildOrderDetails(Map<String, dynamic> order) {
  return Card(
    child: Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            order['productName'],
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),

          // Show variant details if available
          if (order['variantDetails'] != null) ...[
            SizedBox(height: 8),
            Container(
              padding: EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Variant:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 4),
                  if (order['variantDetails']['attributes']['size'] != null)
                    Text('Size: ${order['variantDetails']['attributes']['size']}'),
                  if (order['variantDetails']['attributes']['color'] != null)
                    Text('Color: ${order['variantDetails']['attributes']['color']}'),
                  if (order['variantDetails']['attributes']['material'] != null)
                    Text('Material: ${order['variantDetails']['attributes']['material']}'),
                  Text('SKU: ${order['variantDetails']['sku']}'),
                ],
              ),
            ),
          ],

          SizedBox(height: 8),
          Text('Price: ₹${order['productPrice']}'),
          Text('Daily: ₹${order['dailyPaymentAmount']}'),
        ],
      ),
    ),
  );
}
```

---

## ⚠️ Error Handling

### Variant Not Found
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Variant with ID var_001 not found for this product"
  }
}
```

**Flutter:**
```dart
if (!data['success']) {
  if (data['error']['message'].contains('Variant')) {
    showError('Selected variant is not available. Please choose another.');
  }
}
```

### Variant Out of Stock
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Variant var_001 is out of stock"
  }
}
```

### Variant Not Active
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Variant var_001 is not available"
  }
}
```

---

## 🔍 Admin View

When admin views order, they see:

```
Order: ORD-20241120-A3F2
Product: Premium T-Shirt

Variant Selected:
  - SKU: TSH-L-BLU-001
  - Size: L
  - Color: Blue
  - Material: Cotton
  - Price: ₹550

Delivery Address: ...
```

This helps admin know **exactly which variant** to ship!

---

## 📊 Key Points

### For Products WITHOUT Variants:
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  // variantId: NOT NEEDED
  "totalDays": 30,
  "paymentMethod": "WALLET"
}
```

Backend uses base product price.

### For Products WITH Variants:
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "variantId": "var_001", // ✅ REQUIRED
  "totalDays": 30,
  "paymentMethod": "WALLET"
}
```

Backend uses variant price and stores variant details.

---

## ✅ What Backend Validates

When variant is provided:

1. ✅ Variant exists in product
2. ✅ Variant is active (`isActive: true`)
3. ✅ Variant has stock (`stock > 0`)
4. ✅ Uses variant price for calculations
5. ✅ Stores complete variant info

---

## 🎯 Complete Flow Example

```
User opens product: "Premium T-Shirt"
    ↓
Product has variants: [S-Red, M-Blue, L-Black]
    ↓
User selects: L - Black (₹600)
    ↓
Flutter sends:
  productId: "xxx"
  variantId: "var_003"
    ↓
Backend validates variant
    ↓
Backend uses ₹600 as price
    ↓
Daily amount: ₹600 / 30 = ₹20
    ↓
Order created with variant details
    ↓
Admin can see: "Ship L-Black variant"
```

---

## 📝 Summary

| Field | Required | Description |
|-------|----------|-------------|
| `variantId` | Optional | Variant identifier (required for products with variants) |
| `variantDetails` | Auto | Backend fills this automatically |
| `productPrice` | Auto | Backend uses variant price if variant selected |

**Benefits:**
- ✅ Track exact variant ordered
- ✅ Use correct variant price
- ✅ Admin knows which variant to ship
- ✅ Better inventory management
- ✅ Clear order records

---

**Status:** ✅ **FULLY IMPLEMENTED & READY**

Variant support is production-ready! Flutter team can start using `variantId` in order creation requests.
