@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

rem Clear dist folder
if not exist "dist" (
    mkdir dist
) else (
    echo [LOG] Clearing dist folder...
    del /f /q "dist\*.*" 2>nul
)

rem Find Chrome browser
set "CHROME="
if exist "C:\Users\ch\AppData\Local\CentBrowser\Application\chrome.exe" set "CHROME=C:\Users\ch\AppData\Local\CentBrowser\Application\chrome.exe"
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
    echo [ERROR] Chrome browser not found
    goto end
)

echo ========================================
echo Building Chrome Extension...
echo ========================================

set "EXT_FULL=%cd%"
set "OUTPUT_CRX=dist\AI-aggregate-query.crx"
set "OUTPUT_PEM=dist\chrome-extension.pem"

rem Get short path name
for %%I in ("%EXT_FULL%") do set "EXT_SHORT=%%~sI"
if "%EXT_SHORT%"=="" set "EXT_SHORT=%EXT_FULL%"

echo [LOG] Extension directory: %EXT_FULL%
echo [LOG] Short path: %EXT_SHORT%

rem Switch to parent directory
pushd ..
set "PARENT=%cd%"

rem Clean up ALL .crx and .pem files in parent directory
echo [LOG] Cleaning parent directory...
del /f /q "*.crx" 2>nul
del /f /q "*.pem" 2>nul

rem Pack extension
echo [LOG] Running Chrome pack command...
"%CHROME%" --pack-extension="%EXT_SHORT%" > "%TEMP%\chrome_output.txt" 2>&1
if exist "%TEMP%\chrome_output.txt" (
    type "%TEMP%\chrome_output.txt"
    del /q "%TEMP%\chrome_output.txt" 2>nul
)
timeout /t 1 /nobreak >nul 2>&1

rem Find generated files (may have short path name)
set "CRX_FILE="
set "PEM_FILE="
for %%F in (*.crx) do set "CRX_FILE=%%F"
for %%F in (*.pem) do set "PEM_FILE=%%F"

rem Move files to dist
if defined CRX_FILE (
    echo [LOG] Found .crx file: %CRX_FILE%
    move /y "%CRX_FILE%" "%EXT_FULL%\%OUTPUT_CRX%" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to move .crx file
    ) else (
        echo [SUCCESS] CRX: %OUTPUT_CRX%
    )
) else (
    echo [ERROR] No .crx file generated
)

if defined PEM_FILE (
    echo [LOG] Found .pem file: %PEM_FILE%
    move /y "%PEM_FILE%" "%EXT_FULL%\%OUTPUT_PEM%" >nul
    if errorlevel 1 (
        echo [ERROR] Failed to move .pem file
    ) else (
        echo [SUCCESS] PEM: %OUTPUT_PEM%
    )
)

popd

rem Final check
if exist "%OUTPUT_CRX%" (
    echo ========================================
    echo [SUCCESS] Pack completed!
    echo Output: %OUTPUT_CRX%
    if exist "%OUTPUT_PEM%" echo Key: %OUTPUT_PEM%
    echo ========================================
) else (
    echo ========================================
    echo [ERROR] Pack failed
    echo ========================================
)

:end
