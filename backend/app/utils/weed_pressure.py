from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.daily_weather import DailyWeather, WeatherType
from app.models.weed_pressure import (
    WeedSpecies,
    WeedPressure,
    WeedSeason,
)
from app.core.logging_config import log_performance_metric
import time
import logging

logger = logging.getLogger(__name__)


def calculate_daily_gdd(tmax_c: float, tmin_c: float, base_temp_c: float) -> float:
    """Calculate daily GDD for a given base temperature."""
    daily_avg = (tmax_c + tmin_c) / 2
    return max(0.0, daily_avg - base_temp_c)


def get_gdd_accumulated(
    session: Session, location_id: int, target_date: date, weed_species: WeedSpecies
) -> float:
    """Get accumulated GDD from January 1st to target date for a weed species."""
    # Start accumulation from January 1st of the target year
    jan_1 = target_date.replace(month=1, day=1)

    # Get all weather data from Jan 1 to target date
    weather_query = (
        select(DailyWeather)
        .where(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= jan_1,
            DailyWeather.date <= target_date,
        )
        .order_by(DailyWeather.date.asc())
    )

    weather_data = session.execute(weather_query).scalars().all()

    if not weather_data:
        return 0.0

    # Calculate accumulated GDD
    total_gdd = 0.0
    for weather in weather_data:
        daily_gdd = calculate_daily_gdd(
            weather.temperature_max_c,
            weather.temperature_min_c,
            weed_species.gdd_base_temp_c,
        )
        total_gdd += daily_gdd

    return total_gdd


def calculate_gdd_risk(gdd_accumulated: float, emergence_threshold: float) -> float:
    """Calculate GDD-based emergence risk score (0-3)."""
    if gdd_accumulated < emergence_threshold * 0.7:
        return 0.0  # Too early
    elif gdd_accumulated < emergence_threshold:
        return 1.0  # Approaching threshold
    elif gdd_accumulated < emergence_threshold * 1.3:
        return 2.0  # Peak emergence window
    else:
        return 3.0  # Past peak, but still risk


def estimate_soil_temp(session: Session, location_id: int, target_date: date) -> float:
    """Estimate soil temperature from air temperature with seasonal lag."""
    # Get 3-day average air temperature for stability
    start_date = target_date - timedelta(days=3)

    weather_query = select(
        func.avg(DailyWeather.temperature_max_c).label("avg_max"),
        func.avg(DailyWeather.temperature_min_c).label("avg_min"),
    ).where(
        DailyWeather.location_id == location_id,
        DailyWeather.date >= start_date,
        DailyWeather.date <= target_date,
    )

    result = session.execute(weather_query).first()
    if not result or result.avg_max is None or result.avg_min is None:
        return 0.0

    avg_air_temp = (result.avg_max + result.avg_min) / 2

    # Apply seasonal adjustment factors
    month = target_date.month
    if month in [3, 4, 5]:  # Spring
        factor = 0.8  # Soil cooler than air in spring
    elif month in [6, 7, 8]:  # Summer
        factor = 0.9  # Soil closer to air temp in summer
    else:  # Fall/Winter
        factor = 0.85  # Intermediate

    soil_temp = avg_air_temp * factor
    return soil_temp


def calculate_soil_temp_risk(soil_temp_c: float, weed_species: WeedSpecies) -> float:
    """Calculate soil temperature risk score (0-2)."""
    optimal_min = weed_species.optimal_soil_temp_min_c
    optimal_max = weed_species.optimal_soil_temp_max_c

    if soil_temp_c < optimal_min:
        return 0.0  # Too cold
    elif optimal_min <= soil_temp_c <= optimal_max:
        return 2.0  # Optimal range
    elif soil_temp_c <= optimal_max + 5:
        return 1.0  # Still acceptable
    else:
        return 0.0  # Too hot


