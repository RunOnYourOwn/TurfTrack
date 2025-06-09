from sqlalchemy.ext.asyncio import AsyncSession
from app.models.location import Location
from sqlalchemy.future import select


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
    location = Location(latitude=latitude, longitude=longitude)
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location
