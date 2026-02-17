import json
from concurrent.futures import ThreadPoolExecutor, as_completed


class ClaudeService:
    """Service class for interacting with Anthropic's Claude API"""

    def __init__(self, api_key, model='claude-sonnet-4-20250514'):
        self.api_key = api_key
        self.model = model

    def analyze(self, system_prompt, user_message):
        """
        Send performance data to Claude for analysis.

        Args:
            system_prompt (str): System prompt defining the analyst role
            user_message (str): The formatted performance data

        Returns:
            dict: {'success': True, 'analysis': '...', 'model': '...', 'usage': {...}} or {'error': '...'}
        """
        if not self.api_key:
            return {'error': 'Claude API key not configured'}

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)

            message = client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )

            # Extract text from response content blocks
            analysis_text = ''
            for block in message.content:
                if block.type == 'text':
                    analysis_text += block.text

            return {
                'success': True,
                'analysis': analysis_text,
                'model': self.model,
                'usage': {
                    'input_tokens': message.usage.input_tokens,
                    'output_tokens': message.usage.output_tokens
                }
            }

        except anthropic.AuthenticationError:
            return {'error': 'Invalid Claude API key'}
        except anthropic.RateLimitError:
            return {'error': 'Claude API rate limit exceeded. Please try again shortly.'}
        except anthropic.APIError as e:
            return {'error': f'Claude API error: {str(e)}'}
        except Exception as e:
            return {'error': f'Error calling Claude API: {str(e)}'}

    def follow_up(self, system_prompt, messages):
        """
        Continue a multi-turn conversation with Claude.

        Args:
            system_prompt (str): The system prompt (same as initial analysis)
            messages (list): List of {"role": "user"|"assistant", "content": "..."} dicts

        Returns:
            dict: Same shape as analyze() return value
        """
        if not self.api_key:
            return {'error': 'Claude API key not configured'}

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)

            message = client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=messages
            )

            analysis_text = ''
            for block in message.content:
                if block.type == 'text':
                    analysis_text += block.text

            return {
                'success': True,
                'analysis': analysis_text,
                'model': self.model,
                'usage': {
                    'input_tokens': message.usage.input_tokens,
                    'output_tokens': message.usage.output_tokens
                }
            }

        except anthropic.AuthenticationError:
            return {'error': 'Invalid Claude API key'}
        except anthropic.RateLimitError:
            return {'error': 'Claude API rate limit exceeded. Please try again shortly.'}
        except anthropic.APIError as e:
            return {'error': f'Claude API error: {str(e)}'}
        except Exception as e:
            return {'error': f'Error calling Claude API: {str(e)}'}


class OpenAIService:
    """Service class for interacting with OpenAI's API"""

    def __init__(self, api_key, model='gpt-4o'):
        self.api_key = api_key
        self.model = model

    def analyze(self, system_prompt, user_message):
        """
        Send performance data to OpenAI for analysis.

        Args:
            system_prompt (str): System prompt defining the analyst role
            user_message (str): The formatted performance data

        Returns:
            dict: {'success': True, 'analysis': '...', 'model': '...', 'usage': {...}} or {'error': '...'}
        """
        if not self.api_key:
            return {'error': 'OpenAI API key not configured'}

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=4096,
                temperature=0.3
            )

            analysis_text = response.choices[0].message.content

            return {
                'success': True,
                'analysis': analysis_text,
                'model': self.model,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens
                }
            }

        except Exception as e:
            error_msg = str(e)
            if 'authentication' in error_msg.lower() or 'api key' in error_msg.lower():
                return {'error': 'Invalid OpenAI API key'}
            if 'rate limit' in error_msg.lower():
                return {'error': 'OpenAI API rate limit exceeded. Please try again shortly.'}
            return {'error': f'Error calling OpenAI API: {error_msg}'}

    def follow_up(self, system_prompt, messages):
        """
        Continue a multi-turn conversation with OpenAI.

        Args:
            system_prompt (str): The system prompt
            messages (list): List of {"role": "user"|"assistant", "content": "..."} dicts

        Returns:
            dict: Same shape as analyze() return value
        """
        if not self.api_key:
            return {'error': 'OpenAI API key not configured'}

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            # Prepend system message to conversation history
            full_messages = [{"role": "system", "content": system_prompt}] + messages

            response = client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                max_tokens=4096,
                temperature=0.3
            )

            analysis_text = response.choices[0].message.content

            return {
                'success': True,
                'analysis': analysis_text,
                'model': self.model,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens
                }
            }

        except Exception as e:
            error_msg = str(e)
            if 'authentication' in error_msg.lower() or 'api key' in error_msg.lower():
                return {'error': 'Invalid OpenAI API key'}
            if 'rate limit' in error_msg.lower():
                return {'error': 'OpenAI API rate limit exceeded. Please try again shortly.'}
            return {'error': f'Error calling OpenAI API: {error_msg}'}


