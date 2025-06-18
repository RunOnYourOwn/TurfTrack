import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.gdd import GDDModel, GDDValue, GDDReset, ResetType
from app.models.daily_weather import DailyWeather, WeatherType


def calculate_and_store_gdd_values_sync(
    session: Session, gdd_model_id: int, location_id: int
):
    """
    Calculate and store daily/cumulative GDD values for a GDD model, using the correct run.
    Handles threshold-based reset if enabled.
    """
    # Fetch the GDD model
    gdd_model = session.get(GDDModel, gdd_model_id)
    if not gdd_model:
        raise ValueError("GDD model not found")

    # Fetch all weather data for the location from start_date onward
    weather_q = (
        select(DailyWeather)
        .where(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= gdd_model.start_date,
        )
        .order_by(DailyWeather.date.asc())
    )
    weather_rows = session.execute(weather_q).scalars().all()
    if not weather_rows:
        return 0  # No data to process

    # Remove existing GDD values for this model (for full recalculation)
    session.query(GDDValue).filter(GDDValue.gdd_model_id == gdd_model_id).delete()
    session.commit()

    # Prepare calculation
    base_temp = gdd_model.base_temp
    unit = gdd_model.unit.value
    threshold = gdd_model.threshold
    reset_on_threshold = gdd_model.reset_on_threshold
    run = 1
    cumulative = 0.0
    threshold_crossed = False
    values_to_insert = []

    for w in weather_rows:
        # Select correct Tmax/Tmin based on unit
        if unit == "C":
            tmax = w.temperature_max_c
            tmin = w.temperature_min_c
        else:
            tmax = w.temperature_max_f
            tmin = w.temperature_min_f
        # Calculate daily GDD
        daily_gdd = max(0.0, ((tmax + tmin) / 2) - base_temp)
        # If missing data, set daily_gdd to None
        if tmax is None or tmin is None:
            daily_gdd = None
        # Handle threshold/reset logic
        if (
            reset_on_threshold
            and not threshold_crossed
            and cumulative + (daily_gdd or 0) >= threshold
        ):
            threshold_crossed = True
            run += 1
            cumulative = 0.0  # Reset cumulative for new run
        # Update cumulative
        if daily_gdd is not None:
            cumulative += daily_gdd
        # Insert value
        values_to_insert.append(
            GDDValue(
                gdd_model_id=gdd_model_id,
                date=w.date,
                daily_gdd=daily_gdd,
                cumulative_gdd=cumulative if daily_gdd is not None else None,
                is_forecast=(w.type == WeatherType.forecast),
                run=run,
            )
        )
    # Bulk insert
    session.bulk_save_objects(values_to_insert)
    session.commit()
    return len(values_to_insert)


def manual_gdd_reset_sync(
    session: Session, gdd_model_id: int, reset_date: datetime.date
):
    """
    Perform a manual reset: insert a new GDDReset row for the reset date and incremented run_number.
    The recalculation function will handle value segmentation and cumulative GDD.
    Handles edge cases: removes duplicate resets for the date, deletes all future resets, prevents manual reset before initial.
    """
    from app.models.gdd import GDDReset, ResetType

    # Prevent manual reset before initial reset/start date
    initial_reset = (
        session.query(GDDReset)
        .filter(GDDReset.gdd_model_id == gdd_model_id)
        .order_by(GDDReset.reset_date.asc())
        .first()
    )
    if initial_reset and reset_date < initial_reset.reset_date:
        raise ValueError("Cannot add manual reset before initial reset/start date.")

    # Remove any existing reset for this date
    session.query(GDDReset).filter(
        GDDReset.gdd_model_id == gdd_model_id, GDDReset.reset_date == reset_date
    ).delete()
    session.commit()

    # Find current max run_number in gdd_resets
    max_run = (
        session.query(GDDReset.run_number)
        .filter(GDDReset.gdd_model_id == gdd_model_id)
        .order_by(GDDReset.run_number.desc())
        .first()
    )
    next_run = (max_run[0] if max_run else 1) + 1
    # Insert new manual reset
    new_reset = GDDReset(
        gdd_model_id=gdd_model_id,
        reset_date=reset_date,
        run_number=next_run,
        reset_type=ResetType.manual,
    )
    session.add(new_reset)
    session.commit()

    # Delete all future resets after the manual reset date
    session.query(GDDReset).filter(
        GDDReset.gdd_model_id == gdd_model_id, GDDReset.reset_date > reset_date
    ).delete()
    session.commit()
    return 1


