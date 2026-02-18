import requests
import time

class PageSpeedService:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.base_url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    
    def test_url(self, url, strategy='desktop'):
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
            response = requests.get(self.base_url, params=params, timeout=90)
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
            
            # Capture detailed audit data for analysis
            opportunities = []
            diagnostics = []
            passed_audits = []
            failed_audits = []
            
            # Get performance category audit refs
            perf_category = categories.get('performance', {})
            perf_audit_refs = perf_category.get('auditRefs', [])
            
            for audit_ref in perf_audit_refs:
                audit_id = audit_ref.get('id')
                audit_data = audits.get(audit_id, {})
                
                if not audit_data:
                    continue
                    
                audit_info = {
                    'id': audit_id,
                    'title': audit_data.get('title'),
                    'description': audit_data.get('description'),
                    'score': audit_data.get('score'),
                    'displayValue': audit_data.get('displayValue'),
                    'numericValue': audit_data.get('numericValue'),
                    'weight': audit_ref.get('weight', 0)
                }
                
                # Categorize audits
                if audit_data.get('details', {}).get('type') == 'opportunity':
                    # This is an optimization opportunity
                    savings = audit_data.get('details', {}).get('overallSavingsMs', 0)
                    if savings > 0:
                        audit_info['savingsMs'] = savings
                        opportunities.append(audit_info)
                elif audit_data.get('score') is not None:
                    if audit_data.get('score') < 1:
                        failed_audits.append(audit_info)
                    else:
                        passed_audits.append(audit_info)
                else:
                    # Diagnostic info
                    diagnostics.append(audit_info)
            
            # Sort opportunities by potential savings
            opportunities.sort(key=lambda x: x.get('savingsMs', 0), reverse=True)
            
            # Store raw data with detailed audits for reference
            result['raw_data'] = {
                'fetch_time': data.get('analysisUTCTimestamp'),
                'final_url': lighthouse.get('finalUrl'),
                'opportunities': opportunities[:10],  # Top 10 opportunities
                'failed_audits': failed_audits[:10],  # Top 10 failed audits
                'diagnostics': diagnostics[:5],  # Top 5 diagnostics
                'metric_weights': {
                    'fcp': next((ref.get('weight', 0) for ref in perf_audit_refs if ref.get('id') == 'first-contentful-paint'), 0),
                    'lcp': next((ref.get('weight', 0) for ref in perf_audit_refs if ref.get('id') == 'largest-contentful-paint'), 0),
                    'cls': next((ref.get('weight', 0) for ref in perf_audit_refs if ref.get('id') == 'cumulative-layout-shift'), 0),
                    'tbt': next((ref.get('weight', 0) for ref in perf_audit_refs if ref.get('id') == 'total-blocking-time'), 0),
                    'si': next((ref.get('weight', 0) for ref in perf_audit_refs if ref.get('id') == 'speed-index'), 0),
                }
            }
            
            return result
            
        except Exception as e:
            print(f"Error parsing results: {str(e)}")
            return None
    
    def test_multiple_urls(self, urls, strategy='desktop', delay=1):
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
