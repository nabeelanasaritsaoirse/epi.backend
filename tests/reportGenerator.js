/**
 * HTML Report Generator
 * Generates beautiful HTML reports for API test results
 */

/**
 * Generate HTML report with test results
 * @param {Array} results - Array of test results
 * @returns {String} HTML report
 */
function generateHTMLReport(results) {
  const total = results.length;
  const success = results.filter(r => r.status === 'SUCCESS').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;

  // Calculate average response time
  const successfulResults = results.filter(r => r.status === 'SUCCESS' && r.responseTime);
  const avgResponseTime = successfulResults.length > 0
    ? (successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length).toFixed(0)
    : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Health Check Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }

    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .header p {
      opacity: 0.95;
      font-size: 16px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }

    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }

    .stat-card h3 {
      font-size: 42px;
      margin-bottom: 8px;
      font-weight: 700;
    }

    .stat-card p {
      color: #6c757d;
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-card.total h3 { color: #667eea; }
    .stat-card.success h3 { color: #10b981; }
    .stat-card.failed h3 { color: #ef4444; }
    .stat-card.skipped h3 { color: #f59e0b; }
    .stat-card.timing h3 { color: #8b5cf6; }

    .filters {
      padding: 20px 30px;
      background: white;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .filters label {
      font-weight: 600;
      color: #495057;
      margin-right: 8px;
    }

    .filter-btn {
      padding: 10px 20px;
      border: 2px solid #e9ecef;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 14px;
      font-weight: 500;
      color: #495057;
    }

    .filter-btn:hover {
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-2px);
    }

    .filter-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    #searchBox {
      flex: 1;
      min-width: 250px;
      padding: 10px 16px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    #searchBox:focus {
      outline: none;
      border-color: #667eea;
    }

    .results {
      padding: 30px;
      max-height: calc(100vh - 400px);
      overflow-y: auto;
    }

    .endpoint {
      background: white;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      margin-bottom: 16px;
      overflow: hidden;
      transition: all 0.3s;
    }

    .endpoint:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      transform: translateX(4px);
    }

    .endpoint-header {
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }

    .endpoint-info {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
    }

    .method {
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      min-width: 80px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .method.GET { background: #dbeafe; color: #1e40af; }
    .method.POST { background: #dcfce7; color: #166534; }
    .method.PUT { background: #fef3c7; color: #92400e; }
    .method.PATCH { background: #e0e7ff; color: #4338ca; }
    .method.DELETE { background: #fee2e2; color: #991b1b; }

    .path {
      font-family: 'Courier New', Courier, monospace;
      font-size: 14px;
      color: #374151;
      font-weight: 500;
      flex: 1;
    }

    .endpoint-meta {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .response-time {
      color: #6b7280;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 12px;
      background: #f3f4f6;
      border-radius: 6px;
    }

    .status-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-badge.SUCCESS {
      background: #dcfce7;
      color: #166534;
    }

    .status-badge.FAILED {
      background: #fee2e2;
      color: #991b1b;
    }

    .status-badge.SKIPPED {
      background: #fef3c7;
      color: #92400e;
    }

    .endpoint-details {
      padding: 0 20px 20px;
      border-top: 1px solid #e9ecef;
      display: none;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .endpoint.expanded .endpoint-details {
      display: block;
    }

    .endpoint.expanded .endpoint-header {
      background: #f8f9fa;
    }

    .detail-section {
      margin-top: 16px;
    }

    .detail-section h4 {
      color: #374151;
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .code-block {
      background: #1f2937;
      color: #f3f4f6;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      overflow-x: auto;
      white-space: pre-wrap;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
    }

    .error-message {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px;
      border-radius: 6px;
      color: #991b1b;
      margin-top: 12px;
      line-height: 1.6;
    }

    .error-message strong {
      display: block;
      margin-bottom: 8px;
      color: #7f1d1d;
    }

    .timestamp {
      color: #9ca3af;
      font-size: 12px;
      margin-top: 12px;
      font-style: italic;
    }

    .no-results {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .no-results h3 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    ::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    @media (max-width: 768px) {
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }

      .endpoint-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .endpoint-meta {
        width: 100%;
        justify-content: space-between;
      }

      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      #searchBox {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 API Health Check Report</h1>
      <p>Last tested: ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats">
      <div class="stat-card total">
        <h3>${total}</h3>
        <p>Total Endpoints</p>
      </div>
      <div class="stat-card success">
        <h3>${success}</h3>
        <p>Passing (${successRate}%)</p>
      </div>
      <div class="stat-card failed">
        <h3>${failed}</h3>
        <p>Failed</p>
      </div>
      <div class="stat-card skipped">
        <h3>${skipped}</h3>
        <p>Skipped</p>
      </div>
      <div class="stat-card timing">
        <h3>${avgResponseTime}ms</h3>
        <p>Avg Response Time</p>
      </div>
    </div>

    <div class="filters">
      <label>Filter:</label>
      <button class="filter-btn active" onclick="filterResults('all')">All (${total})</button>
      <button class="filter-btn" onclick="filterResults('SUCCESS')">✅ Success (${success})</button>
      <button class="filter-btn" onclick="filterResults('FAILED')">❌ Failed (${failed})</button>
      <button class="filter-btn" onclick="filterResults('SKIPPED')">⏭️ Skipped (${skipped})</button>
      <input type="text" id="searchBox" placeholder="🔍 Search endpoints..." oninput="searchEndpoints(this.value)">
    </div>

    <div class="results" id="results">
      ${results.map((result, index) => `
        <div class="endpoint" data-status="${result.status}" data-path="${result.path}" data-method="${result.method}">
          <div class="endpoint-header" onclick="toggleDetails(${index})">
            <div class="endpoint-info">
              <span class="method ${result.method}">${result.method}</span>
              <span class="path">${result.path}</span>
            </div>
            <div class="endpoint-meta">
              ${result.responseTime ? `<span class="response-time">⚡ ${result.responseTime}ms</span>` : ''}
              <span class="status-badge ${result.status}">${result.status}</span>
            </div>
          </div>
          <div class="endpoint-details" id="details-${index}">
            ${result.status === 'SUCCESS' ? `
              <div class="detail-section">
                <h4>✅ Response (Status ${result.statusCode})</h4>
                <div class="code-block">${JSON.stringify(result.response, null, 2)}</div>
              </div>
            ` : ''}

            ${result.status === 'FAILED' ? `
              <div class="detail-section">
                <h4>❌ Error Details</h4>
                <div class="error-message">
                  <strong>Status Code: ${result.statusCode}</strong>
                  <strong>Error Message:</strong> ${result.error.message}
                  ${result.error.code ? `<br><strong>Error Code:</strong> ${result.error.code}` : ''}
                </div>
                ${result.error.response ? `
                  <h4 style="margin-top: 16px;">Response Body:</h4>
                  <div class="code-block">${JSON.stringify(result.error.response, null, 2)}</div>
                ` : ''}
              </div>
            ` : ''}

            ${result.status === 'SKIPPED' ? `
              <div class="detail-section">
                <div class="error-message">
                  <strong>Reason:</strong> ${result.reason}
                </div>
              </div>
            ` : ''}

            <div class="timestamp">Tested at: ${result.timestamp.toLocaleString()}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function toggleDetails(index) {
      const endpoints = document.querySelectorAll('.endpoint');
      endpoints[index].classList.toggle('expanded');
    }

    function filterResults(status) {
      // Update active button
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');

      // Filter endpoints
      const endpoints = document.querySelectorAll('.endpoint');
      let visibleCount = 0;

      endpoints.forEach(endpoint => {
        if (status === 'all' || endpoint.dataset.status === status) {
          endpoint.style.display = 'block';
          visibleCount++;
        } else {
          endpoint.style.display = 'none';
        }
      });

      // Show "no results" message if needed
      showNoResults(visibleCount);
    }

    function searchEndpoints(query) {
      query = query.toLowerCase();
      const endpoints = document.querySelectorAll('.endpoint');
      let visibleCount = 0;

      endpoints.forEach(endpoint => {
        const path = endpoint.dataset.path.toLowerCase();
        const method = endpoint.dataset.method.toLowerCase();

        if (path.includes(query) || method.includes(query)) {
          endpoint.style.display = 'block';
          visibleCount++;
        } else {
          endpoint.style.display = 'none';
        }
      });

      showNoResults(visibleCount);
    }

    function showNoResults(count) {
      const resultsDiv = document.getElementById('results');
      let noResultsDiv = document.getElementById('no-results');

      if (count === 0) {
        if (!noResultsDiv) {
          noResultsDiv = document.createElement('div');
          noResultsDiv.id = 'no-results';
          noResultsDiv.className = 'no-results';
          noResultsDiv.innerHTML = '<h3>No results found</h3><p>Try adjusting your filters or search query</p>';
          resultsDiv.appendChild(noResultsDiv);
        }
      } else {
        if (noResultsDiv) {
          noResultsDiv.remove();
        }
      }
    }

    // Auto-refresh every 5 minutes
    setTimeout(() => {
      location.reload();
    }, 5 * 60 * 1000);
  </script>
</body>
</html>
  `;
}

module.exports = { generateHTMLReport };
