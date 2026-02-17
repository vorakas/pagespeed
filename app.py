from flask import Flask, render_template, request, jsonify
from models import Database
from pagespeed_service import PageSpeedService
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from newrelic_service import NewRelicService
from azure_service import AzureLogAnalyticsService
from ai_service import ClaudeService, OpenAIService, run_parallel_analysis, build_system_prompt, build_user_message
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
db = Database()

# Initialize PageSpeed service with API key from environment
API_KEY = os.getenv('PAGESPEED_API_KEY')
pagespeed = PageSpeedService(api_key=API_KEY)
newrelic = NewRelicService()

# Scheduler for daily tests
scheduler = BackgroundScheduler()


def run_daily_tests():
    """Run tests for all URLs - called by scheduler"""
    import time
    print(f"Running scheduled tests at {datetime.now()}")
    all_urls = db.get_all_urls()

    for i, url_data in enumerate(all_urls):
        result = pagespeed.test_url(url_data['url'])
        if result:
            db.save_test_result(url_data['id'], result)
            print(f"Saved result for {url_data['url']}")

        # Add 2-second delay between requests (except after the last one)
        if i < len(all_urls) - 1:
            time.sleep(2)


# Schedule daily tests at 2 AM
scheduler.add_job(func=run_daily_tests, trigger="cron", hour=2, minute=0)
scheduler.start()


@app.route('/')
def index():
    """Main dashboard"""
    sites = db.get_sites()
    return render_template('index.html', sites=sites)


@app.route('/setup')
def setup():
    """Site/URL Setup page"""
    sites = db.get_sites()
    return render_template('setup.html', sites=sites)


@app.route('/test')
def test():
    """Test URLs page"""
    sites = db.get_sites()
    return render_template('test.html', sites=sites)


@app.route('/metrics')
def metrics():
    """Page Performance Metrics page"""
    sites = db.get_sites()
    return render_template('metrics.html', sites=sites)


@app.route('/newrelic')
def newrelic():
    """New Relic Metrics page"""
    sites = db.get_sites()
    return render_template('newrelic.html', sites=sites)


@app.route('/iislogs')
def iislogs():
    """IIS Logs page"""
    sites = db.get_sites()
    return render_template('iislogs.html', sites=sites)


@app.route('/ai-analysis')
def ai_analysis():
    """AI Performance Analysis page"""
    sites = db.get_sites()
    return render_template('ai_analysis.html', sites=sites)


@app.route('/api/sites', methods=['GET', 'POST'])
def sites():
    """Get all sites or create a new site"""
    if request.method == 'POST':
        data = request.get_json()
        site_id = db.add_site(data['name'])
        if site_id:
            return jsonify({'success': True, 'id': site_id})
        else:
            return jsonify({'success': False, 'error': 'Site already exists'}), 400

    return jsonify(db.get_sites())


@app.route('/api/sites/<int:site_id>/urls', methods=['GET', 'POST'])
def site_urls(site_id):
    """Get URLs for a site or add a new URL"""
    if request.method == 'POST':
        data = request.get_json()
        url_id = db.add_url(site_id, data['url'])
        if url_id:
            return jsonify({'success': True, 'id': url_id})
        else:
            return jsonify({'success': False, 'error': 'URL already exists for this site'}), 400

    return jsonify(db.get_urls_by_site(site_id))


@app.route('/api/sites/<int:site_id>/latest-results')
def latest_results(site_id):
    """Get latest test results for a site"""
    results = db.get_latest_results(site_id)
    return jsonify(results)


@app.route('/api/urls/<int:url_id>/history')
def url_history(url_id):
    """Get historical data for a URL"""
    days = request.args.get('days', 30, type=int)
    history = db.get_historical_data(url_id, days)
    return jsonify(history)


