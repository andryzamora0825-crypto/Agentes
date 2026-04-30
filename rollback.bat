@echo off
echo ========================================================
echo   ROLLBACK TOTAL: Volviendo al estado del 19 de Abril
echo   ANTES de cualquier cambio de Comunidad IA
echo   Commit: d0f37d7daa8a8061753c36bd9a5f49bee36283ca
echo ========================================================
echo.

echo Haciendo fetch del repositorio remoto...
git fetch origin
echo.

echo Reseteando TODO el codigo al 19 de abril (pre-Comunidad IA)...
git reset --hard d0f37d7daa8a8061753c36bd9a5f49bee36283ca
echo.

echo Subiendo el rollback a GitHub (force push)...
git push origin main -f
echo.

echo ========================================================
echo  Rollback TOTAL 100%% terminado.
echo  TODO el codigo ahora es del 19 de abril 2026.
echo  Verifique si hubo errores arriba.
echo ========================================================
pause
