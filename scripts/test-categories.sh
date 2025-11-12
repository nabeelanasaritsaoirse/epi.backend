#!/bin/bash

# Category API Testing Script
# Usage: bash scripts/test-categories.sh

API_BASE_URL="http://localhost:3000/api"
TOKEN="your_admin_token_here"  # Replace with actual admin token

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Category API Testing Script ===${NC}\n"

# Function to print section header
print_header() {
  echo -e "\n${YELLOW}>>> $1${NC}\n"
}

# Test 1: Get categories for dropdown
print_header "Test 1: Get Categories for Dropdown (Public)"
curl -X GET "$API_BASE_URL/categories/dropdown/all" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 2: Get all categories
print_header "Test 2: Get All Main Categories (Public)"
curl -X GET "$API_BASE_URL/categories?parentCategoryId=null&isActive=true" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n"

# Test 3: Create main category (Admin)
print_header "Test 3: Create Main Category (Admin)"
echo "Creating 'Electronics' category..."
MAIN_CAT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "All electronic products and gadgets",
    "displayOrder": 1,
    "image": {
      "url": "https://example.com/electronics.jpg",
      "altText": "Electronics Category"
    },
    "meta": {
      "title": "Electronics Store",
      "description": "Browse our electronics collection",
      "keywords": ["electronics", "gadgets", "devices"]
    }
  }')

echo "$MAIN_CAT_RESPONSE" | jq '.'
MAIN_CAT_ID=$(echo "$MAIN_CAT_RESPONSE" | jq -r '.data._id')
echo -e "${GREEN}Created category ID: $MAIN_CAT_ID${NC}"

# Test 4: Create subcategory
print_header "Test 4: Create Subcategory (Admin)"
if [ ! -z "$MAIN_CAT_ID" ] && [ "$MAIN_CAT_ID" != "null" ]; then
  echo "Creating 'Mobile Phones' subcategory under Electronics..."
  SUB_CAT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"name\": \"Mobile Phones\",
      \"description\": \"All types of mobile phones\",
      \"parentCategoryId\": \"$MAIN_CAT_ID\",
      \"displayOrder\": 1,
      \"image\": {
        \"url\": \"https://example.com/mobile-phones.jpg\",
        \"altText\": \"Mobile Phones\"
      }
    }")
  
  echo "$SUB_CAT_RESPONSE" | jq '.'
  SUB_CAT_ID=$(echo "$SUB_CAT_RESPONSE" | jq -r '.data._id')
  echo -e "${GREEN}Created subcategory ID: $SUB_CAT_ID${NC}"
else
  echo -e "${RED}Failed to get main category ID${NC}"
fi

# Test 5: Get category by ID
print_header "Test 5: Get Category By ID (Public)"
if [ ! -z "$MAIN_CAT_ID" ] && [ "$MAIN_CAT_ID" != "null" ]; then
  curl -X GET "$API_BASE_URL/categories/$MAIN_CAT_ID" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" | jq '.'
fi

# Test 6: Get category with subcategories
print_header "Test 6: Get Category with Subcategories (Public)"
if [ ! -z "$MAIN_CAT_ID" ] && [ "$MAIN_CAT_ID" != "null" ]; then
  curl -X GET "$API_BASE_URL/categories/$MAIN_CAT_ID/with-subcategories" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n" | jq '.'
fi

# Test 7: Search categories
print_header "Test 7: Search Categories (Public)"
curl -X GET "$API_BASE_URL/categories/search/mobile" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" | jq '.'

# Test 8: Update category
print_header "Test 8: Update Category (Admin)"
if [ ! -z "$MAIN_CAT_ID" ] && [ "$MAIN_CAT_ID" != "null" ]; then
  echo "Updating Electronics category..."
  curl -s -X PUT "$API_BASE_URL/categories/$MAIN_CAT_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "name": "Electronics & Gadgets",
      "description": "Updated: All electronic products and gadgets",
      "displayOrder": 2
    }' | jq '.'
fi

# Test 9: Create another subcategory for reorder test
print_header "Test 9: Create More Subcategories for Reorder Test (Admin)"
if [ ! -z "$MAIN_CAT_ID" ] && [ "$MAIN_CAT_ID" != "null" ]; then
  echo "Creating 'Laptops' subcategory..."
  LAPTOP_CAT=$(curl -s -X POST "$API_BASE_URL/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"name\": \"Laptops\",
      \"description\": \"All types of laptops\",
      \"parentCategoryId\": \"$MAIN_CAT_ID\",
      \"displayOrder\": 2
    }")
  
  LAPTOP_CAT_ID=$(echo "$LAPTOP_CAT" | jq -r '.data._id')
  echo -e "${GREEN}Created Laptops category ID: $LAPTOP_CAT_ID${NC}"

  echo "Creating 'Tablets' subcategory..."
  TABLET_CAT=$(curl -s -X POST "$API_BASE_URL/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"name\": \"Tablets\",
      \"description\": \"All types of tablets\",
      \"parentCategoryId\": \"$MAIN_CAT_ID\",
      \"displayOrder\": 3
    }")
  
  TABLET_CAT_ID=$(echo "$TABLET_CAT" | jq -r '.data._id')
  echo -e "${GREEN}Created Tablets category ID: $TABLET_CAT_ID${NC}"
fi

# Test 10: Bulk reorder categories
print_header "Test 10: Bulk Reorder Categories (Admin)"
if [ ! -z "$MAIN_CAT_ID" ] && [ ! -z "$LAPTOP_CAT_ID" ] && [ ! -z "$TABLET_CAT_ID" ]; then
  echo "Reordering categories..."
  curl -s -X PUT "$API_BASE_URL/categories/bulk/reorder" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"categories\": [
        {
          \"id\": \"$SUB_CAT_ID\",
          \"displayOrder\": 3
        },
        {
          \"id\": \"$LAPTOP_CAT_ID\",
          \"displayOrder\": 1
        },
        {
          \"id\": \"$TABLET_CAT_ID\",
          \"displayOrder\": 2
        }
      ]
    }" | jq '.'
fi

# Test 11: Get all categories after updates
print_header "Test 11: Get All Categories After Updates (Public)"
curl -X GET "$API_BASE_URL/categories/dropdown/all" \
  -H "Content-Type: application/json" | jq '.'

# Test 12: Delete subcategory
print_header "Test 12: Delete Subcategory (Admin)"
if [ ! -z "$TABLET_CAT_ID" ]; then
  echo "Deleting Tablets category..."
  curl -s -X DELETE "$API_BASE_URL/categories/$TABLET_CAT_ID" \
    -H "Authorization: Bearer $TOKEN" | jq '.'
fi

# Test 13: Try to delete main category with subcategories (should fail)
print_header "Test 13: Try to Delete Main Category with Subcategories (Should Fail)"
if [ ! -z "$MAIN_CAT_ID" ]; then
  echo "Attempting to delete Electronics category (has subcategories)..."
  curl -s -X DELETE "$API_BASE_URL/categories/$MAIN_CAT_ID" \
    -H "Authorization: Bearer $TOKEN" | jq '.'
fi

# Test 14: Force delete with subcategories
print_header "Test 14: Force Delete Main Category (Admin)"
if [ ! -z "$MAIN_CAT_ID" ]; then
  echo "Force deleting Electronics category with all subcategories..."
  curl -s -X DELETE "$API_BASE_URL/categories/$MAIN_CAT_ID?force=true" \
    -H "Authorization: Bearer $TOKEN" | jq '.'
fi

echo -e "\n${GREEN}=== Testing Complete ===${NC}\n"
