@echo off
echo ======================================================
echo   BUILDING TERMIUS DESKTOP NATIVE WINDOW APP (.EXE)   
echo ======================================================

:: Tắt các phiên Termius Desktop đang mở để tránh bị Windows khóa file
taskkill /F /IM "Termius Desktop.exe" 2>nul
taskkill /F /IM "Termius-Setup.exe" 2>nul

:: Xóa thư mục bundle cũ nếu có
if exist "C:\Users\TIENNM\.cargo_build_termius\release\bundle" (
    rmdir /s /q "C:\Users\TIENNM\.cargo_build_termius\release\bundle" 2>nul
)

cmd /c npm run build
cmd /c npx tauri build

if exist "C:\Users\TIENNM\.cargo_build_termius\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" (
    copy /y "C:\Users\TIENNM\.cargo_build_termius\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" "Termius-Setup.exe" >nul
)

echo ======================================================
echo [✔] Build complete! Termius-Setup.exe created.
echo ======================================================
pause
