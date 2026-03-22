<?php
/**
 * Configuration File
 * MySQL, MongoDB, Redis connections + CORS + JSON helpers
 * Supports both local development and Railway deployment (environment variables)
 */

// ─── Error Handling ─────────────────────────────────────────
error_reporting(0);
ini_set('display_errors', 0);

set_exception_handler(function ($e) {
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode([
        'status' => 'error',
        'message' => 'Server error: ' . $e->getMessage()
    ]);
    exit();
});

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ─── CORS Headers ───────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── MySQL Connection ───────────────────────────────────────
// Railway sets MYSQL_URL or individual MYSQL_* env vars
$dbHost = getenv('MYSQLHOST') ?: getenv('DB_HOST') ?: 'localhost';
$dbUser = getenv('MYSQLUSER') ?: getenv('DB_USER') ?: 'root';
$dbPass = getenv('MYSQLPASSWORD') ?: getenv('DB_PASS') ?: 'VINdhya@123';
$dbName = getenv('MYSQLDATABASE') ?: getenv('DB_NAME') ?: 'auth_system';
$dbPort = getenv('MYSQLPORT') ?: 3306;

$mysqli = null;
try {
    $mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName, (int)$dbPort);
    if ($mysqli->connect_error) {
        echo json_encode([
            'status' => 'error',
            'message' => 'MySQL connection failed: ' . $mysqli->connect_error
        ]);
        exit();
    }
    $mysqli->set_charset("utf8mb4");
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'MySQL connection failed: ' . $e->getMessage()
    ]);
    exit();
}

// ─── Redis Connection ───────────────────────────────────────
// Railway sets REDIS_URL or individual REDIS_* env vars
$redisHost = getenv('REDISHOST') ?: '127.0.0.1';
$redisPort = getenv('REDISPORT') ?: 6379;
$redisPass = getenv('REDISPASSWORD') ?: null;

$redis = null;
try {
    $redis = new Redis();
    $redis->connect($redisHost, (int)$redisPort);
    if ($redisPass) {
        $redis->auth($redisPass);
    }
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Redis connection failed: ' . $e->getMessage()
    ]);
    exit();
}

// ─── MongoDB Connection ─────────────────────────────────────
$mongoClient = null;
$mongoDB = null;
$profilesCollection = null;

$vendorAutoload = __DIR__ . '/../vendor/autoload.php';
if (file_exists($vendorAutoload)) {
    require_once $vendorAutoload;
    try {
        $mongoUrl = getenv('MONGO_URL') ?: getenv('MONGODB_URL') ?: 'mongodb://localhost:27017';
        $mongoDbName = getenv('MONGO_DB') ?: 'auth_system';

        $mongoClient = new MongoDB\Client($mongoUrl);
        $mongoDB = $mongoClient->$mongoDbName;
        $profilesCollection = $mongoDB->profiles;
    } catch (Exception $e) {
        $mongoClient = null;
        $mongoDB = null;
        $profilesCollection = null;
    }
}

// ─── Helper Functions ───────────────────────────────────────

function sendResponse($status, $message, $data = []) {
    $response = array_merge(['status' => $status, 'message' => $message], $data);
    echo json_encode($response);
    exit();
}

function getBearerToken() {
    $headers = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $reqHeaders = apache_request_headers();
        if (isset($reqHeaders['Authorization'])) {
            $headers = $reqHeaders['Authorization'];
        }
    }
    if (!empty($headers) && preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
        return $matches[1];
    }
    return null;
}

function validateToken($redis, $token) {
    if (empty($token)) return false;
    $userId = $redis->get("token:$token");
    return $userId !== false ? (int)$userId : false;
}

// ─── Production Helpers ─────────────────────────────────────

function sanitize($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

function validatePasswordStrength($password) {
    if (strlen($password) < 8) {
        return [false, 'Password must be at least 8 characters long'];
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return [false, 'Password must contain at least one uppercase letter'];
    }
    if (!preg_match('/[a-z]/', $password)) {
        return [false, 'Password must contain at least one lowercase letter'];
    }
    if (!preg_match('/[0-9]/', $password)) {
        return [false, 'Password must contain at least one number'];
    }
    if (!preg_match('/[!@#$%^&*()_+\-=\[\]{};\':\"\\|,.<>\/?]/', $password)) {
        return [false, 'Password must contain at least one special character'];
    }
    return [true, ''];
}

function checkRateLimit($redis, $key, $maxAttempts, $windowSeconds) {
    $current = (int) $redis->get($key);
    if ($current >= $maxAttempts) {
        $ttl = $redis->ttl($key);
        return [false, 0, $ttl > 0 ? $ttl : $windowSeconds];
    }
    if ($current === 0) {
        $redis->setex($key, $windowSeconds, 1);
    } else {
        $redis->incr($key);
    }
    return [true, $maxAttempts - $current - 1, 0];
}

function validateName($name) {
    if (strlen($name) < 2) {
        return [false, 'Name must be at least 2 characters'];
    }
    if (strlen($name) > 100) {
        return [false, 'Name must be 100 characters or less'];
    }
    if (!preg_match('/^[a-zA-Z\s\'-]+$/', $name)) {
        return [false, 'Name can only contain letters, spaces, hyphens, and apostrophes'];
    }
    return [true, ''];
}