def run_parallel_analysis(claude_service, openai_service, system_prompt, user_message):
    """
    Run Claude and OpenAI analysis in parallel using ThreadPoolExecutor.

    Args:
        claude_service: ClaudeService instance (or None to skip)
        openai_service: OpenAIService instance (or None to skip)
        system_prompt (str): The system prompt for both models
        user_message (str): The formatted data payload

    Returns:
        dict: {'claude': {...}, 'openai': {...}} with results from each
    """
    results = {'claude': None, 'openai': None}

    futures = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        if claude_service:
            futures[executor.submit(claude_service.analyze, system_prompt, user_message)] = 'claude'
        if openai_service:
            futures[executor.submit(openai_service.analyze, system_prompt, user_message)] = 'openai'

        for future in as_completed(futures):
            provider = futures[future]
            try:
                results[provider] = future.result()
            except Exception as e:
                results[provider] = {'error': f'Unexpected error from {provider}: {str(e)}'}

    return results


def run_parallel_followup(claude_service, openai_service, system_prompt,
                          claude_messages, openai_messages):
    """
    Run follow-up analysis in parallel for both providers.

    Args:
        claude_service: ClaudeService instance (or None)
        openai_service: OpenAIService instance (or None)
        system_prompt (str): The system prompt string
        claude_messages (list): Conversation history for Claude
        openai_messages (list): Conversation history for OpenAI

    Returns:
        dict: {'claude': {...}, 'openai': {...}}
    """
    results = {'claude': None, 'openai': None}

    futures = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        if claude_service and claude_messages:
            futures[executor.submit(
                claude_service.follow_up, system_prompt, claude_messages
            )] = 'claude'
        if openai_service and openai_messages:
            futures[executor.submit(
                openai_service.follow_up, system_prompt, openai_messages
            )] = 'openai'

        for future in as_completed(futures):
            provider = futures[future]
            try:
                results[provider] = future.result()
            except Exception as e:
                results[provider] = {'error': f'Unexpected error from {provider}: {str(e)}'}

    return results


def build_system_prompt():
    """Build the system prompt for AI performance analysis."""
    return """You are a senior web performance analyst examining monitoring data for an IIS/.NET e-commerce website. You have deep expertise in:
- IIS server configuration and performance tuning
- .NET application performance
- Core Web Vitals and frontend performance
- Database query optimization
- CDN and caching strategies

Analyze the provided performance data and produce a structured report with these sections:

## Summary
A 2-3 sentence executive summary of the overall health of this URL/page.

## Key Issues
Bullet points identifying the most significant performance problems, ranked by impact. Reference specific metrics and thresholds.

## Recommendations
Actionable steps to improve performance, ordered by expected impact. Be specific to IIS/.NET where relevant (e.g., output caching, connection pooling, async handlers).

## Anomalies
Any unusual patterns, spikes, or inconsistencies in the data that warrant investigation.

Use markdown formatting. Be concise but thorough. Reference specific numbers from the data."""


def build_user_message(url, time_range, newrelic_data, iis_data):
    """
    Build the user message containing all collected performance data.

    Args:
        url (str): The URL path being analyzed
        time_range (str): The time range of the analysis
        newrelic_data (dict): Combined New Relic metrics (CWV, perf overview, APM)
        iis_data (dict): IIS log summary data from Azure

    Returns:
        str: Formatted data payload for the AI
    """
    sections = []
    sections.append("# Performance Analysis Request")
    sections.append(f"**URL:** {url}")
    sections.append(f"**Time Range:** {time_range}")
    sections.append("")

    # New Relic Core Web Vitals
    if newrelic_data.get('core_web_vitals'):
        sections.append("## New Relic: Core Web Vitals")
        sections.append(json.dumps(newrelic_data['core_web_vitals'], indent=2, default=str))
        sections.append("")

    # Note: performance_overview and apm_metrics are excluded from AI analysis
    # because they are app-wide data not filtered to the specific URL.

    # IIS Log data (filtered for the specific URL only)
    if iis_data.get('slow_requests'):
        sections.append("## IIS Logs: Requests for this URL")
        sections.append(json.dumps(iis_data['slow_requests'], indent=2, default=str))
        sections.append("")

    if not newrelic_data and not iis_data:
        sections.append("*No performance data was available from either source.*")

    return "\n".join(sections)