def calculate_moisture_risk(
    session: Session, location_id: int, target_date: date
) -> float:
    """Calculate moisture risk score (0-2) based on precipitation and humidity."""
    # Get precipitation for last 3 days
    precip_start = target_date - timedelta(days=3)
    precip_query = select(func.sum(DailyWeather.precipitation_mm)).where(
        DailyWeather.location_id == location_id,
        DailyWeather.date >= precip_start,
        DailyWeather.date <= target_date,
    )
    recent_precip = session.execute(precip_query).scalar() or 0.0

    # Get average humidity for last 7 days
    humidity_start = target_date - timedelta(days=7)
    humidity_query = select(func.avg(DailyWeather.relative_humidity_mean)).where(
        DailyWeather.location_id == location_id,
        DailyWeather.date >= humidity_start,
        DailyWeather.date <= target_date,
        DailyWeather.relative_humidity_mean.isnot(None),
    )
    avg_humidity = session.execute(humidity_query).scalar() or 0.0

    # Score precipitation (0-1 point)
    precip_score = 0.0
    if recent_precip > 25:  # > 1 inch
        precip_score = 1.0
    elif recent_precip > 12:  # > 0.5 inch
        precip_score = 0.5

    # Score humidity (0-1 point)
    humidity_score = 0.0
    if avg_humidity > 80:
        humidity_score = 1.0
    elif avg_humidity > 70:
        humidity_score = 0.5

    return precip_score + humidity_score


def calculate_turf_stress(
    session: Session, location_id: int, target_date: date
) -> float:
    """Calculate turf stress score (0-2) based on growth potential and drought stress."""
    # Get current day's weather for ET0 and precipitation
    weather_query = select(DailyWeather).where(
        DailyWeather.location_id == location_id,
        DailyWeather.date == target_date,
    )
    weather = session.execute(weather_query).scalar_one_or_none()

    if not weather:
        return 0.0

    # Calculate drought stress (ET0 - precipitation)
    et0 = weather.et0_evapotranspiration_mm
    precip = weather.precipitation_mm
    drought_stress = max(0.0, et0 - precip)

    # Get growth potential (simplified - you may want to use your existing calculation)
    # For now, we'll estimate based on temperature
    avg_temp = (weather.temperature_max_c + weather.temperature_min_c) / 2
    growth_potential = max(0.0, min(1.0, (avg_temp - 5) / 25))  # Rough estimate

    # Score based on turf health
    stress_score = 0.0

    # Low growth potential = stressed turf
    if growth_potential < 0.3:
        stress_score += 1.0

    # High drought stress
    if drought_stress > 5:  # mm/day
        stress_score += 1.0

    return min(stress_score, 2.0)  # Cap at 2 points


def calculate_seasonal_timing(target_date: date, weed_species: WeedSpecies) -> float:
    """Calculate seasonal timing score (0-1)."""
    month = target_date.month

    if weed_species.season == WeedSeason.spring:
        if month in [3, 4, 5]:  # Spring months
            return 1.0
        else:
            return 0.0
    elif weed_species.season == WeedSeason.summer:
        if month in [6, 7, 8]:  # Summer months
            return 1.0
        else:
            return 0.0
    elif weed_species.season == WeedSeason.fall:
        if month in [9, 10, 11]:  # Fall months
            return 1.0
        else:
            return 0.0
    elif weed_species.season == WeedSeason.year_round:
        return 1.0  # Always relevant

    return 0.0


