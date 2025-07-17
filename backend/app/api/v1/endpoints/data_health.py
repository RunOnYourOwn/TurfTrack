from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, func
from app.core.database import get_db
from app.models.location import Location
from app.models.daily_weather import DailyWeather
from app.models.gdd import GDDValue
from app.models.disease_pressure import DiseasePressure
from app.models.growth_potential import GrowthPotential
from datetime import timedelta, date

router = APIRouter(tags=["data_health"])


def find_missing_ranges(present_dates, expected_dates):
    missing = []
    current_range = []
    for d in expected_dates:
        if d not in present_dates:
            if not current_range:
                current_range = [d, d]
            else:
                current_range[1] = d
        else:
            if current_range:
                missing.append(
                    {"start": str(current_range[0]), "end": str(current_range[1])}
                )
                current_range = []
    if current_range:
        missing.append({"start": str(current_range[0]), "end": str(current_range[1])})
    return missing


@router.get("/data_health/")
async def get_data_health(db: AsyncSession = Depends(get_db)):
    locations = (await db.execute(select(Location))).scalars().all()
    results = []

    # Use a reasonable expected date range: 60 days ago to 16 days in the future (inclusive)
    today = date.today()
    expected_start = today - timedelta(days=60)
    expected_end = today + timedelta(days=16)

    for loc in locations:
        # Get all weather dates for this location
        weather_dates = (
            (
                await db.execute(
                    select(DailyWeather.date).where(DailyWeather.location_id == loc.id)
                )
            )
            .scalars()
            .all()
        )

        # Create expected dates from our reasonable range (end-exclusive)
        expected_dates = [
            expected_start + timedelta(days=i)
            for i in range((expected_end - expected_start).days)
        ]

        async def get_present_dates(
            model, value_field, id_value, id_field="location_id"
        ):
            return set(
                (
                    await db.execute(
                        select(model.date).where(
                            and_(
                                getattr(model, id_field) == id_value,
                                getattr(model, value_field).isnot(None),
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )

        async def get_complete_weather_dates(location_id):
            """Check for weather records with all required fields for disease pressure calculation"""
            return set(
                (
                    await db.execute(
                        select(DailyWeather.date).where(
                            and_(
                                DailyWeather.location_id == location_id,
                                DailyWeather.temperature_max_c.isnot(None),
                                DailyWeather.temperature_min_c.isnot(None),
                                DailyWeather.relative_humidity_mean.isnot(None),
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )

        async def get_any_weather_dates(location_id):
            """Check for any weather records (to detect complete gaps)"""
            return set(
                (
                    await db.execute(
                        select(DailyWeather.date).where(
                            DailyWeather.location_id == location_id
                        )
                    )
                )
                .scalars()
                .all()
            )

        missing = {}
        value_fields = {
            "weather": "temperature_max_c",  # or another key field for weather
            "gdd": "daily_gdd",  # use daily_gdd for GDDValue
            "disease_pressure": "risk_score",  # adjust to your actual field name
            "growth_potential": "growth_potential",
        }

        for name, model in [
            ("weather", DailyWeather),
            ("gdd", GDDValue),
            ("disease_pressure", DiseasePressure),
            ("growth_potential", GrowthPotential),
        ]:
            if name == "gdd":
                from app.models.gdd import GDDModel

                gdd_model_ids = (
                    (
                        await db.execute(
                            select(GDDModel.id).where(GDDModel.location_id == loc.id)
                        )
                    )
                    .scalars()
                    .all()
                )
                if not gdd_model_ids:
                    missing[name] = []
                    continue
                from app.models.gdd import GDDReset

                gdd_missing = []
                for gdd_model_id in gdd_model_ids:
                    # Get the first reset_date for this gdd_model_id
                    first_reset_date = (
                        await db.execute(
                            select(func.min(GDDReset.reset_date)).where(
                                GDDReset.gdd_model_id == gdd_model_id
                            )
                        )
                    ).scalar()
                    if not first_reset_date:
                        continue  # skip if no reset for this model
                    # Use expected date range, but start from reset date
                    model_start = max(first_reset_date, expected_start)
                    model_expected_dates = [
                        model_start + timedelta(days=i)
                        for i in range((expected_end - model_start).days + 1)
                        if model_start + timedelta(days=i) <= expected_end
                    ]
                    model_present_dates = await get_present_dates(
                        GDDValue,
                        value_fields[name],
                        gdd_model_id,
                        id_field="gdd_model_id",
                    )
                    model_missing = find_missing_ranges(
                        model_present_dates, model_expected_dates
                    )
                    gdd_missing.append(
                        {"gdd_model_id": gdd_model_id, "missing": model_missing}
                    )
                missing[name] = gdd_missing
                continue
            elif name == "disease_pressure":
                # Only check for missing values starting from the 5th date (index 4)
                if len(expected_dates) < 5:
                    missing[name] = []
                    continue
                present_dates = await get_present_dates(
                    model, value_fields[name], loc.id
                )
                missing[name] = find_missing_ranges(present_dates, expected_dates[4:])
            elif name == "weather":
                # First check if there are any weather records at all
                any_weather_dates = await get_any_weather_dates(loc.id)
                if not any_weather_dates:
                    # No weather data at all - mark entire range as missing
                    missing[name] = [
                        {"start": str(expected_start), "end": str(expected_end)}
                    ]
                else:
                    # Check for complete weather records with required fields
                    present_dates = await get_complete_weather_dates(loc.id)
                    missing[name] = find_missing_ranges(present_dates, expected_dates)
            elif name == "growth_potential":
                # Check for weather data with required fields for growth potential calculation
                # (uses same function as weather since it requires temperature fields)
                present_dates = await get_complete_weather_dates(loc.id)
                missing[name] = find_missing_ranges(present_dates, expected_dates)
            else:
                present_dates = await get_present_dates(
                    model, value_fields[name], loc.id
                )
                missing[name] = find_missing_ranges(present_dates, expected_dates)

        results.append({"id": loc.id, "name": loc.name, "missing": missing})
    return {"locations": results}
