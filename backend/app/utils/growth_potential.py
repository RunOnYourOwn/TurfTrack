import math
from app.models.lawn import Lawn
from app.models.daily_weather import DailyWeather
from app.models.growth_potential import GrowthPotential
from sqlalchemy import and_, select
import logging


def calculate_growth_potential(temp_c: float, grass_type: str) -> float:
    """
    Calculate turfgrass growth potential (GP) for a given temperature and grass type.
    Args:
        temp_c (float): Average daily temperature in Celsius.
        grass_type (str): 'cold_season' or 'warm_season'.
    Returns:
        float: Growth potential (0 to 1).
    Raises:
        ValueError: If grass_type is not recognized.
    """
    if grass_type == "cold_season":
        t_opt, sigma = 20, 5.5
    elif grass_type == "warm_season":
        t_opt, sigma = 31, 7
    else:
        raise ValueError(f"Unknown grass type: {grass_type}")
    return math.exp(-0.5 * ((temp_c - t_opt) / sigma) ** 2)


def calculate_growth_potential_for_location(
    session, location_id: int, start_date, end_date
):
    """
    Calculate and upsert growth potential for a location over a date range.
    Uses the first lawn's grass_type for the location.
    Args:
        session: SQLAlchemy session
        location_id (int): Location ID
        start_date (date): Start date (inclusive)
        end_date (date): End date (inclusive)
    """
    logger = logging.getLogger(__name__)
    # Get first lawn for this location
    lawn = (
        session.execute(select(Lawn).where(Lawn.location_id == location_id))
        .scalars()
        .first()
    )
    if not lawn:
        logger.warning(f"No lawn found for location {location_id}, skipping GP calc.")
        return
    grass_type = lawn.grass_type.value
    # Get all weather records for this location/date range
    weather_q = session.execute(
        select(DailyWeather).where(
            and_(
                DailyWeather.location_id == location_id,
                DailyWeather.date >= start_date,
                DailyWeather.date <= end_date,
            )
        )
    )
    weather_records = weather_q.scalars().all()
    if not weather_records:
        logger.warning(
            f"No weather data for location {location_id} in range {start_date} to {end_date}"
        )
        return
    for weather in weather_records:
        # Use average daily temp (C)
        if (
            weather.temperature_max_c is not None
            and weather.temperature_min_c is not None
        ):
            avg_temp = (weather.temperature_max_c + weather.temperature_min_c) / 2
            try:
                gp = calculate_growth_potential(avg_temp, grass_type)
            except Exception as e:
                logger.error(
                    f"GP calc error for loc {location_id} date {weather.date}: {e}"
                )
                gp = None
        else:
            gp = None
        # Upsert into growth_potential table
        existing = (
            session.execute(
                select(GrowthPotential).where(
                    and_(
                        GrowthPotential.location_id == location_id,
                        GrowthPotential.date == weather.date,
                    )
                )
            )
            .scalars()
            .first()
        )
        if existing:
            existing.growth_potential = gp
        else:
            session.add(
                GrowthPotential(
                    location_id=location_id,
                    date=weather.date,
                    growth_potential=gp,
                )
            )
    session.commit()
    logger.info(
        f"Growth potential calculated for location {location_id} from {start_date} to {end_date}."
    )

    # After raw values are committed, calculate rolling averages
    gps = (
        session.execute(
            select(GrowthPotential)
            .where(
                GrowthPotential.location_id == location_id,
                GrowthPotential.date >= start_date,
                GrowthPotential.date <= end_date,
            )
            .order_by(GrowthPotential.date)
        )
        .scalars()
        .all()
    )

    def rolling_avg(values, window):
        result = []
        for i in range(len(values)):
            window_vals = [
                v for v in values[max(0, i - window + 1) : i + 1] if v is not None
            ]
            avg = sum(window_vals) / len(window_vals) if window_vals else None
            result.append(avg)
        return result

    gp_values = [gp.growth_potential for gp in gps]
    gp_3d = rolling_avg(gp_values, 3)
    gp_5d = rolling_avg(gp_values, 5)
    gp_7d = rolling_avg(gp_values, 7)

    for i, gp in enumerate(gps):
        gp.gp_3d_avg = gp_3d[i]
        gp.gp_5d_avg = gp_5d[i]
        gp.gp_7d_avg = gp_7d[i]

    session.commit()
    logger.info(
        f"Rolling averages updated for location {location_id} from {start_date} to {end_date}."
    )
