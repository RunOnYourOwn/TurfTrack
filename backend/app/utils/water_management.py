from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import date, timedelta, datetime, timezone
from typing import Optional
import logging

from app.models.water_management import WeeklyWaterSummary, IrrigationEntry
from app.models.daily_weather import DailyWeather, WeatherType
from app.models.lawn import Lawn

logger = logging.getLogger(__name__)


def calculate_weekly_water_summary(
    session: Session, lawn_id: int, week_start: date, week_end: date
) -> Optional[WeeklyWaterSummary]:
    """
    Calculate weekly water summary for a specific lawn and week.
    Returns None if no data is available for the week.
    """
    # Get weather data for the week (from lawn's location)
    lawn = session.get(Lawn, lawn_id)
    if not lawn:
        logger.error(f"Lawn {lawn_id} not found")
        return None

    # Get weather data for the week (both historical and forecast)
    weather_query = select(DailyWeather).where(
        and_(
            DailyWeather.location_id == lawn.location_id,
            DailyWeather.date >= week_start,
            DailyWeather.date <= week_end,
            DailyWeather.type.in_(
                [WeatherType.historical.value, WeatherType.forecast.value]
            ),
        )
    )
    weather_data = session.execute(weather_query).scalars().all()

    if not weather_data:
        logger.warning(f"No weather data found for lawn {lawn_id} week {week_start}")
        return None

    # Check if any day in this week has forecast weather data
    # If any day in the week is forecast, the whole week is forecast
    has_forecast_data = any(w.type == WeatherType.forecast for w in weather_data)

    # Debug: Log forecast detection (can be removed once confirmed working)
    forecast_dates = [w.date for w in weather_data if w.type == WeatherType.forecast]
    if forecast_dates:
        logger.info(
            f"Week {week_start} to {week_end}: Found forecast data for dates {forecast_dates}, setting is_forecast=True"
        )
    else:
        logger.info(
            f"Week {week_start} to {week_end}: No forecast data found, setting is_forecast=False"
        )

    # Organize by date, prefer historical over forecast (same pattern as disease/gdd)
    weather_by_date = {}
    for w in weather_data:
        if w.date not in weather_by_date or w.type == WeatherType.historical.value:
            weather_by_date[w.date] = w

    # Calculate weather totals using organized data (preferring historical over forecast)
    et0_total = sum(
        day.et0_evapotranspiration_in or 0 for day in weather_by_date.values()
    )
    precipitation_total = sum(
        day.precipitation_in or 0 for day in weather_by_date.values()
    )

    # Get irrigation data for the week
    irrigation_query = select(IrrigationEntry).where(
        and_(
            IrrigationEntry.lawn_id == lawn_id,
            IrrigationEntry.date >= week_start,
            IrrigationEntry.date <= week_end,
        )
    )
    irrigation_data = session.execute(irrigation_query).scalars().all()

    # Calculate irrigation total
    irrigation_applied = sum(entry.amount for entry in irrigation_data)

    # Calculate water deficit
    water_deficit = et0_total - precipitation_total - irrigation_applied

    # Determine status
    if water_deficit <= 0:
        status = "excellent"
    elif water_deficit <= 0.5:
        status = "good"
    elif water_deficit <= 1.0:
        status = "warning"
    else:
        status = "critical"

    return WeeklyWaterSummary(
        lawn_id=lawn_id,
        week_start=week_start,
        week_end=week_end,
        et0_total=et0_total,
        precipitation_total=precipitation_total,
        irrigation_applied=irrigation_applied,
        water_deficit=water_deficit,
        status=status,
        is_forecast=has_forecast_data,
    )


def calculate_and_store_weekly_water_summaries(
    session: Session, lawn_id: int, start_date: date, end_date: date
) -> int:
    """
    Calculate and store weekly water summaries for a lawn over a date range.
    Includes both historical and forecast data, following the same pattern as GDD/disease calculations.
    Returns the number of summaries created/updated.
    """
    summaries_processed = 0

    # Generate all weeks in the range (including current week with forecast data)
    current_date = start_date
    while current_date <= end_date:
        # Calculate week start (Monday)
        days_since_monday = current_date.weekday()
        week_start = current_date - timedelta(days=days_since_monday)
        week_end = week_start + timedelta(days=6)

        # Skip if week_start is beyond our range
        if week_start > end_date:
            break

        # Check if summary already exists
        existing_summary = session.execute(
            select(WeeklyWaterSummary).where(
                and_(
                    WeeklyWaterSummary.lawn_id == lawn_id,
                    WeeklyWaterSummary.week_start == week_start,
                )
            )
        ).scalar_one_or_none()

        if existing_summary:
            # Update existing summary
            new_summary = calculate_weekly_water_summary(
                session, lawn_id, week_start, week_end
            )
            if new_summary:
                existing_summary.et0_total = new_summary.et0_total
                existing_summary.precipitation_total = new_summary.precipitation_total
                existing_summary.irrigation_applied = new_summary.irrigation_applied
                existing_summary.water_deficit = new_summary.water_deficit
                existing_summary.status = new_summary.status
                existing_summary.is_forecast = new_summary.is_forecast
                existing_summary.updated_at = datetime.now(timezone.utc)
                summaries_processed += 1
        else:
            # Create new summary
            new_summary = calculate_weekly_water_summary(
                session, lawn_id, week_start, week_end
            )
            if new_summary:
                session.add(new_summary)
                summaries_processed += 1

        # Move to next week
        current_date = week_start + timedelta(days=7)

    session.commit()
    logger.info(
        f"Processed {summaries_processed} weekly water summaries for lawn {lawn_id}"
    )
    return summaries_processed


def calculate_weekly_water_summaries_for_location(
    session: Session, location_id: int, start_date: date, end_date: date
) -> int:
    """
    Calculate weekly water summaries for all lawns at a location.
    Returns total number of summaries processed.
    """
    total_processed = 0

    # Get all lawns for this location
    lawns_query = select(Lawn).where(Lawn.location_id == location_id)
    lawns = session.execute(lawns_query).scalars().all()

    for lawn in lawns:
        try:
            processed = calculate_and_store_weekly_water_summaries(
                session, lawn.id, start_date, end_date
            )
            total_processed += processed
        except Exception as e:
            logger.error(
                f"Failed to calculate weekly summaries for lawn {lawn.id}: {e}"
            )
            continue

    logger.info(
        f"Processed {total_processed} weekly water summaries for location {location_id}"
    )
    return total_processed


def recalculate_weekly_water_summaries_for_lawn(session: Session, lawn_id: int) -> int:
    """
    Recalculate weekly water summaries for a lawn based on recent data.
    This is typically called when new irrigation entries are added.
    Uses an efficient range that covers the current week and recent weeks.
    """
    # Use an efficient range: 2 weeks ago to 2 weeks in future
    # This covers the current week and adjacent weeks that might be affected by irrigation changes
    today = date.today()
    start_date = today - timedelta(weeks=2)
    end_date = today + timedelta(weeks=2)

    logger.info(
        f"Recalculating weekly water summaries for lawn {lawn_id} from {start_date} to {end_date}"
    )

    return calculate_and_store_weekly_water_summaries(
        session, lawn_id, start_date, end_date
    )
