@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo   BUILDING TERMIUS DESKTOP NATIVE WINDOW APP (.EXE)   
echo ======================================================

:: 1. Kiểm tra môi trường Node.js / npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Lỗi: Chưa tìm thấy Node.js / npm trên máy tính!
    echo     Vui lòng tải và cài đặt Node.js (v18+) tại: https://nodejs.org/
    echo ======================================================
    pause
    exit /b 1
)

:: 2. Kiểm tra môi trường Rust / Cargo
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Lỗi: Chưa tìm thấy Rust Compiler (cargo) trên máy tính!
    echo     Vui lòng tải và cài đặt Rust tại: https://rustup.rs/
    echo ======================================================
    pause
    exit /b 1
)

echo [*] Kiểm tra môi trường thành công! Đang tiến hành build...

:: 3. Tắt các phiên ứng dụng cũ đang chạy để tránh bị khóa file
taskkill /F /IM "Termius Desktop.exe" 2>nul
taskkill /F /IM "Termius-Setup.exe" 2>nul

:: 4. Build Frontend (React + Vite)
echo [*] [1/2] Biên dịch React Frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [!] Lỗi: Biên dịch Frontend thất bại. Vui lòng kiểm tra log lỗi ở trên.
    echo ======================================================
    pause
    exit /b 1
)

:: 5. Build Desktop Native App (Tauri)
echo [*] [2/2] Đóng gói ứng dụng Windows bằng Tauri...
call npx tauri build
if %errorlevel% neq 0 (
    echo [!] Lỗi: Đóng gói Tauri App thất bại. Vui lòng kiểm tra log lỗi ở trên.
    echo ======================================================
    pause
    exit /b 1
)

:: 6. Kiểm tra file .exe xuất ra
if exist "src-tauri\target\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" (
    copy /y "src-tauri\target\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" "Termius-Setup.exe" >nul
)

if exist "Termius-Setup.exe" (
    echo ======================================================
    echo [✔] Build hoàn tất thành công!
    echo     File cài đặt: termius-desktop\Termius-Setup.exe
    echo ======================================================
) else (
    echo ======================================================
    echo [!] Lỗi: Không tìm thấy file Termius-Setup.exe sau khi build.
    echo ======================================================
)

pause
