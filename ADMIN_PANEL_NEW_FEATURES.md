# Admin Panel - New Features Documentation

**Live API Base URL:** `https://api.epielio.com`

---

## 🆕 New Features Implemented

### 1. **Auto-Update Product Count in Categories** ✅
Categories ab automatically apni product count update karenge.

### 2. **Export Products & Categories to CSV/Excel** ✅
Admin ab products aur categories ko CSV ya Excel format mein download kar sakta hai.

---

## 📊 Feature 1: Auto-Update Product Count

### **Kya hai?**
Jab bhi koi product create/update/delete hota hai, uski category ki `productCount` automatically update ho jati hai.

### **Kaise kaam karta hai?**
- Product save hone par → Category count update
- Product delete hone par → Category count update
- Product ka status change hone par → Category count update

### **Manual Sync Endpoint** (Initial setup ke liye)

**Endpoint:**
```
POST https://api.epielio.com/api/categories/sync-product-counts
```

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_ADMIN_TOKEN",
  "Content-Type": "application/json"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product counts synced successfully for 108 categories",
  "data": {
    "categoriesUpdated": 108
  }
}
```

**Admin Panel mein kaise use karein:**
1. **Settings page** mein ek button rakho: "Sync Product Counts"
2. Button click hone par ye API call karo
3. Success message show karo

---

## 📥 Feature 2: Export Products to CSV/Excel

### **Endpoint:**
```
GET https://api.epielio.com/api/products/export
```

### **Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `excel` | `excel` ya `csv` |
| `status` | string | - | `published`, `active`, `draft`, `archived` |
| `category` | string | - | Category ID se filter |
| `region` | string | - | Region se filter (e.g., `india`, `usa`) |
| `brand` | string | - | Brand name se filter |
| `hasVariants` | boolean | - | `true` ya `false` |
| `search` | string | - | Product name/description search |

### **Examples:**

**1. Export all products as Excel:**
```
GET https://api.epielio.com/api/products/export?format=excel
```

**2. Export only published products as CSV:**
```
GET https://api.epielio.com/api/products/export?format=csv&status=published
```

**3. Export products by category:**
```
GET https://api.epielio.com/api/products/export?category=675abc123&format=excel
```

**4. Export products by region:**
```
GET https://api.epielio.com/api/products/export?region=india&format=excel
```

**5. Export with multiple filters:**
```
GET https://api.epielio.com/api/products/export?format=excel&status=published&brand=Samsung&region=india
```

### **Response:**
Direct file download hoti hai (Excel ya CSV file).

**Filename format:**
- Excel: `products-1234567890.xlsx`
- CSV: `products-1234567890.csv`

### **Excel File Columns:**

| Column | Description |
|--------|-------------|
| Product ID | Unique product ID |
| Name | Product name |
| Brand | Brand name |
| Category | Category name |
| SKU | Stock keeping unit |
| Regular Price | Original price |
| Sale Price | Discount price |
| Final Price | Actual selling price |
| Currency | Currency (USD, INR, etc.) |
| Stock Quantity | Available quantity |
| Stock Status | in_stock, low_stock, out_of_stock |
| Status | published, active, draft |
| Has Variants | Yes/No |
| Description | Product description |
| Created At | Date created |
| Updated At | Last updated date |

### **Admin Panel Implementation:**

```javascript
// React/Next.js example
const exportProducts = async (format = 'excel', filters = {}) => {
  try {
    const queryParams = new URLSearchParams({
      format,
      ...filters
    }).toString();

    const response = await fetch(
      `https://api.epielio.com/api/products/export?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed');
  }
};

// Usage
exportProducts('excel', { status: 'published', region: 'india' });
```

### **UI Components:**

**Export Button with Dropdown:**
```jsx
<div className="export-section">
  <button onClick={() => exportProducts('excel')}>
    📊 Export to Excel
  </button>
  <button onClick={() => exportProducts('csv')}>
    📄 Export to CSV
  </button>
</div>
```

**Export with Filters:**
```jsx
const [filters, setFilters] = useState({
  status: '',
  category: '',
  region: '',
  brand: ''
});

const handleExport = (format) => {
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== '')
  );
  exportProducts(format, cleanFilters);
};

// UI
<div>
  <select onChange={(e) => setFilters({...filters, status: e.target.value})}>
    <option value="">All Status</option>
    <option value="published">Published</option>
    <option value="draft">Draft</option>
  </select>

  <button onClick={() => handleExport('excel')}>Export Excel</button>
  <button onClick={() => handleExport('csv')}>Export CSV</button>
</div>
```

---

## 📥 Feature 3: Export Categories to CSV/Excel

### **Endpoint:**
```
GET https://api.epielio.com/api/categories/export
```

### **Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `excel` | `excel` ya `csv` |
| `isActive` | boolean | - | `true` ya `false` |
| `parentCategoryId` | string | - | Parent category se filter |

### **Examples:**

**1. Export all categories as Excel:**
```
GET https://api.epielio.com/api/categories/export?format=excel
```

**2. Export only active categories as CSV:**
```
GET https://api.epielio.com/api/categories/export?format=csv&isActive=true
```

**3. Export only main categories (no parent):**
```
GET https://api.epielio.com/api/categories/export?parentCategoryId=null
```

### **Excel File Columns:**

| Column | Description |
|--------|-------------|
| Category ID | Unique category ID |
| Name | Category name |
| Slug | URL slug |
| Parent Category | Parent category name (ya "None") |
| Product Count | Total products in category |
| Display Order | Display order number |
| Is Active | Yes/No |
| Is Featured | Yes/No |
| Description | Category description |
| Created At | Date created |

### **Admin Panel Implementation:**

```javascript
const exportCategories = async (format = 'excel', filters = {}) => {
  try {
    const queryParams = new URLSearchParams({
      format,
      ...filters
    }).toString();

    const response = await fetch(
      `https://api.epielio.com/api/categories/export?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categories-${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed');
  }
};
```

---

## 🔐 Authentication Required

**Sab admin endpoints ke liye authentication zaroori hai:**

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_ADMIN_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

**Agar token invalid/missing hai:**
```json
{
  "success": false,
  "message": "Authentication token required",
  "code": "NO_TOKEN"
}
```

---

## ✅ Testing Checklist

### **Product Count Auto-Update:**
- [ ] Product create karo → Category count badhta hai?
- [ ] Product delete karo → Category count ghatta hai?
- [ ] Product ka category change karo → Dono categories update hoti hain?
- [ ] Manual sync endpoint test karo

### **Product Export:**
- [ ] Excel format download hota hai?
- [ ] CSV format download hota hai?
- [ ] Status filter kaam karta hai?
- [ ] Category filter kaam karta hai?
- [ ] Region filter kaam karta hai?
- [ ] Multiple filters sath mein kaam karte hain?
- [ ] Downloaded file open hoti hai?

### **Category Export:**
- [ ] Excel format download hota hai?
- [ ] CSV format download hota hai?
- [ ] isActive filter kaam karta hai?
- [ ] Downloaded file open hoti hai?

---

## 🚨 Important Notes

### **Product Count:**
- Sirf `published` aur `active` status ke products count hote hain
- Deleted products count nahi hote
- Automatic update asynchronous hai (background mein hota hai)

### **Export:**
- Export direct file download karata hai (JSON response nahi)
- Sirf admin access hai
- File size limit nahi hai (sab records download honge)
- Filters same hain jo existing GET endpoints mein hain

### **Existing APIs:**
- Koi bhi existing API ka response **change nahi hua**
- Sab purane endpoints pehle jaisa kaam kar rahe hain
- Ye sirf new endpoints hain

---

## 📱 Admin Panel UI Suggestions

### **Products Page:**
```
┌─────────────────────────────────────────────────┐
│  Products (98)                    [+ Add Product]│
├─────────────────────────────────────────────────┤
│  Filters:                                        │
│  Status: [All ▼]  Category: [All ▼]  Region: [All ▼]│
│  Brand: [All ▼]                                  │
│                                                  │
│  📊 Export to Excel  |  📄 Export to CSV        │
├─────────────────────────────────────────────────┤
│  [Product List Table]                            │
└─────────────────────────────────────────────────┘
```

### **Categories Page:**
```
┌─────────────────────────────────────────────────┐
│  Categories (108)              [+ Add Category]  │
├─────────────────────────────────────────────────┤
│  Filters:                                        │
│  Active: [All ▼]  Type: [All ▼]                │
│                                                  │
│  📊 Export to Excel  |  📄 Export to CSV        │
│  🔄 Sync Product Counts                         │
├─────────────────────────────────────────────────┤
│  [Category List Table with Product Count]       │
└─────────────────────────────────────────────────┘
```

### **Settings Page:**
```
┌─────────────────────────────────────────────────┐
│  System Maintenance                              │
├─────────────────────────────────────────────────┤
│  Sync Product Counts                             │
│  Update product counts for all categories        │
│  [🔄 Sync Now]                                   │
│                                                  │
│  Last synced: 2 hours ago                       │
└─────────────────────────────────────────────────┘
```

---

## 🐛 Error Handling

### **Export Errors:**

**No data to export:**
```javascript
// Backend automatically handles, empty file download hoti hai
```

**Invalid filters:**
```json
{
  "success": false,
  "message": "Invalid category ID"
}
```

**Authentication error:**
```json
{
  "success": false,
  "message": "Access denied. Admin role required.",
  "code": "ADMIN_REQUIRED"
}
```

### **Frontend Error Handling:**
```javascript
const handleExport = async (format) => {
  try {
    // Show loading
    setLoading(true);

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    // Download file
    const blob = await response.blob();
    downloadFile(blob, format);

    // Show success
    showToast('Export successful!', 'success');

  } catch (error) {
    console.error(error);
    showToast('Export failed: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
};
```

---

## 📞 Support

Agar koi issue aaye ya question ho:
1. Backend logs check karo
2. Network tab mein request/response dekho
3. Console errors check karo

---

**Last Updated:** December 12, 2024
**Version:** 1.0
**Status:** ✅ Live on Production
