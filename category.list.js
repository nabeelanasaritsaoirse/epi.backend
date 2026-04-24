/* =========================
   INIT
   ========================= */
/* =========================
   PAGINATION STATE
========================= */

const CATEGORY_PAGE_SIZE = 10;

CategoryStore.pagination = {
  page: 1,
  limit: CATEGORY_PAGE_SIZE, // ALWAYS 10
  pages: 1,
  total: 0,
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  const successType = sessionStorage.getItem("categorySuccess");

  if (successType) {
    adminPanel.showNotification(
      successType === "created"
        ? "Category created successfully"
        : "Category updated successfully",
      "success",
    );

    sessionStorage.removeItem("categorySuccess");
  }
  updateStats();
  renderCategories();

  const search = document.getElementById("searchInput");
  const status = document.getElementById("statusFilter");
  const level = document.getElementById("levelFilter");
  const view = document.getElementById("viewMode");

  if (search) search.addEventListener("input", filterCategories);
  if (status) status.addEventListener("change", filterCategories);
  if (level) level.addEventListener("change", filterCategories);
  if (view) view.addEventListener("change", renderCategories);
});

/* =========================
   LOAD CATEGORIES
========================= */

async function loadCategories() {
  try {
    showLoading(true);

    const { page, limit } = CategoryStore.pagination;
    CategoryStore.pagination.limit = CATEGORY_PAGE_SIZE;

    const filters = CategoryStore.filters || {};

    const api = await API.get(
      "/categories/admin/all",
      {},
      {
        page,
        limit,

        isActive:
          filters.status === "active"
            ? true
            : filters.status === "inactive"
              ? false
              : "all",

        ...(filters.level ? { level: Number(filters.level) } : {}),
        ...(filters.search ? { search: filters.search } : {}),
      },
    );

    /* =============================
       CATEGORY DATA
    ============================= */
    CategoryStore.categories = (api.data || []).map((c) => ({
      _id: c._id,
      name: c.name || "",
      slug: c.slug || "",
      description: c.description || "",
      level: Number(c.level || 0),
      parentCategoryId: c.parentCategoryId || null,
      isActive: c.isActive !== false,
      isFeatured: !!c.isFeatured,
      displayOrder: Number(c.displayOrder || 0),

      /* =========================
     MARKETPLACE SAFE EXTENSION
  ========================= */

      commissionRate: c.commissionRate ?? 0,
      isRestricted: !!c.isRestricted,

      attributeSchema: Array.isArray(c.attributeSchema)
        ? c.attributeSchema
        : [],

      /* SEO COMPATIBILITY */
      metaTitle: c.metaTitle || c.meta?.title || "",
      metaDescription: c.metaDescription || c.meta?.description || "",
      keywords: c.keywords || c.meta?.keywords || [],
    }));

    /* =============================
       PAGINATION
    ============================= */
    CategoryStore.pagination.total = api.count || 0;
    CategoryStore.pagination.pages = api.totalPages || 1;
    CategoryStore.pagination.page = api.page || page;

    /* =============================
       STATS
    ============================= */
    CategoryStore.stats = {
      total: api.count || 0,
      active: api.activeCount || 0,
      featured: api.featuredCount || 0,
      roots: api.rootCount || 0,
    };
  } catch (err) {
    console.error("Category load failed:", err);
  } finally {
    showLoading(false);
  }
}

/* =========================
   STATS
   ========================= */

function updateStats() {
  const stats = CategoryStore.stats || {};

  document.getElementById("totalCategoriesCount").textContent =
    stats.total ?? 0;

  document.getElementById("activeCategoriesCount").textContent =
    stats.active ?? "-";

  document.getElementById("featuredCategoriesCount").textContent =
    stats.featured ?? "-";

  document.getElementById("rootCategoriesCount").textContent =
    stats.roots ?? "-";
}

/* =========================
   FILTERS
   ========================= */

// function getFilteredCategories() {
//   let list = [...CategoryStore.categories];

//   const q = searchInput?.value?.toLowerCase() || "";
//   const status = statusFilter?.value || "";
//   const level = levelFilter?.value || "";

//   if (q) {
//     list = list.filter(
//       (c) =>
//         c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
//     );
//   }

//   if (status === "active") list = list.filter((c) => c.isActive);
//   if (status === "inactive") list = list.filter((c) => !c.isActive);

//   if (level !== "") list = list.filter((c) => c.level === Number(level));

//   list.sort((a, b) => a.displayOrder - b.displayOrder);
//   return list;
// }

