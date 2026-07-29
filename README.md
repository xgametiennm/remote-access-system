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

## 🚀 Hướng dẫn Cài đặt & Sử dụng

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

### 2. Chạy ứng dụng Desktop (`termius-desktop`)

Yêu cầu: Node.js (v18+) và Rust compiler.

```bash
cd termius-desktop

# Cài đặt thư viện Node.js
npm install

# Chạy giao diện ở chế độ Development (Web)
npm run dev

# Chạy ứng dụng Desktop (Tauri)
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

## 🛡 Bỏ qua Build & Security (.gitignore)

Dự án tự động loại bỏ các file tạm/biên dịch:
- Thư mục build Rust: `target/`, `**/target/`
- Thư mục Node.js: `node_modules/`
- Thư mục đóng gói Web/Tauri: `dist/`, `build/`
- File biến môi trường chứa bí mật: `.env`

---

## 📄 Giấy phép

Dự án được phát hành dưới bản quyền cá nhân.