def calculate_and_store_gdd_values_sync_segmented(
    session: Session, gdd_model_id: int, location_id: int
):
    """
    Calculate and store daily/cumulative GDD values for a GDD model, segmented by runs using the gdd_resets table.
    Handles both manual and threshold resets robustly.
    """
    gdd_model = session.get(GDDModel, gdd_model_id)
    if not gdd_model:
        raise ValueError("GDD model not found")

    # Fetch all resets for this model, ordered by date
    resets = (
        session.query(GDDReset)
        .filter(GDDReset.gdd_model_id == gdd_model_id)
        .order_by(GDDReset.reset_date.asc())
        .all()
    )
    if not resets:
        raise ValueError("No resets found for this GDD model")

    # Prepare weather data
    weather_q = (
        session.query(DailyWeather)
        .filter(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= gdd_model.start_date,
        )
        .order_by(DailyWeather.date.asc())
    )
    weather_rows = weather_q.all()
    if not weather_rows:
        return 0

    # --- Pass 1: Insert threshold resets if needed ---
    max_run = max([r.run_number for r in resets]) if resets else 1
    new_resets = []
    if gdd_model.reset_on_threshold:
        cumulative = 0.0
        run_number = max_run
        for w in weather_rows:
            if gdd_model.unit.value == "C":
                tmax = w.temperature_max_c
                tmin = w.temperature_min_c
            else:
                tmax = w.temperature_max_f
                tmin = w.temperature_min_f
            daily_gdd = (
                max(0.0, ((tmax + tmin) / 2) - gdd_model.base_temp)
                if tmax is not None and tmin is not None
                else None
            )
            if daily_gdd is not None:
                cumulative += daily_gdd
            if cumulative >= gdd_model.threshold:
                exists = (
                    session.query(GDDReset)
                    .filter_by(
                        gdd_model_id=gdd_model_id,
                        reset_date=w.date,
                        reset_type=ResetType.threshold,
                    )
                    .first()
                )
                if not exists:
                    run_number += 1
                    new_reset = GDDReset(
                        gdd_model_id=gdd_model_id,
                        reset_date=w.date,
                        run_number=run_number,
                        reset_type=ResetType.threshold,
                    )
                    session.add(new_reset)
                    new_resets.append(new_reset)
                cumulative = 0.0  # Reset cumulative for new run
        session.commit()
    else:
        # If not reset_on_threshold, do not insert any threshold resets after the latest manual reset
        pass  # No-op: all future GDD values will be assigned to the latest run

    # Remove all existing GDD values for this model (for full recalculation)
    session.query(GDDValue).filter(GDDValue.gdd_model_id == gdd_model_id).delete()
    session.commit()

    # --- Pass 2: Re-fetch resets and segment/calculate ---
    resets = (
        session.query(GDDReset)
        .filter(GDDReset.gdd_model_id == gdd_model_id)
        .order_by(GDDReset.reset_date.asc())
        .all()
    )
    # Reassign run_number sequentially by date
    for idx, reset in enumerate(resets):
        reset.run_number = idx + 1
    session.commit()

    values_to_insert = []
    for i, reset in enumerate(resets):
        run_number = reset.run_number
        start_date = reset.reset_date
        end_date = resets[i + 1].reset_date if i + 1 < len(resets) else None

        segment = [
            w
            for w in weather_rows
            if w.date >= start_date and (end_date is None or w.date < end_date)
        ]
        cumulative = 0.0
        for j, w in enumerate(segment):
            if gdd_model.unit.value == "C":
                tmax = w.temperature_max_c
                tmin = w.temperature_min_c
            else:
                tmax = w.temperature_max_f
                tmin = w.temperature_min_f
            daily_gdd = (
                max(0.0, ((tmax + tmin) / 2) - gdd_model.base_temp)
                if tmax is not None and tmin is not None
                else None
            )
            if daily_gdd is not None:
                if j == 0:
                    cumulative = 0.0  # Reset cumulative to 0 on reset date
                else:
                    cumulative += daily_gdd
            values_to_insert.append(
                GDDValue(
                    gdd_model_id=gdd_model_id,
                    date=w.date,
                    daily_gdd=daily_gdd,
                    cumulative_gdd=cumulative if daily_gdd is not None else None,
                    is_forecast=(w.type == WeatherType.forecast),
                    run=run_number,
                )
            )
    session.bulk_save_objects(values_to_insert)
    session.commit()
    return len(values_to_insert)
