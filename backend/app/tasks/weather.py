import datetime
from app.celery_app import app
from app.core.database import async_session_maker
from app.utils.weather import upsert_daily_weather
from app.models.daily_weather import WeatherType
import openmeteo_requests


@app.task(name="fetch_and_store_weather")
def fetch_and_store_weather(location_id: int, latitude: float, longitude: float):
    import asyncio

    asyncio.run(_fetch_and_store_weather(location_id, latitude, longitude))


async def _fetch_and_store_weather(location_id: int, latitude: float, longitude: float):
    async with async_session_maker() as session:
        om = openmeteo_requests.Client()
        # Fetch historical (past 30 days)
        today = datetime.date.today()
        start_hist = today - datetime.timedelta(days=30)
        end_hist = today - datetime.timedelta(days=2)
        params_hist = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_hist.isoformat(),
            "end_date": end_hist.isoformat(),
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant",
                "et0_fao_evapotranspiration",
            ],
            "timezone": "auto",
        }
        responses_hist = om.weather_api(
            "https://api.open-meteo.com/v1/forecast", params=params_hist
        )
        response_hist = responses_hist[0]
        daily_hist = response_hist.Daily()
        # Build and upsert historical data
        for i, date in enumerate(_get_dates(daily_hist)):
            data = _extract_weather_data(daily_hist, i)
            await upsert_daily_weather(
                session, location_id, date, WeatherType.historical, data
            )

        # Fetch forecast (next 16 days)
        params_forecast = {
            "latitude": latitude,
            "longitude": longitude,
            "forecast_days": 16,
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "wind_direction_10m_dominant",
                "et0_fao_evapotranspiration",
            ],
            "timezone": "auto",
        }
        responses_forecast = om.weather_api(
            "https://api.open-meteo.com/v1/forecast", params=params_forecast
        )
        response_forecast = responses_forecast[0]
        daily_forecast = response_forecast.Daily()
        for i, date in enumerate(_get_dates(daily_forecast)):
            data = _extract_weather_data(daily_forecast, i)
            await upsert_daily_weather(
                session, location_id, date, WeatherType.forecast, data
            )


def _get_dates(daily):
    import pandas as pd

    dates = pd.date_range(
        start=pd.to_datetime(daily.Time(), unit="s"),
        end=pd.to_datetime(daily.TimeEnd(), unit="s"),
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left",
    )
    return dates


def _extract_weather_data(daily, i):
    # Extract and convert all required fields for upsert
    return {
        "temperature_max_c": daily.Variables(0).ValuesAsNumpy()[i],
        "temperature_max_f": daily.Variables(0).ValuesAsNumpy()[i] * 9.0 / 5.0 + 32.0,
        "temperature_min_c": daily.Variables(1).ValuesAsNumpy()[i],
        "temperature_min_f": daily.Variables(1).ValuesAsNumpy()[i] * 9.0 / 5.0 + 32.0,
        "precipitation_mm": daily.Variables(2).ValuesAsNumpy()[i],
        "precipitation_in": daily.Variables(2).ValuesAsNumpy()[i] / 25.4,
        "precipitation_probability_max": daily.Variables(3).ValuesAsNumpy()[i],
        "wind_speed_max_ms": daily.Variables(4).ValuesAsNumpy()[i],
        "wind_speed_max_mph": daily.Variables(4).ValuesAsNumpy()[i] * 2.23694,
        "wind_gusts_max_ms": daily.Variables(5).ValuesAsNumpy()[i],
        "wind_gusts_max_mph": daily.Variables(5).ValuesAsNumpy()[i] * 2.23694,
        "wind_direction_dominant_deg": daily.Variables(6).ValuesAsNumpy()[i],
        "et0_evapotranspiration_mm": daily.Variables(7).ValuesAsNumpy()[i],
        "et0_evapotranspiration_in": daily.Variables(7).ValuesAsNumpy()[i] / 25.4,
    }