@app.route('/api/test-url-async', methods=['POST'])
def test_url_async():
    """Queue a URL test that runs in background - returns immediately"""
    data = request.get_json()
    url_id = data.get('url_id')
    url_text = data.get('url')

    if not url_text:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    # Start test in background thread
    import threading
    def run_test():
        result = pagespeed.test_url(url_text)
        if result and url_id:
            db.save_test_result(url_id, result)

    thread = threading.Thread(target=run_test)
    thread.daemon = True
    thread.start()

    return jsonify({'success': True, 'status': 'queued'})


@app.route('/api/test-url', methods=['POST'])
def test_url():
    """Run a test for a specific URL on demand"""
    data = request.get_json()
    url_id = data.get('url_id')
    url_text = data.get('url')

    if not url_text:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    result = pagespeed.test_url(url_text)

    if result and url_id:
        db.save_test_result(url_id, result)
        return jsonify({'success': True, 'result': result})
    elif result:
        return jsonify({'success': True, 'result': result})
    else:
        return jsonify({'success': False, 'error': 'Failed to test URL'}), 500


@app.route('/api/test-site/<int:site_id>', methods=['POST'])
def test_site(site_id):
    """Run tests for all URLs in a site"""
    import time
    urls = db.get_urls_by_site(site_id)

    results = []
    for i, url_data in enumerate(urls):
        result = pagespeed.test_url(url_data['url'])
        if result:
            db.save_test_result(url_data['id'], result)
            results.append({
                'url': url_data['url'],
                'success': True,
                'result': result
            })
        else:
            results.append({
                'url': url_data['url'],
                'success': False
            })

        # Add 2-second delay between requests (except after the last one)
        if i < len(urls) - 1:
            time.sleep(2)

    return jsonify({'success': True, 'results': results})


@app.route('/api/test-all', methods=['POST'])
def test_all():
    """Run tests for all URLs in all sites"""
    import time
    all_urls = db.get_all_urls()

    results = []
    for i, url_data in enumerate(all_urls):
        result = pagespeed.test_url(url_data['url'])
        if result:
            db.save_test_result(url_data['id'], result)
            results.append({
                'url': url_data['url'],
                'site': url_data['site_name'],
                'success': True
            })
        else:
            results.append({
                'url': url_data['url'],
                'site': url_data['site_name'],
                'success': False
            })

        # Add 2-second delay between requests (except after the last one)
        if i < len(all_urls) - 1:
            time.sleep(2)

    return jsonify({'success': True, 'results': results})


@app.route('/api/urls/<int:url_id>', methods=['DELETE'])
def delete_url(url_id):
    """Delete a URL and all its test results"""
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        # Delete all test results for this URL first (foreign key constraint)
        if db.is_postgres:
            cursor.execute('DELETE FROM test_results WHERE url_id = %s', (url_id,))
            cursor.execute('DELETE FROM urls WHERE id = %s', (url_id,))
        else:
            cursor.execute('DELETE FROM test_results WHERE url_id = ?', (url_id,))
            cursor.execute('DELETE FROM urls WHERE id = ?', (url_id,))

        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sites/<int:site_id>', methods=['PUT'])
def update_site(site_id):
    """Update a site name"""
    data = request.get_json()
    new_name = data.get('name')

    if not new_name:
        return jsonify({'success': False, 'error': 'Name is required'}), 400

    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        if db.is_postgres:
            cursor.execute('UPDATE sites SET name = %s WHERE id = %s', (new_name, site_id))
        else:
            cursor.execute('UPDATE sites SET name = ? WHERE id = ?', (new_name, site_id))

        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/sites/<int:site_id>', methods=['DELETE'])
def delete_site(site_id):
    """Delete a site and all its URLs and test results"""
    conn = db.get_connection()
    cursor = conn.cursor()

    try:
        # Get all URLs for this site
        if db.is_postgres:
            cursor.execute('SELECT id FROM urls WHERE site_id = %s', (site_id,))
        else:
            cursor.execute('SELECT id FROM urls WHERE site_id = ?', (site_id,))

        url_ids = [row[0] for row in cursor.fetchall()]

        # Delete all test results for these URLs
        for url_id in url_ids:
            if db.is_postgres:
                cursor.execute('DELETE FROM test_results WHERE url_id = %s', (url_id,))
            else:
                cursor.execute('DELETE FROM test_results WHERE url_id = ?', (url_id,))

        # Delete all URLs for this site
        if db.is_postgres:
            cursor.execute('DELETE FROM urls WHERE site_id = %s', (site_id,))
            cursor.execute('DELETE FROM sites WHERE id = %s', (site_id,))
        else:
            cursor.execute('DELETE FROM urls WHERE site_id = ?', (site_id,))
            cursor.execute('DELETE FROM sites WHERE id = ?', (site_id,))

        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/comparison')
