# EPI App Team — Product & Category Integration Guide

**Audience:** Flutter / Mobile App Developers
**Version:** 1.1
**Base URL (Dev):** `https://dev-api.epi.com` — replace with actual env URL
**Base URL (Prod):** `https://api.epi.com`
**Last Updated:** 2026-03-03

> **v1.1 Changes (2026-03-03):**
> - **More products visible:** Legacy products without an explicit `listingStatus` value are now returned by all public endpoints (no action needed from app side — just more products in the list).
> - **`description.specifications` format:** Always returned as `[{ key, value, unit }]` on the product detail response — no change to how you read it.
> - **`data.attributes`** is a new optional field on products (flat key-value map of product-level attributes). You can display these as additional info if present, but it is not required.

---

## Table of Contents

1. [Setup — HTTP Client & Auth Token](#1-setup--http-client--auth-token)
2. [Category APIs — What to Use](#2-category-apis--what-to-use)
   - [2.1 Load Home Screen Categories (Dropdown)](#21-load-home-screen-categories-dropdown)
   - [2.2 Get All Categories (with filters)](#22-get-all-categories-with-filters)
   - [2.3 Get Single Category with Subcategories](#23-get-single-category-with-subcategories)
   - [2.4 Search Categories](#24-search-categories)
   - [2.5 Featured Categories](#25-featured-categories)
3. [Product APIs — What to Use](#3-product-apis--what-to-use)
   - [3.1 List Products (Home / Browse Screen)](#31-list-products-home--browse-screen)
   - [3.2 Search Products](#32-search-products)
   - [3.3 Get Single Product Detail](#33-get-single-product-detail)
   - [3.4 Products by Category](#34-products-by-category)
   - [3.5 Featured Products](#35-featured-products)
   - [3.6 Low Stock / Urgency Badge](#36-low-stock--urgency-badge)
   - [3.7 Product Reviews](#37-product-reviews)
   - [3.8 Product Plans (Installment Options)](#38-product-plans-installment-options)
   - [3.9 Product Variants](#39-product-variants)
4. [Data Models — Flutter Classes](#4-data-models--flutter-classes)
5. [Error Handling](#5-error-handling)
6. [Common Patterns — Code Snippets](#6-common-patterns--code-snippets)
7. [Image Handling Tips](#7-image-handling-tips)
8. [Pagination Pattern](#8-pagination-pattern)
9. [What NOT to Call from the App](#9-what-not-to-call-from-the-app)
10. [Quick Reference Table](#10-quick-reference-table)

---

## 1. Setup — HTTP Client & Auth Token

### Base ApiClient setup

```dart
// lib/core/api_client.dart

import 'package:dio/dio.dart';

class ApiClient {
  static const String _baseUrl = 'https://api.epi.com'; // change per env

  static Dio get instance {
    final dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // Attach JWT token to every request automatically
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await AuthService.getToken(); // your local storage
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (DioException e, handler) {
          if (e.response?.statusCode == 401) {
            // Token expired — trigger re-login
            AuthService.logout();
          }
          handler.next(e);
        },
      ),
    );

    return dio;
  }
}
```

### Auth Token Notes

| Scenario | Token Source |
|---|---|
| Regular buyer | Firebase ID Token → exchanged for EPI JWT at login |
| Seller account | Same Firebase login — role is stored server-side |
| No token needed | All product and category GET endpoints work without auth |

> **Most product and category APIs are public — you do NOT need a token to browse products.**
> Token is only needed when a user is logged in and you want personalized results.

---

## 2. Category APIs — What to Use

**Base path:** `/api/categories`

---

### 2.1 Load Home Screen Categories (Dropdown)

Use this for the **main category navigation bar / home screen grid**. Returns only
active root-level categories with their active subcategories — minimal payload, fast.

```
GET /api/categories/dropdown/all
```

**No auth required. No query params needed.**

**Response shape:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc...",
      "categoryId": "CAT001",
      "name": "Electronics",
      "slug": "electronics",
      "mainImage": {
        "url": "https://s3.amazonaws.com/...",
        "altText": "Electronics"
      },
      "iconImage": {
        "url": "https://s3.amazonaws.com/.../icon.png",
        "altText": ""
      },
      "subCategories": [
        {
          "_id": "64def...",
          "categoryId": "CAT002",
          "name": "Mobile Phones",
          "slug": "mobile-phones",
          "mainImage": { "url": "...", "altText": "Mobile Phones" },
          "iconImage": { "url": "...", "altText": "" }
        }
      ]
    }
  ]
}
```

> **Image fallback:** If a subcategory has no image, the server automatically uses
> the parent's image. You don't need to handle this in Flutter.

**Flutter code:**

```dart
// lib/features/home/data/category_repository.dart

Future<List<CategoryModel>> getHomeCategories() async {
  try {
    final response = await ApiClient.instance.get('/api/categories/dropdown/all');
    if (response.data['success'] == true) {
      final List data = response.data['data'] as List;
      return data.map((e) => CategoryModel.fromJson(e)).toList();
    }
    throw Exception('Failed to load categories');
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}
```

---

### 2.2 Get All Categories (with filters)

Use this for a **full category listing page** where you want pagination and filtering.

```
GET /api/categories
```

**Query Parameters:**

| Param | Type | Description | Example |
|---|---|---|---|
| `parentCategoryId` | string | Filter by parent ID. Use `null` for root categories | `parentCategoryId=null` |
| `isActive` | boolean | `true` for active only | `isActive=true` |
| `page` | number | Page number (default: 1) | `page=1` |
| `limit` | number | Items per page (default: 10, max: 100) | `limit=20` |

**Flutter code:**

```dart
Future<CategoryListResponse> getAllCategories({
  String? parentCategoryId,
  bool? isActive,
  int page = 1,
  int limit = 20,
}) async {
  final queryParams = <String, dynamic>{
    'page': page,
    'limit': limit,
  };
  if (parentCategoryId != null) queryParams['parentCategoryId'] = parentCategoryId;
  if (isActive != null) queryParams['isActive'] = isActive.toString();

  final response = await ApiClient.instance.get(
    '/api/categories',
    queryParameters: queryParams,
  );

  return CategoryListResponse.fromJson(response.data);
}
```

---

### 2.3 Get Single Category with Subcategories

Use when user taps a category to **drill into subcategories**.

```
GET /api/categories/:categoryId/with-subcategories
```

**`:categoryId`** — the MongoDB `_id` string of the category

**Flutter code:**

```dart
Future<CategoryModel> getCategoryWithSubs(String categoryId) async {
  final response = await ApiClient.instance.get(
    '/api/categories/$categoryId/with-subcategories',
  );
  return CategoryModel.fromJson(response.data['data']);
}
```

**Response includes:**
- Full category fields
- `subCategories` array with full subcategory objects (not just IDs)
- `parentCategoryId` populated with parent's name and slug

---

### 2.4 Search Categories

```
GET /api/categories/search/:query
```

**Flutter code:**

```dart
Future<List<CategoryModel>> searchCategories(String query) async {
  final encodedQuery = Uri.encodeComponent(query);
  final response = await ApiClient.instance.get(
    '/api/categories/search/$encodedQuery',
  );
  final List data = response.data['data'] as List;
  return data.map((e) => CategoryModel.fromJson(e)).toList();
}
```

---

### 2.5 Featured Categories

For a **"Featured" or "Trending" section** on the home screen.

```
GET /api/categories/featured
```

**No auth required. No params needed.**

```dart
Future<List<CategoryModel>> getFeaturedCategories() async {
  final response = await ApiClient.instance.get('/api/categories/featured');
  final List data = response.data['data'] as List;
  return data.map((e) => CategoryModel.fromJson(e)).toList();
}
```

---

## 3. Product APIs — What to Use

**Base path:** `/api/products`

> **Important:** All public product endpoints automatically filter to `listingStatus: "published"` only.
> Pending / rejected / draft seller products are never visible to the app.

---

### 3.1 List Products (Home / Browse Screen)

```
GET /api/products
```

**Query Parameters:**

| Param | Type | Description | Example |
|---|---|---|---|
| `page` | number | Page number (default: 1) | `page=2` |
| `limit` | number | Items per page (default: 10, max: 100) | `limit=20` |
| `search` | string | Keyword search in name/description | `search=phone` |
| `category` | string | Category ID — includes all subcategories automatically | `category=64abc...` |
| `brand` | string | Filter by brand name | `brand=Samsung` |
| `minPrice` | number | Min final price | `minPrice=500` |
| `maxPrice` | number | Max final price | `maxPrice=10000` |
| `region` | string | Region code (`IN`, `US`, etc.) — auto-detected from IP if not sent | `region=IN` |
| `hasVariants` | boolean | `true` = only variant products, `false` = simple products only | `hasVariants=true` |
| `simpleOnly` | boolean | `true` = no-variant products only (shortcut) | `simpleOnly=true` |
| `attr[Color]` | string | Filter by variant attribute | `attr[Color]=Red` |
| `attr[Size]` | string | Filter by variant size | `attr[Size]=L` |

**Response shape:**

```json
{
  "success": true,
  "data": [ /* array of product objects */ ],
  "pagination": {
    "current": 1,
    "pages": 5,
    "total": 48,
    "limit": 10
  }
}
```

**Flutter code:**

```dart
// lib/features/products/data/product_repository.dart

class ProductRepository {
  final Dio _dio = ApiClient.instance;

  Future<ProductListResponse> getProducts({
    int page = 1,
    int limit = 20,
    String? search,
    String? categoryId,
    String? brand,
    double? minPrice,
    double? maxPrice,
    String? region,
    bool? hasVariants,
    Map<String, String>? attributes, // e.g. {'Color': 'Red', 'Size': 'L'}
  }) async {
    final params = <String, dynamic>{
      'page': page,
      'limit': limit,
    };

    if (search != null && search.isNotEmpty) params['search'] = search;
    if (categoryId != null) params['category'] = categoryId;
    if (brand != null) params['brand'] = brand;
    if (minPrice != null) params['minPrice'] = minPrice;
    if (maxPrice != null) params['maxPrice'] = maxPrice;
    if (region != null) params['region'] = region;
    if (hasVariants != null) params['hasVariants'] = hasVariants.toString();

    // Variant attribute filters: ?attr[Color]=Red&attr[Size]=L
    if (attributes != null) {
      attributes.forEach((key, value) {
        params['attr[$key]'] = value;
      });
    }

    final response = await _dio.get('/api/products', queryParameters: params);
    return ProductListResponse.fromJson(response.data);
  }
}
```

---

### 3.2 Search Products

Advanced search with more options — use for a **dedicated search screen**.

```
GET /api/products/search
```

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (name, description, SKU) |
| `category` | string | Category ID filter |
| `brand` | string | Brand filter |
| `minPrice` | number | Minimum price |
| `maxPrice` | number | Maximum price |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `sortBy` | string | `price_asc`, `price_desc`, `newest`, `name_asc` |
| `region` | string | Region code |
| `inStock` | boolean | `true` = in stock only |

**Flutter code:**

```dart
Future<ProductListResponse> searchProducts({
  required String query,
  String? categoryId,
  String? sortBy,
  bool inStockOnly = false,
  int page = 1,
  int limit = 20,
}) async {
  final params = <String, dynamic>{
    'q': query,
    'page': page,
    'limit': limit,
  };

  if (categoryId != null) params['category'] = categoryId;
  if (sortBy != null) params['sortBy'] = sortBy;
  if (inStockOnly) params['inStock'] = 'true';

  final response = await ApiClient.instance.get(
    '/api/products/search',
    queryParameters: params,
  );
  return ProductListResponse.fromJson(response.data);
}
```

---

### 3.3 Get Single Product Detail

Use on the **Product Detail Page**. Returns full product data + `priceRange` for variant products.

```
GET /api/products/:productId
```

**`:productId`** — can be either:
- The custom `productId` string (e.g. `PROD123456789`)
- The MongoDB `_id` string (e.g. `64abc123...`)

**Response shape:**

```json
{
  "success": true,
  "data": {
    "_id": "64abc...",
    "productId": "PROD123456789",
    "name": "Premium Wireless Headphones",
    "description": "High quality sound...",
    "brand": "SoundMax",
    "pricing": {
      "regularPrice": 4999,
      "salePrice": 3499,
      "finalPrice": 3499,
      "currency": "INR",
      "discountPercentage": 30
    },
    "availability": {
      "isAvailable": true,
      "stockQuantity": 25,
      "stockStatus": "in_stock"
    },
    "images": [
      { "url": "https://s3...", "altText": "Front view", "isPrimary": true }
    ],
    "hasVariants": true,
    "variants": [ /* see section 3.9 */ ],
    "category": {
      "mainCategoryId": "64cat...",
      "mainCategoryName": "Electronics",
      "subCategoryId": "64sub...",
      "subCategoryName": "Headphones"
    },
    "sellerInfo": {
      "storeName": "AudioWorld Store",
      "rating": 4.5,
      "isVerified": true
    },
    "reviewStats": {
      "averageRating": 4.3,
      "totalReviews": 128
    },
    "plans": [ /* installment plans — see section 3.8 */ ]
  },
  "priceRange": {
    "min": 2999,
    "max": 4999,
    "currency": "INR"
  }
}
```

**Flutter code:**

```dart
Future<ProductDetailResponse> getProductById(String productId) async {
  final response = await ApiClient.instance.get('/api/products/$productId');

  if (response.data['success'] != true) {
    throw Exception(response.data['message'] ?? 'Product not found');
  }

  return ProductDetailResponse(
    product: ProductModel.fromJson(response.data['data']),
    priceRange: response.data['priceRange'] != null
        ? PriceRange.fromJson(response.data['priceRange'])
        : null,
  );
}
```

> **Note on `priceRange`:** Only present when `hasVariants: true`. Use this to show
> "₹2,999 – ₹4,999" on product cards without iterating all variants.

---

### 3.4 Products by Category

Two ways to get products by category:

#### Option A — By category slug/name (legacy)
```
GET /api/products/category/:category
```

#### Option B — By category ObjectId (recommended)
```
GET /api/products/category/:categoryId
```

> Use **Option B** (`/category/:categoryId`) for new code — pass the MongoDB `_id`.
> The `category` filter on `GET /api/products` also works and supports subcategories automatically.

**Flutter code (recommended approach — uses the main listing API with category filter):**

```dart
Future<ProductListResponse> getProductsByCategory(
  String categoryId, {
  int page = 1,
  int limit = 20,
}) async {
  return getProducts(categoryId: categoryId, page: page, limit: limit);
}
```

---

### 3.5 Featured Products

Three types of featured product lists — use on **home screen banners/carousels**.

```
GET /api/products/featured/popular
GET /api/products/featured/best-sellers
GET /api/products/featured/trending
GET /api/products/featured/all      ← all 3 types combined
```

**All public, no auth needed.**

**Flutter code:**

```dart
enum FeaturedType { popular, bestSellers, trending, all }

Future<List<ProductModel>> getFeaturedProducts(FeaturedType type) async {
  final pathMap = {
    FeaturedType.popular:     '/api/products/featured/popular',
    FeaturedType.bestSellers: '/api/products/featured/best-sellers',
    FeaturedType.trending:    '/api/products/featured/trending',
    FeaturedType.all:         '/api/products/featured/all',
  };

  final response = await ApiClient.instance.get(pathMap[type]!);
  final List data = response.data['data'] as List;
  return data.map((e) => ProductModel.fromJson(e)).toList();
}
```

---

### 3.6 Low Stock / Urgency Badge

Shows products with low stock — useful for **"Hurry, only X left!" badges**.

```
GET /api/products/low-stock
```

| Param | Type | Description |
|---|---|---|
| `region` | string | Filter by region |
| `limit` | number | Max results |

```dart
Future<List<ProductModel>> getLowStockProducts({String? region}) async {
  final params = <String, dynamic>{'limit': 10};
  if (region != null) params['region'] = region;

  final response = await ApiClient.instance.get(
    '/api/products/low-stock',
    queryParameters: params,
  );
  final List data = response.data['data'] as List;
  return data.map((e) => ProductModel.fromJson(e)).toList();
}
```

---

### 3.7 Product Reviews

Load customer reviews on the product detail screen.

```
GET /api/products/:productId/reviews
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Reviews per page |
| `sort` | string | `newest` | `mostHelpful`, `newest`, `oldest`, `highest`, `lowest` |
| `rating` | string | — | Filter by rating(s). Single: `5`. Multiple: `5,4` |
| `verified` | boolean | — | `true` = verified purchases only |
| `hasImages` | boolean | — | `true` = reviews with photos only |
| `search` | string | — | Search text within reviews |

**Flutter code:**

```dart
Future<ReviewListResponse> getProductReviews(
  String productId, {
  int page = 1,
  int limit = 10,
  String sort = 'newest',
  List<int>? ratingFilter,
  bool verifiedOnly = false,
  bool withImagesOnly = false,
}) async {
  final params = <String, dynamic>{
    'page': page,
    'limit': limit,
    'sort': sort,
  };

  if (ratingFilter != null && ratingFilter.isNotEmpty) {
    params['rating'] = ratingFilter.join(',');
  }
  if (verifiedOnly) params['verified'] = 'true';
  if (withImagesOnly) params['hasImages'] = 'true';

  final response = await ApiClient.instance.get(
    '/api/products/$productId/reviews',
    queryParameters: params,
  );

  return ReviewListResponse.fromJson(response.data);
}
```

**Response includes:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "rating": 5,
      "title": "Excellent product!",
      "body": "Really good quality...",
      "images": ["https://s3..."],
      "isVerifiedPurchase": true,
      "helpfulCount": 12,
      "user": { "name": "John D." }
    }
  ],
  "pagination": { "current": 1, "pages": 13, "total": 128 },
  "summary": {
    "averageRating": 4.3,
    "totalReviews": 128,
    "ratingDistribution": { "5": 80, "4": 30, "3": 10, "2": 5, "1": 3 }
  }
}
```

---

### 3.8 Product Plans (Installment Options)

Shows available installment plans for a product — display on the **product detail screen**.

```
GET /api/products/:productId/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "planId": "PLAN001",
      "name": "3-Month Easy EMI",
      "duration": 3,
      "frequency": "monthly",
      "downPaymentPercent": 20,
      "interestRate": 0,
      "description": "Pay 20% now, rest in 3 monthly installments"
    }
  ]
}
```

```dart
Future<List<PlanModel>> getProductPlans(String productId) async {
  final response = await ApiClient.instance.get(
    '/api/products/$productId/plans',
  );
  final List data = response.data['data'] as List;
  return data.map((e) => PlanModel.fromJson(e)).toList();
}
```

---

### 3.9 Product Variants

For products with `hasVariants: true` — fetch all variants with their images/prices.

```
GET /api/products/:productId/variants
GET /api/products/:productId/variants/:variantId   ← single variant
```

**Variant object shape:**
```json
{
  "variantId": "VAR123456700",
  "sku": "SKU-HP-RED-L",
  "attributes": [
    { "name": "Color", "value": "Red" },
    { "name": "Size",  "value": "L" }
  ],
  "price": 4999,
  "salePrice": 3499,
  "stock": 12,
  "isActive": true,
  "images": [
    { "url": "https://s3.../red-l.jpg", "altText": "Red L variant" }
  ]
}
```

**Flutter code:**

```dart
Future<List<VariantModel>> getProductVariants(String productId) async {
  final response = await ApiClient.instance.get(
    '/api/products/$productId/variants',
  );
  final List data = response.data['data'] as List;
  return data.map((e) => VariantModel.fromJson(e)).toList();
}
```

**How to render a variant selector in Flutter:**

```dart
// Group variants by attribute name to build color/size pickers
Map<String, List<String>> groupVariantAttributes(List<VariantModel> variants) {
  final Map<String, Set<String>> grouped = {};

  for (final variant in variants.where((v) => v.isActive)) {
    for (final attr in variant.attributes) {
      grouped.putIfAbsent(attr.name, () => <String>{}).add(attr.value);
    }
  }

  return grouped.map((key, values) => MapEntry(key, values.toList()));
}

// Find a variant matching selected attributes
VariantModel? findMatchingVariant(
  List<VariantModel> variants,
  Map<String, String> selectedAttributes,
) {
  return variants.firstWhereOrNull((v) {
    return selectedAttributes.entries.every((selected) =>
      v.attributes.any(
        (a) => a.name == selected.key && a.value == selected.value,
      ),
    );
  });
}
```

---

## 4. Data Models — Flutter Classes

```dart
// lib/features/categories/data/models/category_model.dart

class CategoryModel {
  final String id;
  final String categoryId;
  final String name;
  final String slug;
  final CategoryImage? mainImage;
  final CategoryImage? iconImage;
  final List<CategoryModel> subCategories;
  final bool isActive;

  CategoryModel({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.slug,
    this.mainImage,
    this.iconImage,
    this.subCategories = const [],
    this.isActive = true,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['_id'] ?? '',
      categoryId: json['categoryId'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      mainImage: json['mainImage'] != null
          ? CategoryImage.fromJson(json['mainImage'])
          : null,
      iconImage: json['iconImage'] != null
          ? CategoryImage.fromJson(json['iconImage'])
          : null,
      subCategories: (json['subCategories'] as List? ?? [])
          .map((e) => CategoryModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      isActive: json['isActive'] ?? true,
    );
  }
}

class CategoryImage {
  final String url;
  final String altText;

  CategoryImage({required this.url, required this.altText});

  factory CategoryImage.fromJson(Map<String, dynamic> json) {
    // Handle both new schema { url, altText } and old schema (string)
    if (json is String) {
      return CategoryImage(url: json, altText: '');
    }
    return CategoryImage(
      url: json['url'] ?? '',
      altText: json['altText'] ?? '',
    );
  }
}
```

```dart
// lib/features/products/data/models/product_model.dart

class ProductModel {
  final String id;
  final String productId;
  final String name;
  final String? description;
  final String? brand;
  final ProductPricing pricing;
  final ProductAvailability availability;
  final List<ProductImage> images;
  final bool hasVariants;
  final List<VariantModel> variants;
  final ProductCategory? category;
  final SellerInfo? sellerInfo;
  final ReviewStats? reviewStats;
  final PriceRange? priceRange;   // populated separately from getProductById

  ProductModel({
    required this.id,
    required this.productId,
    required this.name,
    this.description,
    this.brand,
    required this.pricing,
    required this.availability,
    this.images = const [],
    this.hasVariants = false,
    this.variants = const [],
    this.category,
    this.sellerInfo,
    this.reviewStats,
    this.priceRange,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['_id'] ?? '',
      productId: json['productId'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      brand: json['brand'],
      pricing: ProductPricing.fromJson(json['pricing'] ?? {}),
      availability: ProductAvailability.fromJson(json['availability'] ?? {}),
      images: (json['images'] as List? ?? [])
          .map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasVariants: json['hasVariants'] ?? false,
      variants: (json['variants'] as List? ?? [])
          .map((e) => VariantModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      category: json['category'] != null
          ? ProductCategory.fromJson(json['category'])
          : null,
      sellerInfo: json['sellerInfo'] != null
          ? SellerInfo.fromJson(json['sellerInfo'])
          : null,
      reviewStats: json['reviewStats'] != null
          ? ReviewStats.fromJson(json['reviewStats'])
          : null,
    );
  }

  /// Display price: salePrice if set, else regularPrice
  double get displayPrice => pricing.finalPrice;

  /// True if product is on sale
  bool get isOnSale =>
      pricing.salePrice != null && pricing.salePrice! < pricing.regularPrice;

  /// Discount percentage (rounded)
  int get discountPercent {
    if (!isOnSale) return 0;
    return ((1 - pricing.salePrice! / pricing.regularPrice) * 100).round();
  }

  /// Primary image URL for product card
  String? get primaryImageUrl {
    final primary = images.firstWhereOrNull((img) => img.isPrimary);
    return primary?.url ?? images.firstOrNull?.url;
  }

  /// Stock status badge text
  String get stockStatusText {
    switch (availability.stockStatus) {
      case 'in_stock':   return 'In Stock';
      case 'low_stock':  return 'Only ${availability.stockQuantity} left!';
      case 'out_of_stock': return 'Out of Stock';
      default:           return '';
    }
  }
}

class ProductPricing {
  final double regularPrice;
  final double? salePrice;
  final double finalPrice;
  final String currency;
  final int? discountPercentage;

  ProductPricing({
    required this.regularPrice,
    this.salePrice,
    required this.finalPrice,
    this.currency = 'INR',
    this.discountPercentage,
  });

  factory ProductPricing.fromJson(Map<String, dynamic> json) {
    return ProductPricing(
      regularPrice: (json['regularPrice'] ?? 0).toDouble(),
      salePrice: json['salePrice'] != null
          ? (json['salePrice'] as num).toDouble()
          : null,
      finalPrice: (json['finalPrice'] ?? json['regularPrice'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'INR',
      discountPercentage: json['discountPercentage'],
    );
  }
}

class ProductAvailability {
  final bool isAvailable;
  final int stockQuantity;
  final String stockStatus; // "in_stock" | "low_stock" | "out_of_stock"

  ProductAvailability({
    required this.isAvailable,
    required this.stockQuantity,
    required this.stockStatus,
  });

  factory ProductAvailability.fromJson(Map<String, dynamic> json) {
    return ProductAvailability(
      isAvailable: json['isAvailable'] ?? false,
      stockQuantity: json['stockQuantity'] ?? 0,
      stockStatus: json['stockStatus'] ?? 'out_of_stock',
    );
  }
}

class ProductImage {
  final String url;
  final String altText;
  final bool isPrimary;

  ProductImage({
    required this.url,
    this.altText = '',
    this.isPrimary = false,
  });

  factory ProductImage.fromJson(Map<String, dynamic> json) {
    return ProductImage(
      url: json['url'] ?? '',
      altText: json['altText'] ?? '',
      isPrimary: json['isPrimary'] ?? false,
    );
  }
}

class VariantModel {
  final String variantId;
  final String sku;
  final List<VariantAttribute> attributes;
  final double price;
  final double? salePrice;
  final int stock;
  final bool isActive;
  final List<ProductImage> images;

  VariantModel({
    required this.variantId,
    required this.sku,
    required this.attributes,
    required this.price,
    this.salePrice,
    required this.stock,
    this.isActive = true,
    this.images = const [],
  });

  double get displayPrice => salePrice ?? price;

  factory VariantModel.fromJson(Map<String, dynamic> json) {
    return VariantModel(
      variantId: json['variantId'] ?? '',
      sku: json['sku'] ?? '',
      attributes: (json['attributes'] as List? ?? [])
          .map((e) => VariantAttribute.fromJson(e as Map<String, dynamic>))
          .toList(),
      price: (json['price'] ?? 0).toDouble(),
      salePrice: json['salePrice'] != null
          ? (json['salePrice'] as num).toDouble()
          : null,
      stock: json['stock'] ?? 0,
      isActive: json['isActive'] ?? true,
      images: (json['images'] as List? ?? [])
          .map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class VariantAttribute {
  final String name;
  final String value;

  VariantAttribute({required this.name, required this.value});

  factory VariantAttribute.fromJson(Map<String, dynamic> json) {
    return VariantAttribute(
      name: json['name'] ?? '',
      value: json['value'] ?? '',
    );
  }
}

class SellerInfo {
  final String? storeName;
  final double? rating;
  final bool isVerified;

  SellerInfo({this.storeName, this.rating, this.isVerified = false});

  factory SellerInfo.fromJson(Map<String, dynamic> json) {
    return SellerInfo(
      storeName: json['storeName'],
      rating: json['rating'] != null ? (json['rating'] as num).toDouble() : null,
      isVerified: json['isVerified'] ?? false,
    );
  }
}

class ReviewStats {
  final double averageRating;
  final int totalReviews;

  ReviewStats({required this.averageRating, required this.totalReviews});

  factory ReviewStats.fromJson(Map<String, dynamic> json) {
    return ReviewStats(
      averageRating: (json['averageRating'] ?? 0).toDouble(),
      totalReviews: json['totalReviews'] ?? 0,
    );
  }
}

class PriceRange {
  final double min;
  final double max;
  final String currency;

  PriceRange({required this.min, required this.max, required this.currency});

  factory PriceRange.fromJson(Map<String, dynamic> json) {
    return PriceRange(
      min: (json['min'] ?? 0).toDouble(),
      max: (json['max'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'INR',
    );
  }

  String get displayText =>
      min == max ? '₹${min.toInt()}' : '₹${min.toInt()} – ₹${max.toInt()}';
}
```

---

## 5. Error Handling

**All error responses follow this shape:**

```json
{
  "success": false,
  "message": "Product not found"
}
```

**Validation errors (400) also include field details:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "pricing.salePrice", "message": "Sale price must be less than regular price" }
  ]
}
```

**Standard HTTP status codes:**

| Status | Meaning | Action |
|---|---|---|
| `200` | OK | Use the `data` field |
| `400` | Bad request / validation error | Show error message to user |
| `401` | Unauthorized | Token missing or expired — re-login |
| `403` | Forbidden | User doesn't have permission |
| `404` | Not found | Show "Product not found" screen |
| `409` | Conflict | Duplicate resource |
| `500` | Server error | Show generic error + retry button |

**Flutter error handling wrapper:**

```dart
// lib/core/api_exception.dart

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final List<Map<String, String>>? fieldErrors;

  ApiException({
    required this.statusCode,
    required this.message,
    this.fieldErrors,
  });

  factory ApiException.fromDio(DioException e) {
    final statusCode = e.response?.statusCode ?? 0;
    final data = e.response?.data;

    String message = 'Something went wrong. Please try again.';
    List<Map<String, String>>? fieldErrors;

    if (data is Map) {
      message = data['message'] ?? message;
      if (data['errors'] is List) {
        fieldErrors = (data['errors'] as List)
            .map((err) => {
                  'field': err['field']?.toString() ?? '',
                  'message': err['message']?.toString() ?? '',
                })
            .toList();
      }
    }

    return ApiException(
      statusCode: statusCode,
      message: message,
      fieldErrors: fieldErrors,
    );
  }

  bool get isNotFound    => statusCode == 404;
  bool get isUnauthorized => statusCode == 401;
  bool get isServerError  => statusCode >= 500;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
```

---

## 6. Common Patterns — Code Snippets

### Home Screen — Load categories + featured products in parallel

```dart
Future<void> loadHomeScreen() async {
  // Fire all requests simultaneously — do NOT await one by one
  final results = await Future.wait([
    getCategoriesForDropdown(),      // navigation bar
    getFeaturedProducts(FeaturedType.popular),   // carousel
    getFeaturedProducts(FeaturedType.trending),  // trending section
    getProducts(limit: 10),          // latest products
  ]);

  final categories  = results[0] as List<CategoryModel>;
  final popular     = results[1] as List<ProductModel>;
  final trending    = results[2] as List<ProductModel>;
  final latest      = results[3] as ProductListResponse;
  // update state...
}
```

---

### Product Card — Display price correctly

```dart
Widget buildPriceWidget(ProductModel product) {
  if (product.hasVariants && product.priceRange != null) {
    // Variant product: show range
    return Text(product.priceRange!.displayText);
  }

  if (product.isOnSale) {
    return Row(children: [
      Text(
        '₹${product.pricing.regularPrice.toInt()}',
        style: const TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey),
      ),
      const SizedBox(width: 6),
      Text('₹${product.displayPrice.toInt()}', style: const TextStyle(color: Colors.red)),
      const SizedBox(width: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        color: Colors.green,
        child: Text('${product.discountPercent}% OFF',
            style: const TextStyle(color: Colors.white, fontSize: 11)),
      ),
    ]);
  }

  return Text('₹${product.displayPrice.toInt()}');
}
```

---

### Variant Selector Widget

```dart
class VariantSelectorWidget extends StatefulWidget {
  final List<VariantModel> variants;
  final ValueChanged<VariantModel?> onVariantSelected;

  // ...
}

class _VariantSelectorWidgetState extends State<VariantSelectorWidget> {
  final Map<String, String> _selected = {};

  @override
  Widget build(BuildContext context) {
    final attributeGroups = groupVariantAttributes(widget.variants);

    return Column(
      children: attributeGroups.entries.map((entry) {
        final attrName   = entry.key;   // "Color", "Size"
        final attrValues = entry.value; // ["Red", "Blue", "Green"]

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(attrName, style: const TextStyle(fontWeight: FontWeight.bold)),
            Wrap(
              spacing: 8,
              children: attrValues.map((value) {
                final isSelected = _selected[attrName] == value;
                return ChoiceChip(
                  label: Text(value),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() => _selected[attrName] = value);
                    final matched = findMatchingVariant(widget.variants, _selected);
                    widget.onVariantSelected(matched);
                  },
                );
              }).toList(),
            ),
          ],
        );
      }).toList(),
    );
  }
}
```

---

### Review Rating Bar

```dart
Widget buildRatingBar(ReviewStats stats) {
  return Row(children: [
    Text(stats.averageRating.toStringAsFixed(1),
        style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
    const SizedBox(width: 8),
    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Use flutter_rating_bar package
      RatingBarIndicator(
        rating: stats.averageRating,
        itemCount: 5,
        itemSize: 18,
        itemBuilder: (_, __) =>
            const Icon(Icons.star, color: Colors.amber),
      ),
      Text('${stats.totalReviews} reviews',
          style: const TextStyle(color: Colors.grey)),
    ]),
  ]);
}
```

---

## 7. Image Handling Tips

- **All images are S3 URLs.** They are permanent — safe to cache.
- **Category images** can be in two shapes. The model handles both:
  - New schema: `{ "url": "...", "altText": "..." }`
  - Old schema: plain string URL (server sends it normalized now)
- **Image fallback**: If `mainImage.url` is empty/null, show a local placeholder asset.
- **Product `images` array** — always check `isPrimary: true` for the main card image.

```dart
// Cached image widget
Widget categoryImageWidget(CategoryImage? image) {
  if (image == null || image.url.isEmpty) {
    return Image.asset('assets/images/placeholder_category.png');
  }
  return CachedNetworkImage(
    imageUrl: image.url,
    placeholder: (_, __) => const CircularProgressIndicator(),
    errorWidget: (_, __, ___) =>
        Image.asset('assets/images/placeholder_category.png'),
    fit: BoxFit.cover,
  );
}
```

---

## 8. Pagination Pattern

All list endpoints use this pagination shape:

```json
// Category list
{
  "count": 48,
  "page": 2,
  "limit": 10,
  "totalPages": 5,
  "data": [...]
}

// Product list
{
  "pagination": {
    "current": 2,
    "pages": 5,
    "total": 48,
    "limit": 10
  },
  "data": [...]
}
```

**Flutter infinite scroll pattern:**

```dart
class _ProductListState extends State<ProductListScreen> {
  final List<ProductModel> _products = [];
  int _currentPage = 1;
  bool _hasMore = true;
  bool _isLoading = false;
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()
      ..addListener(() {
        if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200) {
          _loadMore();
        }
      });
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_isLoading || !_hasMore) return;
    setState(() => _isLoading = true);

    try {
      final response = await ProductRepository().getProducts(page: _currentPage, limit: 20);
      setState(() {
        _products.addAll(response.products);
        _hasMore = _currentPage < response.pagination.pages;
        _currentPage++;
      });
    } catch (e) {
      // show snackbar
    } finally {
      setState(() => _isLoading = false);
    }
  }
}
```

---

## 9. What NOT to Call from the App

These endpoints are **admin-only** and will return `403 Forbidden` if called with a user token.

| ❌ Do NOT call from app | Why |
|---|---|
| `POST /api/products` | Admin only — create product |
| `PUT /api/products/:id` | Admin only — edit product |
| `DELETE /api/products/:id` | Admin only — delete product |
| `GET /api/products/admin/all` | Admin only — shows deleted/pending products |
| `POST /api/categories` | Admin only |
| `PUT /api/categories/:id` | Admin only |
| `GET /api/categories/admin/all` | Admin only |
| `PATCH /api/products/:id/listing-status` | Admin only — approve/reject seller products |
| `POST /api/products/:id/generate-variant-matrix` | Admin only |
| `GET /api/products/export` | Admin only |
| `GET /api/categories/export` | Admin only |

---

## 10. Quick Reference Table

### Category Endpoints — App Team

| What you need | Method | Path | Auth |
|---|---|---|---|
| Home nav categories | GET | `/api/categories/dropdown/all` | None |
| All categories (paginated) | GET | `/api/categories` | None |
| Single category + subcategories | GET | `/api/categories/:id/with-subcategories` | None |
| Search categories | GET | `/api/categories/search/:query` | None |
| Featured categories | GET | `/api/categories/featured` | None |
| Category by ID | GET | `/api/categories/:id` | None |

### Product Endpoints — App Team

| What you need | Method | Path | Auth |
|---|---|---|---|
| Browse / list products | GET | `/api/products` | None |
| Search products | GET | `/api/products/search` | None |
| Single product detail | GET | `/api/products/:productId` | None |
| Products by category | GET | `/api/products?category=:id` | None |
| Featured — popular | GET | `/api/products/featured/popular` | None |
| Featured — best sellers | GET | `/api/products/featured/best-sellers` | None |
| Featured — trending | GET | `/api/products/featured/trending` | None |
| All featured (combined) | GET | `/api/products/featured/all` | None |
| Low stock products | GET | `/api/products/low-stock` | None |
| Product variants | GET | `/api/products/:id/variants` | None |
| Single variant | GET | `/api/products/:id/variants/:variantId` | None |
| Product plans | GET | `/api/products/:id/plans` | None |
| Product reviews | GET | `/api/products/:id/reviews` | None |

---

> **Questions / issues?** Raise them on the internal dev Slack channel or create a GitHub issue.
> **Related docs:**
> - [SELLER_SYSTEM_API_DOCUMENTATION.md](SELLER_SYSTEM_API_DOCUMENTATION.md) — For seller-facing app screens
> - [PRODUCT_CATEGORY_API_DOCUMENTATION.md](PRODUCT_CATEGORY_API_DOCUMENTATION.md) — Full technical reference (all teams)
> - [FLUTTER_TEAM_INSTALLMENT_ORDER_GUIDE.md](FLUTTER_TEAM_INSTALLMENT_ORDER_GUIDE.md) — Order creation & payment flow
