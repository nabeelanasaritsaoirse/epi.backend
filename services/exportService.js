const ExcelJS = require('exceljs');
const Product = require('../models/Product');

/**
 * Export products to Excel file
 * @param {Object} filters - MongoDB query filters
 * @returns {ExcelJS.Workbook} Excel workbook
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
 * @returns {string} CSV string
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