def comparison():
    """Get comparison data between two sites"""
    site1_id = request.args.get('site1', type=int)
    site2_id = request.args.get('site2', type=int)

    if not site1_id or not site2_id:
        return jsonify({'error': 'Both site1 and site2 parameters are required'}), 400

    site1_results = db.get_latest_results(site1_id)
    site2_results = db.get_latest_results(site2_id)

    return jsonify({
        'site1': site1_results,
        'site2': site2_results
    })


@app.route('/api/comparison/urls')
def url_comparison():
    """Get comparison data between two specific URLs"""
    url1_id = request.args.get('url1', type=int)
    url2_id = request.args.get('url2', type=int)

    if not url1_id or not url2_id:
        return jsonify({'error': 'Both url1 and url2 parameters are required'}), 400

    # Get latest result for each URL
    conn = db.get_connection()
    cursor = conn.cursor()

    # Get URL 1 data
    query = '''
        SELECT 
            u.url,
            s.name as site_name,
            tr.performance_score,
            tr.accessibility_score,
            tr.best_practices_score,
            tr.seo_score,
            tr.fcp,
            tr.lcp,
            tr.cls,
            tr.inp,
            tr.ttfb,
            tr.total_byte_weight,
            tr.tested_at
        FROM urls u
        JOIN sites s ON u.site_id = s.id
        LEFT JOIN (
            SELECT url_id, MAX(tested_at) as max_date
            FROM test_results
            GROUP BY url_id
        ) latest ON u.id = latest.url_id
        LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
        WHERE u.id = %s
    ''' if db.is_postgres else '''
        SELECT 
            u.url,
            s.name as site_name,
            tr.performance_score,
            tr.accessibility_score,
            tr.best_practices_score,
            tr.seo_score,
            tr.fcp,
            tr.lcp,
            tr.cls,
            tr.inp,
            tr.ttfb,
            tr.total_byte_weight,
            tr.tested_at
        FROM urls u
        JOIN sites s ON u.site_id = s.id
        LEFT JOIN (
            SELECT url_id, MAX(tested_at) as max_date
            FROM test_results
            GROUP BY url_id
        ) latest ON u.id = latest.url_id
        LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
        WHERE u.id = ?
    '''

    cursor.execute(query, (url1_id,))
    if db.is_postgres:
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        url1_data = dict(zip(columns, row)) if row else None
    else:
        row = cursor.fetchone()
        url1_data = dict(row) if row else None

    cursor.execute(query.replace('u.id = %s' if db.is_postgres else 'u.id = ?',
                                 'u.id = %s' if db.is_postgres else 'u.id = ?'), (url2_id,))
    if db.is_postgres:
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        url2_data = dict(zip(columns, row)) if row else None
    else:
        row = cursor.fetchone()
        url2_data = dict(row) if row else None

    conn.close()

    return jsonify({
        'url1': url1_data,
        'url2': url2_data
    })


