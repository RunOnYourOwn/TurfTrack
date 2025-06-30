from sqlalchemy.ext.asyncio import AsyncSession
from app.models.location import Location
from sqlalchemy.future import select
from app.models.lawn import Lawn


async def get_or_create_location(
    session: AsyncSession, latitude: float, longitude: float
) -> Location:
    result = await session.execute(
        select(Location).where(
            Location.latitude == latitude, Location.longitude == longitude
        )
    )
    location = result.scalars().first()
    if location:
        return location

    # Generate a name based on coordinates
    name = f"Location ({latitude:.4f}, {longitude:.4f})"
    location = Location(name=name, latitude=latitude, longitude=longitude)
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


async def cleanup_orphaned_location(db: AsyncSession, location_id: int) -> bool:
    """
    Clean up a location if no lawns are using it.

    Args:
        db: Database session
        location_id: ID of the location to check and potentially clean up

    Returns:
        bool: True if location was cleaned up, False if location still has lawns
    """
    # Check if any lawns still use this location
    result = await db.execute(select(Lawn).where(Lawn.location_id == location_id))
    remaining_lawns = result.scalars().all()

    if not remaining_lawns:
        # Clean up location-related data
        from app.models.daily_weather import DailyWeather
        from app.models.task_status import TaskStatus

        # Delete weather data for this location
        await db.execute(
            DailyWeather.__table__.delete().where(
                DailyWeather.location_id == location_id
            )
        )

        # Delete task status records for this location
        await db.execute(
            TaskStatus.__table__.delete().where(
                TaskStatus.related_location_id == location_id
            )
        )

        # Delete the location
        location = await db.get(Location, location_id)
        if location:
            await db.delete(location)

        await db.commit()
        return True  # Location was cleaned up
    return False  # Location still has lawns
