import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.gdd import GDDModel, GDDValue, GDDReset, ResetType, GDDModelParameters
from app.models.daily_weather import DailyWeather, WeatherType
from app.models.lawn import Lawn


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

    Note: reset_date is the date you want the new run to START ON. The actual reset will be created
    for the day before, so that the new run starts on the requested date.
    """
    from app.models.gdd import GDDReset, ResetType

    # Adjust reset date to be the after before (since reset date marks the end of previous run)
    actual_reset_date = reset_date + datetime.timedelta(days=1)

    # Prevent manual reset before initial reset/start date
    initial_reset = (
        session.query(GDDReset)
        .filter(GDDReset.gdd_model_id == gdd_model_id)
        .order_by(GDDReset.reset_date.asc())
        .first()
    )
    if initial_reset and actual_reset_date < initial_reset.reset_date:
        raise ValueError("Cannot add manual reset before initial reset/start date.")

    # Remove any existing reset for this date
    session.query(GDDReset).filter(
        GDDReset.gdd_model_id == gdd_model_id, GDDReset.reset_date == actual_reset_date
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
        reset_date=actual_reset_date,
        run_number=next_run,
        reset_type=ResetType.manual,
    )
    session.add(new_reset)
    session.commit()

    # Delete all future resets after the manual reset date
    session.query(GDDReset).filter(
        GDDReset.gdd_model_id == gdd_model_id, GDDReset.reset_date > actual_reset_date
    ).delete()
    session.commit()
    return 1


def calculate_and_store_gdd_values_sync_segmented(
    session: Session, gdd_model_id: int, location_id: int
):
    """
    Calculate and store daily/cumulative GDD values for a GDD model, segmented by runs using the gdd_resets table.
    Handles both manual and threshold resets robustly. Uses parameter history for date-specific calculations.
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

    # Clear existing GDD values
    session.query(GDDValue).filter(GDDValue.gdd_model_id == gdd_model_id).delete()
    session.commit()

    # Process each segment between resets
    for i in range(len(resets)):
        start_date = resets[i].reset_date
        end_date = resets[i + 1].reset_date if i + 1 < len(resets) else None
        run_number = resets[i].run_number

        # Get weather data for this segment
        weather_q = session.query(DailyWeather).filter(
            DailyWeather.location_id == location_id,
            DailyWeather.date >= start_date,
        )
        if end_date:
            weather_q = weather_q.filter(DailyWeather.date < end_date)
        weather_q = weather_q.order_by(DailyWeather.date.asc())
        weather_rows = weather_q.all()

        cumulative = 0.0
        values_to_insert = []
        threshold_reset_needed = False
        threshold_reset_date = None

        for w in weather_rows:
            # Get parameters effective for this date
            date_params = get_effective_parameters(session, gdd_model_id, w.date)
            if not date_params:
                continue

            # Calculate daily GDD
            if gdd_model.unit.value == "C":
                tmax = w.temperature_max_c
                tmin = w.temperature_min_c
            else:
                tmax = w.temperature_max_f
                tmin = w.temperature_min_f

            if tmax is None or tmin is None:
                daily_gdd = None
                cumulative_gdd = None
            else:
                daily_gdd = max(0.0, ((tmax + tmin) / 2) - date_params["base_temp"])

                # If this is the start of a threshold reset run, cumulative stays at 0
                if resets[i].reset_type == ResetType.threshold and w.date == start_date:
                    cumulative = 0
                else:
                    # Add daily_gdd to cumulative
                    cumulative += daily_gdd

                    # Check for threshold reset
                    # Only check on the last/current run and if we haven't already found a reset point
                    if (
                        date_params["reset_on_threshold"]
                        and cumulative >= date_params["threshold"]
                        and i == len(resets) - 1
                        and not threshold_reset_needed
                    ):
                        threshold_reset_needed = True
                        # Set reset date to the next day
                        threshold_reset_date = w.date + datetime.timedelta(days=1)

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

        # Bulk insert values for this segment
        if values_to_insert:
            session.bulk_save_objects(values_to_insert)
            session.commit()

        # If we found a threshold reset point, create it and recalculate
        if threshold_reset_needed:
            # Add a new threshold reset
            new_reset = GDDReset(
                gdd_model_id=gdd_model_id,
                reset_date=threshold_reset_date,  # This is now the day after crossing
                run_number=run_number + 1,
                reset_type=ResetType.threshold,
            )
            session.add(new_reset)
            session.commit()

            # Recalculate from this point with the new reset
            calculate_and_store_gdd_values_sync_segmented(
                session, gdd_model_id, location_id
            )
            return

    return True


def get_effective_parameters(
    session: Session, gdd_model_id: int, target_date: datetime.date
):
    """
    Get the effective parameters for a GDD model on a specific date.
    Returns the most recent parameter set that was effective on or before the target date.
    """
    # Find the most recent parameter set effective on or before the target date
    param_query = (
        session.query(GDDModelParameters)
        .filter(
            GDDModelParameters.gdd_model_id == gdd_model_id,
            GDDModelParameters.effective_from <= target_date,
        )
        .order_by(GDDModelParameters.effective_from.desc())
        .first()
    )

    if param_query:
        return {
            "base_temp": param_query.base_temp,
            "threshold": param_query.threshold,
            "reset_on_threshold": param_query.reset_on_threshold,
        }

    # If no parameter history found, get current model parameters
    model = session.get(GDDModel, gdd_model_id)
    if model:
        return {
            "base_temp": model.base_temp,
            "threshold": model.threshold,
            "reset_on_threshold": model.reset_on_threshold,
        }

    return None


def store_parameter_history(
    session: Session,
    gdd_model_id: int,
    base_temp: float,
    threshold: float,
    reset_on_threshold: bool,
    effective_from: datetime.date,
):
    """
    Store a new parameter set in the history table.
    """
    # Check if we already have parameters for this date
    existing = (
        session.query(GDDModelParameters)
        .filter(
            GDDModelParameters.gdd_model_id == gdd_model_id,
            GDDModelParameters.effective_from == effective_from,
        )
        .first()
    )

    if existing:
        # Update existing record
        existing.base_temp = base_temp
        existing.threshold = threshold
        existing.reset_on_threshold = reset_on_threshold
    else:
        # Create new record
        new_params = GDDModelParameters(
            gdd_model_id=gdd_model_id,
            base_temp=base_temp,
            threshold=threshold,
            reset_on_threshold=reset_on_threshold,
            effective_from=effective_from,
        )
        session.add(new_params)

    session.commit()


def recalculate_historical_gdd(
    session: Session, gdd_model_id: int, from_date: datetime.date
):
    """
    Recalculate GDD values from a specific date forward using parameter history.
    """
    # Get the model to ensure it exists
    model = session.get(GDDModel, gdd_model_id)
    if not model:
        raise ValueError("GDD model not found")

    # Get the lawn to get location_id
    lawn = session.get(Lawn, model.lawn_id)
    if not lawn:
        raise ValueError("Lawn not found for GDD model")

    # Delete existing GDD values from the from_date forward
    session.query(GDDValue).filter(
        GDDValue.gdd_model_id == gdd_model_id, GDDValue.date >= from_date
    ).delete()
    session.commit()

    # Recalculate using the segmented approach which will now use parameter history
    calculate_and_store_gdd_values_sync_segmented(
        session, gdd_model_id, lawn.location_id
    )
