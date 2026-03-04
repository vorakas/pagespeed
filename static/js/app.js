let sites = [];
let currentChart = null;

// ==================== Toast Notifications ====================
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-dismiss" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// ==================== Empty State Component ====================
function createEmptyState(options) {
    const { icon, title, description, actionText, actionHref } = options;
    let html = '<div class="empty-state">';
    if (icon) {
        html += '<div class="empty-state-icon">' + icon + '</div>';
    }
    if (title) {
        html += '<div class="empty-state-title">' + title + '</div>';
    }
    if (description) {
        html += '<div class="empty-state-description">' + description + '</div>';
    }
    if (actionText && actionHref) {
        html += '<a href="' + actionHref + '" class="empty-state-action">' + actionText + '</a>';
    }
    html += '</div>';
    return html;
}

// SVG icons for empty states (Feather-style, matching nav icons)
const EMPTY_ICONS = {
    gridPlus: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="17.5" y1="14" x2="17.5" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>',
    barChart: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    folderPlus: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    filePlus: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    gitCompare: '<svg viewBox="0 0 24 24"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>',
    key: '<svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    server: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>'
};

// Get selected test strategy from radio buttons (defaults to 'desktop')
function getSelectedStrategy() {
    const selected = document.querySelector('input[name="testStrategy"]:checked');
    return selected ? selected.value : 'desktop';
}

// Get selected strategy for the dashboard page (separate radio group)
function getDashboardStrategy() {
    const selected = document.querySelector('input[name="dashboardStrategy"]:checked');
    return selected ? selected.value : 'desktop';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSites();
    
    // Setup form handlers only if they exist on this page
    const addSiteForm = document.getElementById('addSiteForm');
    if (addSiteForm) {
        addSiteForm.addEventListener('submit', addSite);
    }
    
    const addUrlForm = document.getElementById('addUrlForm');
    if (addUrlForm) {
        addUrlForm.addEventListener('submit', addUrl);
    }
    
    const chartSiteSelect = document.getElementById('chartSiteSelect');
    if (chartSiteSelect) {
        chartSiteSelect.addEventListener('change', updateUrlsForChart);
    }

    // When strategy toggle changes, refresh the dashboard to show results for selected strategy
    const strategyRadios = document.querySelectorAll('input[name="testStrategy"]');
    strategyRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            loadDashboard();
        });
    });

    // Dashboard page: wire strategy toggle (actual load happens after loadSites completes)
    const dashboardStrategyRadios = document.querySelectorAll('input[name="dashboardStrategy"]');
    dashboardStrategyRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            loadWorstPerformers();
        });
    });
});

// Load all sites
async function loadSites() {
    try {
        const response = await fetch('/api/sites');
        sites = await response.json();
        
        updateSiteSelects();
        createSiteTabs();
        loadDashboard();
        loadWorstPerformers();
    } catch (error) {
        console.error('Error loading sites:', error);
    }
}

// Update all site select dropdowns
function updateSiteSelects() {
    const selects = ['urlSiteSelect', 'compareSite1', 'compareSite2', 'chartSiteSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return; // Element doesn't exist on this page
        
        select.innerHTML = '<option value="">Select a site...</option>';
        
        sites.forEach(site => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = site.name;
            select.appendChild(option);
        });
    });
}

// Add a new site
async function addSite(e) {
    e.preventDefault();
    const siteName = document.getElementById('siteName').value;
    
    try {
        const response = await fetch('/api/sites', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: siteName})
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('siteName').value = '';
            loadSites();
            showMessage('Site added successfully!');
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding site:', error);
        showToast('Failed to add site', 'error');
    }
}