@app.route('/api/test-details/<int:url_id>')
def test_details(url_id):
    """Get detailed test results including opportunities and diagnostics"""
    conn = db.get_connection()
    cursor = conn.cursor()

    query = '''
        SELECT 
            u.url,
            s.name as site_name,
            tr.performance_score,
            tr.accessibility_score,
            tr.best_practices_score,
            tr.seo_score,
            tr.fcp,
            tr.lcp,
            tr.cls,
            tr.tti,
            tr.tbt,
            tr.speed_index,
            tr.inp,
            tr.ttfb,
            tr.total_byte_weight,
            tr.raw_data,
            tr.tested_at
        FROM urls u
        JOIN sites s ON u.site_id = s.id
        LEFT JOIN (
            SELECT url_id, MAX(tested_at) as max_date
            FROM test_results
            GROUP BY url_id
        ) latest ON u.id = latest.url_id
        LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
        WHERE u.id = %s
    ''' if db.is_postgres else '''
        SELECT 
            u.url,
            s.name as site_name,
            tr.performance_score,
            tr.accessibility_score,
            tr.best_practices_score,
            tr.seo_score,
            tr.fcp,
            tr.lcp,
            tr.cls,
            tr.tti,
            tr.tbt,
            tr.speed_index,
            tr.inp,
            tr.ttfb,
            tr.total_byte_weight,
            tr.raw_data,
            tr.tested_at
        FROM urls u
        JOIN sites s ON u.site_id = s.id
        LEFT JOIN (
            SELECT url_id, MAX(tested_at) as max_date
            FROM test_results
            GROUP BY url_id
        ) latest ON u.id = latest.url_id
        LEFT JOIN test_results tr ON u.id = tr.url_id AND tr.tested_at = latest.max_date
        WHERE u.id = ?
    '''

    cursor.execute(query, (url_id,))

    if db.is_postgres:
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        result = dict(zip(columns, row)) if row else None
    else:
        row = cursor.fetchone()
        result = dict(row) if row else None

    conn.close()

    if not result:
        return jsonify({'error': 'No test results found'}), 404

    # Parse raw_data JSON
    if result.get('raw_data'):
        result['raw_data'] = json.loads(result['raw_data'])

    return jsonify(result)


@app.route('/api/newrelic/test-connection', methods=['POST'])
def test_newrelic_connection():
    """Test connection to New Relic API"""
    data = request.get_json()
    api_key = data.get('api_key')

    if not api_key:
        return jsonify({'success': False, 'message': 'API key is required'}), 400

    # Create a temporary service instance with the provided API key
    temp_service = NewRelicService(api_key=api_key)
    result = temp_service.test_connection()

    return jsonify(result)


@app.route('/api/newrelic/core-web-vitals', methods=['POST'])
def get_core_web_vitals():
    """
    Get Core Web Vitals metrics from New Relic

    Expected JSON body:
    {
        "api_key": "NRAK-...",
        "account_id": 122363,
        "app_name": "LampsPlus Site Live",
        "page_url": "https://www.lampsplus.com/",
        "time_range": "30 minutes ago"  // optional, defaults to "30 minutes ago"
    }
    """
    data = request.get_json()

    # Validate required fields
    required_fields = ['api_key', 'account_id', 'app_name', 'page_url']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'success': False,
                'error': f'Missing required field: {field}'
            }), 400

    # Extract parameters
    api_key = data.get('api_key')
    account_id = data.get('account_id')
    app_name = data.get('app_name')
    page_url = data.get('page_url')
    time_range = data.get('time_range', '30 minutes ago')

    # Create New Relic service instance with provided API key
    nr_service = NewRelicService(api_key=api_key)

    # Get metrics
    result = nr_service.get_core_web_vitals(
        account_id=account_id,
        app_name=app_name,
        page_url=page_url,
        time_range=time_range
    )

    if 'error' in result:
        return jsonify({
            'success': False,
            'error': result['error']
        }), 500

    return jsonify(result)


@app.route('/api/newrelic/performance-overview', methods=['POST'])
def get_performance_overview():
    """
    Get Performance Overview metrics from New Relic

    Expected JSON body:
    {
        "api_key": "NRAK-...",
        "account_id": 122363,
        "app_name": "LampsPlus Site Live",
        "time_range": "30 minutes ago"
    }
    """
    data = request.get_json()

    required_fields = ['api_key', 'account_id', 'app_name']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'success': False,
                'error': f'Missing required field: {field}'
            }), 400

    api_key = data.get('api_key')
    account_id = data.get('account_id')
    app_name = data.get('app_name')
    time_range = data.get('time_range', '30 minutes ago')

    nr_service = NewRelicService(api_key=api_key)
    result = nr_service.get_performance_overview(account_id, app_name, time_range)

    if 'error' in result:
        return jsonify({
            'success': False,
            'error': result['error']
        }), 500

    return jsonify(result)


