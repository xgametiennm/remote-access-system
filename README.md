# Remote Access System

Hệ thống quản lý và truy cập máy chủ từ xa an toàn, hiệu quả với kiến trúc hiện đại gồm Agent Daemon, công cụ CLI và Giao diện Desktop (Tauri + React).

---

## 🏗 Kiến trúc Dự án

Dự án bao gồm 3 thành phần chính:

| Thành phần | Công nghệ | Mô tả |
| :--- | :--- | :--- |
| 🛡 **`agent/`** | Rust, Systemd | Service chạy ngầm trên máy chủ mục tiêu (Daemon), hỗ trợ tự động cài đặt qua `run.sh` và thiết lập Cron Daily Health Check. |
| 💻 **`cli/`** | Rust | Công cụ dòng lệnh nhẹ kết nối và điều khiển Agent từ xa. |
| 🖥 **`termius-desktop/`** | Tauri, React, TypeScript, Vite, Tailwind CSS | Giao diện Desktop ứng dụng quản lý máy chủ hiện đại theo phong cách Termius (quản lý Vaults, Terminal Tabs, danh sách Host). |

---

## ✨ Tính năng nổi bật

- **Tự động hóa Agent Installer (`run.sh`):** Cài đặt tự động dưới dạng Systemd Daemon (`remote-agent.service`), mở cổng Firewall (`ufw`/`iptables`) và thiết lập Cron Daily kiểm tra sức khỏe tự động khôi phục khi gặp sự cố.
- **Giao diện Desktop hiện đại:** Được phát triển bằng Tauri v2 + React, hỗ trợ đa tab Terminal, lưu trữ thông tin đăng nhập an toàn (Vaults) và giao diện Dark Mode cao cấp.
- **Tối ưu hiệu năng:** Thành phần Backend Agent và CLI viết hoàn toàn bằng **Rust** cho khả năng xử lý nhanh, chiếm cực ít RAM và CPU.

---

## 🚀 Hướng dẫn Cài đặt & Phục vụ Development

### 1. Cài đặt Agent trên Server (Linux)

Chạy script cài đặt tự động với quyền `root`/`sudo`:

```bash
cd agent
sudo ./run.sh [PORT]
```
*(Mặc định cổng là `23` nếu không truyền tham số).*

- **Kiểm tra trạng thái Service:**
  ```bash
  systemctl status remote-agent
  ```
- **Xem Log Health Check:**
  ```bash
  cat /var/log/remote-agent-health.log
  ```

---

### 2. Chạy ứng dụng Desktop ở chế độ Dev (`termius-desktop`)

Yêu cầu: Node.js (v18+) và Rust compiler toolchain.

```bash
cd termius-desktop

# Cài đặt thư viện Node.js
npm install

# Chạy giao diện ở chế độ Development (Web)
npm run dev

# Chạy ứng dụng Desktop (Tauri Dev Mode)
npm run tauri dev
```

---

### 3. Chạy công cụ CLI

```bash
cd cli
cargo run --release
```
Hoặc chạy bằng script trên Windows:
```cmd
run-cli.bat
```

---

## 📦 Hướng dẫn Biên dịch / Build File Thực Thi (.exe & Binary)

### 1. Build File Cài Đặt Desktop App (`.exe` / `.msi`)

Để đóng gói ứng dụng **Termius Desktop** thành file cài đặt Windows `.exe`:

```bash
cd termius-desktop

# Cài đặt phụ thuộc (nếu chưa cài)
npm install

# Biên dịch ứng dụng ra file .exe installer
npm run tauri build
```

📌 **Vị trí file `.exe` sau khi build thành công:**
- **File Cài đặt Windows Installer (`.exe` / `.msi`):**  
  `termius-desktop/src-tauri/target/release/bundle/nsis/`  
  hoặc `termius-desktop/src-tauri/target/release/bundle/msi/`
- **File thực thi trực tiếp (`.exe` không qua installer):**  
  `termius-desktop/src-tauri/target/release/termius-desktop.exe`

---

### 2. Build File CLI Thực Thi (`.exe`)

Để đóng gói công cụ dòng lệnh **CLI** thành file `.exe` chạy trực tiếp trên Windows:

```bash
cd cli
cargo build --release
```

📌 **Vị trí file `.exe` sau khi build:**
- `cli/target/release/remote-cli.exe` (hoặc `target/release/remote-cli.exe`)

---

### 3. Build Agent Binary (Linux Daemon)

Biên dịch file thực thi cho Agent chạy trên máy chủ Linux:

```bash
cd agent
cargo build --release --bin remote-agent
```

📌 **Vị trí file sau khi build:**
- `agent/target/release/remote-agent` (hoặc `./target/release/remote-agent`)

---

## 🛡 Bỏ qua Build & Security (.gitignore)

Dự án tự động loại bỏ các file tạm/biên dịch:
- Thư mục build Rust: `target/`, `**/target/`
- Thư mục Node.js: `node_modules/`, `**/node_modules/`
- Thư mục đóng gói Web/Tauri: `dist/`, `build/`
- File biến môi trường chứa bí mật: `.env`

---

## 📄 Giấy phép

Dự án được phát hành dưới bản quyền cá nhân.
