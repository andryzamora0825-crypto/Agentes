@echo off
echo ========================================================
echo        Subiendo el codigo a GitHub automaticamente...
echo ========================================================
echo.

git add .
git commit -m "Migracion a OpenAI y mejoras generales"
git push origin main -f

echo.
echo ========================================================
echo  Proceso 100%% terminado. Verifique si hubo errores arriba.
echo ========================================================
pause