@app.route('/api/newrelic/apm-metrics', methods=['POST'])
def get_apm_metrics():
    """
    Get APM metrics (Transactions, Database, External, Errors) from New Relic

    Expected JSON body:
    {
        "api_key": "NRAK-...",
        "account_id": 122363,
        "app_name": "LampsPlus Site Live",
        "time_range": "30 minutes ago"
    }
    """
    data = request.get_json()

    required_fields = ['api_key', 'account_id', 'app_name']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'success': False,
                'error': f'Missing required field: {field}'
            }), 400

    api_key = data.get('api_key')
    account_id = data.get('account_id')
    app_name = data.get('app_name')
    time_range = data.get('time_range', '30 minutes ago')

    nr_service = NewRelicService(api_key=api_key)
    result = nr_service.get_apm_metrics(account_id, app_name, time_range)

    if 'error' in result:
        return jsonify({
            'success': False,
            'error': result['error']
        }), 500

    return jsonify(result)


@app.route('/api/newrelic/custom-query', methods=['POST'])
def execute_custom_query():
    """
    Execute a custom NerdGraph query

    Expected JSON body:
    {
        "api_key": "NRAK-...",
        "query": "{ actor { user { email } } }"
    }
    """
    data = request.get_json()

    api_key = data.get('api_key')
    query = data.get('query')

    if not api_key or not query:
        return jsonify({
            'success': False,
            'error': 'Both api_key and query are required'
        }), 400

    # Create New Relic service instance
    nr_service = NewRelicService(api_key=api_key)

    # Execute query
    result = nr_service.execute_query(query)

    if 'error' in result:
        return jsonify({
            'success': False,
            'error': result['error']
        }), 500

    return jsonify({
        'success': True,
        'data': result
    })


# ==================== Azure Log Analytics Routes ====================

