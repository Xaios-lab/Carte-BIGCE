@echo off
title Studio Crea IA
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js n'est pas installe. Telechargez-le sur https://nodejs.org (bouton LTS), installez-le, puis relancez ce fichier.
  pause & exit /b 1
)
if not exist node_modules (
  echo Premiere installation, patientez une a deux minutes...
  call npm install --no-audit --no-fund || (echo Echec de l'installation. & pause & exit /b 1)
)
if not exist .env copy .env.example .env >nul
start "" http://localhost:3777
echo.
echo  Studio Crea IA demarre : http://localhost:3777  (laissez cette fenetre ouverte)
echo  Pour arreter : fermez cette fenetre.
echo.
node server/index.js
pause
