"""Tests verifying tzdata provides IANA time zone support on all platforms."""

from __future__ import annotations

from zoneinfo import ZoneInfo, available_timezones


def test_iana_timezones_available():
    """Verify IANA time zones are available via the tzdata package."""
    zones = ["Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney", "UTC"]
    for tz_name in zones:
        zone = ZoneInfo(tz_name)
        assert zone.key == tz_name

    all_zones = available_timezones()
    assert "Europe/London" in all_zones
    assert "America/New_York" in all_zones
