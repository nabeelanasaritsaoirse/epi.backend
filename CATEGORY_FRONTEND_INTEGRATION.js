// Frontend Integration Guide for Category Management
// This file shows how to implement category dropdown in your product creation form

/**
 * EXAMPLE 1: React Component for Admin Product Creation with Category Dropdown
 */

import React, { useState, useEffect } from 'react';

const AdminProductForm = () => {
  const [categories, setCategories] = useState([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories/dropdown/all');
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.data);
      } else {
        setError('Failed to load categories');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get subcategories of selected main category
  const getSubcategories = () => {
    if (!selectedMainCategory) return [];
    
    const mainCategory = categories.find(cat => cat._id === selectedMainCategory);
    return mainCategory?.subCategories || [];
  };

  const handleMainCategoryChange = (e) => {
    setSelectedMainCategory(e.target.value);
    setSelectedSubCategory(''); // Reset subcategory when main changes
  };

  const handleSubCategoryChange = (e) => {
    setSelectedSubCategory(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedMainCategory) {
      alert('Please select a category');
      return;
    }

    // Get category details for product
    const mainCat = categories.find(cat => cat._id === selectedMainCategory);
    const subCat = getSubcategories().find(cat => cat._id === selectedSubCategory);

    const productData = {
      name: document.getElementById('productName').value,
      description: {
        short: document.getElementById('shortDesc').value,
        long: document.getElementById('longDesc').value
      },
      category: {
        mainCategoryId: mainCat._id,
        mainCategoryName: mainCat.name,
        subCategoryId: subCat?._id || null,
        subCategoryName: subCat?.name || null
      },
      brand: document.getElementById('brand').value,
      pricing: {
        regularPrice: parseFloat(document.getElementById('regularPrice').value),
        salePrice: parseFloat(document.getElementById('salePrice').value)
      },
      // ... add other product fields
    };

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(productData)
      });

      const result = await response.json();
      if (result.success) {
        alert('Product created successfully');
        // Reset form or redirect
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (err) {
      console.error('Error creating product:', err);
      alert('Error creating product');
    }
  };

  if (loading) return <div>Loading categories...</div>;
  if (error) return <div>Error: {error}</div>;

  const subcategories = getSubcategories();

  return (
    <form onSubmit={handleSubmit}>
      <h2>Add New Product</h2>

      {/* Product Name */}
      <div className="form-group">
        <label htmlFor="productName">Product Name:</label>
        <input 
          type="text" 
          id="productName" 
          required 
          placeholder="Enter product name"
        />
      </div>

      {/* Category Dropdown */}
      <div className="form-group">
        <label htmlFor="mainCategory">Category: <span style={{color: 'red'}}>*</span></label>
        <select 
          id="mainCategory" 
          value={selectedMainCategory}
          onChange={handleMainCategoryChange}
          required
        >
          <option value="">-- Select Category --</option>
          {categories.map(category => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Subcategory Dropdown (only shown if main category selected) */}
      {selectedMainCategory && subcategories.length > 0 && (
        <div className="form-group">
          <label htmlFor="subCategory">Sub Category:</label>
          <select 
            id="subCategory" 
            value={selectedSubCategory}
            onChange={handleSubCategoryChange}
          >
            <option value="">-- Select Sub Category (Optional) --</option>
            {subcategories.map(subcat => (
              <option key={subcat._id} value={subcat._id}>
                {subcat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="form-group">
        <label htmlFor="shortDesc">Short Description:</label>
        <input 
          type="text" 
          id="shortDesc" 
          required 
          placeholder="Brief product description"
        />
      </div>

      <div className="form-group">
        <label htmlFor="longDesc">Long Description:</label>
        <textarea 
          id="longDesc" 
          placeholder="Detailed product description"
        />
      </div>

      {/* Brand */}
      <div className="form-group">
        <label htmlFor="brand">Brand:</label>
        <input 
          type="text" 
          id="brand" 
          required 
          placeholder="Brand name"
        />
      </div>

      {/* Pricing */}
      <div className="form-group">
        <label htmlFor="regularPrice">Regular Price:</label>
        <input 
          type="number" 
          id="regularPrice" 
          step="0.01" 
          required 
          placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="salePrice">Sale Price:</label>
        <input 
          type="number" 
          id="salePrice" 
          step="0.01" 
          placeholder="0.00"
        />
      </div>

      <button type="submit" className="btn-submit">Create Product</button>
    </form>
  );
};

export default AdminProductForm;


/**
 * EXAMPLE 2: Vanilla JavaScript Implementation
 */

class CategoryManager {
  constructor() {
    this.categories = [];
    this.apiBaseUrl = '/api/categories';
  }

  // Load categories on page initialization
  async init() {
    await this.loadCategories();
    this.setupEventListeners();
  }

  // Fetch all categories from API
  async loadCategories() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/dropdown/all`);
      const data = await response.json();
      
      if (data.success) {
        this.categories = data.data;
        this.populateMainCategoryDropdown();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  // Populate main category dropdown
  populateMainCategoryDropdown() {
    const select = document.getElementById('mainCategory');
    select.innerHTML = '<option value="">-- Select Category --</option>';
    
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category._id;
      option.textContent = category.name;
      option.dataset.categoryId = category._id;
      option.dataset.categoryName = category.name;
      select.appendChild(option);
    });
  }

  // Populate subcategory dropdown
  populateSubCategoryDropdown() {
    const mainSelect = document.getElementById('mainCategory');
    const subSelect = document.getElementById('subCategory');
    const selectedValue = mainSelect.value;

    subSelect.innerHTML = '<option value="">-- Select Sub Category --</option>';

    if (!selectedValue) {
      subSelect.disabled = true;
      return;
    }

    const mainCategory = this.categories.find(cat => cat._id === selectedValue);
    
    if (mainCategory && mainCategory.subCategories && mainCategory.subCategories.length > 0) {
      subSelect.disabled = false;
      mainCategory.subCategories.forEach(subcat => {
        const option = document.createElement('option');
        option.value = subcat._id;
        option.textContent = subcat.name;
        option.dataset.subcategoryId = subcat._id;
        option.dataset.subcategoryName = subcat.name;
        subSelect.appendChild(option);
      });
    } else {
      subSelect.disabled = true;
    }
  }

  // Setup event listeners
  setupEventListeners() {
    const mainCategorySelect = document.getElementById('mainCategory');
    mainCategorySelect.addEventListener('change', () => this.populateSubCategoryDropdown());
  }

  // Get selected category data
  getSelectedCategories() {
    const mainSelect = document.getElementById('mainCategory');
    const subSelect = document.getElementById('subCategory');

    const mainOption = mainSelect.options[mainSelect.selectedIndex];
    const subOption = subSelect.options[subSelect.selectedIndex];

    return {
      mainCategoryId: mainSelect.value,
      mainCategoryName: mainOption.dataset.categoryName,
      subCategoryId: subSelect.value || null,
      subCategoryName: subOption.dataset.subcategoryName || null
    };
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  const categoryManager = new CategoryManager();
  await categoryManager.init();

  // Make it globally accessible
  window.categoryManager = categoryManager;
});


/**
 * EXAMPLE 3: Admin Category Management Page
 */

class AdminCategoryManager {
  constructor() {
    this.apiBaseUrl = '/api/categories';
    this.token = localStorage.getItem('token');
  }

  // Create new category
  async createCategory(categoryData) {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(categoryData)
      });

      const result = await response.json();
      if (result.success) {
        console.log('Category created:', result.data);
        return result.data;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  // Update category
  async updateCategory(categoryId, updates) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(updates)
      });

      const result = await response.json();
      if (result.success) {
        console.log('Category updated:', result.data);
        return result.data;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  // Delete category
  async deleteCategory(categoryId, force = false) {
    try {
      const url = `${this.apiBaseUrl}/${categoryId}${force ? '?force=true' : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        console.log('Category deleted');
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // Get all categories
  async getAllCategories() {
    try {
      const response = await fetch(`${this.apiBaseUrl}?isActive=all`);
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  // Reorder categories
  async reorderCategories(categoriesWithOrder) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/bulk/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ categories: categoriesWithOrder })
      });

      const result = await response.json();
      if (result.success) {
        console.log('Categories reordered');
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error reordering categories:', error);
      throw error;
    }
  }
}


/**
 * HTML TEMPLATE FOR PRODUCT FORM
 */

/*

<form id="productForm">
  <div class="form-container">
    
    <h1>Add New Product</h1>

    <!-- Product Name -->
    <div class="form-group">
      <label for="productName">Product Name *</label>
      <input 
        type="text" 
        id="productName" 
        name="productName" 
        required 
        placeholder="Enter product name"
      />
    </div>

    <!-- Category -->
    <div class="form-group">
      <label for="mainCategory">Category *</label>
      <select id="mainCategory" name="mainCategory" required>
        <option value="">-- Loading categories... --</option>
      </select>
    </div>

    <!-- Sub Category -->
    <div class="form-group">
      <label for="subCategory">Sub Category</label>
      <select id="subCategory" name="subCategory" disabled>
        <option value="">-- Select a category first --</option>
      </select>
    </div>

    <!-- Brand -->
    <div class="form-group">
      <label for="brand">Brand *</label>
      <input 
        type="text" 
        id="brand" 
        name="brand" 
        required 
        placeholder="Enter brand name"
      />
    </div>

    <!-- Description -->
    <div class="form-group">
      <label for="shortDesc">Short Description *</label>
      <textarea 
        id="shortDesc" 
        name="shortDesc" 
        required 
        placeholder="Brief product description"
        rows="3"
      ></textarea>
    </div>

    <!-- Price -->
    <div class="form-row">
      <div class="form-group">
        <label for="regularPrice">Regular Price *</label>
        <input 
          type="number" 
          id="regularPrice" 
          name="regularPrice" 
          step="0.01" 
          required 
          placeholder="0.00"
        />
      </div>
      <div class="form-group">
        <label for="salePrice">Sale Price</label>
        <input 
          type="number" 
          id="salePrice" 
          name="salePrice" 
          step="0.01" 
          placeholder="0.00"
        />
      </div>
    </div>

    <!-- Submit -->
    <button type="submit" class="btn-primary">Create Product</button>
  </div>
</form>

<style>
.form-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 12px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.btn-primary:hover {
  background-color: #0056b3;
}

select:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}
</style>

*/
