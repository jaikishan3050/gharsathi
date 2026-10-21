@echo off
echo ====================================================
echo Starting Ghar Sathi Full Stack System...
echo Backend:  http://127.0.0.1:8000/api/
echo Frontend: http://localhost:5173/
echo ====================================================
start "GharSathi Backend (Django)" cmd /k "cd /d %~dp0backend && python manage.py runserver 127.0.0.1:8000"
start "GharSathi Frontend (Vite)" cmd /k "cd /d %~dp0GharSathi_React && npm run dev"