def calculate_weed_pressure_score(
    session: Session, location_id: int, target_date: date, weed_species: WeedSpecies
) -> dict:
    """Calculate comprehensive weed pressure score for a specific weed species."""
    start_time = time.time()

    # Get all risk components
    gdd_accumulated = get_gdd_accumulated(
        session, location_id, target_date, weed_species
    )
    gdd_risk = calculate_gdd_risk(gdd_accumulated, weed_species.gdd_threshold_emergence)

    soil_temp = estimate_soil_temp(session, location_id, target_date)
    soil_temp_risk = calculate_soil_temp_risk(soil_temp, weed_species)

    moisture_risk = calculate_moisture_risk(session, location_id, target_date)
    turf_stress = calculate_turf_stress(session, location_id, target_date)
    seasonal_timing = calculate_seasonal_timing(target_date, weed_species)

    # Weighted composite score (scaled so max possible score is 10)
    # Scaling factor: 10 / 2.2 ≈ 4.545
    composite_score = (
        (gdd_risk * 1.36)
        + (soil_temp_risk * 0.91)
        + (moisture_risk * 0.91)
        + (turf_stress * 0.91)
        + (seasonal_timing * 0.45)
    )

    # Cap at 10
    final_score = min(composite_score, 10.0)

    # Get additional calculation inputs for storage
    weather = session.execute(
        select(DailyWeather).where(
            DailyWeather.location_id == location_id,
            DailyWeather.date == target_date,
        )
    ).scalar_one_or_none()

    # Determine if the weather is a forecast based on the 'type' field
    is_forecast = (
        weather.type == WeatherType.forecast
        if weather and hasattr(weather, "type")
        else False
    )

    # Calculate 3-day precipitation
    precip_3day = 0.0
    if weather:
        precip_start = target_date - timedelta(days=3)
        precip_query = select(func.sum(DailyWeather.precipitation_mm)).where(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= precip_start,
            DailyWeather.date <= target_date,
        )
        precip_3day = session.execute(precip_query).scalar() or 0.0

    # Calculate average humidity
    humidity_avg = 0.0
    if weather and weather.relative_humidity_mean:
        humidity_avg = weather.relative_humidity_mean

    # Get ET0
    et0_mm = weather.et0_evapotranspiration_mm if weather else 0.0

    duration_ms = (time.time() - start_time) * 1000
    log_performance_metric(
        "weed_pressure_calculation",
        duration_ms,
        success=True,
        location_id=location_id,
        weed_species_id=weed_species.id,
    )

    return {
        "weed_pressure_score": final_score,
        "gdd_risk_score": gdd_risk,
        "soil_temp_risk_score": soil_temp_risk,
        "moisture_risk_score": moisture_risk,
        "turf_stress_score": turf_stress,
        "seasonal_timing_score": seasonal_timing,
        "gdd_accumulated": gdd_accumulated,
        "soil_temp_estimate_c": soil_temp,
        "precipitation_3day_mm": precip_3day,
        "humidity_avg": humidity_avg,
        "et0_mm": et0_mm,
        "is_forecast": is_forecast,
    }


def calculate_weed_pressure_for_location(
    session: Session, location_id: int, target_date: date
) -> list[dict]:
    """Calculate weed pressure for all active weed species at a location for a single date."""
    # Get all active weed species
    species_query = select(WeedSpecies).where(WeedSpecies.is_active)
    weed_species_list = session.execute(species_query).scalars().all()

    results = []
    for species in weed_species_list:
        try:
            score_data = calculate_weed_pressure_score(
                session, location_id, target_date, species
            )
            score_data["weed_species_id"] = species.id
            score_data["location_id"] = location_id
            score_data["date"] = target_date
            results.append(score_data)
        except Exception as e:
            logger.error(
                f"Error calculating weed pressure for {species.name}: {e}",
                exc_info=True,
            )
            raise  # Re-raise for debugging
    return results


