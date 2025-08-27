from typing import Dict, Any
from app.models.mower import MaintenanceSchedule
from datetime import datetime, timedelta


class MowerUtils:
    @staticmethod
    def calculate_hours_overdue(
        total_hours: int, last_hours: int, interval_hours: int
    ) -> int:
        """Calculate hours overdue for maintenance."""
        return total_hours - last_hours - interval_hours

    @staticmethod
    def format_maintenance_due_item(
        schedule: MaintenanceSchedule, hours_overdue: int
    ) -> Dict[str, Any]:
        """Format a maintenance schedule into a due item."""
        return {
            "schedule_id": schedule.id,
            "maintenance_type": schedule.maintenance_type.value,
            "custom_name": schedule.custom_name,
            "hours_overdue": hours_overdue,
            "is_overdue": True,
        }

    @staticmethod
    def validate_maintenance_interval(
        interval_hours: int, interval_months: int
    ) -> bool:
        """Validate that at least one interval is specified."""
        return interval_hours > 0 or interval_months > 0

    @staticmethod
    def calculate_next_maintenance_date(
        last_maintenance_date: datetime, interval_months: int
    ) -> datetime:
        """Calculate the next maintenance date based on interval months."""
        if not last_maintenance_date or interval_months <= 0:
            return None
        return last_maintenance_date + timedelta(days=interval_months * 30)

    @staticmethod
    def build_mower_response_dict(
        mower: Any, total_hours: int, maintenance_due: list
    ) -> Dict[str, Any]:
        """Build a mower response dictionary with calculated fields."""
        return {
            **mower.__dict__,
            "total_hours": total_hours,
            "next_maintenance_due": maintenance_due,
        }