// Add a new URL
async function addUrl(e) {
    e.preventDefault();
    const siteId = document.getElementById('urlSiteSelect').value;
    const url = document.getElementById('urlInput').value;
    
    if (!siteId) {
        showToast('Please select a site', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/sites/${siteId}/urls`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url: url})
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('urlInput').value = '';
            showMessage('URL added successfully!');
            loadDashboard();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('Error adding URL:', error);
        showToast('Failed to add URL', 'error');
    }
}

// Create site tabs
function createSiteTabs() {
    const tabsContainer = document.getElementById('siteTabs');
    if (!tabsContainer) return; // Not on a page with tabs
    
    tabsContainer.innerHTML = '';
    
    sites.forEach((site, index) => {
        const tabWrapper = document.createElement('div');
        tabWrapper.className = 'tab-wrapper';
        
        const tab = document.createElement('button');
        tab.className = 'tab' + (index === 0 ? ' active' : '');
        tab.textContent = site.name;
        tab.onclick = () => switchTab(site.id, tab);
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'tab-buttons';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'tab-edit';
        editBtn.innerHTML = '✎';
        editBtn.title = 'Rename site';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            renameSite(site.id, site.name);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tab-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete site';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSite(site.id, site.name);
        };
        
        buttonGroup.appendChild(editBtn);
        buttonGroup.appendChild(deleteBtn);
        tab.appendChild(buttonGroup);
        tabWrapper.appendChild(tab);
        tabsContainer.appendChild(tabWrapper);
    });
}

// Switch between site tabs
function switchTab(siteId, tabElement) {
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');
    
    // Reset sorting state
    currentSortColumn = null;
    currentSortDirection = null;
    unsortedResults = [];
    
    // Load results for this site
    loadSiteResults(siteId);
}

// Load dashboard with latest results
async function loadDashboard() {
    const siteContent = document.getElementById('siteContent');
    if (!siteContent) return; // Not on a page with dashboard
    
    if (sites.length === 0) {
        siteContent.innerHTML = createEmptyState({
            icon: EMPTY_ICONS.gridPlus,
            title: 'No Sites Configured',
            description: 'Add your first site and URLs to start monitoring performance.',
            actionText: 'Go to Setup',
            actionHref: '/setup'
        });
        return;
    }
    
    // Load results for the first site by default
    loadSiteResults(sites[0].id);
}

// ==================== Worst Performing URLs (Dashboard) ====================

// Fetch and display the worst performing URLs per site
async function loadWorstPerformers() {
    const container = document.getElementById('worstPerformers');
    if (!container) return;

    container.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Loading results...</p></div>';

    try {
        const strategy = getDashboardStrategy();
        const response = await fetch(`/api/worst-performing?strategy=${strategy}&limit=5`);
        const results = await response.json();

        if (results.length === 0) {
            container.innerHTML = createEmptyState({
                icon: EMPTY_ICONS.barChart,
                title: 'No Test Results Yet',
                description: 'Run PageSpeed tests on your configured URLs to see the worst performers here.',
                actionText: 'Go to Test URLs',
                actionHref: '/test'
            });
            return;
        }

        // Group results by site_name (preserving order from API)
        const groupedBySite = groupResultsBySite(results);
        renderWorstPerformersBySite(groupedBySite, container);
    } catch (error) {
        console.error('Error loading worst performers:', error);
        container.innerHTML = '<div class="no-data">Failed to load results</div>';
    }
}

// Group a flat result list into an ordered map of site_name → results[]
function groupResultsBySite(results) {
    const grouped = new Map();
    results.forEach(result => {
        const siteName = result.site_name;
        if (!grouped.has(siteName)) {
            grouped.set(siteName, []);
        }
        grouped.get(siteName).push(result);
    });
    return grouped;
}

// Render a separate table for each site
function renderWorstPerformersBySite(groupedBySite, container) {
    let html = '';

    groupedBySite.forEach((siteResults, siteName) => {
        html += `<div class="worst-performers-site-group">`;
        html += `<h3 class="worst-performers-site-name">${siteName}</h3>`;
        html += buildWorstPerformersTable(siteResults);
        html += `</div>`;
    });

    container.innerHTML = html;
}

// Build a single worst-performers table for one site
function buildWorstPerformersTable(results) {
    let html = '<table class="results-table worst-performers-table"><thead><tr>';
    html += '<th class="col-url">URL</th>';
    html += '<th class="col-perf">Performance</th>';
    html += '<th class="col-a11y">Accessibility</th>';
    html += '<th class="col-bp">Best Practices</th>';
    html += '<th class="col-seo">SEO</th>';
    html += '<th class="col-fcp">FCP (ms)</th>';
    html += '<th class="col-lcp">LCP (ms)</th>';
    html += '<th class="col-cls">CLS</th>';
    html += '<th class="col-inp">INP (ms)</th>';
    html += '<th class="col-ttfb">TTFB (ms)</th>';
    html += '<th class="col-size">Page Size</th>';
    html += '<th class="col-tested">Last Tested</th>';
    html += '<th class="col-actions">Actions</th>';
    html += '</tr></thead><tbody>';

    results.forEach(result => {
        html += '<tr>';
        html += `<td class="col-url" title="${result.url}">${result.url}</td>`;
        html += `<td>${formatScore(result.performance_score)}</td>`;
        html += `<td>${formatScore(result.accessibility_score)}</td>`;
        html += `<td>${formatScore(result.best_practices_score)}</td>`;
        html += `<td>${formatScore(result.seo_score)}</td>`;
        html += `<td>${formatFCP(result.fcp)}</td>`;
        html += `<td>${formatLCP(result.lcp)}</td>`;
        html += `<td>${formatCLS(result.cls)}</td>`;
        html += `<td>${formatINP(result.inp)}</td>`;
        html += `<td>${formatTTFB(result.ttfb)}</td>`;
        html += `<td>${formatPageSize(result.total_byte_weight)}</td>`;
        html += `<td>${formatDate(result.tested_at)}</td>`;
        html += `<td class="action-buttons">
                    <button class="btn-details" onclick="showDetails(${result.url_id})" title="View detailed breakdown">📊</button>
                </td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

// Load results for a specific site
async function loadSiteResults(siteId) {
    const contentDiv = document.getElementById('siteContent');
    contentDiv.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Loading results...</p></div>';
    
    // Reset sorting state when loading new site
    currentSortColumn = null;
    currentSortDirection = null;
    unsortedResults = [];
    currentSiteIdForSorting = siteId;
    
    try {
        const strategy = getSelectedStrategy();
        const response = await fetch(`/api/sites/${siteId}/latest-results?strategy=${strategy}`);
        const results = await response.json();
        
        if (results.length === 0) {
            contentDiv.innerHTML = createEmptyState({
                icon: EMPTY_ICONS.barChart,
                title: 'No Test Results Yet',
                description: 'Run your first PageSpeed test to see performance scores here.',
                actionText: 'Go to Test URLs',
                actionHref: '/test'
            });
            currentResults = [];
            return;
        }
        
        // Store results for sorting
        currentResults = results;
        renderTable(results);
        
    } catch (error) {
        console.error('Error loading site results:', error);
        contentDiv.innerHTML = '<div class="no-data">Failed to load results</div>';
    }
}

// Test all sites with real-time progress
async function testAllSites() {
    const progressContainer = document.getElementById('testProgress');
    const progressText = document.getElementById('progressText');
    const progressCount = document.getElementById('progressCount');
    const progressBar = document.getElementById('progressBar');
    const progressDetails = document.getElementById('progressDetails');
    const strategy = getSelectedStrategy();

    // Get all URLs first
    let allUrls = [];
    try {
        const response = await fetch('/api/sites');
        const sitesData = await response.json();
        
        for (const site of sitesData) {
            const urlsResponse = await fetch(`/api/sites/${site.id}/urls`);
            const urls = await urlsResponse.json();
            urls.forEach(url => {
                allUrls.push({
                    id: url.id,
                    url: url.url,
                    siteName: site.name
                });
            });
        }
    } catch (error) {
        console.error('Error fetching URLs:', error);
        showToast('Failed to fetch URLs', 'error');
        return;
    }
    
    if (allUrls.length === 0) {
        showToast('No URLs to test. Please add some URLs first.', 'warning');
        return;
    }
    
    // Show progress container
    progressContainer.classList.add('show');
    const strategyLabel = strategy === 'mobile' ? '📱 Mobile' : '🖥️ Desktop';
    progressText.textContent = `Preparing to test (${strategyLabel})... (Please stay on this page)`;
    progressCount.textContent = `0 / ${allUrls.length}`;
    progressBar.style.width = '0%';
    progressDetails.innerHTML = '';
    
    // Disable buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    
    let completed = 0;
    let successful = 0;
    let failed = 0;
    
    // Test each URL sequentially
    for (let i = 0; i < allUrls.length; i++) {
        const urlData = allUrls[i];
        
        // Update progress
        progressText.textContent = `Testing ${urlData.siteName}...`;
        progressDetails.innerHTML = `<div class="testing-url">🔄 ${urlData.url}</div>`;
        
        try {
            const response = await fetch('/api/test-url', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    url_id: urlData.id,
                    url: urlData.url,
                    strategy: strategy
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                successful++;
                progressDetails.innerHTML = `<div class="tested-url success">✅ ${urlData.url}</div>` + progressDetails.innerHTML;
            } else {
                failed++;
                const errorMsg = result.error || 'Test failed';
                progressDetails.innerHTML = `<div class="tested-url failed">❌ ${urlData.url}<br><span class="error-detail">${errorMsg}</span></div>` + progressDetails.innerHTML;
            }
        } catch (error) {
            failed++;
            const errorMsg = error.message || 'Network error';
            progressDetails.innerHTML = `<div class="tested-url failed">❌ ${urlData.url}<br><span class="error-detail">Error: ${errorMsg}</span></div>` + progressDetails.innerHTML;
        }
        
        completed++;
        const percentage = (completed / allUrls.length) * 100;
        progressBar.style.width = `${percentage}%`;
        progressCount.textContent = `${completed} / ${allUrls.length}`;
        
        // Keep only last 5 results visible
        const allResults = progressDetails.querySelectorAll('.tested-url');
        if (allResults.length > 5) {
            for (let j = 5; j < allResults.length; j++) {
                allResults[j].style.display = 'none';
            }
        }
    }
    
    // Show completion message
    progressText.textContent = 'Tests Complete! ✅';
    progressDetails.innerHTML = `
        <div class="completion-summary">
            <div class="summary-item success">✅ ${successful} Successful</div>
            <div class="summary-item failed">❌ ${failed} Failed</div>
        </div>
    ` + progressDetails.innerHTML;
    
    // Re-enable buttons
    buttons.forEach(btn => btn.disabled = false);
    
    // Automatically refresh dashboard to show new results
    loadDashboard();
    
    // Hide progress container after 5 seconds
    setTimeout(() => {
        progressContainer.classList.remove('show');
    }, 5000);
}


// Load URLs for comparison dropdowns
async function loadUrlsForComparison(siteNumber) {
    const siteId = document.getElementById(`compareSite${siteNumber}`).value;
    const urlSelect = document.getElementById(`compareUrl${siteNumber}`);
    
    urlSelect.innerHTML = '<option value="">Select URL...</option>';
    
    if (!siteId) return;
    
    try {
        const response = await fetch(`/api/sites/${siteId}/urls`);
        const urls = await response.json();
        
        urls.forEach(url => {
            const option = document.createElement('option');
            option.value = url.id;
            option.textContent = url.url;
            urlSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading URLs for comparison:', error);
    }
}

// Load comparison between two URLs
async function loadComparison() {
    const url1Id = document.getElementById('compareUrl1').value;
    const url2Id = document.getElementById('compareUrl2').value;
    const resultsDiv = document.getElementById('comparisonResults');
    
    if (!url1Id || !url2Id) {
        showToast('Please select URLs from both sites to compare', 'warning');
        return;
    }
    
    resultsDiv.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Loading comparison...</p></div>';
    
    try {
        const response = await fetch(`/api/comparison/urls?url1=${url1Id}&url2=${url2Id}`);
        const data = await response.json();
        
        if (!data.url1 || !data.url2) {
            resultsDiv.innerHTML = createEmptyState({
                icon: EMPTY_ICONS.gitCompare,
                title: 'No Comparison Data',
                description: 'No test results available for one or both selected URLs. Run tests first.',
                actionText: 'Go to Test URLs',
                actionHref: '/test'
            });
            return;
        }
        
        let html = '<div class="comparison-grid">';
        
        // URL 1
        html += `<div class="comparison-site">`;
        html += `<h3>${data.url1.site_name}</h3>`;
        html += `<p class="comparison-url">${data.url1.url}</p>`;
        html += formatUrlComparisonResults(data.url1);
        html += '</div>';
        
        // URL 2
        html += `<div class="comparison-site">`;
        html += `<h3>${data.url2.site_name}</h3>`;
        html += `<p class="comparison-url">${data.url2.url}</p>`;
        html += formatUrlComparisonResults(data.url2);
        html += '</div>';
        
        html += '</div>';
        
        // Add difference summary
        html += '<div class="comparison-summary">';
        html += '<h4>Performance Difference</h4>';
        html += formatComparisonDifference(data.url1, data.url2);
        html += '</div>';
        
        resultsDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading comparison:', error);
        resultsDiv.innerHTML = '<div class="no-data">Failed to load comparison</div>';
    }
}

// Format URL comparison results
function formatUrlComparisonResults(result) {
    let html = '<div class="metric-group">';
    html += '<h4>Lighthouse Scores</h4>';
    html += `<div class="metric-row"><span class="metric-label">Performance:</span>${formatScore(result.performance_score)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">Accessibility:</span>${formatScore(result.accessibility_score)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">Best Practices:</span>${formatScore(result.best_practices_score)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">SEO:</span>${formatScore(result.seo_score)}</div>`;
    html += '</div>';
    
    html += '<div class="metric-group">';
    html += '<h4>Core Web Vitals</h4>';
    html += `<div class="metric-row"><span class="metric-label">FCP:</span>${formatFCP(result.fcp)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">LCP:</span>${formatLCP(result.lcp)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">CLS:</span>${formatCLS(result.cls)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">INP:</span>${formatINP(result.inp)}</div>`;
    html += `<div class="metric-row"><span class="metric-label">TTFB:</span>${formatTTFB(result.ttfb)}</div>`;
    html += '</div>';
    
    html += '<div class="metric-group">';
    html += '<h4>Additional Info</h4>';
    html += `<div class="metric-row"><span class="metric-label">Page Size:</span><span>${formatPageSize(result.total_byte_weight)}</span></div>`;
    html += `<div class="metric-row"><span class="metric-label">Last Tested:</span><span>${formatDate(result.tested_at)}</span></div>`;
    html += '</div>';
    
    return html;
}

// Format comparison difference
function formatComparisonDifference(url1, url2) {
    const metrics = [
        { name: 'Performance', key: 'performance_score', format: 'score' },
        { name: 'FCP', key: 'fcp', format: 'ms', lower: true },
        { name: 'LCP', key: 'lcp', format: 'ms', lower: true },
        { name: 'CLS', key: 'cls', format: 'decimal', lower: true },
        { name: 'INP', key: 'inp', format: 'ms', lower: true },
        { name: 'TTFB', key: 'ttfb', format: 'ms', lower: true },
        { name: 'Page Size', key: 'total_byte_weight', format: 'bytes', lower: true }
    ];
    
    let html = '<div class="difference-grid">';
    
    metrics.forEach(metric => {
        const val1 = url1[metric.key];
        const val2 = url2[metric.key];
        
        if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) {
            return;
        }
        
        const diff = val1 - val2;
        const absDiff = Math.abs(diff);
        
        // Determine if difference is better or worse
        const isBetter = metric.lower ? (diff < 0) : (diff > 0);
        const diffClass = isBetter ? 'diff-better' : 'diff-worse';
        const arrow = isBetter ? '↑' : '↓';
        
        let formattedDiff;
        if (metric.format === 'score') {
            formattedDiff = `${absDiff.toFixed(1)} points`;
        } else if (metric.format === 'ms') {
            formattedDiff = `${Math.round(absDiff)}ms`;
        } else if (metric.format === 'decimal') {
            formattedDiff = absDiff.toFixed(3);
        } else if (metric.format === 'bytes') {
            formattedDiff = formatPageSize(absDiff);
        }
        
        html += `<div class="difference-item">`;
        html += `<span class="diff-metric">${metric.name}:</span>`;
        html += `<span class="${diffClass}">${arrow} ${formattedDiff} ${isBetter ? 'better' : 'worse'} on ${url1.site_name}</span>`;
        html += `</div>`;
    });
    
    html += '</div>';
    return html;
}

// Update historical chart
// Update historical chart
async function updateUrlsForChart() {
    const siteId = document.getElementById('chartSiteSelect').value;
    const urlSelect = document.getElementById('chartUrlSelect');
    
    urlSelect.innerHTML = '<option value="">Select a URL...</option>';
    
    if (!siteId) return;
    
    try {
        const response = await fetch(`/api/sites/${siteId}/urls`);
        const urls = await response.json();
        
        urls.forEach(url => {
            const option = document.createElement('option');
            option.value = url.id;
            option.textContent = url.url;
            urlSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading URLs:', error);
    }
}

// Load historical chart
async function loadHistoricalChart() {
    const urlId = document.getElementById('chartUrlSelect').value;
    
    if (!urlId) {
        showToast('Please select a URL', 'warning');
        return;
    }
    
    try {
        const strategy = getSelectedStrategy();
        const response = await fetch(`/api/urls/${urlId}/history?days=30&strategy=${strategy}`);
        const history = await response.json();
        
        if (history.length === 0) {
            showToast('No historical data available for this URL', 'info');
            return;
        }
        
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        if (currentChart) {
            currentChart.destroy();
        }
        
        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(h => new Date(h.tested_at).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Performance',
                        data: history.map(h => h.performance_score),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Accessibility',
                        data: history.map(h => h.accessibility_score),
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Best Practices',
                        data: history.map(h => h.best_practices_score),
                        borderColor: '#ff9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'SEO',
                        data: history.map(h => h.seo_score),
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Performance Scores Over Time'
                    },
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Score'
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading historical data:', error);
        showToast('Failed to load historical data', 'error');
    }
}

// Show detailed breakdown modal
async function showDetails(urlId) {
    try {
        const response = await fetch(`/api/test-details/${urlId}`);
        const data = await response.json();
        
        if (!data || !data.raw_data) {
            showToast('No detailed data available for this URL. Please run a test first.', 'info');
            return;
        }
        
        const rawData = data.raw_data;
        
        // Build modal content
        let modalHTML = `
            <div class="modal-overlay" onclick="closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>📊 Performance Details</h2>
                        <button class="modal-close" onclick="closeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-url">${data.url}</div>
                        <div class="detail-site">Site: ${data.site_name}</div>
                        
                        <div class="detail-section">
                            <h3>Performance Score Breakdown</h3>
                            <div class="score-breakdown">
                                <div class="breakdown-item">
                                    <span class="breakdown-label">Overall Performance:</span>
                                    ${formatScore(data.performance_score)}
                                </div>
                            </div>
                            
                            <h4>Metric Contributions</h4>
                            <div class="metrics-contribution">
                                ${formatMetricWeight('First Contentful Paint', data.fcp, rawData.metric_weights?.fcp)}
                                ${formatMetricWeight('Largest Contentful Paint', data.lcp, rawData.metric_weights?.lcp)}
                                ${formatMetricWeight('Cumulative Layout Shift', data.cls, rawData.metric_weights?.cls, true)}
                                ${formatMetricWeight('Total Blocking Time', data.tbt, rawData.metric_weights?.tbt)}
                                ${formatMetricWeight('Speed Index', data.speed_index, rawData.metric_weights?.si)}
                            </div>
                        </div>
                        
                        ${rawData.opportunities && rawData.opportunities.length > 0 ? `
                        <div class="detail-section">
                            <h3>🚀 Optimization Opportunities</h3>
                            <p class="section-desc">Potential improvements to boost performance</p>
                            <div class="opportunities-list">
                                ${rawData.opportunities.map(opp => `
                                    <div class="opportunity-item">
                                        <div class="opp-title">${opp.title}</div>
                                        <div class="opp-savings">💡 Potential savings: ${formatSavings(opp.savingsMs)}</div>
                                        ${opp.displayValue ? `<div class="opp-detail">${opp.displayValue}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${rawData.failed_audits && rawData.failed_audits.length > 0 ? `
                        <div class="detail-section">
                            <h3>⚠️ Failed Audits</h3>
                            <p class="section-desc">Areas that need improvement</p>
                            <div class="failed-audits-list">
                                ${rawData.failed_audits.map(audit => `
                                    <div class="audit-item">
                                        <div class="audit-title">${audit.title}</div>
                                        ${audit.displayValue ? `<div class="audit-detail">${audit.displayValue}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="detail-section">
                            <h3>📈 All Metrics</h3>
                            <div class="all-metrics">
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="First Contentful Paint - When first content appears. Good: < 1.8s">FCP:</strong> ${formatMetric(data.fcp)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Largest Contentful Paint - When largest content is visible. Good: < 2.5s">LCP:</strong> ${formatMetric(data.lcp)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Cumulative Layout Shift - Visual stability. Good: < 0.1">CLS:</strong> ${data.cls?.toFixed(3) || 'N/A'}</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Total Blocking Time - Time blocked from user input. Good: < 200ms">TBT:</strong> ${formatMetric(data.tbt)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Speed Index - How quickly content displays. Good: < 3.4s">Speed Index:</strong> ${formatMetric(data.speed_index)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Time to Interactive - When page becomes fully interactive. Good: < 3.8s">TTI:</strong> ${formatMetric(data.tti)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Interaction to Next Paint - Responsiveness to interactions. Good: < 200ms">INP:</strong> ${formatMetric(data.inp)}ms</div>
                                <div class="metric-item"><strong class="tooltip-trigger" data-tooltip="Time to First Byte - Server response time. Good: < 800ms">TTFB:</strong> ${formatMetric(data.ttfb)}ms</div>
                                <div class="metric-item"><strong>Page Size:</strong> ${formatPageSize(data.total_byte_weight)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        console.error('Error loading details:', error);
        showToast('Failed to load detailed data', 'error');
    }
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

function formatMetricWeight(label, value, weight, isDecimal = false) {
    if (value === null || value === undefined) return '';
    
    const formattedValue = isDecimal ? value.toFixed(3) : `${Math.round(value)}ms`;
    // Handle both formats: if weight > 1, it's already a percentage, otherwise multiply by 100
    const weightPercent = weight ? (weight > 1 ? Math.round(weight) : Math.round(weight * 100)) : 0;
    
    // Get tooltip info for the metric
    const tooltipInfo = getMetricTooltip(label);
    
    return `
        <div class="metric-weight-item">
            <div class="metric-weight-header">
                <span class="metric-weight-label tooltip-trigger" data-tooltip="${tooltipInfo}">${label}:</span>
                <span class="metric-weight-value">${formattedValue}</span>
            </div>
            <div class="metric-weight-percent">${weightPercent}% of score</div>
        </div>
    `;
}

// Get tooltip information for metrics
function getMetricTooltip(label) {
    const tooltips = {
        'First Contentful Paint': 'FCP - Measures when the first content (text, image) appears on screen. Good: < 1.8s',
        'Largest Contentful Paint': 'LCP - Measures when the largest content element becomes visible. Good: < 2.5s',
        'Cumulative Layout Shift': 'CLS - Measures visual stability. How much content shifts unexpectedly. Good: < 0.1',
        'Total Blocking Time': 'TBT - Measures how long the page is blocked from responding to user input. Good: < 200ms',
        'Speed Index': 'SI - Measures how quickly content is visually displayed during page load. Good: < 3.4s',
        'Time to Interactive': 'TTI - Measures when the page becomes fully interactive. Good: < 3.8s',
        'Interaction to Next Paint': 'INP - Measures responsiveness to user interactions. Good: < 200ms',
        'Time to First Byte': 'TTFB - Measures server response time. Good: < 800ms'
    };
    
    return tooltips[label] || label;
}

function formatSavings(ms) {
    if (!ms) return 'N/A';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
}

// Table sorting state
let currentSortColumn = null;
let currentSortDirection = null; // null = no sort, 'asc' = ascending, 'desc' = descending
let currentResults = []; // Store current results
let unsortedResults = []; // Store original order
let currentSiteIdForSorting = null;

// Sort table by column
function sortTable(column) {
    if (!currentResults.length) return;
    
    // Store unsorted copy on first sort
    if (!unsortedResults.length) {
        unsortedResults = JSON.parse(JSON.stringify(currentResults));
    }
    
    // Three-state sorting: unsorted -> asc -> desc -> unsorted
    if (currentSortColumn === column) {
        if (currentSortDirection === null) {
            currentSortDirection = 'asc';
        } else if (currentSortDirection === 'asc') {
            currentSortDirection = 'desc';
        } else {
            // Reset to unsorted
            currentSortDirection = null;
            currentSortColumn = null;
            currentResults = JSON.parse(JSON.stringify(unsortedResults));
            renderTable(currentResults);
            updateSortIndicators();
            return;
        }
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Sort the results
    currentResults.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        // Handle null/undefined values
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        // Handle different data types
        if (column === 'url') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        } else if (column === 'tested_at') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        }
        
        if (currentSortDirection === 'asc') {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
        } else {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
    });
    
    renderTable(currentResults);
    updateSortIndicators();
}

// Render the table with given results
function renderTable(results) {
    const contentDiv = document.getElementById('siteContent');
    
    let html = '<table class="results-table"><thead><tr>';
    html += '<th class="sortable col-url" onclick="sortTable(\'url\')">URL <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'performance_score\')">Performance <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'accessibility_score\')">Accessibility <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'best_practices_score\')">Best Practices <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'seo_score\')">SEO <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'fcp\')">FCP (ms) <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'lcp\')">LCP (ms) <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'cls\')">CLS <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'inp\')">INP (ms) <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'ttfb\')">TTFB (ms) <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'total_byte_weight\')">Page Size <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" onclick="sortTable(\'tested_at\')">Last Tested <span class="sort-indicator"></span></th>';
    html += '<th>Actions</th>';
    html += '</tr></thead><tbody>';

    results.forEach(result => {
        html += '<tr>';
        html += `<td class="col-url">${result.url}</td>`;
        html += `<td>${formatScore(result.performance_score)}</td>`;
        html += `<td>${formatScore(result.accessibility_score)}</td>`;
        html += `<td>${formatScore(result.best_practices_score)}</td>`;
        html += `<td>${formatScore(result.seo_score)}</td>`;
        html += `<td>${formatFCP(result.fcp)}</td>`;
        html += `<td>${formatLCP(result.lcp)}</td>`;
        html += `<td>${formatCLS(result.cls)}</td>`;
        html += `<td>${formatINP(result.inp)}</td>`;
        html += `<td>${formatTTFB(result.ttfb)}</td>`;
        html += `<td>${formatPageSize(result.total_byte_weight)}</td>`;
        html += `<td>${formatDate(result.tested_at)}</td>`;
        html += `<td class="action-buttons">
                    <button class="btn-details" onclick="showDetails(${result.url_id})" title="View detailed breakdown">📊</button>
                    <button class="btn-retest" onclick="retestUrl(${result.url_id}, '${result.url}')" title="Retest this URL">🔄</button>
                    <button class="btn-delete" onclick="deleteUrl(${result.url_id}, '${result.url}')" title="Delete this URL">🗑️</button>
                </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    contentDiv.innerHTML = html;
    
    updateSortIndicators();
}

// Update sort indicators in table headers
function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
        indicator.textContent = '';
        indicator.className = 'sort-indicator';
    });
    
    if (currentSortColumn && currentSortDirection) {
        const headers = document.querySelectorAll('.sortable');
        headers.forEach(header => {
            if (header.onclick && header.onclick.toString().includes(`'${currentSortColumn}'`)) {
                const indicator = header.querySelector('.sort-indicator');
                if (currentSortDirection === 'asc') {
                    indicator.textContent = '▲';
                    indicator.className = 'sort-indicator sort-asc';
                } else {
                    indicator.textContent = '▼';
                    indicator.className = 'sort-indicator sort-desc';
                }
            }
        });
    }
}

// Retest a single URL
async function retestUrl(urlId, urlText) {
    const progressContainer = document.getElementById('testProgress');
    const progressText = document.getElementById('progressText');
    const progressCount = document.getElementById('progressCount');
    const progressBar = document.getElementById('progressBar');
    const progressDetails = document.getElementById('progressDetails');
    const strategy = getSelectedStrategy();

    // Show progress container
    progressContainer.classList.add('show');
    const strategyLabel = strategy === 'mobile' ? '📱 Mobile' : '🖥️ Desktop';
    progressText.textContent = `Retesting URL (${strategyLabel})...`;
    progressCount.textContent = '0 / 1';
    progressBar.style.width = '0%';
    progressDetails.innerHTML = `<div class="testing-url">🔄 ${urlText}</div>`;

    try {
        const response = await fetch('/api/test-url', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                url_id: urlId,
                url: urlText,
                strategy: strategy
            })
        });
        
        const result = await response.json();
        
        progressBar.style.width = '100%';
        progressCount.textContent = '1 / 1';
        
        if (result.success) {
            progressText.textContent = 'Test Complete!';
            progressDetails.innerHTML = `<div class="tested-url success">✅ ${urlText}</div>`;
        } else {
            progressText.textContent = 'Test Failed';
            const errorMsg = result.error || 'Test failed';
            progressDetails.innerHTML = `<div class="tested-url failed">❌ ${urlText}<br><span class="error-detail">${errorMsg}</span></div>`;
        }
        
        // Refresh dashboard after delay
        setTimeout(() => {
            loadDashboard();
            progressContainer.classList.remove('show');
        }, 2000);
        
    } catch (error) {
        progressText.textContent = 'Error';
        const errorMsg = error.message || 'Network error';
        progressDetails.innerHTML = `<div class="tested-url failed">❌ ${urlText}<br><span class="error-detail">Error: ${errorMsg}</span></div>`;
        
        setTimeout(() => {
            progressContainer.classList.remove('show');
        }, 3000);
    }
}

// Rename a site
async function renameSite(siteId, currentName) {
    const newName = prompt(`Rename site "${currentName}" to:`, currentName);
    
    if (!newName || newName === currentName) {
        return;
    }
    
    if (newName.trim() === '') {
        showToast('Site name cannot be empty', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/sites/${siteId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName.trim()})
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Site renamed successfully!');
            loadSites();
        } else {
            showToast('Failed to rename site: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error renaming site:', error);
        showToast('Failed to rename site', 'error');
    }
}

// Delete a URL
async function deleteUrl(urlId, urlText) {
    if (!confirm(`Are you sure you want to delete "${urlText}"?\n\nThis will also delete all test results for this URL. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/urls/${urlId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('URL deleted successfully!');
            loadDashboard();
        } else {
            showToast('Failed to delete URL: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting URL:', error);
        showToast('Failed to delete URL', 'error');
    }
}

// Delete a site
async function deleteSite(siteId, siteName) {
    if (!confirm(`Are you sure you want to delete the entire site "${siteName}"?\n\nThis will delete all URLs and test results for this site. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sites/${siteId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Site deleted successfully!');
            loadSites();
        } else {
            showToast('Failed to delete site: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting site:', error);
        showToast('Failed to delete site', 'error');
    }
}

// Utility functions
function formatScore(score) {
    if (score === null || score === undefined) return '<span class="score">N/A</span>';
    
    const rounded = Math.round(score);
    let className = 'score-poor';
    
    if (rounded >= 90) className = 'score-good';
    else if (rounded >= 50) className = 'score-average';
    
    return `<span class="score ${className}">${rounded}</span>`;
}

function formatMetric(value) {
    if (value === null || value === undefined) return 'N/A';
    return Math.round(value);
}

function formatFCP(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    const rounded = Math.round(value);
    let className = 'vitals-poor';
    
    if (rounded <= 1800) className = 'vitals-good';
    else if (rounded <= 3000) className = 'vitals-needs-improvement';
    
    return `<span class="${className}">${rounded}ms</span>`;
}

function formatLCP(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    const rounded = Math.round(value);
    let className = 'vitals-poor';
    
    if (rounded <= 2500) className = 'vitals-good';
    else if (rounded <= 4000) className = 'vitals-needs-improvement';
    
    return `<span class="${className}">${rounded}ms</span>`;
}

function formatCLS(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    const formatted = value.toFixed(3);
    let className = 'vitals-poor';
    
    if (value <= 0.1) className = 'vitals-good';
    else if (value <= 0.25) className = 'vitals-needs-improvement';
    
    return `<span class="${className}">${formatted}</span>`;
}

function formatINP(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    const rounded = Math.round(value);
    let className = 'vitals-poor';
    
    if (rounded <= 200) className = 'vitals-good';
    else if (rounded <= 500) className = 'vitals-needs-improvement';
    
    return `<span class="${className}">${rounded}ms</span>`;
}

function formatTTFB(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    const rounded = Math.round(value);
    let className = 'vitals-poor';
    
    if (rounded <= 800) className = 'vitals-good';
    else if (rounded <= 1800) className = 'vitals-needs-improvement';
    
    return `<span class="${className}">${rounded}ms</span>`;
}

function formatPageSize(value) {
    if (value === null || value === undefined) return '<span>N/A</span>';
    
    // Convert bytes to appropriate unit
    if (value < 1024) {
        return `${Math.round(value)} B`;
    } else if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    } else {
        return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function average(arr) {
    const filtered = arr.filter(n => n !== null && n !== undefined);
    if (filtered.length === 0) return null;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function showMessage(message) {
    showToast(message, 'success');
}


// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const themeLabel = themeToggle.querySelector('.theme-label');
    
    
    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        themeIcon.textContent = '☀️';
        themeLabel.textContent = "Light Mode";
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-mode');
        themeIcon.textContent = '🌙';
        themeLabel.textContent = "Dark Mode";
        localStorage.setItem('theme', 'light');
    }
}

// Load saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.querySelector('.theme-icon').textContent = '🌙';
            themeToggle.querySelector('.theme-label').textContent = 'Dark Mode';
        }
    }
}

// Load theme and initialize
loadTheme();
window.onload = loadDashboard;

// Load sites and URLs for the setup page
async function loadSitesAndUrls() {
    const container = document.getElementById('sitesUrlsList');
    if (!container) return; // Not on setup page
    
    try {
        container.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div><p>Loading sites...</p></div>';

        const response = await fetch('/api/sites');
        const sites = await response.json();

        if (sites.length === 0) {
            container.innerHTML = createEmptyState({
                icon: EMPTY_ICONS.folderPlus,
                title: 'No Sites Created Yet',
                description: 'Use the form above to add your first site and start tracking URLs.'
            });
            return;
        }
        
        container.innerHTML = '';
        
        for (const site of sites) {
            // Fetch URLs for this site
            const urlsResponse = await fetch(`/api/sites/${site.id}/urls`);
            const urls = await urlsResponse.json();
            
            const siteCard = document.createElement('div');
            siteCard.className = 'site-urls-card';

            let urlsHtml = '';
            if (urls.length === 0) {
                urlsHtml = '<div class="no-urls">' + createEmptyState({
                    icon: EMPTY_ICONS.filePlus,
                    title: 'No URLs Added',
                    description: 'Add URLs to this site to start monitoring.'
                }) + '</div>';
            } else {
                urlsHtml = '<ul class="url-list">';
                urls.forEach(url => {
                    urlsHtml += `
                        <li class="url-item">
                            <span class="url-text">${url.url}</span>
                            <div class="url-actions">
                                <button class="btn-delete" onclick="deleteUrl(${url.id}, ${site.id})" title="Delete URL">×</button>
                            </div>
                        </li>
                    `;
                });
                urlsHtml += '</ul>';
            }

            const urlCount = urls.length;
            siteCard.innerHTML = `
                <h3 onclick="toggleSiteDrawer(this)">
                    <span class="drawer-toggle">
                        <span class="drawer-chevron"></span>
                        ${site.name}
                        <span class="drawer-url-count">(${urlCount} URL${urlCount !== 1 ? 's' : ''})</span>
                    </span>
                    <button class="btn-delete" onclick="event.stopPropagation(); deleteSiteFromList(${site.id})" title="Delete Site">×</button>
                </h3>
                <div class="url-drawer">
                    ${urlsHtml}
                </div>
            `;

            container.appendChild(siteCard);
        }
    } catch (error) {
        console.error('Error loading sites and URLs:', error);
        container.innerHTML = '<p style="color: #f87171; text-align: center; padding: 30px;">Error loading sites and URLs</p>';
    }
}

// Toggle site URL drawer open/closed
function toggleSiteDrawer(headerEl) {
    const card = headerEl.closest('.site-urls-card');
    if (card) card.classList.toggle('open');
}

// Delete a URL from the list
async function deleteUrl(urlId, siteId) {
    if (!confirm('Are you sure you want to delete this URL? All test results will be lost.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/urls/${urlId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadSitesAndUrls(); // Reload the list
            loadSites(); // Also reload sites for the dropdowns
        } else {
            showToast('Error deleting URL: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting URL:', error);
        showToast('Error deleting URL', 'error');
    }
}

// Delete a site from the list
async function deleteSiteFromList(siteId) {
    if (!confirm('Are you sure you want to delete this site? All URLs and test results will be lost.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sites/${siteId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadSitesAndUrls(); // Reload the list
            loadSites(); // Also reload sites for the dropdowns
        } else {
            showToast('Error deleting site: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting site:', error);
        showToast('Error deleting site', 'error');
    }
}

// Load sites and URLs when on setup page
if (document.getElementById('sitesUrlsList')) {
    document.addEventListener('DOMContentLoaded', function() {
        loadSites();
        loadSitesAndUrls();

        // Setup form handlers
        document.getElementById('addSiteForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            await addSite(e);
            loadSitesAndUrls(); // Refresh the list after adding a site
            populateTriggerUrlCheckboxes(); // Refresh trigger URL checkboxes
        });

        document.getElementById('addUrlForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            await addUrl(e);
            loadSitesAndUrls(); // Refresh the list after adding a URL
            populateTriggerUrlCheckboxes(); // Refresh trigger URL checkboxes
        });

        // Initialize trigger section if present
        if (document.getElementById('triggersList')) {
            loadTriggerPresets();
            populateTriggerUrlCheckboxes();
            loadTriggers();

            const triggerForm = document.getElementById('triggerForm');
            if (triggerForm) {
                triggerForm.addEventListener('submit', saveTrigger);
            }
        }
    });
}

// ==================== Scheduled Test Triggers ====================

// Load schedule presets into the dropdown (built-in + user-created)
async function loadTriggerPresets() {
    const presetSelect = document.getElementById('triggerPreset');
    if (!presetSelect) return;

    try {
        const response = await fetch('/api/triggers/presets');
        const presets = await response.json();
        presetSelect.innerHTML = '';

        const builtinPresets = presets.filter(p => p.is_builtin);
        const customPresets = presets.filter(p => !p.is_builtin);

        builtinPresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.value;
            option.textContent = preset.label;
            option.dataset.isBuiltin = 'true';
            option.dataset.presetId = '';
            presetSelect.appendChild(option);
        });

        if (customPresets.length > 0) {
            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '── Custom Presets ──';
            presetSelect.appendChild(separator);

            customPresets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.value;
                option.textContent = preset.label;
                option.dataset.isBuiltin = 'false';
                option.dataset.presetId = preset.id;
                presetSelect.appendChild(option);
            });
        }

        // Update delete button visibility for the current selection
        onPresetChange();
    } catch (error) {
        console.error('Error loading trigger presets:', error);
    }
}

