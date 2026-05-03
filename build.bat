@echo off
title Roblox Fast Join - Build

echo.
echo =========================================
echo   ROBLOX FAST JOIN - Compilando .exe
echo =========================================
echo.

echo [1/3] Instalando dependencias...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
)

echo [1/3] Instalando PyInstaller...
pip install pyinstaller --quiet
if %errorlevel% neq 0 (
    echo ERROR: No se pudo instalar PyInstaller.
    pause
    exit /b 1
)
echo OK.

echo.
echo [2/3] Compilando...
echo Esto puede tardar 1-2 minutos, espera...
echo.

py.exe -m PyInstaller ^
    --noconfirm ^
    --onefile ^
    --windowed ^
    --name RobloxFastJoin ^
    --collect-all customtkinter ^
    --hidden-import browser_cookie3 ^
    --hidden-import requests ^
    --hidden-import uuid ^
    --hidden-import platform ^
    --hidden-import hashlib ^
    --hidden-import datetime ^
    app.py

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Fallo la compilacion.
    pause
    exit /b 1
)

echo.
echo [3/3] Limpiando temporales...
if exist build rmdir /s /q build
if exist RobloxFastJoin.spec del /q RobloxFastJoin.spec

echo.
echo =========================================
echo   LISTO: dist\RobloxFastJoin.exe
echo =========================================
echo.
echo Puedes mover ese .exe a cualquier carpeta.
echo Recuerda que el .exe necesita internet para
echo validar la licencia al arrancar.
echo.
pause
