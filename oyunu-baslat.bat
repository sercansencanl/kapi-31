@echo off
rem Kapı 31: önbelleksiz yerel sunucuyu baslatir ve oyunu tarayicida acar. Kapatmak icin bu pencereyi kapat.
cd /d "%~dp0"
python sunucu.py
if errorlevel 1 (
  echo.
  echo Python bulunamadi veya 8000 portu dolu. Python kurulu mu: python --version
  pause
)
