"""Tests verifying tzdata is installed and provides IANA time zones across OSs."""

from __future__ import annotations

import zoneinfo
from datetime import UTC, datetime, timedelta

import pytest


@pytest.fixture
def tzdata_only():
    """Clear system TZPATH so zoneinfo is forced to use the tzdata package.

    On Linux and macOS, system timezone files (/usr/share/zoneinfo) are normally
    read first. Resetting TZPATH to empty forces resolution exclusively through
    tzdata, ensuring identical behavior across OSs.
    """
    zoneinfo.reset_tzpath(to=[])
    zoneinfo.ZoneInfo.clear_cache()
    try:
        yield
    finally:
        zoneinfo.reset_tzpath()
        zoneinfo.ZoneInfo.clear_cache()


def test_tzdata_used_for_clock_change(tzdata_only):
    """Verify tzdata provides accurate timezone and daylight saving transitions."""
    london = zoneinfo.ZoneInfo("Europe/London")

    # UK clocks go forward on Sunday 29 March 2026 at 01:00 UTC.
    # 00:30 UTC -> 00:30 GMT (UTC+0)
    # 01:30 UTC -> 02:30 BST (UTC+1)
    before = datetime(2026, 3, 29, 0, 30, tzinfo=UTC).astimezone(london)
    after = datetime(2026, 3, 29, 1, 30, tzinfo=UTC).astimezone(london)

    assert before.utcoffset() == timedelta(0)
    assert after.utcoffset() == timedelta(hours=1)


def test_iana_timezones_available(tzdata_only):
    """Verify common IANA time zones resolve exclusively via tzdata."""
    zones = ["Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney", "UTC"]
    for tz_name in zones:
        zone = zoneinfo.ZoneInfo(tz_name)
        assert zone.key == tz_name
    assert set(zones) <= zoneinfo.available_timezones()
