<?php
/**
 * Login Endpoint — Production Hardened
 * POST: email, password → Verify → Generate token → Store in Redis
 * Features: Rate limiting (5 attempts/15min per IP+email), timing-safe responses
 */

require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Method not allowed');
}

// ─── Read Input ─────────────────────────────────────────────
$email    = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';

// ─── Validate Input ─────────────────────────────────────────
$errors = [];

if (empty($email)) {
    $errors['email'] = 'Email address is required';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please enter a valid email address';
}

if (empty($password)) {
    $errors['password'] = 'Password is required';
}

if (!empty($errors)) {
    sendResponse('error', 'Please fix the following errors', ['field_errors' => $errors]);
}

// ─── Rate Limiting (5 login attempts per 15 minutes per IP+email) ──
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitKey = "ratelimit:login:" . md5($ip . ':' . $email);
list($allowed, $remaining, $retryAfter) = checkRateLimit($redis, $rateLimitKey, 5, 900);

if (!$allowed) {
    $minutes = ceil($retryAfter / 60);
    http_response_code(429);
    sendResponse('error', "Account temporarily locked. Too many failed attempts. Try again in $minutes minute(s).", [
        'locked'      => true,
        'retry_after' => $retryAfter,
        'field_errors' => ['email' => "Locked for $minutes min"]
    ]);
}

// ─── Fetch User (Prepared Statement) ────────────────────────
$stmt = $mysqli->prepare("SELECT id, name, email, password FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    // Generic message to prevent email enumeration
    sendResponse('error', 'Invalid email or password', [
        'attempts_remaining' => $remaining
    ]);
}

$user = $result->fetch_assoc();
$stmt->close();

// ─── Verify Password ───────────────────────────────────────
if (!password_verify($password, $user['password'])) {
    sendResponse('error', 'Invalid email or password', [
        'attempts_remaining' => $remaining
    ]);
}

// ─── Successful Login — Reset rate limiter ──────────────────
$redis->del($rateLimitKey);

// ─── Invalidate any existing tokens for this user ───────────
// Search and delete old tokens (prevents session piling)
$existingTokenKey = "user_token:" . $user['id'];
$oldToken = $redis->get($existingTokenKey);
if ($oldToken) {
    $redis->del("token:$oldToken");
}

// ─── Generate Secure Token ──────────────────────────────────
$token = bin2hex(random_bytes(32)); // 64 char hex token (256-bit)

// ─── Store Token in Redis (1 hour expiry) ───────────────────
$redis->setex("token:$token", 3600, $user['id']);
$redis->setex("user_token:" . $user['id'], 3600, $token);

// ─── Return Success ─────────────────────────────────────────
sendResponse('success', 'Login successful! Redirecting...', [
    'token'   => $token,
    'user_id' => $user['id'],
    'name'    => $user['name']
]);
