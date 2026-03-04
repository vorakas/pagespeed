"""Business logic for scheduled test triggers.

Orchestrates trigger CRUD, APScheduler job management, and trigger
execution.  Follows Single Responsibility: validation and scheduling
logic lives here; persistence is delegated to ``TriggerRepository``;
actual PageSpeed testing is delegated to ``TestingService``.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import TYPE_CHECKING

from config import (
    REQUEST_DELAY_SECONDS,
    SCHEDULE_PRESETS,
    TRIGGER_JOB_PREFIX,
)
from data_access.preset_repository import PresetRepository
from data_access.trigger_repository import TriggerRepository
from enums import TriggerStrategy
from exceptions import SchedulerError, ValidationError

if TYPE_CHECKING:
    from apscheduler.schedulers.background import BackgroundScheduler
    from services.testing_service import TestingService


class TriggerService:
    """Coordinates trigger lifecycle and APScheduler job synchronization.

    Single Responsibility: owns the business rules around trigger
    creation, validation, and scheduler integration.  Delegates
    persistence to ``TriggerRepository`` and test execution to
    ``TestingService``.

    Args:
        trigger_repo:    Repository for the ``scheduled_triggers`` table.
        preset_repo:     Repository for the ``schedule_presets`` table.
        testing_service: Service that runs PageSpeed tests.
        scheduler:       APScheduler ``BackgroundScheduler`` instance.
    """

    def __init__(
        self,
        trigger_repo: TriggerRepository,
        preset_repo: PresetRepository,
        testing_service: TestingService,
        scheduler: BackgroundScheduler,
    ) -> None:
        self._triggers: TriggerRepository = trigger_repo
        self._presets: PresetRepository = preset_repo
        self._testing: TestingService = testing_service
        self._scheduler: BackgroundScheduler = scheduler

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_scheduler_status(self) -> dict:
        """Return diagnostic information about the APScheduler state."""
        scheduler = self._scheduler
        jobs = scheduler.get_jobs()
        job_info = []
        for job in jobs:
            job_info.append({
                'id': job.id,
                'name': job.name,
                'next_run_time': str(job.next_run_time) if job.next_run_time else None,
                'trigger': str(job.trigger),
            })
        return {
            'scheduler_running': scheduler.running,
            'scheduler_class': type(scheduler).__name__,
            'timezone': str(getattr(scheduler, 'timezone', 'unknown')),
            'job_count': len(jobs),
            'jobs': job_info,
            'server_time_utc': datetime.utcnow().isoformat(),
        }

    def get_triggers(self) -> list[dict]:
        """Return all triggers with schedule label and URL details."""
        triggers = self._triggers.get_all()
        for trigger in triggers:
            trigger['schedule_label'] = self._get_schedule_label(
                trigger['schedule_type'], trigger['schedule_value'],
            )
        return triggers

    def get_trigger(self, trigger_id: int) -> dict | None:
        """Return a single trigger by id, or ``None``."""
        trigger = self._triggers.get_by_id(trigger_id)
        if trigger:
            trigger['schedule_label'] = self._get_schedule_label(
                trigger['schedule_type'], trigger['schedule_value'],
            )
        return trigger

    # ------------------------------------------------------------------
    # Preset operations
    # ------------------------------------------------------------------

    def get_all_presets(self) -> list[dict]:
        """Return merged list of built-in and user-created presets.

        Each item has: ``value`` (cron expression), ``label``,
        ``is_builtin`` (bool), and ``id`` (int or None for built-ins).
        Built-in presets appear first, then user-created presets.
        """
        merged: list[dict] = []

        # Built-in presets from config
        for key, config in SCHEDULE_PRESETS.items():
            cron_expression = self._preset_kwargs_to_cron(config)
            merged.append({
                'value': cron_expression,
                'label': config['label'],
                'is_builtin': True,
                'id': None,
            })

        # User-created presets from database
        user_presets = self._presets.get_all()
        for preset in user_presets:
            merged.append({
                'value': preset['cron_expression'],
                'label': preset['name'],
                'is_builtin': False,
                'id': preset['id'],
            })

        return merged

    def create_preset(self, name: str, cron_expression: str) -> int:
        """Create a new user schedule preset.

        Args:
            name:            Display name for the preset.
            cron_expression: 5-field cron expression string.

        Returns:
            The auto-generated id of the new preset.

        Raises:
            ValidationError: If name is empty, cron is invalid, or name
                             collides with a built-in preset label.
        """
        if not name or not name.strip():
            raise ValidationError("Preset name is required")

        name = name.strip()

        # Validate cron expression (5 fields)
        fields = cron_expression.strip().split()
        if len(fields) != 5:
            raise ValidationError(
                "Cron expression must have 5 fields "
                "(minute hour day month weekday)"
            )

        # Check collision with built-in preset labels
        builtin_labels = {
            config['label'].lower() for config in SCHEDULE_PRESETS.values()
        }
        if name.lower() in builtin_labels:
            raise ValidationError(
                f"Name '{name}' conflicts with a built-in preset"
            )

        preset_id = self._presets.create(name, cron_expression.strip())
        if preset_id is None:
            raise ValidationError(f"Preset name '{name}' already exists")

        return preset_id

    def delete_preset(self, preset_id: int) -> None:
        """Delete a user-created preset.

        Raises:
            ValidationError: If preset not found.
        """
        success = self._presets.delete(preset_id)
        if not success:
            raise ValidationError(f"Preset {preset_id} not found")

    @staticmethod
    def _preset_kwargs_to_cron(config: dict) -> str:
        """Convert APScheduler cron kwargs from a built-in preset to a
        5-field cron expression string.

        Args:
            config: Preset dict from ``SCHEDULE_PRESETS`` with APScheduler
                    kwargs (hour, minute, day_of_week, etc.) plus a label.

        Returns:
            5-field cron string: ``"minute hour day month day_of_week"``.
        """
        minute = str(config.get('minute', '*'))
        hour = str(config.get('hour', '*'))
        day = str(config.get('day', '*'))
        month = str(config.get('month', '*'))
        day_of_week = str(config.get('day_of_week', '*'))
        return f"{minute} {hour} {day} {month} {day_of_week}"

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def create_trigger(
        self,
        name: str,
        schedule_type: str,
        schedule_value: str,
        strategy: str,
        url_ids: list[int],
    ) -> int:
        """Create a new trigger, persist it, and register a scheduler job.

        Args:
            name:           Unique display name for the trigger.
            schedule_type:  ``'preset'`` or ``'custom'``.
            schedule_value: Preset key or cron expression string.
            strategy:       One of ``'desktop'``, ``'mobile'``, ``'both'``.
            url_ids:        List of URL ids to include in this trigger.

        Returns:
            The auto-generated id of the new trigger.

        Raises:
            ValidationError: If any input is invalid or name is duplicate.
        """
        self._validate_trigger_input(name, schedule_type, schedule_value, strategy, url_ids)

        trigger_id = self._triggers.create(
            name, schedule_type, schedule_value, strategy, url_ids,
        )
        if trigger_id is None:
            raise ValidationError(f"Trigger name '{name}' already exists")

        # Register the APScheduler job (trigger is enabled by default)
        trigger = self._triggers.get_by_id(trigger_id)
        self._add_job(trigger)

        return trigger_id

    def update_trigger(
        self,
        trigger_id: int,
        name: str,
        schedule_type: str,
        schedule_value: str,
        strategy: str,
        url_ids: list[int],
    ) -> None:
        """Update an existing trigger and reschedule its job.

        Raises:
            ValidationError: If trigger not found or input is invalid.
        """
        self._validate_trigger_input(name, schedule_type, schedule_value, strategy, url_ids)

        success = self._triggers.update(
            trigger_id, name, schedule_type, schedule_value, strategy, url_ids,
        )
        if not success:
            raise ValidationError(f"Trigger {trigger_id} not found or name already exists")

        # Reschedule: remove old job, add new one if still enabled
        self._remove_job(trigger_id)
        trigger = self._triggers.get_by_id(trigger_id)
        if trigger and trigger['enabled']:
            self._add_job(trigger)

    def delete_trigger(self, trigger_id: int) -> None:
        """Delete a trigger and remove its scheduler job.

        Raises:
            ValidationError: If trigger not found.
        """
        self._remove_job(trigger_id)
        success = self._triggers.delete(trigger_id)
        if not success:
            raise ValidationError(f"Trigger {trigger_id} not found")

    def toggle_trigger(self, trigger_id: int, enabled: bool) -> None:
        """Enable or disable a trigger and add/remove its scheduler job.

        Raises:
            ValidationError: If trigger not found.
        """
        success = self._triggers.set_enabled(trigger_id, enabled)
        if not success:
            raise ValidationError(f"Trigger {trigger_id} not found")

        if enabled:
            trigger = self._triggers.get_by_id(trigger_id)
            if trigger:
                self._add_job(trigger)
        else:
            self._remove_job(trigger_id)

    def run_now(self, trigger_id: int) -> None:
        """Manually execute a trigger immediately in a background thread.

        Validates that the trigger exists, then spawns a daemon thread
        to run the full execution pipeline without blocking the HTTP
        response.  The background thread updates ``last_run_at`` and
        ``last_run_status`` upon completion, just like a scheduled run.

        Raises:
            ValidationError: If the trigger does not exist.
        """
        trigger = self._triggers.get_by_id(trigger_id)
        if trigger is None:
            raise ValidationError(f"Trigger {trigger_id} not found")

        thread = threading.Thread(
            target=self._execute_trigger,
            args=(trigger_id,),
            daemon=True,
            name=f"run-now-trigger-{trigger_id}",
        )
        thread.start()

    # ------------------------------------------------------------------
    # Scheduler synchronization
    # ------------------------------------------------------------------

    def sync_all_jobs(self) -> None:
        """Restore APScheduler jobs for all enabled triggers.

        Called once during application startup (after ``scheduler.start()``)
        to ensure every enabled trigger has a corresponding job.
        """
        enabled_triggers = self._triggers.get_all_enabled()
        print(f"Syncing {len(enabled_triggers)} enabled trigger(s) to scheduler")

        for trigger in enabled_triggers:
            try:
                self._add_job(trigger)
                job = self._scheduler.get_job(f"{TRIGGER_JOB_PREFIX}{trigger['id']}")
                next_run = job.next_run_time if job else 'unknown'
                print(f"  → '{trigger['name']}' (cron: {trigger['schedule_value']}) next run: {next_run}")
            except SchedulerError as exc:
                print(f"Warning: failed to sync trigger '{trigger['name']}': {exc}")

    # ------------------------------------------------------------------
    # Private — scheduler job management
    # ------------------------------------------------------------------

    def _add_job(self, trigger: dict) -> None:
        """Register an APScheduler cron job for the given trigger."""
        job_id = f"{TRIGGER_JOB_PREFIX}{trigger['id']}"

        # Remove existing job if present (idempotent)
        self._remove_job(trigger['id'])

        try:
            cron_kwargs = self._build_cron_kwargs(
                trigger['schedule_type'], trigger['schedule_value'],
            )
            self._scheduler.add_job(
                func=self._execute_trigger,
                trigger='cron',
                id=job_id,
                args=[trigger['id']],
                name=f"Trigger: {trigger['name']}",
                **cron_kwargs,
            )
        except Exception as exc:
            raise SchedulerError(
                f"Failed to schedule trigger '{trigger['name']}': {exc}"
            ) from exc

    def _remove_job(self, trigger_id: int) -> None:
        """Remove an APScheduler job by trigger id (no-op if not found)."""
        job_id = f"{TRIGGER_JOB_PREFIX}{trigger_id}"
        try:
            self._scheduler.remove_job(job_id)
        except Exception:
            pass  # Job doesn't exist — that's fine

    # ------------------------------------------------------------------
    # Private — trigger execution (scheduler callback)
    # ------------------------------------------------------------------

    def _execute_trigger(self, trigger_id: int) -> None:
        """Scheduler callback: test all URLs for a trigger.

        Loads the trigger's URL ids and strategy from the database,
        then runs PageSpeed tests with appropriate delays.
        """
        trigger = self._triggers.get_by_id(trigger_id)
        if trigger is None:
            print(f"Trigger {trigger_id} not found — skipping execution")
            return

        if not trigger['enabled']:
            print(f"Trigger '{trigger['name']}' is disabled — skipping")
            return

        url_ids = trigger['url_ids']
        if not url_ids:
            print(f"Trigger '{trigger['name']}' has no URLs — skipping")
            return

        strategy = trigger['strategy']
        strategies = (
            ['desktop', 'mobile']
            if strategy == TriggerStrategy.BOTH
            else [strategy]
        )

        total_tests = len(url_ids) * len(strategies)
        successes = 0
        failures = 0

        print(
            f"Executing trigger '{trigger['name']}' "
            f"({len(url_ids)} URLs, strategy={strategy}) "
            f"at {datetime.now()}"
        )

        for current_strategy in strategies:
            for index, url_id in enumerate(url_ids):
                try:
                    url_data = self._get_url_by_id(url_id)
                    if url_data is None:
                        print(f"  URL id {url_id} not found — skipping")
                        failures += 1
                        continue

                    self._testing.test_single_url(
                        url=url_data['url'],
                        url_id=url_id,
                        strategy=current_strategy,
                    )
                    print(f"  Tested {url_data['url']} ({current_strategy})")
                    successes += 1
                except Exception as exc:
                    print(f"  Failed to test URL id {url_id}: {exc}")
                    failures += 1

                # Rate-limit delay between tests
                if index < len(url_ids) - 1:
                    time.sleep(REQUEST_DELAY_SECONDS)

            # Delay between strategy passes when running 'both'
            if len(strategies) > 1 and current_strategy == 'desktop':
                time.sleep(REQUEST_DELAY_SECONDS)

        # Record execution result
        if failures == 0:
            run_status = 'success'
        elif successes == 0:
            run_status = 'failed'
        else:
            run_status = 'partial'

        self._triggers.set_last_run(trigger_id, run_status)
        print(
            f"Trigger '{trigger['name']}' completed: "
            f"{successes}/{total_tests} succeeded — {run_status}"
        )

    def _get_url_by_id(self, url_id: int) -> dict | None:
        """Retrieve a URL record by id using the testing service's repository."""
        # Access the URL repository through the testing service's injected dependency
        urls_repo = self._testing._urls
        ph = urls_repo._cm._placeholder()
        with urls_repo._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM urls WHERE id = {ph}", (url_id,),
            )
            return urls_repo._cm._row_to_dict(cursor)

    # ------------------------------------------------------------------
    # Private — schedule helpers
    # ------------------------------------------------------------------

    def _build_cron_kwargs(
        self, schedule_type: str, schedule_value: str,
    ) -> dict:
        """Convert schedule config to APScheduler cron trigger kwargs.

        Args:
            schedule_type:  ``'preset'`` or ``'custom'``.
            schedule_value: Preset key or 5-field cron expression.

        Returns:
            Dict of APScheduler cron keyword arguments.

        Raises:
            ValidationError: If the schedule is invalid.
        """
        if schedule_type == 'preset':
            preset = SCHEDULE_PRESETS.get(schedule_value)
            if not preset:
                raise ValidationError(f"Unknown schedule preset: {schedule_value}")
            # Copy without the 'label' key
            return {k: v for k, v in preset.items() if k != 'label'}

        if schedule_type == 'custom':
            return self._parse_cron_expression(schedule_value)

        raise ValidationError(f"Unknown schedule type: {schedule_type}")

    @staticmethod
    def _parse_cron_expression(expression: str) -> dict:
        """Parse a 5-field cron expression into APScheduler kwargs.

        Format: ``minute hour day_of_month month day_of_week``

        Standard cron uses 0=Sunday for day_of_week, but APScheduler uses
        0=Monday (ISO weekday).  This method converts automatically so
        users can write standard cron expressions.

        Examples:
            ``0 2 * * *``   → daily at 2:00 AM
            ``*/30 * * * *`` → every 30 minutes
            ``0 6 * * 1``   → weekly on Monday at 6:00 AM

        Returns:
            Dict with keys: minute, hour, day, month, day_of_week.

        Raises:
            ValidationError: If the expression doesn't have 5 fields.
        """
        fields = expression.strip().split()
        if len(fields) != 5:
            raise ValidationError(
                f"Cron expression must have 5 fields (minute hour day month weekday), "
                f"got {len(fields)}: '{expression}'"
            )

        day_of_week = TriggerService._convert_cron_dow(fields[4])

        return {
            'minute': fields[0],
            'hour': fields[1],
            'day': fields[2],
            'month': fields[3],
            'day_of_week': day_of_week,
        }

    @staticmethod
    def _convert_cron_dow(field: str) -> str:
        """Convert standard-cron day-of-week to APScheduler convention.

        Standard cron: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
        APScheduler:   0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

        Handles wildcards (``*``), steps (``*/2``), ranges (``1-5``),
        lists (``1,3,5``), and named days (``mon,wed`` — passed through).
        """
        if field == '*' or '/' in field:
            # Wildcards and step expressions work the same in both systems
            # for common patterns like */2. Pass through as-is.
            return field

        # Named days (mon, tue, etc.) — no conversion needed
        if any(c.isalpha() for c in field):
            return field

        # Convert each number: standard (0=Sun) → APScheduler (0=Mon, 6=Sun)
        # Formula: sun(0/7)→6, mon(1)→0, tue(2)→1, ... sat(6)→5
        _CRON_TO_APSCHEDULER = {
            '0': '6', '1': '0', '2': '1', '3': '2',
            '4': '3', '5': '4', '6': '5', '7': '6',
        }

        parts = []
        for segment in field.split(','):
            if '-' in segment:
                # Range like "1-5" → convert both ends
                start, end = segment.split('-', 1)
                start = _CRON_TO_APSCHEDULER.get(start, start)
                end = _CRON_TO_APSCHEDULER.get(end, end)
                parts.append(f"{start}-{end}")
            else:
                parts.append(_CRON_TO_APSCHEDULER.get(segment, segment))

        return ','.join(parts)

    @staticmethod
    def _get_schedule_label(schedule_type: str, schedule_value: str) -> str:
        """Return a human-readable label for a schedule configuration."""
        if schedule_type == 'preset':
            preset = SCHEDULE_PRESETS.get(schedule_value)
            if preset:
                return preset['label']
            return schedule_value
        return f"Custom: {schedule_value}"

    # ------------------------------------------------------------------
    # Private — validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_trigger_input(
        name: str,
        schedule_type: str,
        schedule_value: str,
        strategy: str,
        url_ids: list[int],
    ) -> None:
        """Validate all trigger creation/update inputs.

        Raises:
            ValidationError: If any input is invalid.
        """
        if not name or not name.strip():
            raise ValidationError("Trigger name is required")

        if schedule_type not in ('preset', 'custom'):
            raise ValidationError("Schedule type must be 'preset' or 'custom'")

        if not schedule_value or not schedule_value.strip():
            raise ValidationError("Schedule value is required")

        if schedule_type == 'preset' and schedule_value not in SCHEDULE_PRESETS:
            raise ValidationError(f"Unknown schedule preset: {schedule_value}")

        if schedule_type == 'custom':
            fields = schedule_value.strip().split()
            if len(fields) != 5:
                raise ValidationError(
                    "Custom cron expression must have 5 fields "
                    "(minute hour day month weekday)"
                )

        valid_strategies = {s.value for s in TriggerStrategy}
        if strategy not in valid_strategies:
            raise ValidationError(
                f"Strategy must be one of: {', '.join(valid_strategies)}"
            )

        if not url_ids:
            raise ValidationError("At least one URL must be selected")