async function filterCategories() {
  CategoryStore.pagination.page = 1;

  const status = document.getElementById("statusFilter")?.value;
  const level = document.getElementById("levelFilter")?.value;
  const search = document.getElementById("searchInput")?.value;

  CategoryStore.filters = {
    status,
    level,
    search,
  };

  await loadCategories();
  updateStats();
  renderCategories();
}

/* =========================
   RENDER
   ========================= */

function renderCategories() {
  const container = document.getElementById("categoriesContainer");
  if (!container) return;

  const view = document.getElementById("viewMode")?.value || "tree";

  const selectedLevel = document.getElementById("levelFilter")?.value;

  let data = [...CategoryStore.categories];

  if (selectedLevel !== "" && selectedLevel !== null) {
    data = data.filter((c) => c.level === Number(selectedLevel));
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML =
      '<div class="text-center text-muted py-5">No categories found</div>';

    renderCategoryPagination();
    return;
  }

  if (view === "list") {
    renderListView(container, data);
  } else {
    renderTreeView(container, data);
  }

  /* ✅ ALWAYS render pagination */
  renderCategoryPagination();
}

/* =========================
   TREE VIEW
   ========================= */

function renderTreeView(container, data) {
  const ul = document.createElement("ul");
  ul.className = "list-unstyled";

  const selectedLevel = document.getElementById("levelFilter")?.value;
  const searchQuery = document.getElementById("searchInput")?.value?.trim();

  let roots;

  // 🔥 If searching → render flat list
  if (searchQuery || selectedLevel !== "") {
    // Flat render when filtering
    roots = data;
  } else {
    // Normal tree only without filters
    roots = data.filter((c) => !c.parentCategoryId);
  }

  roots.forEach((r) => {
    ul.appendChild(renderTreeNode(r, data));
  });

  container.innerHTML = "";
  container.appendChild(ul);
}

function renderTreeNode(cat, all) {
  const li = document.createElement("li");
  const children = all.filter((c) => c.parentCategoryId === cat._id);

  const row = document.createElement("div");
  row.className = "d-flex justify-content-between align-items-start py-2 px-2";

  const left = document.createElement("div");
  left.className = "d-flex align-items-start";

  if (children.length) {
    const toggle = document.createElement("button");
    toggle.className = "btn btn-sm btn-link me-2";
    toggle.innerHTML = '<i class="bi bi-chevron-down"></i>';
    toggle.onclick = () => {
      const sub = li.querySelector("ul");
      if (!sub) return;
      sub.style.display = sub.style.display === "none" ? "block" : "none";
    };

    left.appendChild(toggle);
  } else {
    left.appendChild(document.createElement("span")).style.width = "1.5rem";
  }

  const info = document.createElement("div");
  info.innerHTML = `
    <strong>${escapeHtml(cat.name)}</strong>
    <div class="small text-muted">${escapeHtml(cat.description)}</div>
    <div class="mt-1">
      <span class="badge bg-secondary">Level ${cat.level}</span>
      ${
        cat.isActive
          ? '<span class="badge bg-success ms-1">Active</span>'
          : '<span class="badge bg-warning ms-1">Inactive</span>'
      }
      ${
        cat.isFeatured ? '<span class="badge bg-info ms-1">Featured</span>' : ""
      }
    </div>
  `;
  left.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "btn-group btn-group-sm";

  actions.innerHTML = `
    <button class="btn btn-outline-primary" onclick="editCategory('${
      cat._id
    }')">
      <i class="bi bi-pencil"></i>
    </button>
    <button class="btn btn-outline-${cat.isFeatured ? "info" : "secondary"}"
      onclick="toggleCategoryFeatured('${cat._id}')">
      <i class="bi bi-star${cat.isFeatured ? "-fill" : ""}"></i>
    </button>
    <button class="btn btn-outline-${cat.isActive ? "warning" : "success"}"
      onclick="toggleCategoryStatus('${cat._id}')">
      <i class="bi bi-${cat.isActive ? "pause" : "play"}-circle"></i>
    </button>
    <button class="btn btn-outline-danger"
  onclick="this.disabled=true; deleteCategory('${cat._id}')">

      <i class="bi bi-trash"></i>
    </button>
  `;

  row.appendChild(left);
  row.appendChild(actions);
  li.appendChild(row);

  if (children.length) {
    const sub = document.createElement("ul");
    sub.className = "list-unstyled ms-4";
    children.forEach((c) => sub.appendChild(renderTreeNode(c, all)));
    li.appendChild(sub);
  }

  return li;
}

/* =========================
   LIST VIEW
   ========================= */

function renderListView(container, data) {
  container.innerHTML = `
    <table class="table table-hover">
      <thead>
        <tr>
          <th>Name</th>
          <th>Level</th>
          <th>Status</th>
          <th>Featured</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (c) => `
          <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${c.level}</td>
            <td>${c.isActive ? "Active" : "Inactive"}</td>
            <td>${c.isFeatured ? "Yes" : "No"}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary"
                onclick="editCategory('${c._id}')">
                <i class="bi bi-pencil"></i>
              </button>
            </td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}