// Show/hide delete button based on selected preset type
function onPresetChange() {
    const presetSelect = document.getElementById('triggerPreset');
    const deleteBtn = document.getElementById('deletePresetBtn');
    if (!presetSelect || !deleteBtn) return;

    const selectedOption = presetSelect.options[presetSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset.isBuiltin === 'false') {
        deleteBtn.style.display = '';
    } else {
        deleteBtn.style.display = 'none';
    }
}

// Show the save preset dialog (from custom cron mode — pre-fills cron)
function showSavePresetDialog() {
    const cronInput = document.getElementById('triggerCron');
    if (!cronInput || !cronInput.value.trim()) {
        showToast('Enter a cron expression first', 'warning');
        return;
    }

    const dialog = document.getElementById('savePresetDialog');
    if (dialog) {
        dialog.style.display = '';
        const cronField = document.getElementById('savePresetCron');
        cronField.value = cronInput.value.trim();
        cronField.style.display = 'none'; // Hide cron input — already filled from the form
        document.getElementById('savePresetName').value = '';
        document.getElementById('savePresetName').focus();
    }
}

// Show the save preset dialog (from preset mode — needs cron input)
function showSavePresetFromPresetMode() {
    const dialog = document.getElementById('savePresetDialog');
    if (dialog) {
        dialog.style.display = '';
        const cronField = document.getElementById('savePresetCron');
        cronField.value = '';
        cronField.style.display = ''; // Show cron input — user needs to enter it
        document.getElementById('savePresetName').value = '';
        cronField.focus();
    }
}

