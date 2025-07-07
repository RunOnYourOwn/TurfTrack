import math
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.daily_weather import DailyWeather, WeatherType
from app.models.disease_pressure import DiseasePressure

# Smith-Kerns Dollar Spot Model reference: https://tdl.wisc.edu/dollar-spot-model/
SMITH_KERNS_COEFFICIENTS = {
    "b0": -11.4041,
    "b1": 0.1932,  # Temp (°C)
    "b2": 0.0894,  # RH (%)
}


def calculate_smith_kerns_for_location(
    session: Session,
    location_id: int,
    start_date: datetime.date,
    end_date: datetime.date,
):
    """
    Calculate Smith-Kerns dollar spot risk for each date/location using 5-day moving averages of temp and RH.
    Uses historical data when available, fills with forecast data as needed.
    Stores results in disease_pressure table.
    """
    # Get all relevant weather data for the window
    weather_rows = (
        session.execute(
            select(DailyWeather)
            .where(
                DailyWeather.location_id == location_id,
                DailyWeather.date >= start_date - datetime.timedelta(days=4),
                DailyWeather.date <= end_date,
                DailyWeather.type.in_(
                    [WeatherType.historical.value, WeatherType.forecast.value]
                ),
            )
            .order_by(DailyWeather.date.asc(), DailyWeather.type.asc())
        )
        .scalars()
        .all()
    )

    # Organize by date, prefer historical over forecast
    weather_by_date = {}
    for w in weather_rows:
        if w.date not in weather_by_date or w.type == WeatherType.historical.value:
            weather_by_date[w.date] = w

    all_dates = [
        start_date + datetime.timedelta(days=i)
        for i in range((end_date - start_date).days + 1)
    ]

    required_fields = [
        "temperature_max_c",
        "temperature_min_c",
        "relative_humidity_mean",
    ]

    for target_date in all_dates:
        # Only process if we have a weather record for the target date
        if target_date not in weather_by_date:
            continue

        # Gather 5-day window ending on target_date
        window = []
        for offset in range(4, -1, -1):
            d = target_date - datetime.timedelta(days=offset)
            if d in weather_by_date:
                window.append(weather_by_date[d])

        # Check if we have enough data for calculation
        if len(window) < 5:
            # Only insert pending/null if weather exists for target_date
            existing = (
                session.execute(
                    select(DiseasePressure).where(
                        DiseasePressure.date == target_date,
                        DiseasePressure.location_id == location_id,
                        DiseasePressure.disease == "dollar_spot",
                    )
                )
                .scalars()
                .first()
            )
            if not existing:
                dp = DiseasePressure(
                    date=target_date,
                    location_id=location_id,
                    disease="dollar_spot",
                    risk_score=None,  # Null indicates pending/incomplete data
                )
                session.add(dp)
            continue  # Skip calculation for this date

        # Check all required fields are present for all 5 days
        incomplete = False
        for w in window:
            for field in required_fields:
                if getattr(w, field) is None:
                    incomplete = True
                    break
            if incomplete:
                break
        if incomplete:
            # Only insert pending/null if weather exists for target_date
            existing = (
                session.execute(
                    select(DiseasePressure).where(
                        DiseasePressure.date == target_date,
                        DiseasePressure.location_id == location_id,
                        DiseasePressure.disease == "dollar_spot",
                    )
                )
                .scalars()
                .first()
            )
            if not existing:
                dp = DiseasePressure(
                    date=target_date,
                    location_id=location_id,
                    disease="dollar_spot",
                    risk_score=None,  # Null indicates pending/incomplete data
                )
                session.add(dp)
            continue  # Skip calculation for this date

        # Calculate 5-day moving averages
        avg_temp = (
            sum(((w.temperature_max_c) + (w.temperature_min_c)) / 2 for w in window) / 5
        )
        avg_rh = sum((w.relative_humidity_mean) for w in window) / 5

        # Smith-Kerns formula (with cutoff)
        b0 = SMITH_KERNS_COEFFICIENTS["b0"]
        b1 = SMITH_KERNS_COEFFICIENTS["b1"]
        b2 = SMITH_KERNS_COEFFICIENTS["b2"]
        if avg_temp < 10 or avg_temp > 35:
            risk_score = 0
        else:
            logit = b0 + b1 * avg_temp + b2 * avg_rh
            risk_score = math.exp(logit) / (1 + math.exp(logit))

        # Upsert into disease_pressure table
        existing = (
            session.execute(
                select(DiseasePressure).where(
                    DiseasePressure.date == target_date,
                    DiseasePressure.location_id == location_id,
                    DiseasePressure.disease == "dollar_spot",
                )
            )
            .scalars()
            .first()
        )
        if existing:
            existing.risk_score = risk_score
        else:
            dp = DiseasePressure(
                date=target_date,
                location_id=location_id,
                disease="dollar_spot",
                risk_score=risk_score,
            )
            session.add(dp)
    session.commit()
