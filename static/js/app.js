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
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tab-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete site';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSite(site.id, site.name);
        };
        
        tab.appendChild(deleteBtn);
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
            html += `<td>${formatDate(result.tested_at)}</td>`;
            html += `<td><button class="btn-delete" onclick="deleteUrl(${result.url_id}, '${result.url}')">🗑️ Delete</button></td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        contentDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading site results:', error);
        contentDiv.innerHTML = '<div class="no-data">Failed to load results</div>';
    }
}

// Test all sites
async function testAllSites() {
    const progressDiv = document.getElementById('testProgress');
    progressDiv.textContent = 'Running tests... This may take several minutes.';
    progressDiv.classList.add('show');
    
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    
    try {
        const response = await fetch('/api/test-all', {method: 'POST'});
        const result = await response.json();
        
        progressDiv.textContent = `Tests completed! ${result.results.filter(r => r.success).length} successful, ${result.results.filter(r => !r.success).length} failed.`;
        
        setTimeout(() => {
            loadDashboard();
            progressDiv.classList.remove('show');
        }, 2000);
        
    } catch (error) {
        console.error('Error running tests:', error);
        progressDiv.textContent = 'Error running tests. Please try again.';
    } finally {
        buttons.forEach(btn => btn.disabled = false);
    }
}

// Load comparison between two sites
async function loadComparison() {
    const site1Id = document.getElementById('compareSite1').value;
    const site2Id = document.getElementById('compareSite2').value;
    const resultsDiv = document.getElementById('comparisonResults');
    
    if (!site1Id || !site2Id) {
        alert('Please select both sites to compare');
        return;
    }
    
    resultsDiv.innerHTML = '<div class="loading">Loading comparison...</div>';
    
    try {
        const response = await fetch(`/api/comparison?site1=${site1Id}&site2=${site2Id}`);
        const data = await response.json();
        
        const site1Name = sites.find(s => s.id == site1Id).name;
        const site2Name = sites.find(s => s.id == site2Id).name;
        
        let html = '<div class="comparison-grid">';
        
        // Site 1
        html += `<div class="comparison-site"><h3>${site1Name}</h3>`;
        html += formatComparisonResults(data.site1);
        html += '</div>';
        
        // Site 2
        html += `<div class="comparison-site"><h3>${site2Name}</h3>`;
        html += formatComparisonResults(data.site2);
        html += '</div>';
        
        html += '</div>';
        resultsDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading comparison:', error);
        resultsDiv.innerHTML = '<div class="no-data">Failed to load comparison</div>';
    }
}

// Format comparison results
function formatComparisonResults(results) {
    if (results.length === 0) {
        return '<div class="no-data">No test results available</div>';
    }
    
    const avg = {
        performance: average(results.map(r => r.performance_score)),
        accessibility: average(results.map(r => r.accessibility_score)),
        best_practices: average(results.map(r => r.best_practices_score)),
        seo: average(results.map(r => r.seo_score))
    };
    
    let html = '<div class="metric-row"><span class="metric-label">Avg Performance:</span>' + formatScore(avg.performance) + '</div>';
    html += '<div class="metric-row"><span class="metric-label">Avg Accessibility:</span>' + formatScore(avg.accessibility) + '</div>';
    html += '<div class="metric-row"><span class="metric-label">Avg Best Practices:</span>' + formatScore(avg.best_practices) + '</div>';
    html += '<div class="metric-row"><span class="metric-label">Avg SEO:</span>' + formatScore(avg.seo) + '</div>';
    html += `<div class="metric-row"><span class="metric-label">URLs Tested:</span><span>${results.length}</span></div>`;
    
    return html;
}

// Update URLs dropdown when site is selected for charts
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
