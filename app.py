from flask import Flask, render_template, request, jsonify
from models import Database
from pagespeed_service import PageSpeedService
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
db = Database()

# Initialize PageSpeed service with API key from environment
API_KEY = os.getenv('PAGESPEED_API_KEY')
pagespeed = PageSpeedService(api_key=API_KEY)

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

if __name__ == '__main__':
    # Create some sample data if database is empty
    sites = db.get_sites()
    if len(sites) == 0:
        print("No sites found. You can add sites and URLs through the web interface.")
    
    # Get port from environment variable (Railway sets this) or default to 5000
    port = int(os.getenv('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)