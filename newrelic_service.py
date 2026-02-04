import requests
import json
import os


class NewRelicService:
    """Service class for interacting with New Relic's NerdGraph API"""

    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv('NEWRELIC_API_KEY')
        self.endpoint = 'https://api.newrelic.com/graphql'

    def execute_query(self, query):
        """
        Execute a GraphQL query against New Relic's NerdGraph API

        Args:
            query (str): GraphQL query string

        Returns:
            dict: Parsed JSON response from New Relic
        """
        if not self.api_key:
            return {'error': 'New Relic API key not configured'}

        headers = {
            'Content-Type': 'application/json',
            'API-Key': self.api_key
        }

        payload = {
            'query': query
        }

        try:
            response = requests.post(
                self.endpoint,
                headers=headers,
                json=payload,
                timeout=30
            )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            return {'error': 'Request to New Relic API timed out'}
        except requests.exceptions.RequestException as e:
            return {'error': f'Error calling New Relic API: {str(e)}'}
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON response from New Relic'}

    def get_core_web_vitals(self, account_id, app_name, page_url, time_range='30 minutes ago'):
        """
        Get Core Web Vitals metrics for a specific page

        Args:
            account_id (int): New Relic account ID
            app_name (str): Application name in New Relic
            page_url (str): Full page URL to query
            time_range (str): NRQL time range (e.g., '30 minutes ago', '1 hour ago')

        Returns:
            dict: Metrics data including LCP, CLS, Page Load, etc.
        """
        # Extract the targetGroupedUrl from the full URL
        # For https://www.lampsplus.com/ -> www.lampsplus.com:443/
        from urllib.parse import urlparse
        parsed = urlparse(page_url)
        port = parsed.port if parsed.port else (443 if parsed.scheme == 'https' else 80)
        target_grouped_url = f"{parsed.netloc}:{port}{parsed.path}"

        print(
            f"DEBUG: Querying for app_name='{app_name}', target_grouped_url='{target_grouped_url}', page_url='{page_url}'")

        query = f"""
        {{
          actor {{
            account(id: {account_id}) {{
              lcp: nrql(query: "FROM PageViewTiming SELECT percentile(largestContentfulPaint * 1000, 50, 75, 90) AS LCP_ms WHERE appName = '{app_name}' AND targetGroupedUrl = '{target_grouped_url}' AND timingName = 'largestContentfulPaint' SINCE {time_range}") {{ results }}
              cls: nrql(query: "FROM PageViewTiming SELECT percentile(cumulativeLayoutShift, 50, 75, 90) AS CLS WHERE appName = '{app_name}' AND targetGroupedUrl = '{target_grouped_url}' AND timingName = 'windowLoad' SINCE {time_range}") {{ results }}
              pageLoad: nrql(query: "FROM PageView SELECT percentile(duration, 50, 75, 90) AS PageLoad_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              backend: nrql(query: "FROM PageView SELECT percentile(backendDuration, 50, 75, 90) AS Backend_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              frontend: nrql(query: "FROM PageView SELECT percentile(domProcessingDuration + pageRenderingDuration, 50, 75, 90) AS Frontend_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              ttfbLike: nrql(query: "FROM PageView SELECT percentile(queueDuration + networkDuration, 50, 75, 90) AS TTFB_like_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              domProcessing: nrql(query: "FROM PageView SELECT percentile(domProcessingDuration, 50, 75, 90) AS DomProcessing_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              inpCollectionCheck: nrql(query: "FROM BrowserInteraction SELECT count(*) AS interactions WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
            }}
          }}
        }}
        """

        response = self.execute_query(query)

        print(f"DEBUG: Full New Relic response: {json.dumps(response, indent=2)}")

        if 'error' in response:
            return response

        # Parse and format the response
        try:
            account_data = response.get('data', {}).get('actor', {}).get('account', {})

            print(f"DEBUG: Account data keys: {list(account_data.keys())}")
            print(f"DEBUG: LCP results: {account_data.get('lcp', {}).get('results', [])}")

            # Extract metrics from the response
            metrics = {
                'lcp': self._extract_percentiles(account_data.get('lcp', {}).get('results', [])),
                'cls': self._extract_percentiles(account_data.get('cls', {}).get('results', [])),
                'pageLoad': self._extract_percentiles(account_data.get('pageLoad', {}).get('results', [])),
                'backend': self._extract_percentiles(account_data.get('backend', {}).get('results', [])),
                'frontend': self._extract_percentiles(account_data.get('frontend', {}).get('results', [])),
                'ttfbLike': self._extract_percentiles(account_data.get('ttfbLike', {}).get('results', [])),
                'domProcessing': self._extract_percentiles(account_data.get('domProcessing', {}).get('results', [])),
                'interactions': account_data.get('inpCollectionCheck', {}).get('results', [{}])[0].get('interactions',
                                                                                                       0)
            }

            return {
                'success': True,
                'metrics': metrics,
                'metadata': {
                    'account_id': account_id,
                    'app_name': app_name,
                    'page_url': page_url,
                    'time_range': time_range
                }
            }

        except (KeyError, IndexError, TypeError) as e:
            print(f"DEBUG: Error parsing response: {str(e)}")
            return {'error': f'Error parsing New Relic response: {str(e)}'}

    def _extract_percentiles(self, results):
        """
        Extract p50, p75, p90 values from NRQL results

        Args:
            results (list): NRQL results array

        Returns:
            dict: Dictionary with p50, p75, p90 keys
        """
        print(f"DEBUG _extract_percentiles: Input results = {results}")

        if not results or len(results) == 0:
            print("DEBUG: No results, returning None values")
            return {'p50': None, 'p75': None, 'p90': None}

        result = results[0]
        print(f"DEBUG: First result object = {result}")
        print(f"DEBUG: Result keys = {list(result.keys())}")

        # The result might have keys like 'percentile.50', 'percentile.75', etc.
        # or direct keys based on the AS clause
        p50 = None
        p75 = None
        p90 = None

        # Try to find the percentile values
        for key, value in result.items():
            print(f"DEBUG: Checking key '{key}' with value {value}")
            if 'percentile.50' in key.lower() or key.endswith('_ms') or key == 'CLS':
                p50 = value
                print(f"DEBUG: Set p50 = {value} from key '{key}'")
            if 'percentile.75' in key.lower():
                p75 = value
                print(f"DEBUG: Set p75 = {value} from key '{key}'")
            if 'percentile.90' in key.lower():
                p90 = value
                print(f"DEBUG: Set p90 = {value} from key '{key}'")

        # If we didn't find them with the above logic, try extracting by position
        # New Relic returns percentiles in order when using percentile(column, 50, 75, 90)
        keys = list(result.keys())
        if len(keys) >= 3:
            if p50 is None:
                p50 = result.get(keys[0])
                print(f"DEBUG: Set p50 = {p50} from position 0 (key '{keys[0]}')")
            if p75 is None:
                p75 = result.get(keys[1])
                print(f"DEBUG: Set p75 = {p75} from position 1 (key '{keys[1]}')")
            if p90 is None:
                p90 = result.get(keys[2])
                print(f"DEBUG: Set p90 = {p90} from position 2 (key '{keys[2]}')")

        final_result = {
            'p50': p50,
            'p75': p75,
            'p90': p90
        }
        print(f"DEBUG: Final percentiles result = {final_result}")
        return final_result

    def test_connection(self):
        """
        Test the connection to New Relic API

        Returns:
            dict: Success status and message
        """
        query = """
        {
          actor {
            user {
              email
              name
            }
          }
        }
        """

        response = self.execute_query(query)

        if 'error' in response:
            return {
                'success': False,
                'message': response['error']
            }

        try:
            user = response.get('data', {}).get('actor', {}).get('user', {})
            return {
                'success': True,
                'message': f'Connected as {user.get("name", "Unknown")} ({user.get("email", "Unknown")})'
            }
        except (KeyError, TypeError):
            return {
                'success': False,
                'message': 'Connected but could not retrieve user information'
            }