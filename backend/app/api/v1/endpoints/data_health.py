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
from app.models.weed_pressure import WeedPressure, WeedSpecies
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


async def find_duplicate_weather_entries(db: AsyncSession, location_id: int):
    """
    Find duplicate weather entries for a location (same date, different types).
    Returns dates that have both historical and forecast entries.
    """
    from app.models.daily_weather import WeatherType

    # Find dates that have multiple entries
    duplicate_dates_query = (
        select(DailyWeather.date)
        .where(DailyWeather.location_id == location_id)
        .group_by(DailyWeather.date)
        .having(func.count(DailyWeather.date) > 1)
    )

    duplicate_dates = (await db.execute(duplicate_dates_query)).scalars().all()

    duplicates = []
    for weather_date in duplicate_dates:
        # Get all entries for this date
        entries_query = (
            select(DailyWeather)
            .where(
                DailyWeather.location_id == location_id,
                DailyWeather.date == weather_date,
            )
            .order_by(DailyWeather.type.asc())  # historical comes before forecast
        )

        entries = (await db.execute(entries_query)).scalars().all()

        if len(entries) > 1:
            # Check if we have both historical and forecast
            types = [entry.type for entry in entries]
            if WeatherType.historical in types and WeatherType.forecast in types:
                duplicates.append(
                    {
                        "date": str(weather_date),
                        "entries": [
                            {
                                "id": entry.id,
                                "type": entry.type.value,
                                "temperature_max_c": entry.temperature_max_c,
                                "temperature_min_c": entry.temperature_min_c,
                            }
                            for entry in entries
                        ],
                    }
                )

    return duplicates


async def find_duplicate_disease_pressure_entries(db: AsyncSession, location_id: int):
    """
    Find duplicate disease pressure entries for a location (same date, same disease).
    Returns dates/diseases that have more than one entry.
    """
    from app.models.disease_pressure import DiseasePressure

    # Find (date, disease) pairs that have multiple entries
    duplicate_query = (
        select(DiseasePressure.date, DiseasePressure.disease)
        .where(DiseasePressure.location_id == location_id)
        .group_by(DiseasePressure.date, DiseasePressure.disease)
        .having(func.count(DiseasePressure.id) > 1)
    )
    duplicates = (await db.execute(duplicate_query)).all()
    result = []
    for date_val, disease in duplicates:
        # Get all entries for this date/disease
        entries_query = select(DiseasePressure).where(
            DiseasePressure.location_id == location_id,
            DiseasePressure.date == date_val,
            DiseasePressure.disease == disease,
        )
        entries = (await db.execute(entries_query)).scalars().all()
        result.append(
            {
                "date": str(date_val),
                "disease": disease,
                "entries": [{"id": e.id, "risk_score": e.risk_score} for e in entries],
            }
        )
    return result


@router.get("/data_health/")
async def get_data_health(db: AsyncSession = Depends(get_db)):
    locations = (await db.execute(select(Location))).scalars().all()
    results = []

    # Use a reasonable expected date range: 60 days ago to 16 days in the future (inclusive)
    today = date.today()
    expected_start = today - timedelta(days=60)
    expected_end = today + timedelta(days=16)

    for loc in locations:
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
            "weed_pressure": "weed_pressure_score",
        }

        for name, model in [
            ("weather", DailyWeather),
            ("gdd", GDDValue),
            ("disease_pressure", DiseasePressure),
            ("growth_potential", GrowthPotential),
            ("weed_pressure", WeedPressure),
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
                        for i in range((expected_end - model_start).days)
                        if model_start + timedelta(days=i) < expected_end
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
            elif name == "weed_pressure":
                # For each active weed species, check for missing entries
                species_list = (
                    (await db.execute(select(WeedSpecies).where(WeedSpecies.is_active)))
                    .scalars()
                    .all()
                )
                weed_missing = []
                for species in species_list:
                    # Check for weed pressure data for this specific species and location
                    present_dates = set(
                        (
                            await db.execute(
                                select(WeedPressure.date).where(
                                    and_(
                                        WeedPressure.location_id == loc.id,
                                        WeedPressure.weed_species_id == species.id,
                                        WeedPressure.weed_pressure_score.isnot(None),
                                    )
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )
                    # Only count dates where this species is missing
                    missing_ranges = find_missing_ranges(present_dates, expected_dates)
                    weed_missing.append(
                        {
                            "species_id": species.id,
                            "species_name": species.name,
                            "missing": missing_ranges,
                        }
                    )
                missing[name] = weed_missing
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
                # Check for actual growth potential records
                present_dates = await get_present_dates(
                    model, value_fields[name], loc.id
                )
                missing[name] = find_missing_ranges(present_dates, expected_dates)
            else:
                present_dates = await get_present_dates(
                    model, value_fields[name], loc.id
                )
                missing[name] = find_missing_ranges(present_dates, expected_dates)

        results.append({"id": loc.id, "name": loc.name, "missing": missing})

    # Check for duplicate weather entries
    duplicate_weather = {}
    for loc in locations:
        duplicates = await find_duplicate_weather_entries(db, loc.id)
        if duplicates:
            duplicate_weather[loc.id] = duplicates

    # Remove duplicate_disease_pressure logic
    return {"locations": results, "duplicate_weather": duplicate_weather}
