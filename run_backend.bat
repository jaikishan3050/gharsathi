@echo off
echo ====================================================
echo Starting Ghar Sathi Django REST Framework Backend...
echo Server URL: http://127.0.0.1:8000/api/
echo ====================================================
cd /d "%~dp0backend"
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
python manage.py runserver 127.0.0.1:8000
pause
