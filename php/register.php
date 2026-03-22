<?php
/**
 * Register Endpoint — Production Hardened
 * POST: name, email, password, confirm_password
 * Checks: duplicate email, duplicate name, strong password, XSS sanitization
 * Storage: MySQL (prepared statements only)
 */

require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Method not allowed');
}

// ─── Rate Limiting (10 registrations per 15 minutes per IP) ──
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitKey = "ratelimit:register:$ip";
list($allowed, $remaining, $retryAfter) = checkRateLimit($redis, $rateLimitKey, 10, 900);

if (!$allowed) {
    http_response_code(429);
    sendResponse('error', "Too many registration attempts. Try again in " . ceil($retryAfter / 60) . " minutes.", [
        'retry_after' => $retryAfter
    ]);
}

// ─── Read & Sanitize Input ──────────────────────────────────
$name            = sanitize($_POST['name'] ?? '');
$email           = strtolower(trim($_POST['email'] ?? ''));
$password        = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';

// ─── Validate Fields ────────────────────────────────────────
$errors = [];

// Name validation
list($nameValid, $nameError) = validateName($name);
if (!$nameValid) {
    $errors['name'] = $nameError;
}

// Email validation
if (empty($email)) {
    $errors['email'] = 'Email address is required';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please enter a valid email address';
} elseif (strlen($email) > 254) {
    $errors['email'] = 'Email address is too long';
}

// Password validation
if (empty($password)) {
    $errors['password'] = 'Password is required';
} else {
    list($passValid, $passError) = validatePasswordStrength($password);
    if (!$passValid) {
        $errors['password'] = $passError;
    }
}

// Confirm password
if (empty($confirmPassword)) {
    $errors['confirm_password'] = 'Please confirm your password';
} elseif ($password !== $confirmPassword) {
    $errors['confirm_password'] = 'Passwords do not match';
}

// Return all field errors at once
if (!empty($errors)) {
    sendResponse('error', 'Please fix the following errors', ['field_errors' => $errors]);
}

// ─── Check Duplicate Email (Prepared Statement) ─────────────
$stmt = $mysqli->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    sendResponse('error', 'This email is already registered. Please login or use a different email.', [
        'field_errors' => ['email' => 'Email already registered']
    ]);
}
$stmt->close();

// ─── Check Duplicate Name (Prepared Statement) ──────────────
$stmt = $mysqli->prepare("SELECT id FROM users WHERE LOWER(name) = LOWER(?)");
$stmt->bind_param("s", $name);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    sendResponse('error', 'This name is already taken. Please use a different name.', [
        'field_errors' => ['name' => 'Name already taken']
    ]);
}
$stmt->close();

// ─── Hash Password (bcrypt, cost 12) ────────────────────────
$hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

// ─── Insert User (Prepared Statement) ───────────────────────
$stmt = $mysqli->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $email, $hashedPassword);

if ($stmt->execute()) {
    $stmt->close();
    sendResponse('success', 'Registration successful! Redirecting to login...');
} else {
    $stmt->close();
    sendResponse('error', 'Registration failed. Please try again.');
}