/* =========================
   CATEGORY PAGINATION
========================= */

function renderCategoryPagination() {
  const totalPages = CategoryStore.pagination.pages;
  const currentPage = CategoryStore.pagination.page;

  const container = document.getElementById("categoryPagination");
  if (!container) return;

  container.innerHTML = "";

  if (!totalPages || totalPages <= 1) return;

  const PAGE_WINDOW = 10;

  const windowStart =
    Math.floor((currentPage - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1;

  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages);

  let html = `<ul class="pagination justify-content-center mb-0">`;

  /* ===== FIRST WINDOW ===== */
  html += `
    <li class="page-item ${windowStart === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${windowStart - PAGE_WINDOW}">
        &laquo;
      </a>
    </li>
  `;

  /* ===== PREVIOUS ===== */
  html += `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">
        &lsaquo;
      </a>
    </li>
  `;

  /* ===== PAGE NUMBERS ===== */
  for (let p = windowStart; p <= windowEnd; p++) {
    html += `
      <li class="page-item ${p === currentPage ? "active" : ""}">
        <a class="page-link" href="#" data-page="${p}">
          ${p}
        </a>
      </li>
    `;
  }

  /* ===== NEXT ===== */
  html += `
    <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">
        &rsaquo;
      </a>
    </li>
  `;

  /* ===== LAST WINDOW ===== */
  html += `
    <li class="page-item ${windowEnd === totalPages ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${windowEnd + 1}">
        &raquo;
      </a>
    </li>
  `;

  html += `</ul>`;

  container.innerHTML = html;

  /* ===============================
     PAGINATION CLICK HANDLER
  =============================== */

  container.querySelectorAll("a.page-link").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();

      const target = parseInt(a.dataset.page, 10);

      if (isNaN(target) || target < 1 || target > totalPages) return;

      CategoryStore.pagination.page = target;

      try {
        await loadCategories(); // ✅ fetch next page
        updateStats(); // ✅ keep stats correct
        renderCategories(); // ✅ re-render UI
      } catch (err) {
        console.error("Pagination error:", err);
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  });
}
/* =========================
   ACTIONS
   ========================= */

function editCategory(id) {
  location.href = `category-edit.html?id=${id}`;
}

async function toggleCategoryStatus(id) {
  const cat = CategoryStore.categories.find((c) => c._id === id);
  if (!cat) return;

  try {
    await API.put(
      "/categories/:categoryId",
      { isActive: !cat.isActive },
      { categoryId: id },
    );

    await loadCategories();
    renderCategories();
  } catch (err) {
    console.error(err);
  }
}

async function toggleCategoryFeatured(id) {
  try {
    await API.put(
      "/categories/:categoryId/toggle-featured",
      {},
      { categoryId: id },
    );

    await loadCategories();
    renderCategories();
  } catch (err) {
    console.error(err);
  }
}

let deletingCategoryIds = new Set();

async function deleteCategory(id) {
  if (deletingCategoryIds.has(id)) return; // 🔒 prevent double click
  if (!confirm("Delete this category?")) return;

  deletingCategoryIds.add(id);

  try {
    await API.delete(`/categories/${id}`);
    adminPanel.showNotification("Category deleted successfully", "success");

    await loadCategories();
    updateStats();
    renderCategories();
  } catch (err) {
    const message = err?.response?.message || err?.message;

    if (
      message?.includes("subcategories") &&
      confirm("This category has subcategories. Delete all?")
    ) {
      await API.delete(
        "/categories/:categoryId",
        { categoryId: id },
        { force: true },
      );

      adminPanel.showNotification(
        "Category and subcategories deleted",
        "success",
      );

      await loadCategories();
      updateStats();
      renderCategories();
      return; // ⛔ STOP here
    }

    adminPanel.showNotification(
      message || "Failed to delete category",
      "error",
    );
  }
}
async function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = "";
  document.getElementById("levelFilter").value = "";
  document.getElementById("viewMode").value = "tree";

  CategoryStore.filters = {};
  CategoryStore.pagination.page = 1;

  await loadCategories();
  updateStats();
  renderCategories();
}
/* =========================
   EXPOSE
   ========================= */

window.editCategory = editCategory;
window.filterCategories = filterCategories;
window.toggleCategoryStatus = toggleCategoryStatus;
window.toggleCategoryFeatured = toggleCategoryFeatured;
window.deleteCategory = deleteCategory;
window.resetFilters = resetFilters;
