# Product Detail Page (PDP) — Frontend Integration Guide

**Version:** 1.1 | **Last Updated:** 2026-03-03

> **For the App Team** — How to render the product page, handle variant selection, and create an order.

> **v1.1 Changes (2026-03-03):**
> - **`description.specifications`** is always returned as `[{ key, value, unit }]` — no change to your reader code.
> - **`data.attributes`** is a new optional map field on the product (e.g., `{ "Origin": "Alphonso", "Certified": "Yes" }`). Display it as additional product info if present.
> - **More products visible:** Legacy products without `listingStatus` are now returned by the public API — no code changes needed.

---

## 1. API to Fetch Product

```
GET /api/products/:productId
Authorization: Bearer <user_token>
```

Use the product's `productId` string (e.g., `PROD895460120`) in the URL.

---

## 2. Key Fields and Where to Display Them

```
API Response → data: { ... }
```

| UI Section | API Field |
|---|---|
| Product image carousel | `data.images[]` → use `url` for each, sort by `order` |
| Seller name / brand | `data.sellerInfo.storeName` or `data.brand` |
| Free shipping badge | Show if `data.pricing.finalPrice >= threshold` (your call) |
| Product title | `data.name` |
| Price (sale) | `data.pricing.salePrice` (update when variant selected → see below) |
| Price (original) | `data.pricing.regularPrice` (strikethrough) |
| Short description | `data.description.short` |
| Long description | `data.description.long` |
| Features list | `data.description.features[]` |
| Specifications table | `data.description.specifications[]` → `{key, value, unit}` |
| Origin | `data.origin.country` |
| Return policy | `data.warranty.returnPolicy` days |
| Rating / reviews | `data.reviewStats.averageRating`, `data.reviewStats.totalReviews` |
| Tags | `data.tags[]` |

---

## 3. Variant Selection — THIS IS THE KEY PART

### 3.1 How the data looks

Each product has `data.variants[]` — an array of 8 variants.
Each variant has `attributes[]` — 5 key-value pairs:

```json
{
  "variantId": "VAR64910640700",
  "price": 767,
  "salePrice": 675,
  "stock": 25,
  "isActive": true,
  "attributes": [
    { "name": "Grade",    "value": "Standard"      },
    { "name": "Ripeness", "value": "Fully Ripe"    },
    { "name": "Packaging","value": "Regular Box"   },
    { "name": "Form",     "value": "Whole Fruit"   },
    { "name": "Storage",  "value": "Fresh Delivery" }
  ]
}
```

### 3.2 Step 1 — Build the attribute option groups

On page load, **extract unique values for each attribute name** from all active variants:

```dart
// Dart / Flutter pseudocode
Map<String, List<String>> attributeOptions = {};

for (var variant in variants.where((v) => v.isActive)) {
  for (var attr in variant.attributes) {
    attributeOptions.putIfAbsent(attr.name, () => []);
    if (!attributeOptions[attr.name]!.contains(attr.value)) {
      attributeOptions[attr.name]!.add(attr.value);
    }
  }
}

// Result:
// {
//   "Grade":    ["Standard", "Premium A", "Organic", "Export A+"],
//   "Ripeness": ["Fully Ripe", "Semi-Ripe", "Raw (Green)"],
//   "Packaging":["Regular Box", "Gift Box", "Eco Jute Bag", "Wooden Crate", "Zip Pouch", "Tetra Pack"],
//   "Form":     ["Whole Fruit", "Ready-to-Eat Slices", "Pulp Pack"],
//   "Storage":  ["Fresh Delivery", "Cold Storage"]
// }
```

**Render a row of selector chips/buttons for each attribute group.**

### 3.3 Step 2 — Default selection on page load

Start with **the first active variant** (or the `defaultVariantId` if not null):