// Hide the save preset dialog
function hideSavePresetDialog() {
    const dialog = document.getElementById('savePresetDialog');
    if (dialog) {
        dialog.style.display = 'none';
        document.getElementById('savePresetName').value = '';
        document.getElementById('savePresetCron').value = '';
    }
}

// Save current cron expression as a named preset
async function savePreset() {
    const nameInput = document.getElementById('savePresetName');
    const cronField = document.getElementById('savePresetCron');
    const name = nameInput.value.trim();
    const cronExpression = cronField.value.trim();

    if (!cronExpression) {
        showToast('Please enter a cron expression', 'warning');
        cronField.focus();
        return;
    }
    if (!name) {
        showToast('Please enter a preset name', 'warning');
        nameInput.focus();
        return;
    }

    try {
        const response = await fetch('/api/triggers/presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cron_expression: cronExpression })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast(`Preset "${name}" saved`, 'success');
            hideSavePresetDialog();
            await loadTriggerPresets();
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving preset:', error);
        showToast('Error saving preset', 'error');
    }
}

// Delete the currently selected custom preset
async function deleteSelectedPreset() {
    const presetSelect = document.getElementById('triggerPreset');
    if (!presetSelect) return;

    const selectedOption = presetSelect.options[presetSelect.selectedIndex];
    if (!selectedOption || selectedOption.dataset.isBuiltin !== 'false') {
        showToast('Only custom presets can be deleted', 'warning');
        return;
    }

    const presetId = selectedOption.dataset.presetId;
    const presetName = selectedOption.textContent;

    if (!confirm(`Delete preset "${presetName}"? Existing triggers using this schedule will not be affected.`)) return;

    try {
        const response = await fetch(`/api/triggers/presets/${presetId}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok && result.success) {
            showToast(`Preset "${presetName}" deleted`, 'success');
            await loadTriggerPresets();
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting preset:', error);
        showToast('Error deleting preset', 'error');
    }
}

// Live cron expression preview — translates to human-readable text
function updateCronPreview() {
    const cronInput = document.getElementById('savePresetCron');
    const preview = document.getElementById('cronPreview');
    if (!cronInput || !preview) return;

    const expression = cronInput.value.trim();
    if (!expression) {
        preview.textContent = '';
        preview.className = 'cron-preview';
        return;
    }

    const description = describeCronExpression(expression);
    if (description) {
        const pstNote = describeCronPST(expression);
        preview.innerHTML = '→ ' + description + ' (UTC)' + (pstNote ? `<span class="cron-pst-note">${pstNote}</span>` : '');
        preview.className = 'cron-preview cron-preview-valid';
    } else {
        preview.textContent = '⚠ Invalid — must be 5 fields: minute hour day month weekday';
        preview.className = 'cron-preview cron-preview-invalid';
    }
}

// Convert UTC hours in a cron expression to PST/PDT equivalent text
function describeCronPST(expression) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return null;
    const [minute, hour] = fields;

    // Only show PST conversion for specific hour values (not */N or *)
    if (hour === '*' || hour.startsWith('*/')) return null;

    // Determine current Pacific offset: -8 (PST) or -7 (PDT)
    const now = new Date();
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdOffset;
    const offset = isDST ? 7 : 8;
    const label = isDST ? 'PDT' : 'PST';

    const hours = hour.split(',');
    const min = minute === '0' || minute === '00' ? '00' : minute;
    const pstTimes = hours.map(h => {
        const hNum = parseInt(h);
        if (isNaN(hNum)) return null;
        let pstH = hNum - offset;
        let dayShift = '';
        if (pstH < 0) { pstH += 24; dayShift = ' (prev day)'; }
        const period = pstH >= 12 ? 'PM' : 'AM';
        const h12 = pstH === 0 ? 12 : pstH > 12 ? pstH - 12 : pstH;
        return `${h12}:${min.padStart(2, '0')} ${period}${dayShift}`;
    }).filter(Boolean);

    if (pstTimes.length === 0) return null;
    return ` — ${pstTimes.join(' and ')} ${label}`;
}

// Translate a 5-field cron expression to a human-readable description
function describeCronExpression(expression) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

    const dayNames = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
        '4': 'Thursday', '5': 'Friday', '6': 'Saturday', '7': 'Sunday',
        'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
        'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday' };

    const monthNames = { '1': 'January', '2': 'February', '3': 'March', '4': 'April',
        '5': 'May', '6': 'June', '7': 'July', '8': 'August',
        '9': 'September', '10': 'October', '11': 'November', '12': 'December' };

    let parts = [];

    // Describe frequency / time
    if (minute.startsWith('*/') && hour === '*') {
        parts.push(`Every ${minute.slice(2)} minutes`);
    } else if (hour.startsWith('*/') && minute !== '*') {
        parts.push(`Every ${hour.slice(2)} hours at :${minute.padStart(2, '0')}`);
    } else if (hour.startsWith('*/')) {
        parts.push(`Every ${hour.slice(2)} hours`);
    } else {
        // Specific time(s)
        const hours = hour.includes(',') ? hour.split(',') : [hour];
        const timeStrings = hours.map(h => {
            if (h === '*') return null;
            const hNum = parseInt(h);
            if (isNaN(hNum)) return h;
            const period = hNum >= 12 ? 'PM' : 'AM';
            const h12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;
            const min = minute === '0' || minute === '00' ? '00' : minute;
            return `${h12}:${min.padStart(2, '0')} ${period}`;
        }).filter(Boolean);

        if (timeStrings.length > 0) {
            parts.push(`At ${timeStrings.join(' and ')}`);
        } else if (minute !== '*') {
            parts.push(`At minute ${minute} of every hour`);
        }
    }

    // Day of week
    if (dayOfWeek !== '*') {
        if (dayOfWeek === '1-5' || dayOfWeek.toLowerCase() === 'mon-fri') {
            parts.push('on weekdays');
        } else if (dayOfWeek === '0,6' || dayOfWeek.toLowerCase() === 'sat,sun') {
            parts.push('on weekends');
        } else {
            const days = dayOfWeek.split(',').map(d => dayNames[d.toLowerCase()] || d);
            parts.push(`on ${days.join(', ')}`);
        }
    }

    // Day of month
    if (dayOfMonth !== '*') {
        if (dayOfMonth.startsWith('*/')) {
            parts.push(`every ${dayOfMonth.slice(2)} days`);
        } else {
            const suffix = (n) => {
                const s = ['th','st','nd','rd'];
                const v = n % 100;
                return n + (s[(v-20)%10] || s[v] || s[0]);
            };
            const days = dayOfMonth.split(',').map(d => suffix(parseInt(d)));
            parts.push(`on the ${days.join(', ')}`);
        }
    }

    // Month
    if (month !== '*') {
        if (month.startsWith('*/')) {
            parts.push(`every ${month.slice(2)} months`);
        } else {
            const months = month.split(',').map(m => monthNames[m] || m);
            parts.push(`in ${months.join(', ')}`);
        }
    }

    // If we have nothing useful, provide a generic description
    if (parts.length === 0) {
        parts.push('Every minute');
    }

    // Add "Daily" prefix if no day/week constraints
    if (dayOfWeek === '*' && dayOfMonth === '*' && month === '*' &&
        !parts[0].startsWith('Every')) {
        parts.unshift('Daily');
    }

    return parts.join(' ').replace(/^Daily At/, 'Daily at');
}

// Populate URL checkboxes grouped by site
async function populateTriggerUrlCheckboxes() {
    const container = document.getElementById('triggerUrlCheckboxes');
    if (!container) return;

    try {
        const response = await fetch('/api/sites');
        const allSites = await response.json();

        if (allSites.length === 0) {
            container.innerHTML = '<p class="trigger-no-urls">No sites configured yet. Add sites and URLs above first.</p>';
            return;
        }

        let html = '';
        for (const site of allSites) {
            const urlsResponse = await fetch(`/api/sites/${site.id}/urls`);
            const urls = await urlsResponse.json();

            if (urls.length === 0) continue;

            html += `<div class="url-checkbox-site-group">`;
            html += `<label class="url-checkbox-site-header">`;
            html += `<input type="checkbox" class="site-select-all" data-site-id="${site.id}" onchange="toggleSiteUrls(this, ${site.id})">`;
            html += `<strong>${site.name}</strong> <span class="url-checkbox-count">(${urls.length} URLs)</span>`;
            html += `</label>`;

            urls.forEach(url => {
                html += `<label class="url-checkbox-item" title="${url.url}">`;
                html += `<input type="checkbox" name="triggerUrls" value="${url.id}" data-site-id="${site.id}" onchange="updateSiteSelectAll(${site.id})">`;
                html += `<span class="url-checkbox-label">${url.url}</span>`;
                html += `</label>`;
            });

            html += `</div>`;
        }

        if (!html) {
            container.innerHTML = '<p class="trigger-no-urls">No URLs configured yet. Add URLs to your sites above first.</p>';
            return;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading trigger URLs:', error);
        container.innerHTML = '<p class="trigger-no-urls">Error loading URLs</p>';
    }
}

// Toggle all URL checkboxes for a site
function toggleSiteUrls(selectAllCheckbox, siteId) {
    const checkboxes = document.querySelectorAll(`input[name="triggerUrls"][data-site-id="${siteId}"]`);
    checkboxes.forEach(cb => { cb.checked = selectAllCheckbox.checked; });
}

// Update the select-all checkbox state based on individual checkboxes
function updateSiteSelectAll(siteId) {
    const checkboxes = document.querySelectorAll(`input[name="triggerUrls"][data-site-id="${siteId}"]`);
    const selectAll = document.querySelector(`.site-select-all[data-site-id="${siteId}"]`);
    if (!selectAll) return;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = someChecked && !allChecked;
}

// Toggle between preset and custom cron input
function toggleScheduleInput() {
    const scheduleType = document.getElementById('triggerScheduleType').value;
    const presetGroup = document.getElementById('presetGroup');
    const cronGroup = document.getElementById('cronGroup');

    if (scheduleType === 'preset') {
        presetGroup.style.display = '';
        cronGroup.style.display = 'none';
    } else {
        presetGroup.style.display = 'none';
        cronGroup.style.display = '';
    }
}

// Toggle cron reference visibility
function toggleCronReference() {
    const ref = document.getElementById('cronReference');
    if (!ref) return;
    ref.style.display = ref.style.display === 'none' ? '' : 'none';
}

// Load and render all triggers
async function loadTriggers() {
    const container = document.getElementById('triggersList');
    if (!container) return;

    try {
        const response = await fetch('/api/triggers');
        const triggers = await response.json();

        if (triggers.length === 0) {
            container.innerHTML = createEmptyState({
                icon: EMPTY_ICONS.calendar,
                title: 'No Triggers Created',
                description: 'Create a trigger above to automate your PageSpeed testing.'
            });
            return;
        }

        let html = '';
        triggers.forEach(trigger => {
            html += renderTriggerCard(trigger);
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading triggers:', error);
        container.innerHTML = '<p style="color: #f87171; text-align: center; padding: 30px;">Error loading triggers</p>';
    }
}

// Render a single trigger card
function renderTriggerCard(trigger) {
    const enabledClass = trigger.enabled ? 'trigger-enabled' : 'trigger-disabled';
    const toggleChecked = trigger.enabled ? 'checked' : '';
    const strategyLabel = trigger.strategy === 'both' ? 'Desktop & Mobile' :
                          trigger.strategy.charAt(0).toUpperCase() + trigger.strategy.slice(1);
    const urlCount = trigger.url_ids ? trigger.url_ids.length : 0;

    return `
        <div class="trigger-card ${enabledClass}" data-trigger-id="${trigger.id}">
            <div class="trigger-card-header">
                <div class="trigger-card-info">
                    <h4 class="trigger-card-name">${trigger.name}</h4>
                    <div class="trigger-card-meta">
                        <span class="trigger-meta-item" title="Schedule">
                            <svg viewBox="0 0 24 24" class="trigger-meta-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${trigger.schedule_label || trigger.schedule_value}
                        </span>
                        <span class="trigger-meta-item" title="Strategy">
                            <svg viewBox="0 0 24 24" class="trigger-meta-icon"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            ${strategyLabel}
                        </span>
                        <span class="trigger-meta-item" title="URLs">
                            <svg viewBox="0 0 24 24" class="trigger-meta-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            ${urlCount} URL${urlCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <div class="trigger-card-actions">
                    <label class="trigger-toggle" title="${trigger.enabled ? 'Enabled' : 'Disabled'}">
                        <input type="checkbox" ${toggleChecked} onchange="toggleTrigger(${trigger.id}, this.checked)">
                        <span class="trigger-toggle-slider"></span>
                    </label>
                    <button class="btn-trigger-edit" onclick="editTrigger(${trigger.id})" title="Edit">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-trigger-delete" onclick="deleteTrigger(${trigger.id})" title="Delete">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Save (create or update) a trigger
async function saveTrigger(e) {
    e.preventDefault();

    const editId = document.getElementById('triggerEditId').value;
    const name = document.getElementById('triggerName').value.trim();
    const scheduleType = document.getElementById('triggerScheduleType').value;

    // Always store the cron expression directly — presets are just a form convenience.
    // When a preset is selected, its value is already a cron expression.
    const scheduleValue = scheduleType === 'preset'
        ? document.getElementById('triggerPreset').value
        : document.getElementById('triggerCron').value.trim();
    const strategy = document.querySelector('input[name="triggerStrategy"]:checked').value;

    // Collect selected URL ids
    const urlCheckboxes = document.querySelectorAll('input[name="triggerUrls"]:checked');
    const urlIds = Array.from(urlCheckboxes).map(cb => parseInt(cb.value));

    if (!name) {
        showToast('Please enter a trigger name', 'warning');
        return;
    }
    if (!scheduleValue) {
        showToast('Please select or enter a schedule', 'warning');
        return;
    }
    if (urlIds.length === 0) {
        showToast('Please select at least one URL', 'warning');
        return;
    }

    const payload = {
        name: name,
        schedule_type: 'custom',
        schedule_value: scheduleValue,
        strategy: strategy,
        url_ids: urlIds
    };

    try {
        const url = editId ? `/api/triggers/${editId}` : '/api/triggers';
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.success !== false) {
            showToast(editId ? 'Trigger updated successfully' : 'Trigger created successfully', 'success');
            resetTriggerForm();
            loadTriggers();
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error saving trigger:', error);
        showToast('Error saving trigger', 'error');
    }
}

// Delete a trigger
async function deleteTrigger(triggerId) {
    if (!confirm('Are you sure you want to delete this trigger?')) return;

    try {
        const response = await fetch(`/api/triggers/${triggerId}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok && result.success) {
            showToast('Trigger deleted', 'success');
            loadTriggers();
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error deleting trigger:', error);
        showToast('Error deleting trigger', 'error');
    }
}

// Toggle trigger enabled/disabled
async function toggleTrigger(triggerId, enabled) {
    try {
        const response = await fetch(`/api/triggers/${triggerId}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: enabled })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast(`Trigger ${enabled ? 'enabled' : 'disabled'}`, 'success');
            loadTriggers();
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error toggling trigger:', error);
        showToast('Error toggling trigger', 'error');
    }
}

// Edit a trigger — populate form with existing data
async function editTrigger(triggerId) {
    try {
        const response = await fetch('/api/triggers');
        const triggers = await response.json();
        const trigger = triggers.find(t => t.id === triggerId);

        if (!trigger) {
            showToast('Trigger not found', 'error');
            return;
        }

        // Set form title and button text
        document.getElementById('triggerFormTitle').textContent = 'Edit Trigger';
        document.getElementById('triggerSubmitBtn').textContent = 'Update Trigger';
        document.getElementById('triggerCancelBtn').style.display = '';
        document.getElementById('triggerEditId').value = trigger.id;

        // Fill form fields
        document.getElementById('triggerName').value = trigger.name;

        // Always populate in "custom cron" mode — the cron expression is the
        // source of truth.  For old triggers with schedule_type='preset', the
        // schedule_value is a preset key; we show it in the cron field and the
        // user can re-save to convert it.
        document.getElementById('triggerScheduleType').value = 'custom';
        toggleScheduleInput();
        document.getElementById('triggerCron').value = trigger.schedule_value;

        // Set strategy radio
        const strategyRadio = document.querySelector(`input[name="triggerStrategy"][value="${trigger.strategy}"]`);
        if (strategyRadio) strategyRadio.checked = true;

        // Check the correct URL checkboxes
        const allUrlCheckboxes = document.querySelectorAll('input[name="triggerUrls"]');
        allUrlCheckboxes.forEach(cb => {
            cb.checked = trigger.url_ids && trigger.url_ids.includes(parseInt(cb.value));
        });

        // Update select-all states
        document.querySelectorAll('.site-select-all').forEach(selectAll => {
            const siteId = parseInt(selectAll.dataset.siteId);
            updateSiteSelectAll(siteId);
        });

        // Scroll to form
        document.querySelector('.trigger-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error('Error loading trigger for edit:', error);
        showToast('Error loading trigger', 'error');
    }
}

// Cancel editing — reset form to create mode
function cancelTriggerEdit() {
    resetTriggerForm();
}

// Reset the trigger form to its default create state
function resetTriggerForm() {
    document.getElementById('triggerFormTitle').textContent = 'Create Trigger';
    document.getElementById('triggerSubmitBtn').textContent = 'Create Trigger';
    document.getElementById('triggerCancelBtn').style.display = 'none';
    document.getElementById('triggerEditId').value = '';
    document.getElementById('triggerForm').reset();
    document.getElementById('triggerScheduleType').value = 'preset';
    toggleScheduleInput();
    hideSavePresetDialog();

    // Uncheck all URL checkboxes
    document.querySelectorAll('input[name="triggerUrls"]').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.site-select-all').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
}

