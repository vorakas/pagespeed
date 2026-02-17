import requests
import json
from datetime import datetime, timedelta


class AzureLogAnalyticsService:
    """Service class for interacting with Azure Monitor Log Analytics REST API"""

    def __init__(self, tenant_id, client_id, client_secret, workspace_id):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.workspace_id = workspace_id
        self.token = None
        self.token_expiry = None
        self.base_url = f'https://api.loganalytics.io/v1/workspaces/{workspace_id}/query'

    def _get_token(self):
        """Acquire an OAuth2 access token via client_credentials grant"""
        if self.token and self.token_expiry and datetime.now() < self.token_expiry:
            return self.token

        token_url = f'https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token'

        data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': 'https://api.loganalytics.io/.default'
        }

        try:
            response = requests.post(token_url, data=data, timeout=15)
            response.raise_for_status()
            token_data = response.json()

            self.token = token_data['access_token']
            expires_in = token_data.get('expires_in', 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 60)

            return self.token

        except requests.exceptions.RequestException as e:
            return {'error': f'Failed to acquire Azure token: {str(e)}'}
        except (KeyError, json.JSONDecodeError) as e:
            return {'error': f'Invalid token response from Azure: {str(e)}'}

    def execute_query(self, query, timespan=None):
        """
        Execute a KQL query against Azure Log Analytics

        Args:
            query (str): KQL query string
            timespan (str): Optional ISO 8601 duration (e.g., 'PT24H' for 24 hours)

        Returns:
            dict: Parsed JSON response or error dict
        """
        token = self._get_token()
        if isinstance(token, dict) and 'error' in token:
            return token

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        payload = {'query': query}
        if timespan:
            payload['timespan'] = timespan

        try:
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 403:
                return {'error': 'Access denied. Ensure the app registration has Log Analytics Reader role on the workspace.'}

            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout:
            return {'error': 'Request to Azure Log Analytics timed out'}
        except requests.exceptions.RequestException as e:
            return {'error': f'Error calling Azure Log Analytics: {str(e)}'}
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON response from Azure Log Analytics'}

    def _parse_table_response(self, response):
        """
        Convert Log Analytics tabular response to list of dicts

        Log Analytics returns: {"tables": [{"columns": [{"name": "col1", ...}], "rows": [[val1, val2, ...]]}]}
        """
        try:
            tables = response.get('tables', [])
            if not tables:
                return []

            table = tables[0]
            columns = [col['name'] for col in table.get('columns', [])]
            rows = table.get('rows', [])

            return [dict(zip(columns, row)) for row in rows]

        except (KeyError, IndexError, TypeError) as e:
            print(f"DEBUG: Error parsing table response: {str(e)}")
            return []

    def test_connection(self):
        """
        Test connectivity to the Log Analytics workspace and check for IIS log data

        Returns:
            dict: Success status and message
        """
        # First try querying the W3CIISLog table
        response = self.execute_query('W3CIISLog | take 1 | project TimeGenerated, sSiteName')

        if isinstance(response, dict) and 'error' in response:
            # If W3CIISLog fails, try a generic workspace query
            fallback = self.execute_query('Heartbeat | take 1')
            if isinstance(fallback, dict) and 'error' in fallback:
                return {
                    'success': False,
                    'message': f'Could not connect to workspace: {response["error"]}'
                }
            else:
                return {
                    'success': True,
                    'message': 'Connected to workspace, but W3CIISLog table was not found. IIS logs may not be configured.',
                    'warning': True
                }

        rows = self._parse_table_response(response)
        if len(rows) > 0:
            site_name = rows[0].get('sSiteName', 'Unknown')
            return {
                'success': True,
                'message': f'Connected to workspace. Found IIS log data (site: {site_name}).'
            }
        else:
            return {
                'success': True,
                'message': 'Connected to workspace. W3CIISLog table exists but no recent data found.'
            }

    def search_logs(self, start_date, end_date, url_filter=None, status_code=None, site_name=None, limit=100):
        """
        Search and filter IIS logs

        Args:
            start_date (str): Start datetime in ISO format
            end_date (str): End datetime in ISO format
            url_filter (str): Optional URL path filter (contains match)
            status_code (str): Optional status code filter (e.g., '4' for 4xx, '200' for exact)
            site_name (str): Optional IIS site name filter
            limit (int): Max number of rows to return

        Returns:
            dict: Search results with parsed log entries
        """
        # Build KQL query with filters
        filters = [
            f"TimeGenerated between (datetime('{start_date}') .. datetime('{end_date}'))",
            "csUriStem !endswith '.css'",
            "csUriStem !endswith '.js'",
            "csUriStem !endswith '.png'",
            "csUriStem !endswith '.jpg'",
            "csUriStem !endswith '.gif'",
            "csUriStem !endswith '.ico'",
            "csUriStem !endswith '.woff'",
            "csUriStem !endswith '.woff2'",
            "csUriStem !endswith '.svg'",
            "csUriStem !endswith '.map'"
        ]

        if url_filter:
            filters.append(f"csUriStem contains '{url_filter}'")

        if status_code:
            if len(status_code) == 1:
                # Filter by status class (e.g., '4' matches 4xx)
                filters.append(f"scStatus startswith '{status_code}'")
            else:
                filters.append(f"scStatus == '{status_code}'")

        if site_name:
            filters.append(f"sSiteName == '{site_name}'")

        where_clause = '\n| where '.join(filters)

        query = f"""W3CIISLog
| where {where_clause}
| project TimeGenerated, csMethod, csUriStem, csUriQuery, scStatus, TimeTaken, cIP, sSiteName, scBytes
| order by TimeGenerated desc
| take {limit}"""

        print(f"DEBUG: IIS search query: {query}")

        response = self.execute_query(query)

        if isinstance(response, dict) and 'error' in response:
            return response

        rows = self._parse_table_response(response)

        return {
            'success': True,
            'logs': rows,
            'count': len(rows),
            'metadata': {
                'start_date': start_date,
                'end_date': end_date,
                'url_filter': url_filter,
                'status_code': status_code,
                'limit': limit
            }
        }

    def get_dashboard_summary(self, start_date, end_date, site_name=None):
        """
        Get aggregated dashboard summary stats

        Args:
            start_date (str): Start datetime in ISO format
            end_date (str): End datetime in ISO format
            site_name (str): Optional IIS site name filter

        Returns:
            dict: Summary stats, top pages, and status code distribution
        """
        time_filter = f"TimeGenerated between (datetime('{start_date}') .. datetime('{end_date}'))"
        site_filter = f'| where sSiteName == "{site_name}"' if site_name else ''
        static_filter = """csUriStem !endswith ".css" and csUriStem !endswith ".js" and csUriStem !endswith ".png" and csUriStem !endswith ".jpg" and csUriStem !endswith ".gif" and csUriStem !endswith ".ico" and csUriStem !endswith ".woff" and csUriStem !endswith ".woff2" and csUriStem !endswith ".svg" and csUriStem !endswith ".map" """

        # Query 1: Summary stats
        summary_query = f"""W3CIISLog
| where {time_filter}
{site_filter}
| where {static_filter}
| summarize
    TotalRequests = count(),
    ErrorCount4xx = countif(scStatus startswith "4"),
    ErrorCount5xx = countif(scStatus startswith "5"),
    AvgTimeTaken = avg(TimeTaken),
    P50TimeTaken = percentile(TimeTaken, 50),
    P90TimeTaken = percentile(TimeTaken, 90),
    P99TimeTaken = percentile(TimeTaken, 99),
    MaxTimeTaken = max(TimeTaken)"""

        # Query 2: Top pages
        top_pages_query = f"""W3CIISLog
| where {time_filter}
{site_filter}
| where {static_filter}
| summarize RequestCount = count(), AvgTimeTaken = avg(TimeTaken) by csUriStem
| order by RequestCount desc
| take 10"""

        # Query 3: Status code distribution
        status_query = f"""W3CIISLog
| where {time_filter}
{site_filter}
| summarize Count = count() by scStatus
| order by Count desc
| take 20"""

        # Execute all three queries
        summary_resp = self.execute_query(summary_query)
        if isinstance(summary_resp, dict) and 'error' in summary_resp:
            return summary_resp

        top_pages_resp = self.execute_query(top_pages_query)
        if isinstance(top_pages_resp, dict) and 'error' in top_pages_resp:
            return top_pages_resp

        status_resp = self.execute_query(status_query)
        if isinstance(status_resp, dict) and 'error' in status_resp:
            return status_resp

        # Parse results
        summary_rows = self._parse_table_response(summary_resp)
        top_pages = self._parse_table_response(top_pages_resp)
        status_dist = self._parse_table_response(status_resp)

        # Extract summary (single row)
        summary = {}
        if summary_rows and len(summary_rows) > 0:
            s = summary_rows[0]
            summary = {
                'totalRequests': s.get('TotalRequests', 0),
                'errorCount4xx': s.get('ErrorCount4xx', 0),
                'errorCount5xx': s.get('ErrorCount5xx', 0),
                'avgTimeTaken': round(s.get('AvgTimeTaken', 0) or 0, 1),
                'p50TimeTaken': round(s.get('P50TimeTaken', 0) or 0, 1),
                'p90TimeTaken': round(s.get('P90TimeTaken', 0) or 0, 1),
                'p99TimeTaken': round(s.get('P99TimeTaken', 0) or 0, 1),
                'maxTimeTaken': round(s.get('MaxTimeTaken', 0) or 0, 1)
            }

        # Format top pages
        formatted_top_pages = []
        for p in top_pages:
            formatted_top_pages.append({
                'url': p.get('csUriStem', 'Unknown'),
                'requestCount': p.get('RequestCount', 0),
                'avgTimeTaken': round(p.get('AvgTimeTaken', 0) or 0, 1)
            })

        # Format status distribution
        formatted_status = []
        total_for_pct = sum(s.get('Count', 0) for s in status_dist)
        for s in status_dist:
            count = s.get('Count', 0)
            formatted_status.append({
                'statusCode': s.get('scStatus', 0),
                'count': count,
                'percentage': round((count / total_for_pct * 100) if total_for_pct > 0 else 0, 1)
            })

        return {
            'success': True,
            'summary': summary,
            'topPages': formatted_top_pages,
            'statusDistribution': formatted_status,
            'metadata': {
                'start_date': start_date,
                'end_date': end_date
            }
        }