```dart
// Find default variant
Variant? selectedVariant;

if (product.defaultVariantId != null) {
  selectedVariant = variants.firstWhere(
    (v) => v.variantId == product.defaultVariantId,
    orElse: () => variants.first,
  );
} else {
  // Use cheapest active variant as default
  selectedVariant = variants
    .where((v) => v.isActive)
    .reduce((a, b) => (a.salePrice ?? a.price) < (b.salePrice ?? b.price) ? a : b);
}

// Extract its current attribute selections
Map<String, String> selectedAttributes = {};
for (var attr in selectedVariant.attributes) {
  selectedAttributes[attr.name] = attr.value;
}
```

### 3.4 Step 3 — When user taps a chip, find the matching variant

```dart
void onAttributeSelected(String attrName, String attrValue) {
  // Update the selection
  selectedAttributes[attrName] = attrValue;

  // Find the variant that matches ALL selected attributes
  Variant? match = variants.where((v) => v.isActive).firstWhere(
    (variant) {
      return selectedAttributes.entries.every((entry) {
        return variant.attributes.any(
          (a) => a.name == entry.key && a.value == entry.value,
        );
      });
    },
    orElse: () => null,  // no exact match yet
  );

  if (match != null) {
    selectedVariant = match;
    // !! Update price on screen from match.price / match.salePrice
    // !! Update stock from match.stock
    // !! Update image from match.images[0].url (if variant has own image)
  }
}
```

### 3.5 What to show for price and stock

**ALWAYS use the selected variant's price, not `data.pricing`:**

```dart
// Price to display
int displayPrice     = selectedVariant.salePrice ?? selectedVariant.price;
int strikeThroughPrice = selectedVariant.price;

// Stock
int stock = selectedVariant.stock;
bool isOutOfStock = stock == 0 || !selectedVariant.isActive;

// Variant image (use product images if variant has no image)
String imageUrl = (selectedVariant.images.isNotEmpty)
    ? selectedVariant.images[0].url
    : product.images[0].url;
```

> **Why not use `data.pricing`?**
> `data.pricing` is the product's base price. Each variant has its own price.
> e.g., Standard variant = ₹675, Export A+ variant = ₹979.
> The price must update when the user changes the variant.

### 3.6 Price range on the listing card

Use `data.priceRange` (returned at the root level of the API response):

```json
"priceRange": {
  "min": 574,
  "max": 979,
  "currency": "INR"
}
```

Display as: **"₹574 – ₹979"** on the product card in the list/home screen.

---

## 4. Payment Plans ("Select Plan" button)

The product has `data.plans[]` (pre-built plans) AND `data.paymentPlan` (installment config).

### Show the 3 plans:
```
data.plans = [
  { name: "7-Day Plan",  days: 7,  perDayAmount: 110, totalAmount: 770, isRecommended: false },
  { name: "15-Day Plan", days: 15, perDayAmount: 52,  totalAmount: 780, isRecommended: true  },
  { name: "30-Day Plan", days: 30, perDayAmount: 26,  totalAmount: 780, isRecommended: false }
]
```

When user taps "Select Plan", show a bottom sheet listing these plans.
Mark the one where `isRecommended: true` with a "Best Value" badge.

---

## 5. Creating an Order (POST /api/installment-orders)

```
POST /api/installment-orders
Authorization: Bearer <user_token>
Content-Type: application/json
```

### Request Body:

```json
{
  "productId":    "69a5744f048287daad762cd9",
  "variantId":    "VAR64910640700",
  "quantity":     1,
  "totalDays":    15,
  "paymentMethod": "RAZORPAY",
  "deliveryAddress": {
    "fullName":    "Rahul Sharma",
    "phone":       "9876543210",
    "addressLine1":"123 MG Road",
    "addressLine2":"Koramangala",
    "city":        "Bengaluru",
    "state":       "Karnataka",
    "pincode":     "560034",
    "country":     "India"
  }
}
```

### Field mapping:

| Field | Where to get it | Notes |
|---|---|---|
| `productId` | `data._id` from GET product response | This is the MongoDB ObjectId, **NOT** `data.productId` |
| `variantId` | `selectedVariant.variantId` | The variant user selected on PDP |
| `quantity` | User input (default 1) | |
| `totalDays` | From selected plan: `plan.days` | 7, 15, or 30 |
| `paymentMethod` | `"RAZORPAY"` or `"WALLET"` | |
| `deliveryAddress` | From user's saved address | |
| `couponCode` | Optional | |
| `dailyAmount` | Optional — skip it, backend calculates | |

### CRITICAL:
- `productId` = `data._id` (e.g., `"69a5744f048287daad762cd9"`) — **ObjectId format**
- `variantId` = `selectedVariant.variantId` (e.g., `"VAR64910640700"`) — **string, NOT `_id`**

---

## 6. Complete Flow — Step by Step

```
1. User opens PDP
   → GET /api/products/PROD895460120
   → Render product images, name, description

2. Parse variants, build attribute option groups
   → Show: Grade chips, Ripeness chips, Packaging chips, Form chips, Storage chips

3. Default-select first active variant
   → Show its price, stock, image

4. User taps a chip (e.g., "Premium A" for Grade)
   → Find variant where Grade=Premium A + all other current selections
   → Update price, stock, image on screen

5. User taps "Select Plan"
   → Show 3 plans from data.plans[]
   → User selects 15-Day Plan (totalDays = 15)

6. User taps "Check Out"
   → POST /api/installment-orders with:
      productId  = data._id
      variantId  = selectedVariant.variantId
      totalDays  = 15
      paymentMethod = "RAZORPAY"
      deliveryAddress = { ... }
```

---

## 7. Edge Cases

| Scenario | What to do |
|---|---|
| `variant.isActive = false` | Grey out / disable that option, user can't select it |
| `variant.stock = 0` | Show "Out of Stock" badge, disable checkout |
| No variant matches the selection | This won't happen with our current data (all combinations exist), but if it does: show "This combination is unavailable" |
| `defaultVariantId = null` | Pick cheapest active variant as default |
| `hasVariants = false` | Product has no variants — use `data.pricing.salePrice` and `data._id` only (no `variantId` in order) |
| `priceRange` | Use on listing cards. On PDP always show selected variant's actual price |

---

## 8. Quick Reference — Which `id` to use where

```
data._id            → "69a5744f048287daad762cd9"  → Use in POST /api/installment-orders as productId
data.productId      → "PROD895460120"             → Use in GET /api/products/:productId URL
variant._id         → "69a57f110499df45a3b33a1f"  → Internal MongoDB ID, DON'T use
variant.variantId   → "VAR64910640700"            → Use in POST /api/installment-orders as variantId
```

---

## 9. Variant Attribute Reference

All 8 variants and their attributes for quick reference:

| V# | Grade | Ripeness | Packaging | Form | Storage | Price |
|---|---|---|---|---|---|---|
| 1 | Standard | Fully Ripe | Regular Box | Whole Fruit | Fresh Delivery | base |
| 2 | Premium A | Fully Ripe | Gift Box | Whole Fruit | Fresh Delivery | +28% |
| 3 | Organic | Fully Ripe | Eco Jute Bag | Whole Fruit | Fresh Delivery | +32% |
| 4 | Export A+ | Fully Ripe | Wooden Crate | Whole Fruit | Cold Storage | +45% |
| 5 | Standard | Semi-Ripe | Regular Box | Whole Fruit | Fresh Delivery | -8% |
| 6 | Standard | Raw (Green) | Regular Box | Whole Fruit | Fresh Delivery | -15% |
| 7 | Premium A | Fully Ripe | Zip Pouch | Ready-to-Eat Slices | Cold Storage | +38% |
| 8 | Premium A | Fully Ripe | Tetra Pack | Pulp Pack | Fresh Delivery | +18% |