def calculate_weed_pressure_for_location_range(
    session: Session, location_id: int, start_date: date, end_date: date
):
    """
    Calculate and upsert weed pressure for a location over a date range.
    Similar to calculate_growth_potential_for_location.
    """
    start_time = time.time()

    logger = logging.getLogger(__name__)

    # Get all active weed species
    species_query = select(WeedSpecies).where(WeedSpecies.is_active)
    weed_species_list = session.execute(species_query).scalars().all()

    if not weed_species_list:
        logger.warning("No active weed species found, skipping weed pressure calc.")
        duration_ms = (time.time() - start_time) * 1000
        log_performance_metric(
            "weed_pressure_calc",
            duration_ms,
            success=False,
            location_id=location_id,
            error="No active weed species found",
        )
        return

    # Generate all dates in the range
    all_dates = [
        start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)
    ]

    records_processed = 0
    for target_date in all_dates:
        for species in weed_species_list:
            try:
                score_data = calculate_weed_pressure_score(
                    session, location_id, target_date, species
                )

                # Check if entry already exists
                existing = session.execute(
                    select(WeedPressure).where(
                        WeedPressure.location_id == location_id,
                        WeedPressure.date == target_date,
                        WeedPressure.weed_species_id == species.id,
                    )
                ).scalar_one_or_none()

                if existing:
                    # Update existing entry
                    existing.weed_pressure_score = score_data["weed_pressure_score"]
                    existing.gdd_risk_score = score_data["gdd_risk_score"]
                    existing.soil_temp_risk_score = score_data["soil_temp_risk_score"]
                    existing.moisture_risk_score = score_data["moisture_risk_score"]
                    existing.turf_stress_score = score_data["turf_stress_score"]
                    existing.seasonal_timing_score = score_data["seasonal_timing_score"]
                    existing.gdd_accumulated = score_data["gdd_accumulated"]
                    existing.soil_temp_estimate_c = score_data["soil_temp_estimate_c"]
                    existing.precipitation_3day_mm = score_data["precipitation_3day_mm"]
                    existing.humidity_avg = score_data["humidity_avg"]
                    existing.et0_mm = score_data["et0_mm"]
                    existing.is_forecast = score_data["is_forecast"]
                else:
                    # Create new entry
                    new_entry = WeedPressure(
                        location_id=location_id,
                        date=target_date,
                        weed_species_id=species.id,
                        weed_pressure_score=score_data["weed_pressure_score"],
                        gdd_risk_score=score_data["gdd_risk_score"],
                        soil_temp_risk_score=score_data["soil_temp_risk_score"],
                        moisture_risk_score=score_data["moisture_risk_score"],
                        turf_stress_score=score_data["turf_stress_score"],
                        seasonal_timing_score=score_data["seasonal_timing_score"],
                        gdd_accumulated=score_data["gdd_accumulated"],
                        soil_temp_estimate_c=score_data["soil_temp_estimate_c"],
                        precipitation_3day_mm=score_data["precipitation_3day_mm"],
                        humidity_avg=score_data["humidity_avg"],
                        et0_mm=score_data["et0_mm"],
                        is_forecast=score_data["is_forecast"],
                    )
                    session.add(new_entry)

                records_processed += 1

            except Exception as e:
                logger.error(
                    f"Error calculating weed pressure for {species.name} on {target_date}: {e}",
                    exc_info=True,
                )
                # Continue with other species/dates instead of failing completely
                continue

    session.commit()
    logger.info(
        f"Weed pressure calculated for location {location_id} from {start_date} to {end_date}."
    )

    duration_ms = (time.time() - start_time) * 1000
    log_performance_metric(
        "weed_pressure_calc",
        duration_ms,
        success=True,
        location_id=location_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        records_processed=records_processed,
        species_count=len(weed_species_list),
    )


def store_weed_pressure_data(session: Session, weed_pressure_data: list[dict]) -> int:
    """Store weed pressure data in the database."""
    stored_count = 0

    for data in weed_pressure_data:
        # Check if entry already exists
        existing = session.execute(
            select(WeedPressure).where(
                WeedPressure.location_id == data["location_id"],
                WeedPressure.date == data["date"],
                WeedPressure.weed_species_id == data["weed_species_id"],
            )
        ).scalar_one_or_none()

        if existing:
            # Update existing entry
            existing.weed_pressure_score = data["weed_pressure_score"]
            existing.gdd_risk_score = data["gdd_risk_score"]
            existing.soil_temp_risk_score = data["soil_temp_risk_score"]
            existing.moisture_risk_score = data["moisture_risk_score"]
            existing.turf_stress_score = data["turf_stress_score"]
            existing.seasonal_timing_score = data["seasonal_timing_score"]
            existing.gdd_accumulated = data["gdd_accumulated"]
            existing.soil_temp_estimate_c = data["soil_temp_estimate_c"]
            existing.precipitation_3day_mm = data["precipitation_3day_mm"]
            existing.humidity_avg = data["humidity_avg"]
            existing.et0_mm = data["et0_mm"]
            existing.is_forecast = data["is_forecast"]
        else:
            # Create new entry
            new_entry = WeedPressure(
                location_id=data["location_id"],
                date=data["date"],
                weed_species_id=data["weed_species_id"],
                weed_pressure_score=data["weed_pressure_score"],
                gdd_risk_score=data["gdd_risk_score"],
                soil_temp_risk_score=data["soil_temp_risk_score"],
                moisture_risk_score=data["moisture_risk_score"],
                turf_stress_score=data["turf_stress_score"],
                seasonal_timing_score=data["seasonal_timing_score"],
                gdd_accumulated=data["gdd_accumulated"],
                soil_temp_estimate_c=data["soil_temp_estimate_c"],
                precipitation_3day_mm=data["precipitation_3day_mm"],
                humidity_avg=data["humidity_avg"],
                et0_mm=data["et0_mm"],
                is_forecast=data["is_forecast"],
            )
            session.add(new_entry)

        stored_count += 1

    session.commit()
    return stored_count
