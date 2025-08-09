"""Python 3.10 compatibility shims.

This module is automatically imported at interpreter startup (via site module)
if present on sys.path. We use it to provide missing interfaces on older
Python versions without touching many files across the codebase.
"""

import sys
import datetime as _dt
from datetime import timezone as _timezone

# Backport datetime.UTC for Python < 3.11
if not hasattr(_dt, "UTC"):
    try:
        _dt.UTC = _timezone.utc  # type: ignore[attr-defined]
    except Exception:
        # If anything goes wrong, at least don't crash interpreter startup
        pass



