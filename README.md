# AuthVault — Full Stack Authentication & Profile Management System

A production-grade user authentication system built with **PHP**, **MySQL**, **MongoDB**, **Redis**, and a modern dark-themed UI. Features secure registration with duplicate detection, rate-limited login, token-based session management, and a dynamic profile editor.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, Bootstrap 5, jQuery | Responsive UI & AJAX communication |
| **Backend** | PHP 8+ | API endpoints & server logic |
| **Auth DB** | MySQL | User credentials (prepared statements) |
| **Profile DB** | MongoDB | User profile data (age, DOB, contact) |
| **Session Store** | Redis | Token-based session management |

---

## Project Structure

```
AuthVault/
├── index.html             # Landing page
├── register.html          # Registration page
├── login.html             # Login page
├── profile.html           # Profile management page
│
├── css/
│   └── style.css          # Complete design system (dark theme)
│
├── js/
│   ├── register.js        # Registration logic + validation
│   ├── login.js           # Login logic + rate limit handling
│   └── profile.js         # Profile CRUD + change detection
│
├── php/
│   ├── config.php         # DB connections + helper functions
│   ├── register.php       # POST — Register new user
│   ├── login.php          # POST — Authenticate user
│   └── profile.php        # GET/POST/DELETE — Profile & logout
│
├── vendor/                # Composer dependencies (MongoDB driver)
├── composer.json
└── composer.lock
```

---

##  Application Flow

```
Register → Login → Profile → Update → Logout
```

1. **Register** — Create account with name, email, password (+ confirm password)
2. **Login** — Authenticate with email & password, receive session token
3. **Profile** — View/edit additional details (age, DOB, contact)
4. **Logout** — Destroy session token and redirect to login

---

##  Requirements Compliance

| Requirement | Implementation |
|------------|---------------|
| HTML, JS, CSS, PHP in **separate files** | Yes — No code co-exists in the same file |
| **jQuery AJAX** only (no form submission) | Yes — All client-server communication via `$.ajax()` |
| **Bootstrap** for responsive design | Yes — Bootstrap 5 grid, floating labels, responsive breakpoints |
| **MySQL** for registered data | Yes — User credentials stored in MySQL |
| **MongoDB** for profile details | Yes — Age, DOB, contact stored in MongoDB |
| **Prepared Statements** only (no raw SQL) | Yes — All queries use `$mysqli->prepare()` |
| **localStorage** for login session | Yes — Token stored in `localStorage` (no PHP sessions) |
| **Redis** for backend session storage | Yes — Tokens stored with `setex()` and 1-hour TTL |

---

## Security Features

- **Password Hashing** — bcrypt with cost factor 12
- **Strong Password Policy** — Min 8 chars, uppercase, lowercase, number, special character
- **Duplicate Detection** — Checks both email AND name before registration
- **Rate Limiting** — 5 login attempts per 15 minutes (per IP + email)
- **Registration Throttle** — 10 registrations per 15 minutes per IP
- **XSS Prevention** — All inputs sanitized with `htmlspecialchars()`
- **Token Security** — 256-bit cryptographic tokens (`random_bytes(32)`)
- **Session Invalidation** — Old tokens destroyed on new login
- **Input Validation** — Client-side (JS) AND server-side (PHP) validation
- **Field-Level Errors** — Inline error messages for every form field
- **Account Lockout UI** — Visual feedback when rate limit is exceeded

---

## Setup Instructions

### Prerequisites

- **XAMPP** (PHP 8+, MySQL)
- **MongoDB** Community Server
- **Redis** for Windows
- **Composer** (PHP dependency manager)

### 1. Database Setup

```sql
-- MySQL
CREATE DATABASE auth_system;
USE auth_system;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```
-- MongoDB (auto-created on first write)
Database: auth_system
Collection: profiles
```

### 2. Install Dependencies

```bash
cd /path/to/AuthVault
composer install
```

### 3. Configure Database Credentials

Edit `php/config.php` and update:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'your_mysql_password');
define('DB_NAME', 'auth_system');
```

### 4. Start Services

```bash
# Start MySQL & Apache (via XAMPP)
# Start MongoDB
net start MongoDB

# Start Redis
redis-server
```

### 5. Run the Application

```bash
php -S localhost:8000
```

Open **http://localhost:8000** in a browser.

---

## Design

- **Theme** — Dark mode with `#030303` background
- **Accent** — Sky blue `#38BDF8`
- **Typography** — Inter (sans-serif) + Newsreader (serif italic for headings)
- **Effects** — Glassmorphism cards, animated buttons, glow borders
- **Responsive** — Mobile-first design with Bootstrap 5 grid

---

## Screenshots

### Landing Page
Clean, centered hero with animated shield icon and CTA buttons.

### Registration Page
Glassmorphism card with password strength meter, confirm password, and inline validation.

### Login Page
Dark-themed login with rate limit lockout warning display.

### Profile Page
Avatar with glow animation, editable fields with change detection.

---
