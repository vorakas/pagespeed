import requests
import time

class PageSpeedService:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.base_url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    
    def test_url(self, url, strategy='mobile'):
        """
        Test a URL using PageSpeed Insights API
        
        Args:
            url: The URL to test
            strategy: 'mobile' or 'desktop'
        
        Returns:
            dict: Parsed results or None if error
        """
        params = {
            'url': url,
            'strategy': strategy,
            'category': ['performance', 'accessibility', 'best-practices', 'seo']
        }
        
        if self.api_key:
            params['key'] = self.api_key
        
        try:
            print(f"Testing {url}...")
            response = requests.get(self.base_url, params=params, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            return self._parse_results(data)
            
        except requests.exceptions.RequestException as e:
            print(f"Error testing {url}: {str(e)}")
            return None
    
    def _parse_results(self, data):
        """Parse the PageSpeed API response"""
        try:
            lighthouse = data.get('lighthouseResult', {})
            categories = lighthouse.get('categories', {})
            audits = lighthouse.get('audits', {})
            
            result = {
                'performance_score': categories.get('performance', {}).get('score', 0) * 100 if categories.get('performance', {}).get('score') is not None else None,
                'accessibility_score': categories.get('accessibility', {}).get('score', 0) * 100 if categories.get('accessibility', {}).get('score') is not None else None,
                'best_practices_score': categories.get('best-practices', {}).get('score', 0) * 100 if categories.get('best-practices', {}).get('score') is not None else None,
                'seo_score': categories.get('seo', {}).get('score', 0) * 100 if categories.get('seo', {}).get('score') is not None else None,
            }
            
            # Core Web Vitals and other metrics
            metrics = audits.get('metrics', {}).get('details', {}).get('items', [{}])[0]
            
            result['fcp'] = metrics.get('firstContentfulPaint')  # First Contentful Paint (ms)
            result['lcp'] = metrics.get('largestContentfulPaint')  # Largest Contentful Paint (ms)
            result['cls'] = audits.get('cumulative-layout-shift', {}).get('numericValue')  # Cumulative Layout Shift
            result['tti'] = metrics.get('interactive')  # Time to Interactive (ms)
            result['tbt'] = metrics.get('totalBlockingTime')  # Total Blocking Time (ms)
            result['speed_index'] = metrics.get('speedIndex')  # Speed Index (ms)
            
            # Additional Web Vitals
            result['inp'] = audits.get('interaction-to-next-paint', {}).get('numericValue')  # Interaction to Next Paint (ms)
            
            # Server metrics
            result['ttfb'] = audits.get('server-response-time', {}).get('numericValue')  # Time to First Byte (ms)
            
            # Page size (total transfer size in bytes)
            result['total_byte_weight'] = audits.get('total-byte-weight', {}).get('numericValue')  # Total page size (bytes)
            
            # Store raw data for reference
            result['raw_data'] = {
                'fetch_time': data.get('analysisUTCTimestamp'),
                'final_url': lighthouse.get('finalUrl'),
            }
            
            return result
            
        except Exception as e:
            print(f"Error parsing results: {str(e)}")
            return None
    
    def test_multiple_urls(self, urls, strategy='mobile', delay=1):
        """
        Test multiple URLs with a delay between requests
        
        Args:
            urls: List of URLs to test
            strategy: 'mobile' or 'desktop'
            delay: Seconds to wait between requests (to respect rate limits)
        
        Returns:
            dict: Results keyed by URL
        """
        results = {}
        
        for i, url in enumerate(urls):
            results[url] = self.test_url(url, strategy)
            
            # Add delay between requests (except after the last one)
            if i < len(urls) - 1 and delay > 0:
                time.sleep(delay)
        
        return results
