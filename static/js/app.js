let sites = [];
let currentChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSites();
    
    // Setup form handlers
    document.getElementById('addSiteForm').addEventListener('submit', addSite);
    document.getElementById('addUrlForm').addEventListener('submit', addUrl);
    document.getElementById('chartSiteSelect').addEventListener('change', updateUrlsForChart);
});

// Load all sites
async function loadSites() {
    try {
        const response = await fetch('/api/sites');
        sites = await response.json();
        
        updateSiteSelects();
        createSiteTabs();
        loadDashboard();
    } catch (error) {
        console.error('Error loading sites:', error);
    }
}

// Update all site select dropdowns
function updateSiteSelects() {
    const selects = ['urlSiteSelect', 'compareSite1', 'compareSite2', 'chartSiteSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
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
            alert(result.error);
        }
    } catch (error) {
        console.error('Error adding site:', error);
        alert('Failed to add site');
    }
}

// Add a new URL
async function addUrl(e) {
    e.preventDefault();
    const siteId = document.getElementById('urlSiteSelect').value;
    const url = document.getElementById('urlInput').value;
    
    if (!siteId) {
        alert('Please select a site');
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
            alert(result.error);
        }
    } catch (error) {
        console.error('Error adding URL:', error);
        alert('Failed to add URL');
    }
}

// Create site tabs
function createSiteTabs() {
    const tabsContainer = document.getElementById('siteTabs');
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
    
    // Load results for this site
    loadSiteResults(siteId);
}

// Load dashboard with latest results
async function loadDashboard() {
    if (sites.length === 0) {
        document.getElementById('siteContent').innerHTML = '<div class="no-data">No sites configured. Add sites and URLs to get started.</div>';
        return;
    }
    
    // Load results for the first site by default
    loadSiteResults(sites[0].id);
}

// Load results for a specific site
async function loadSiteResults(siteId) {
    const contentDiv = document.getElementById('siteContent');
    contentDiv.innerHTML = '<div class="loading">Loading results...</div>';
    
    try {
        const response = await fetch(`/api/sites/${siteId}/latest-results`);
        const results = await response.json();
        
        if (results.length === 0) {
            contentDiv.innerHTML = '<div class="no-data">No test results yet. Click "Test All URLs" to run your first test.</div>';
            return;
        }
        
        let html = '<table class="results-table"><thead><tr>';
        html += '<th>URL</th>';
        html += '<th>Performance</th>';
        html += '<th>Accessibility</th>';
        html += '<th>Best Practices</th>';
        html += '<th>SEO</th>';
        html += '<th>FCP (ms)</th>';
        html += '<th>LCP (ms)</th>';
        html += '<th>CLS</th>';
        html += '<th>INP (ms)</th>';
        html += '<th>TTFB (ms)</th>';
        html += '<th>Page Size</th>';
        html += '<th>Last Tested</th>';
        html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';
        
        results.forEach(result => {
            html += '<tr>';
            html += `<td>${result.url}</td>`;
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
        alert('Failed to fetch URLs');
        return;
    }
    
    if (allUrls.length === 0) {
        alert('No URLs to test. Please add some URLs first.');
        return;
    }
    
    // Show progress container
    progressContainer.classList.add('show');
    progressText.textContent = 'Preparing to test...';
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
                    url: urlData.url
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
    progressText.textContent = 'Tests Complete!';
    progressDetails.innerHTML = `
        <div class="completion-summary">
            <div class="summary-item success">✅ ${successful} Successful</div>
            <div class="summary-item failed">❌ ${failed} Failed</div>
        </div>
    ` + progressDetails.innerHTML;
    
    // Re-enable buttons
    buttons.forEach(btn => btn.disabled = false);
    
    // Refresh dashboard after a short delay
    setTimeout(() => {
        loadDashboard();
        progressContainer.classList.remove('show');
    }, 3000);
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
        alert('Please select URLs from both sites to compare');
        return;
    }
    
    resultsDiv.innerHTML = '<div class="loading">Loading comparison...</div>';
    
    try {
        const response = await fetch(`/api/comparison/urls?url1=${url1Id}&url2=${url2Id}`);
        const data = await response.json();
        
        if (!data.url1 || !data.url2) {
            resultsDiv.innerHTML = '<div class="no-data">No test results available for one or both URLs</div>';
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
        alert('Please select a URL');
        return;
    }
    
    try {
        const response = await fetch(`/api/urls/${urlId}/history?days=30`);
        const history = await response.json();
        
        if (history.length === 0) {
            alert('No historical data available for this URL');
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
        alert('Failed to load historical data');
    }
}

// Show detailed breakdown modal
async function showDetails(urlId) {
    try {
        const response = await fetch(`/api/test-details/${urlId}`);
        const data = await response.json();
        
        if (!data || !data.raw_data) {
            alert('No detailed data available for this URL. Please run a test first.');
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
                                <div class="metric-item"><strong>FCP:</strong> ${formatMetric(data.fcp)}ms</div>
                                <div class="metric-item"><strong>LCP:</strong> ${formatMetric(data.lcp)}ms</div>
                                <div class="metric-item"><strong>CLS:</strong> ${data.cls?.toFixed(3) || 'N/A'}</div>
                                <div class="metric-item"><strong>TBT:</strong> ${formatMetric(data.tbt)}ms</div>
                                <div class="metric-item"><strong>Speed Index:</strong> ${formatMetric(data.speed_index)}ms</div>
                                <div class="metric-item"><strong>TTI:</strong> ${formatMetric(data.tti)}ms</div>
                                <div class="metric-item"><strong>INP:</strong> ${formatMetric(data.inp)}ms</div>
                                <div class="metric-item"><strong>TTFB:</strong> ${formatMetric(data.ttfb)}ms</div>
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
        alert('Failed to load detailed data');
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
    const weightPercent = weight ? Math.round(weight * 100) : 0;
    
    return `
        <div class="metric-weight-item">
            <div class="metric-weight-header">
                <span class="metric-weight-label">${label}:</span>
                <span class="metric-weight-value">${formattedValue}</span>
            </div>
            <div class="metric-weight-percent">${weightPercent}% of score</div>
        </div>
    `;
}

function formatSavings(ms) {
    if (!ms) return 'N/A';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
}

// Retest a single URL
async function retestUrl(urlId, urlText) {
    const progressContainer = document.getElementById('testProgress');
    const progressText = document.getElementById('progressText');
    const progressCount = document.getElementById('progressCount');
    const progressBar = document.getElementById('progressBar');
    const progressDetails = document.getElementById('progressDetails');
    
    // Show progress container
    progressContainer.classList.add('show');
    progressText.textContent = 'Retesting URL...';
    progressCount.textContent = '0 / 1';
    progressBar.style.width = '0%';
    progressDetails.innerHTML = `<div class="testing-url">🔄 ${urlText}</div>`;
    
    try {
        const response = await fetch('/api/test-url', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                url_id: urlId,
                url: urlText
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
        alert('Site name cannot be empty');
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
            alert('Failed to rename site: ' + result.error);
        }
    } catch (error) {
        console.error('Error renaming site:', error);
        alert('Failed to rename site');
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
            alert('Failed to delete URL: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting URL:', error);
        alert('Failed to delete URL');
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
            alert('Failed to delete site: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting site:', error);
        alert('Failed to delete site');
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
    const progressDiv = document.getElementById('testProgress');
    progressDiv.textContent = message;
    progressDiv.classList.add('show');
    setTimeout(() => progressDiv.classList.remove('show'), 3000);
}