@app.route('/api/azure/test-connection', methods=['POST'])
def test_azure_connection():
    """Test connection to Azure Log Analytics workspace"""
    data = request.get_json()

    required_fields = ['tenant_id', 'client_id', 'client_secret', 'workspace_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

    service = AzureLogAnalyticsService(
        tenant_id=data['tenant_id'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        workspace_id=data['workspace_id']
    )

    result = service.test_connection()
    return jsonify(result)


@app.route('/api/azure/search-logs', methods=['POST'])
def search_azure_logs():
    """Search and filter IIS logs from Azure Log Analytics"""
    data = request.get_json()

    required_fields = ['tenant_id', 'client_id', 'client_secret', 'workspace_id', 'start_date', 'end_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    service = AzureLogAnalyticsService(
        tenant_id=data['tenant_id'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        workspace_id=data['workspace_id']
    )

    result = service.search_logs(
        start_date=data['start_date'],
        end_date=data['end_date'],
        url_filter=data.get('url_filter'),
        status_code=data.get('status_code'),
        site_name=data.get('site_name'),
        limit=data.get('limit', 100)
    )

    if isinstance(result, dict) and 'error' in result:
        return jsonify({'success': False, 'error': result['error']}), 500

    return jsonify(result)


@app.route('/api/azure/dashboard-summary', methods=['POST'])
def azure_dashboard_summary():
    """Get aggregated IIS log dashboard summary"""
    data = request.get_json()

    required_fields = ['tenant_id', 'client_id', 'client_secret', 'workspace_id', 'start_date', 'end_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    service = AzureLogAnalyticsService(
        tenant_id=data['tenant_id'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        workspace_id=data['workspace_id']
    )

    result = service.get_dashboard_summary(
        start_date=data['start_date'],
        end_date=data['end_date'],
        site_name=data.get('site_name')
    )

    if isinstance(result, dict) and 'error' in result:
        return jsonify({'success': False, 'error': result['error']}), 500

    return jsonify(result)


@app.route('/api/azure/list-sites', methods=['POST'])
def azure_list_sites():
    """Get distinct IIS site names from Log Analytics workspace"""
    data = request.get_json()

    required_fields = ['tenant_id', 'client_id', 'client_secret', 'workspace_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    service = AzureLogAnalyticsService(
        tenant_id=data['tenant_id'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        workspace_id=data['workspace_id']
    )

    query = 'W3CIISLog | distinct sSiteName | order by sSiteName asc'
    response = service.execute_query(query, timespan='P7D')

    if isinstance(response, dict) and 'error' in response:
        return jsonify({'success': False, 'error': response['error']}), 500

    rows = service._parse_table_response(response)
    sites = [row.get('sSiteName', '') for row in rows if row.get('sSiteName')]

    return jsonify({
        'success': True,
        'sites': sites
    })


@app.route('/api/azure/execute-query', methods=['POST'])
def azure_execute_query():
    """Execute a raw KQL query against Azure Log Analytics"""
    data = request.get_json()

    required_fields = ['tenant_id', 'client_id', 'client_secret', 'workspace_id', 'query']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    query = data['query'].strip()
    if not query:
        return jsonify({'success': False, 'error': 'Query cannot be empty'}), 400

    service = AzureLogAnalyticsService(
        tenant_id=data['tenant_id'],
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        workspace_id=data['workspace_id']
    )

    timespan = data.get('timespan')
    response = service.execute_query(query, timespan=timespan)

    if isinstance(response, dict) and 'error' in response:
        return jsonify({'success': False, 'error': response['error']}), 500

    # Parse into rows for table display
    rows = service._parse_table_response(response)

    # Extract column metadata from raw response
    columns = []
    tables = response.get('tables', [])
    if tables:
        columns = [col['name'] for col in tables[0].get('columns', [])]

    return jsonify({
        'success': True,
        'columns': columns,
        'rows': rows,
        'count': len(rows),
        'raw': response
    })


# ==================== AI Analysis Routes ====================

@app.route('/api/ai/analyze', methods=['POST'])
def ai_analyze():
    """Orchestrate data gathering and parallel AI analysis"""
    data = request.get_json()

    url_path = data.get('url')
    page_url = data.get('page_url')
    time_range = data.get('time_range', '1 hour ago')
    providers = data.get('providers', [])

    if not url_path:
        return jsonify({'success': False, 'error': 'URL path is required'}), 400

    if not providers:
        return jsonify({'success': False, 'error': 'At least one AI provider must be selected'}), 400

    # ---- Step 1: Gather New Relic data ----
    newrelic_data = {}
    nr_api_key = data.get('nr_api_key')
    nr_account_id = data.get('nr_account_id')
    nr_app_name = data.get('nr_app_name')

    if nr_api_key and nr_account_id and nr_app_name:
        try:
            nr_service = NewRelicService(api_key=nr_api_key)

            # Core Web Vitals (needs full page URL)
            if page_url:
                cwv_result = nr_service.get_core_web_vitals(
                    account_id=int(nr_account_id),
                    app_name=nr_app_name,
                    page_url=page_url,
                    time_range=time_range
                )
                if cwv_result.get('success'):
                    newrelic_data['core_web_vitals'] = cwv_result.get('metrics', {})

            # Performance Overview
            perf_result = nr_service.get_performance_overview(
                int(nr_account_id), nr_app_name, time_range
            )
            if perf_result.get('success'):
                newrelic_data['performance_overview'] = {
                    'current': perf_result.get('current', {}),
                    'previous': perf_result.get('previous', {})
                }

            # APM Metrics
            apm_result = nr_service.get_apm_metrics(
                int(nr_account_id), nr_app_name, time_range
            )
            if apm_result.get('success'):
                newrelic_data['apm_metrics'] = {
                    'transactions': apm_result.get('transactions', [])[:10],
                    'database': apm_result.get('database', [])[:10],
                    'external': apm_result.get('external', [])[:10],
                    'errors': apm_result.get('errors', [])[:10]
                }
        except Exception as e:
            print(f"Error gathering New Relic data: {e}")

    # ---- Step 2: Gather IIS log data ----
    iis_data = {}
    az_tenant = data.get('azure_tenant_id')
    az_client = data.get('azure_client_id')
    az_secret = data.get('azure_client_secret')
    az_workspace = data.get('azure_workspace_id')

    if az_tenant and az_client and az_secret and az_workspace:
        try:
            az_service = AzureLogAnalyticsService(
                tenant_id=az_tenant,
                client_id=az_client,
                client_secret=az_secret,
                workspace_id=az_workspace
            )

            # Calculate date range from time_range string
            now = datetime.utcnow()
            minutes = _parse_time_range_to_minutes(time_range)
            start_date = (now - timedelta(minutes=minutes)).isoformat() + 'Z'
            end_date = now.isoformat() + 'Z'

            site_name = data.get('azure_site_name')

            # Dashboard summary
            summary_result = az_service.get_dashboard_summary(
                start_date=start_date,
                end_date=end_date,
                site_name=site_name
            )
            if isinstance(summary_result, dict) and summary_result.get('success'):
                iis_data['summary'] = summary_result.get('summary', {})
                iis_data['status_distribution'] = summary_result.get('statusDistribution', [])
                iis_data['top_pages'] = summary_result.get('topPages', [])

            # Slow requests for this specific URL
            slow_result = az_service.search_logs(
                start_date=start_date,
                end_date=end_date,
                url_filter=url_path,
                site_name=site_name,
                limit=20
            )
            if isinstance(slow_result, dict) and slow_result.get('success'):
                iis_data['slow_requests'] = slow_result.get('logs', [])
        except Exception as e:
            print(f"Error gathering IIS log data: {e}")

    # ---- Step 3: Check we have some data ----
    if not newrelic_data and not iis_data:
        return jsonify({
            'success': False,
            'error': 'No data could be retrieved. Check that New Relic and/or Azure credentials are configured on their respective pages.'
        }), 400

    # ---- Step 4: Build prompt and run AI analysis in parallel ----
    system_prompt = build_system_prompt()
    user_message = build_user_message(url_path, time_range, newrelic_data, iis_data)

    claude_svc = None
    openai_svc = None

    if 'claude' in providers and data.get('claude_api_key'):
        claude_svc = ClaudeService(
            api_key=data['claude_api_key'],
            model=data.get('claude_model', 'claude-sonnet-4-20250514')
        )

    if 'openai' in providers and data.get('openai_api_key'):
        openai_svc = OpenAIService(
            api_key=data['openai_api_key'],
            model=data.get('openai_model', 'gpt-4o')
        )

    ai_results = run_parallel_analysis(claude_svc, openai_svc, system_prompt, user_message)

    # ---- Step 5: Return results ----
    return jsonify({
        'success': True,
        'claude': ai_results.get('claude'),
        'openai': ai_results.get('openai'),
        'data_sources': {
            'newrelic': bool(newrelic_data),
            'iis_logs': bool(iis_data)
        },
        'prompt_preview': user_message[:2000] + '...' if len(user_message) > 2000 else user_message
    })


def _parse_time_range_to_minutes(time_range):
    """Convert NRQL-style time range string to minutes."""
    try:
        parts = time_range.lower().split()
        value = int(parts[0])
        unit = parts[1]
        if 'hour' in unit:
            return value * 60
        elif 'minute' in unit:
            return value
        elif 'day' in unit:
            return value * 1440
    except (IndexError, ValueError):
        pass
    return 60  # default 1 hour


if __name__ == '__main__':
    # Create some sample data if database is empty
    sites = db.get_sites()
    if len(sites) == 0:
        print("No sites found. You can add sites and URLs through the web interface.")

    # Get port from environment variable (Railway sets this) or default to 5000
    port = int(os.getenv('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)