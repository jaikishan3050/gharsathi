"""
WSGI config for Ghar Sathi backend service.
Enables running as `backend.wsgi:application` from root or `gharsathi_backend.wsgi:application`.
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so gharsathi_backend and api are discoverable
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gharsathi_backend.settings')

from gharsathi_backend.wsgi import application  # noqa: F401
