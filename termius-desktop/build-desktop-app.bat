@echo off

echo ======================================================
echo   BUILDING TERMIUS DESKTOP NATIVE WINDOW APP (.EXE)   
echo ======================================================

:: --------------------------------------------------------
:: 1. Tắt các phiên ứng dụng cũ & Xóa file cài đặt cũ
:: --------------------------------------------------------
taskkill /F /IM "Termius Desktop.exe" 2>nul
taskkill /F /IM "Termius-Setup.exe" 2>nul
if exist "Termius-Setup.exe" del /f /q "Termius-Setup.exe" 2>nul

:: --------------------------------------------------------
:: 2. Kiểm tra & Tự động tải/cài đặt Node.js / npm nếu thiếu
:: --------------------------------------------------------
where npm >nul 2>nul
if %errorlevel% equ 0 goto CHECK_RUST

echo [!] Chưa tìm thấy Node.js / npm. Đang tự động tải về và cài đặt...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node_setup.msi'" 2>nul

if exist "%TEMP%\node_setup.msi" (
    echo [*] Đang tự động cài đặt Node.js...
    msiexec /i "%TEMP%\node_setup.msi" /qn /norestart
    del /f /q "%TEMP%\node_setup.msi" 2>nul
    set "PATH=%ProgramFiles%\nodejs\;%APPDATA%\npm;%PATH%"
)

where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo [✔] Cài đặt Node.js tự động thành công!
    goto CHECK_RUST
)

echo ======================================================
echo [!] Lỗi: Tự động cài đặt Node.js thất bại.
echo     Vui lòng tải và cài đặt thủ công Node.js tại:
echo     https://nodejs.org/
echo ======================================================
pause
exit /b 1

:CHECK_RUST
:: --------------------------------------------------------
:: 3. Kiểm tra & Tự động tải/cài đặt Rust Compiler (cargo) nếu thiếu
:: --------------------------------------------------------
where cargo >nul 2>nul
if %errorlevel% equ 0 goto CHECK_BUILD_TOOLS

echo [!] Chưa tìm thấy Rust. Đang tự động tải về toolchain rustup...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://win.rustup.rs/x86_64' -OutFile '%TEMP%\rustup-init.exe'" 2>nul

if exist "%TEMP%\rustup-init.exe" (
    echo [*] Đang tự động cài đặt Rust Compiler...
    "%TEMP%\rustup-init.exe" -y --default-host x86_64-pc-windows-msvc --default-toolchain stable
    del /f /q "%TEMP%\rustup-init.exe" 2>nul
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

where cargo >nul 2>nul
if %errorlevel% equ 0 (
    echo [✔] Cài đặt Rust Compiler tự động thành công!
    goto CHECK_BUILD_TOOLS
)

echo ======================================================
echo [!] Lỗi: Tự động cài đặt Rust thất bại.
echo     Vui lòng tải và cài đặt thủ công Rust tại:
echo     https://rustup.rs/
echo ======================================================
pause
exit /b 1

:CHECK_BUILD_TOOLS
:: --------------------------------------------------------
:: 4. Kiểm tra C++ Build Tools (MSVC Linker)
:: --------------------------------------------------------
where link.exe >nul 2>nul
if %errorlevel% equ 0 goto START_BUILD

if exist "%ProgramFiles%\Microsoft Visual Studio" goto START_BUILD

echo [!] Cảnh báo: Chưa phát hiện C++ Build Tools.
echo     Đang tải bộ cài Visual Studio C++ Build Tools tự động...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile '%TEMP%\vs_buildtools.exe'" 2>nul

if exist "%TEMP%\vs_buildtools.exe" (
    echo [*] Đang khởi chạy bộ cài Visual Studio C++ Build Tools...
    "%TEMP%\vs_buildtools.exe" --quiet --wait --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
    del /f /q "%TEMP%\vs_buildtools.exe" 2>nul
)

:START_BUILD
echo [*] Kiểm tra môi trường hoàn tất! Đang tiến hành build...

:: 5. Kiểm tra và tự động npm install nếu chưa có node_modules
if exist "node_modules" goto BUILD_FRONTEND

echo [*] Chưa tìm thấy thư mục node_modules. Đang tự động npm install...
call npm install
if %errorlevel% neq 0 (
    echo [!] Lỗi: npm install thất bại. Vui lòng kiểm tra kết nối mạng.
    echo ======================================================
    pause
    exit /b 1
)

:BUILD_FRONTEND
:: 6. Build Frontend (React + Vite)
echo [*] [1/2] Biên dịch React Frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [!] Lỗi: Biên dịch Frontend thất bại. Vui lòng kiểm tra log lỗi ở trên.
    echo ======================================================
    pause
    exit /b 1
)

:: 7. Build Desktop Native App (Tauri)
echo [*] [2/2] Đóng gói ứng dụng Windows bằng Tauri...
call npx tauri build
if %errorlevel% neq 0 (
    echo [!] Lỗi: Đóng gói Tauri App thất bại. Vui lòng kiểm tra log lỗi ở trên.
    echo ======================================================
    pause
    exit /b 1
)

:: 8. Tìm và copy file mới tạo ra Termius-Setup.exe
if exist "src-tauri\target\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" (
    copy /y "src-tauri\target\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" "Termius-Setup.exe"
) else if exist "%USERPROFILE%\.cargo_build_termius\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" (
    copy /y "%USERPROFILE%\.cargo_build_termius\release\bundle\nsis\Termius Desktop_1.0.0_x64-setup.exe" "Termius-Setup.exe"
) else (
    for /r "src-tauri\target" %%F in (*setup.exe) do (
        copy /y "%%F" "Termius-Setup.exe"
    )
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
