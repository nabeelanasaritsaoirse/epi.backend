const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');

/**
 * Export products to Excel file
 * @param {Object} filters - MongoDB query filters
 * @returns {Promise<ExcelJS.Workbook>} Excel workbook
 */
exports.exportProductsToExcel = async (filters = {}) => {
  try {
    // Fetch products based on filters
    const products = await Product.find(filters)
      .populate('category.mainCategoryId', 'name')
      .sort({ createdAt: -1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    // Define columns
    worksheet.columns = [
      { header: 'Product ID', key: 'productId', width: 15 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Regular Price', key: 'regularPrice', width: 12 },
      { header: 'Sale Price', key: 'salePrice', width: 12 },
      { header: 'Final Price', key: 'finalPrice', width: 12 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Stock Quantity', key: 'stockQuantity', width: 12 },
      { header: 'Stock Status', key: 'stockStatus', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Has Variants', key: 'hasVariants', width: 12 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    products.forEach(product => {
      worksheet.addRow({
        productId: product.productId || '',
        name: product.name || '',
        brand: product.brand || '',
        category: product.category?.mainCategoryName || '',
        sku: product.sku || '',
        regularPrice: product.pricing?.regularPrice || 0,
        salePrice: product.pricing?.salePrice || 0,
        finalPrice: product.pricing?.finalPrice || 0,
        currency: product.pricing?.currency || 'USD',
        stockQuantity: product.availability?.stockQuantity || 0,
        stockStatus: product.availability?.stockStatus || '',
        status: product.status || '',
        hasVariants: product.hasVariants ? 'Yes' : 'No',
        description: product.description?.short || '',
        createdAt: product.createdAt?.toISOString().split('T')[0] || '',
        updatedAt: product.updatedAt?.toISOString().split('T')[0] || ''
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 10);
    });

    return workbook;

  } catch (error) {
    console.error('Export to Excel error:', error);
    throw error;
  }
};

/**
 * Export products to CSV
 * @param {Object} filters - MongoDB query filters
 * @returns {Promise<string>} CSV string
 */
exports.exportProductsToCSV = async (filters = {}) => {
  try {
    const products = await Product.find(filters)
      .populate('category.mainCategoryId', 'name')
      .sort({ createdAt: -1 });

    const csvRows = [];

    // Header
    csvRows.push([
      'Product ID', 'Name', 'Brand', 'Category', 'SKU',
      'Regular Price', 'Sale Price', 'Final Price', 'Currency',
      'Stock Quantity', 'Stock Status', 'Status', 'Has Variants',
      'Description', 'Created At', 'Updated At'
    ].join(','));

    // Data rows
    products.forEach(product => {
      csvRows.push([
        product.productId || '',
        `"${(product.name || '').replace(/"/g, '""')}"`, // Escape quotes
        product.brand || '',
        product.category?.mainCategoryName || '',
        product.sku || '',
        product.pricing?.regularPrice || 0,
        product.pricing?.salePrice || 0,
        product.pricing?.finalPrice || 0,
        product.pricing?.currency || 'USD',
        product.availability?.stockQuantity || 0,
        product.availability?.stockStatus || '',
        product.status || '',
        product.hasVariants ? 'Yes' : 'No',
        `"${(product.description?.short || '').replace(/"/g, '""')}"`,
        product.createdAt?.toISOString().split('T')[0] || '',
        product.updatedAt?.toISOString().split('T')[0] || ''
      ].join(','));
    });

    return csvRows.join('\n');

  } catch (error) {
    console.error('CSV export error:', error);
    throw error;
  }
};

/**
 * Export categories to Excel file
 * @param {Object} filters - MongoDB query filters
 * @returns {ExcelJS.Workbook} Excel workbook
 */
exports.exportCategoriesToExcel = async (filters = {}) => {
  try {
    const Category = require('../models/Category');

    // Fetch categories based on filters
    const categories = await Category.find(filters)
      .populate('parentCategoryId', 'name')
      .sort({ displayOrder: 1, name: 1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Categories');

    // Define columns
    worksheet.columns = [
      { header: 'Category ID', key: 'categoryId', width: 15 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Slug', key: 'slug', width: 30 },
      { header: 'Parent Category', key: 'parentCategory', width: 25 },
      { header: 'Product Count', key: 'productCount', width: 12 },
      { header: 'Display Order', key: 'displayOrder', width: 12 },
      { header: 'Is Active', key: 'isActive', width: 10 },
      { header: 'Is Featured', key: 'isFeatured', width: 12 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add data rows
    categories.forEach(category => {
      worksheet.addRow({
        categoryId: category.categoryId || '',
        name: category.name || '',
        slug: category.slug || '',
        parentCategory: category.parentCategoryId?.name || 'None (Main Category)',
        productCount: category.productCount || 0,
        displayOrder: category.displayOrder || 0,
        isActive: category.isActive ? 'Yes' : 'No',
        isFeatured: category.isFeatured ? 'Yes' : 'No',
        description: category.description || '',
        createdAt: category.createdAt?.toISOString().split('T')[0] || ''
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 10);
    });

    return workbook;

  } catch (error) {
    console.error('Export categories to Excel error:', error);
    throw error;
  }
};

/**
 * Export categories to CSV
 * @param {Object} filters - MongoDB query filters
 * @returns {string} CSV string
 */
exports.exportCategoriesToCSV = async (filters = {}) => {
  try {
    const Category = require('../models/Category');

    const categories = await Category.find(filters)
      .populate('parentCategoryId', 'name')
      .sort({ displayOrder: 1, name: 1 });

    const csvRows = [];

    // Header
    csvRows.push([
      'Category ID', 'Name', 'Slug', 'Parent Category', 'Product Count',
      'Display Order', 'Is Active', 'Is Featured', 'Description', 'Created At'
    ].join(','));

    // Data rows
    categories.forEach(category => {
      csvRows.push([
        category.categoryId || '',
        `"${(category.name || '').replace(/"/g, '""')}"`,
        category.slug || '',
        `"${(category.parentCategoryId?.name || 'None (Main Category)').replace(/"/g, '""')}"`,
        category.productCount || 0,
        category.displayOrder || 0,
        category.isActive ? 'Yes' : 'No',
        category.isFeatured ? 'Yes' : 'No',
        `"${(category.description || '').replace(/"/g, '""')}"`,
        category.createdAt?.toISOString().split('T')[0] || ''
      ].join(','));
    });

    return csvRows.join('\n');

  } catch (error) {
    console.error('CSV export categories error:', error);
    throw error;
  }
};

// ============================================================
// VENDOR IMPORT TEMPLATE GENERATOR
// ============================================================

/**
 * Generate an empty vendor Excel template with instructions,
 * column validations, and a sample row — ready to send to vendors.
 * @returns {Promise<ExcelJS.Workbook>}
 */
exports.generateVendorTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EPI Platform';
  workbook.created = new Date();

  // ── Colour palette ──────────────────────────────────────────
  const COLOR = {
    headerBg: 'FF1F4E79',   // dark navy — used in instruction title font
  };

  // ══════════════════════════════════════════════════════════════
  // SHEET 1 – INSTRUCTIONS
  // ══════════════════════════════════════════════════════════════
  const instrSheet = workbook.addWorksheet('📋 Instructions');
  instrSheet.getColumn('A').width = 5;
  instrSheet.getColumn('B').width = 35;
  instrSheet.getColumn('C').width = 65;

  const instrRows = [
    ['', '📋 VENDOR PRODUCT IMPORT TEMPLATE', ''],
    ['', '', ''],
    ['', 'HOW TO USE THIS FILE', ''],
    ['', '1. Go to the "🛍 Products" sheet', 'Fill in one product per row.'],
    ['', '2. Go to the "🎨 Variants" sheet', 'Fill in variant rows ONLY if the product has variants (different sizes / colours). Link by Product SKU.'],
    ['', '3. Do NOT change column headers', 'Changing header names will break the import.'],
    ['', '4. Delete the sample row (row 2)', 'Row 2 in both sheets is example data only.'],
    ['', '5. Image URLs', 'Provide direct publicly accessible image URLs (jpg/png/webp). You may provide up to 3 per product.'],
    ['', '6. Send the file back to us', 'We will import it and confirm the products live.'],
    ['', '', ''],
    ['', 'COLOUR LEGEND', ''],
    ['', '🟡 Yellow column', 'REQUIRED — must be filled, import will fail otherwise.'],
    ['', '🟢 Green column', 'OPTIONAL — fill if available.'],
    ['', '', ''],
    ['', 'ALLOWED VALUES', ''],
    ['', 'condition', 'new | refurbished | used | pre-owned'],
    ['', 'gstRate', '0 | 5 | 12 | 18 | 28'],
    ['', 'weightUnit', 'g | kg | lb | oz'],
    ['', 'dimensionUnit', 'cm | in | mm'],
    ['', 'warrantyUnit', 'days | months | years'],
    ['', 'hasVariants', 'Yes | No'],
    ['', 'features', 'Pipe-separated  →  Feature 1|Feature 2|Feature 3'],
    ['', 'specifications', 'Pipe-separated key:value  →  RAM:8GB|Storage:256GB'],
    ['', 'tags', 'Comma-separated  →  organic,fresh,seasonal'],
    ['', '', ''],
    ['', 'QUESTIONS?', 'Contact the platform team.'],
  ];

  instrRows.forEach((r, i) => {
    const row = instrSheet.addRow(r);
    if (i === 0) {
      row.getCell('B').font = { bold: true, size: 14, color: { argb: COLOR.headerBg } };
    } else if (r[1] && (r[1] === r[1].toUpperCase()) && r[1].length > 2) {
      row.getCell('B').font = { bold: true };
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SHEET 2 – PRODUCTS
  // ══════════════════════════════════════════════════════════════
  const prodSheet = workbook.addWorksheet('🛍 Products');

  // Column definitions: { header, key, width, required, note }
  const prodCols = [
    // ── Basic ─────────────────────────────────────────────────
    { header: 'Product Name *',        key: 'name',              width: 32, req: true,  note: '2–200 characters' },
    { header: 'Brand *',               key: 'brand',             width: 20, req: true,  note: '' },
    { header: 'SKU *',                 key: 'sku',               width: 18, req: true,  note: 'Unique product code (e.g. MNG-001)' },
    { header: 'Main Category Name *',  key: 'mainCategoryName',  width: 22, req: true,  note: 'Must match a category on the platform' },
    { header: 'Sub Category Name',     key: 'subCategoryName',   width: 22, req: false, note: 'Optional sub-category' },
    // ── Descriptions ──────────────────────────────────────────
    { header: 'Short Description *',   key: 'shortDesc',         width: 45, req: true,  note: '10–500 characters' },
    { header: 'Long Description',      key: 'longDesc',          width: 50, req: false, note: 'Detailed product description' },
    { header: 'Features',              key: 'features',          width: 45, req: false, note: 'Pipe-separated: Feature1|Feature2' },
    { header: 'Specifications',        key: 'specifications',    width: 50, req: false, note: 'Key:Value|Key:Value  e.g.  RAM:8GB|Storage:256GB' },
    // ── Pricing ───────────────────────────────────────────────
    { header: 'Regular Price (INR) *', key: 'regularPrice',      width: 20, req: true,  note: 'MRP / original price' },
    { header: 'Sale Price (INR)',       key: 'salePrice',         width: 18, req: false, note: 'Must be less than Regular Price' },
    { header: 'Cost Price (INR)',       key: 'costPrice',         width: 18, req: false, note: 'Your cost — internal use only' },
    // ── Stock ─────────────────────────────────────────────────
    { header: 'Stock Quantity *',      key: 'stockQty',          width: 15, req: true,  note: 'Current available units' },
    // ── Product details ───────────────────────────────────────
    { header: 'Condition',             key: 'condition',         width: 15, req: false, note: 'new | refurbished | used | pre-owned' },
    { header: 'Tags',                  key: 'tags',              width: 30, req: false, note: 'Comma-separated: organic,fresh' },
    // ── Tax ───────────────────────────────────────────────────
    { header: 'HSN Code',              key: 'hsnCode',           width: 14, req: false, note: '6–8 digit HSN code for GST' },
    { header: 'GST Rate (%)',          key: 'gstRate',           width: 14, req: false, note: '0 | 5 | 12 | 18 | 28' },
    // ── Dimensions ────────────────────────────────────────────
    { header: 'Weight',                key: 'weight',            width: 12, req: false, note: 'Numeric value' },
    { header: 'Weight Unit',           key: 'weightUnit',        width: 14, req: false, note: 'g | kg | lb | oz' },
    { header: 'Length',                key: 'length',            width: 12, req: false, note: 'Numeric value' },
    { header: 'Width',                 key: 'width',             width: 12, req: false, note: 'Numeric value' },
    { header: 'Height',                key: 'height',            width: 12, req: false, note: 'Numeric value' },
    { header: 'Dimension Unit',        key: 'dimensionUnit',     width: 16, req: false, note: 'cm | in | mm' },
    // ── Warranty ──────────────────────────────────────────────
    { header: 'Warranty Period',       key: 'warrantyPeriod',    width: 16, req: false, note: 'Number (e.g. 12)' },
    { header: 'Warranty Unit',         key: 'warrantyUnit',      width: 15, req: false, note: 'days | months | years' },
    { header: 'Return Days',           key: 'returnDays',        width: 14, req: false, note: 'Return window in days (e.g. 7)' },
    // ── Images ────────────────────────────────────────────────
    { header: 'Image URL 1',           key: 'imageUrl1',         width: 50, req: false, note: 'Primary image URL (jpg/png/webp)' },
    { header: 'Image URL 2',           key: 'imageUrl2',         width: 50, req: false, note: 'Additional image' },
    { header: 'Image URL 3',           key: 'imageUrl3',         width: 50, req: false, note: 'Additional image' },
    // ── Variants flag ─────────────────────────────────────────
    { header: 'Has Variants',          key: 'hasVariants',       width: 14, req: false, note: 'Yes or No — if Yes, fill Variants sheet' },
    // ── Origin ────────────────────────────────────────────────
    { header: 'Country of Origin',     key: 'country',           width: 20, req: false, note: 'e.g. India' },
    { header: 'Manufacturer',          key: 'manufacturer',      width: 25, req: false, note: '' },
  ];

  prodSheet.columns = prodCols.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const prodHeaderRow = prodSheet.getRow(1);
  prodHeaderRow.eachCell((cell, colNum) => {
    const col = prodCols[colNum - 1];
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: col.req ? 'FFFFE082' : 'FFA5D6A7' },  // amber vs green
    };
    cell.font = { bold: true, color: { argb: 'FF1A237E' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF1A237E' } },
    };
    if (col.note) {
      cell.note = { texts: [{ text: col.note }] };
    }
  });
  prodHeaderRow.height = 28;

  // Sample row
  const sampleProd = {
    name:            'Alphonso Mango 1 Kg Box',
    brand:           'Farm Fresh',
    sku:             'MNG-ALPHONSO-1KG',
    mainCategoryName:'Fruits',
    subCategoryName: 'Mangoes',
    shortDesc:       'Premium Alphonso mangoes sourced directly from Ratnagiri farms.',
    longDesc:        'Hand-picked Alphonso mangoes known for their rich taste and aroma.',
    features:        'Hand-picked|No artificial ripening|Farm fresh',
    specifications:  'Grade:A1|Net Weight:1 Kg|Origin:Ratnagiri',
    regularPrice:    699,
    salePrice:       599,
    costPrice:       400,
    stockQty:        100,
    condition:       'new',
    tags:            'mango,alphonso,organic,fresh',
    hsnCode:         '080450',
    gstRate:         0,
    weight:          1,
    weightUnit:      'kg',
    length:          20,
    width:           15,
    height:          10,
    dimensionUnit:   'cm',
    warrantyPeriod:  '',
    warrantyUnit:    '',
    returnDays:      2,
    imageUrl1:       'https://example.com/images/alphonso-mango.jpg',
    imageUrl2:       '',
    imageUrl3:       '',
    hasVariants:     'No',
    country:         'India',
    manufacturer:    'Ratnagiri Farms',
  };

  const sampleProdRow = prodSheet.addRow(sampleProd);
  sampleProdRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
    cell.font = { italic: true, color: { argb: 'FF5D4037' } };
  });
  sampleProdRow.getCell('name').value = '⬇ SAMPLE ROW — DELETE BEFORE SENDING ⬇  ' + sampleProd.name;

  // Data validation dropdowns
  const totalRows = 1001; // header + 1000 data rows
  const conditionList   = '"new,refurbished,used,pre-owned"';
  const gstList         = '"0,5,12,18,28"';
  const weightUnitList  = '"g,kg,lb,oz"';
  const dimUnitList     = '"cm,in,mm"';
  const warUnitList     = '"days,months,years"';
  const variantsList    = '"Yes,No"';

  const addDropdown = (col, formula) => {
    for (let r = 3; r <= totalRows; r++) {
      prodSheet.getCell(`${col}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [formula],
        showErrorMessage: true, errorTitle: 'Invalid value',
        error: `Please select from the dropdown list.`,
      };
    }
  };

  addDropdown('N', conditionList);   // condition
  addDropdown('Q', gstList);         // gstRate
  addDropdown('S', weightUnitList);  // weightUnit
  addDropdown('W', dimUnitList);     // dimensionUnit
  addDropdown('Y', warUnitList);     // warrantyUnit
  addDropdown('AE', variantsList);   // hasVariants

  // Freeze header row
  prodSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ══════════════════════════════════════════════════════════════
  // SHEET 3 – VARIANTS
  // ══════════════════════════════════════════════════════════════
  const varSheet = workbook.addWorksheet('🎨 Variants');

  const varCols = [
    { header: 'Product SKU *',       key: 'productSku',   width: 22, req: true,  note: 'Must match SKU in Products sheet' },
    { header: 'Variant SKU *',       key: 'variantSku',   width: 22, req: true,  note: 'Unique SKU for this variant' },
    { header: 'Attribute 1 Name *',  key: 'attr1Name',    width: 20, req: true,  note: 'e.g. Color, Size, Weight' },
    { header: 'Attribute 1 Value *', key: 'attr1Value',   width: 20, req: true,  note: 'e.g. Red, XL, 500g' },
    { header: 'Attribute 2 Name',    key: 'attr2Name',    width: 20, req: false, note: 'Second attribute (optional)' },
    { header: 'Attribute 2 Value',   key: 'attr2Value',   width: 20, req: false, note: '' },
    { header: 'Attribute 3 Name',    key: 'attr3Name',    width: 20, req: false, note: 'Third attribute (optional)' },
    { header: 'Attribute 3 Value',   key: 'attr3Value',   width: 20, req: false, note: '' },
    { header: 'Price (INR) *',       key: 'price',        width: 16, req: true,  note: '' },
    { header: 'Sale Price (INR)',     key: 'salePrice',    width: 16, req: false, note: 'Must be < Price' },
    { header: 'Stock *',             key: 'stock',        width: 14, req: true,  note: '' },
    { header: 'Image URL',           key: 'imageUrl',     width: 50, req: false, note: 'Image for this specific variant' },
  ];

  varSheet.columns = varCols.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const varHeaderRow = varSheet.getRow(1);
  varHeaderRow.eachCell((cell, colNum) => {
    const col = varCols[colNum - 1];
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: col.req ? 'FF80CBC4' : 'FFB2DFDB' },
    };
    cell.font = { bold: true, color: { argb: 'FF004D40' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF004D40' } } };
    if (col.note) cell.note = { texts: [{ text: col.note }] };
  });
  varHeaderRow.height = 28;

  // Sample variant row
  const sampleVar = {
    productSku:  'MNG-ALPHONSO-1KG',
    variantSku:  'MNG-ALPHONSO-1KG-V1',
    attr1Name:   'Pack Size',
    attr1Value:  '1 Kg',
    attr2Name:   '',
    attr2Value:  '',
    attr3Name:   '',
    attr3Value:  '',
    price:       699,
    salePrice:   599,
    stock:       50,
    imageUrl:    'https://example.com/images/alphonso-1kg.jpg',
  };
  const sampleVarRow = varSheet.addRow(sampleVar);
  sampleVarRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2F1' } };
    cell.font = { italic: true, color: { argb: 'FF004D40' } };
  });

  varSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ══════════════════════════════════════════════════════════════
  // SHEET 4 – STOCK UPDATE ONLY (for quick stock refresh)
  // ══════════════════════════════════════════════════════════════
  const stockSheet = workbook.addWorksheet('📦 Stock Update Only');
  stockSheet.columns = [
    { header: 'SKU *',              key: 'sku',      width: 22 },
    { header: 'New Stock Qty *',    key: 'stock',    width: 18 },
    { header: 'Sale Price (INR)',   key: 'salePrice',width: 18 },
    { header: 'Regular Price (INR)',key: 'regPrice', width: 20 },
  ];
  const stockHdr = stockSheet.getRow(1);
  stockHdr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF9A9A' } };
    cell.font = { bold: true, color: { argb: 'FF4A148C' } };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF4A148C' } } };
  });
  stockSheet.addRow({ sku: 'MNG-ALPHONSO-1KG', stock: 150, salePrice: 599, regPrice: 699 });
  stockSheet.getRow(2).font = { italic: true, color: { argb: 'FF6A1B9A' } };
  stockSheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
};

// ============================================================
// VENDOR EXCEL IMPORTER
// ============================================================

// Max rows a vendor may submit in one file
const IMPORT_ROW_LIMIT = 1000;

// Escape special regex chars to prevent ReDoS
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Allowed enum values for validated fields
const VALID_CONDITIONS   = ['new', 'refurbished', 'used', 'pre-owned'];
const VALID_WEIGHT_UNITS = ['g', 'kg', 'lb', 'oz'];
const VALID_DIM_UNITS    = ['cm', 'in', 'mm'];
const VALID_WAR_UNITS    = ['days', 'months', 'years'];
const VALID_GST_RATES    = [0, 5, 12, 18, 28];

// Basic URL sanity check (must start with http/https)
const isValidUrl = (str) => /^https?:\/\/.+\..+/.test(str);

/**
 * Parse a vendor-filled Excel workbook (Buffer) into an array of
 * product objects ready for bulk insert.
 *
 * @param {Buffer} buffer          - Excel file buffer
 * @param {string} createdByEmail  - email of the admin who imports
 * @returns {{ products: Object[], errors: string[], stockUpdates: Object[] }}
 */
exports.importVendorExcel = async (buffer, createdByEmail) => {
  const Category = require('../models/Category');
  const workbook  = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const errors  = [];
  const products = [];
  const stockUpdates = [];

  // ── Helper: safely extract cell value (handles plain, richText, shared) ──
  const cell = (row, key) => {
    const v = row.getCell(key).value;
    if (v === null || v === undefined) return '';
    // ExcelJS RichText format: { richText: [{ text: '...' }] }
    if (typeof v === 'object' && Array.isArray(v.richText)) {
      return v.richText.map(rt => rt.text || '').join('').trim();
    }
    // Shared string / hyperlink: { text: '...' }
    if (typeof v === 'object' && typeof v.text === 'string') {
      return v.text.trim();
    }
    return String(v).trim();
  };

  const num = (row, key) => {
    const v = parseFloat(cell(row, key));
    return isNaN(v) ? undefined : v;
  };

  // ── Category cache (uses exact string match, NOT unescaped regex) ───────
  const catCache = {};
  const resolveCategory = async (mainName, subName) => {
    const key = mainName.toLowerCase();
    if (!catCache[key]) {
      const cat = await Category.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(mainName)}$`, 'i') },
        isDeleted: { $ne: true },
      });
      catCache[key] = cat || null;
    }
    const mainCat = catCache[key];
    if (!mainCat) return null;

    let subCat = null;
    if (subName) {
      const subKey = `${key}__${subName.toLowerCase()}`;
      if (!catCache[subKey]) {
        const sc = await Category.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(subName)}$`, 'i') },
          parentCategoryId: mainCat._id,
          isDeleted: { $ne: true },
        });
        catCache[subKey] = sc || null;
      }
      subCat = catCache[subKey];
    }
    return { mainCat, subCat };
  };

  // ── Parse Variants sheet first (build map: productSku → variants[]) ──
  const variantMap = {};
  const seenVariantSkus = new Set(); // variant SKUs must be unique across all variants in this file
  const varSheet = workbook.getWorksheet('🎨 Variants');
  if (varSheet) {
    varSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const productSku = cell(row, 'productSku');
      if (!productSku || productSku.includes('SAMPLE')) return;

      const attr1Name    = cell(row, 'attr1Name');
      const attr1Value   = cell(row, 'attr1Value');
      const varSku       = cell(row, 'variantSku');
      const price        = num(row, 'price');
      const varSalePrice = num(row, 'salePrice');
      const varStockRaw  = num(row, 'stock');
      const varStock     = varStockRaw !== undefined ? Math.max(0, Math.floor(varStockRaw)) : 0;

      // Required field + price validation
      const varRowErrors = [];
      if (!varSku)                                                         varRowErrors.push('Variant SKU is required');
      if (varSku && seenVariantSkus.has(varSku.trim()))                    varRowErrors.push(`Duplicate Variant SKU "${varSku}" — each variant must have a unique SKU`);
      if (!attr1Name)                                                      varRowErrors.push('Attribute 1 Name is required');
      if (!attr1Value)                                                     varRowErrors.push('Attribute 1 Value is required');
      if (price === undefined)                                             varRowErrors.push('Price is required');
      if (price !== undefined && price <= 0)                               varRowErrors.push('Price must be greater than 0');
      if (varSalePrice !== undefined && varSalePrice <= 0)                 varRowErrors.push('Sale Price must be greater than 0 if provided');
      if (varSalePrice !== undefined && price !== undefined && varSalePrice >= price) {
        varRowErrors.push(`Sale Price (${varSalePrice}) must be less than Price (${price})`);
      }

      if (varRowErrors.length) {
        errors.push(`Variants row ${rowNum} (Product SKU: ${productSku}): ${varRowErrors.join('; ')}.`);
        return;
      }

      seenVariantSkus.add(varSku.trim());

      const attrs = [{ name: attr1Name, value: attr1Value }];
      const a2n = cell(row, 'attr2Name'); const a2v = cell(row, 'attr2Value');
      const a3n = cell(row, 'attr3Name'); const a3v = cell(row, 'attr3Value');
      if (a2n && a2v) attrs.push({ name: a2n, value: a2v });
      if (a3n && a3v) attrs.push({ name: a3n, value: a3v });

      // Validate variant image URL
      const imgUrl = cell(row, 'imageUrl');
      let varImages = [];
      if (imgUrl) {
        if (!isValidUrl(imgUrl)) {
          errors.push(`Variants row ${rowNum} (Product SKU: ${productSku}): Image URL is not valid — "${imgUrl}". Skipping image.`);
        } else {
          varImages = [{ url: imgUrl, isPrimary: true, altText: '', order: 1 }];
        }
      }

      const variant = {
        variantId:  uuidv4(),
        sku:        varSku.trim(),
        attributes: attrs,
        price,
        salePrice:  varSalePrice || undefined,
        stock:      varStock,
        images:     varImages,
        isActive:   true,
      };
      if (!variantMap[productSku]) variantMap[productSku] = [];
      variantMap[productSku].push(variant);
    });
  }

  // ── Parse Stock Update sheet ─────────────────────────────────
  const stockSheet = workbook.getWorksheet('📦 Stock Update Only');
  if (stockSheet) {
    stockSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const sku = cell(row, 'sku');
      if (!sku || sku.includes('SAMPLE')) return;
      const stockQty  = num(row, 'stock');
      // treat 0 as "no update" — a price of 0 is never valid
      const salePrice = num(row, 'salePrice') || undefined;
      const regPrice  = num(row, 'regPrice')  || undefined;
      if (sku && stockQty !== undefined) {
        stockUpdates.push({ sku, stockQty: Math.max(0, Math.floor(stockQty)), salePrice, regPrice });
      }
    });
  }

  // ── Parse Products sheet ─────────────────────────────────────
  const prodSheet = workbook.getWorksheet('🛍 Products');
  if (!prodSheet) {
    errors.push('Products sheet ("🛍 Products") not found in the uploaded file.');
    return { products: [], errors, stockUpdates };
  }

  // ── Collect rows, enforce row limit ─────────────────────────
  const rowList = [];
  prodSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    rowList.push({ row, rowNum });
  });

  if (rowList.length > IMPORT_ROW_LIMIT) {
    errors.push(`File has ${rowList.length} data rows. Maximum allowed per import is ${IMPORT_ROW_LIMIT}. Please split into multiple files.`);
    return { products: [], errors, stockUpdates };
  }

  // ── Track SKUs seen in this file to catch duplicates ─────────
  const seenSkus = new Set();

  for (const { row, rowNum } of rowList) {
    const name = cell(row, 'name');
    if (!name || name.includes('SAMPLE ROW')) continue;  // skip blank / sample

    const sku              = cell(row, 'sku');
    const brand            = cell(row, 'brand');
    const mainCategoryName = cell(row, 'mainCategoryName');
    const subCategoryName  = cell(row, 'subCategoryName');
    const shortDesc        = cell(row, 'shortDesc');
    const regularPrice     = num(row, 'regularPrice');
    const salePrice        = num(row, 'salePrice');
    const costPrice        = num(row, 'costPrice');
    const stockQtyRaw      = num(row, 'stockQty');
    const stockQty         = stockQtyRaw !== undefined ? Math.max(0, Math.floor(stockQtyRaw)) : 0;

    // ── Required field validation ────────────────────────────
    const rowErrors = [];
    if (!name)                            rowErrors.push('Product Name is required');
    if (name && name.length < 2)          rowErrors.push('Product Name must be at least 2 characters');
    if (name && name.length > 200)        rowErrors.push('Product Name cannot exceed 200 characters');
    if (!brand)                           rowErrors.push('Brand is required');
    if (!sku)                             rowErrors.push('SKU is required');
    if (!mainCategoryName)                rowErrors.push('Main Category Name is required');
    if (!shortDesc)                       rowErrors.push('Short Description is required');
    if (shortDesc && shortDesc.length < 10)  rowErrors.push('Short Description must be at least 10 characters');
    if (shortDesc && shortDesc.length > 500) rowErrors.push('Short Description cannot exceed 500 characters');
    if (regularPrice === undefined)       rowErrors.push('Regular Price is required');
    if (regularPrice !== undefined && regularPrice <= 0) rowErrors.push('Regular Price must be greater than 0');
    if (salePrice !== undefined && salePrice <= 0)       rowErrors.push('Sale Price must be greater than 0 if provided');
    if (salePrice !== undefined && regularPrice !== undefined && salePrice >= regularPrice) {
      rowErrors.push(`Sale Price (${salePrice}) must be less than Regular Price (${regularPrice})`);
    }

    // ── Duplicate SKU within file ────────────────────────────
    if (sku && seenSkus.has(sku)) {
      rowErrors.push(`Duplicate SKU "${sku}" — each product must have a unique SKU`);
    }

    if (rowErrors.length) {
      errors.push(`Row ${rowNum} (SKU: ${sku || 'N/A'}): ${rowErrors.join('; ')}.`);
      continue;
    }

    seenSkus.add(sku);

    // ── Category lookup ──────────────────────────────────────
    const catResult = await resolveCategory(mainCategoryName, subCategoryName);
    if (!catResult) {
      errors.push(`Row ${rowNum} (SKU: ${sku}): category "${mainCategoryName}" not found on platform.`);
      continue;
    }

    // ── Image URL validation ─────────────────────────────────
    const images = [];
    ['imageUrl1', 'imageUrl2', 'imageUrl3'].forEach((k, i) => {
      const url = cell(row, k);
      if (!url) return;
      if (!isValidUrl(url)) {
        errors.push(`Row ${rowNum} (SKU: ${sku}): Image URL ${i + 1} is not a valid URL — "${url}". Skipping this image.`);
        return;
      }
      images.push({ url, isPrimary: i === 0, altText: '', order: i + 1 });
    });

    // ── Specifications ───────────────────────────────────────
    const specs = [];
    const specsRaw = cell(row, 'specifications');
    if (specsRaw) {
      specsRaw.split('|').forEach(part => {
        const [key, ...rest] = part.split(':');
        if (key && rest.length) specs.push({ key: key.trim(), value: rest.join(':').trim(), unit: '' });
      });
    }

    // ── Features & Tags ──────────────────────────────────────
    const featuresRaw = cell(row, 'features');
    const features = featuresRaw
      ? featuresRaw.split('|').map(f => f.trim()).filter(Boolean)
      : [];

    const tagsRaw = cell(row, 'tags');
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : [];

    // ── Enum normalization (case-insensitive, fallback to default) ──
    const conditionRaw  = cell(row, 'condition').toLowerCase();
    const condition     = VALID_CONDITIONS.includes(conditionRaw) ? conditionRaw : 'new';

    const weightUnitRaw = cell(row, 'weightUnit').toLowerCase();
    const weightUnit    = VALID_WEIGHT_UNITS.includes(weightUnitRaw) ? weightUnitRaw : 'kg';

    const dimUnitRaw    = cell(row, 'dimensionUnit').toLowerCase();
    const dimensionUnit = VALID_DIM_UNITS.includes(dimUnitRaw) ? dimUnitRaw : 'cm';

    const warUnitRaw    = cell(row, 'warrantyUnit').toLowerCase();
    const warrantyUnit  = VALID_WAR_UNITS.includes(warUnitRaw) ? warUnitRaw : 'months';

    const gstRateRaw    = num(row, 'gstRate');
    const gstRate       = VALID_GST_RATES.includes(gstRateRaw) ? gstRateRaw : undefined;

    const hasVariants   = cell(row, 'hasVariants').toLowerCase() === 'yes';

    const productDoc = {
      productId:   uuidv4(),
      name:        name.trim(),
      brand:       brand.trim(),
      sku:         sku.trim(),
      slug: name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, ''),
      category: {
        mainCategoryId:   catResult.mainCat._id,
        mainCategoryName: catResult.mainCat.name,
        subCategoryId:    catResult.subCat?._id   || undefined,
        subCategoryName:  catResult.subCat?.name  || undefined,
      },
      description: {
        short: shortDesc.trim(),
        long:  cell(row, 'longDesc') || undefined,
        features,
        specifications: specs,
      },
      pricing: {
        regularPrice,
        salePrice:    salePrice  || undefined,
        costPrice:    costPrice  || undefined,
        currency:     'INR',
        baseCurrency: 'INR',
      },
      availability: {
        isAvailable:   true,
        stockQuantity: stockQty,
        lowStockLevel: 10,
      },
      condition,
      tags,
      taxInfo: {
        hsnCode: cell(row, 'hsnCode') || undefined,
        gstRate,
      },
      dimensions: {
        weight:        num(row, 'weight'),
        weightUnit,
        length:        num(row, 'length'),
        width:         num(row, 'width'),
        height:        num(row, 'height'),
        dimensionUnit,
      },
      warranty: {
        period:       num(row, 'warrantyPeriod'),
        warrantyUnit,
        returnPolicy: num(row, 'returnDays'),
      },
      origin: {
        country:      cell(row, 'country')      || undefined,
        manufacturer: cell(row, 'manufacturer') || undefined,
      },
      images,
      hasVariants,
      variants: (() => {
        if (!hasVariants) return [];
        const v = variantMap[sku] || [];
        if (v.length === 0) {
          errors.push(`Row ${rowNum} (SKU: ${sku}): "Has Variants" is Yes but no variants found in the Variants sheet for this SKU. Product imported with variants empty.`);
        }
        return v;
      })(),
      status:      'draft',
      listingStatus: 'pending_approval',
      createdByEmail,
      isDeleted:   false,
    };

    products.push(productDoc);
  }

  // ── Warn about orphaned variant rows (productSku not matched) ──────────
  for (const varProductSku of Object.keys(variantMap)) {
    if (!seenSkus.has(varProductSku)) {
      errors.push(`Variants sheet: Product SKU "${varProductSku}" has variant rows but no matching product was found in the Products sheet. These variants will be ignored.`);
    }
  }

  return { products, errors, stockUpdates };
};
