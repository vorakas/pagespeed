from flask import Flask, render_template, request, jsonify
from models import Database
from pagespeed_service import PageSpeedService
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import os
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


if __name__ == '__main__':
    # Create some sample data if database is empty
    sites = db.get_sites()
    if len(sites) == 0:
        print("No sites found. You can add sites and URLs through the web interface.")

    app.run(debug=True, host='0.0.0.0', port=5000)