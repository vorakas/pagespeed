@echo off
REM Build the Pharos Applitools helper into a single Windows .exe.
REM
REM Run this from a developer machine that has Python + pip installed;
REM QA machines do NOT need Python, they just receive applitools-fetch.exe.
REM
REM Output: dist\applitools-fetch.exe (committed-by-build, not by hand).

setlocal

cd /d "%~dp0"

if not exist .venv (
    echo Creating virtualenv...
    python -m venv .venv || goto :err
)

call .venv\Scripts\activate.bat || goto :err

pip install --upgrade pip >nul || goto :err
pip install -r requirements.txt pyinstaller || goto :err

echo Building applitools-fetch.exe...
pyinstaller ^
    --onefile ^
    --console ^
    --name applitools-fetch ^
    --clean ^
    applitools_fetch.py || goto :err

echo.
echo Build complete: %CD%\dist\applitools-fetch.exe
echo.
pause
goto :eof

:err
echo.
echo BUILD FAILED.
echo.
pause
exit /b 1
