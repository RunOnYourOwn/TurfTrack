from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any
from app.models.mower import (
    Mower,
    MowingLog,
    MaintenanceSchedule,
    MaintenanceLog,
)
from app.schemas.mower import MaintenanceDueItem


class MowerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_total_hours(self, mower_id: int) -> int:
        """Calculate total hours from mowing logs for a mower."""
        result = await self.db.execute(
            select(MowingLog.duration_minutes).where(MowingLog.mower_id == mower_id)
        )
        mowing_minutes = result.scalars().all()
        return sum(minutes for minutes in mowing_minutes) // 60

    async def calculate_maintenance_due(
        self, mower_id: int
    ) -> List[MaintenanceDueItem]:
        """Calculate maintenance due items for a mower."""
        total_hours = await self.calculate_total_hours(mower_id)

        result = await self.db.execute(
            select(MaintenanceSchedule).where(
                MaintenanceSchedule.mower_id == mower_id,
                MaintenanceSchedule.is_active == True,
            )
        )
        maintenance_schedules = result.scalars().all()

        maintenance_due_items = []
        for schedule in maintenance_schedules:
            hours_overdue = (
                total_hours - schedule.last_maintenance_hours - schedule.interval_hours
            )
            if hours_overdue > 0:
                maintenance_due_items.append(
                    {
                        "schedule_id": schedule.id,
                        "maintenance_type": schedule.maintenance_type.value,
                        "custom_name": schedule.custom_name,
                        "hours_overdue": hours_overdue,
                        "is_overdue": True,
                    }
                )

        return maintenance_due_items

    async def get_mower_with_calculations(self, mower_id: int) -> Dict[str, Any]:
        """Get a mower with calculated total hours and maintenance due information."""
        result = await self.db.execute(
            select(Mower)
            .options(selectinload(Mower.location))
            .where(Mower.id == mower_id)
        )
        mower = result.scalars().first()

        if not mower:
            return None

        total_hours = await self.calculate_total_hours(mower_id)
        maintenance_due = await self.calculate_maintenance_due(mower_id)

        return {
            **mower.__dict__,
            "total_hours": total_hours,
            "next_maintenance_due": maintenance_due,
        }

    async def get_all_mowers_with_calculations(self) -> List[Dict[str, Any]]:
        """Get all mowers with calculated total hours and maintenance due information."""
        result = await self.db.execute(
            select(Mower).options(selectinload(Mower.location)).order_by(Mower.name)
        )
        mowers = result.scalars().all()

        mowers_with_calculations = []
        for mower in mowers:
            total_hours = await self.calculate_total_hours(mower.id)
            maintenance_due = await self.calculate_maintenance_due(mower.id)

            mower_dict = {
                **mower.__dict__,
                "total_hours": total_hours,
                "next_maintenance_due": maintenance_due,
            }
            mowers_with_calculations.append(mower_dict)

        return mowers_with_calculations

    async def update_maintenance_schedule_after_log(
        self, mower_id: int, maintenance_type: str
    ) -> None:
        """Update maintenance schedule after a maintenance log is created/updated/deleted."""
        # Find all maintenance schedules for this mower with the same maintenance type
        schedules_result = await self.db.execute(
            select(MaintenanceSchedule).where(
                MaintenanceSchedule.mower_id == mower_id,
                MaintenanceSchedule.maintenance_type == maintenance_type,
                MaintenanceSchedule.is_active == True,
            )
        )
        affected_schedules = schedules_result.scalars().all()

        for schedule in affected_schedules:
            # Find the most recent maintenance log for this schedule type
            recent_log_result = await self.db.execute(
                select(MaintenanceLog)
                .where(
                    MaintenanceLog.mower_id == mower_id,
                    MaintenanceLog.maintenance_type == maintenance_type,
                )
                .order_by(MaintenanceLog.hours_at_maintenance.desc())
            )
            recent_log = recent_log_result.scalars().first()

            if recent_log:
                # Update schedule with the most recent maintenance info
                schedule.last_maintenance_hours = recent_log.hours_at_maintenance
                schedule.last_maintenance_date = recent_log.maintenance_date
            else:
                # No more maintenance logs for this type, reset schedule
                schedule.last_maintenance_hours = 0
                schedule.last_maintenance_date = None

        await self.db.commit()
