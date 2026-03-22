<?php
/**
 * Profile Endpoint — Production Hardened
 * GET:    Validate token → Fetch MySQL user + MongoDB profile
 * POST:   Validate token → Validate + Sanitize → Update/Insert MongoDB profile
 * DELETE: Validate token → Logout (clear Redis tokens)
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ─── Get Token ──────────────────────────────────────────────
$token = getBearerToken();

// Fallback: check query param or POST data
if (empty($token)) {
    $token = $_GET['token'] ?? $_POST['token'] ?? '';
}

// ─── Validate Token ─────────────────────────────────────────
$userId = validateToken($redis, $token);

if ($userId === false) {
    http_response_code(401);
    sendResponse('error', 'Unauthorized. Invalid or expired token.');
}

// ─── Handle GET — Fetch Profile ─────────────────────────────
if ($method === 'GET') {

    // Fetch user from MySQL (prepared statement)
    $stmt = $mysqli->prepare("SELECT id, name, email FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        sendResponse('error', 'User not found');
    }

    // Fetch profile from MongoDB (if available)
    $profileData = [
        'age'        => '',
        'dob'        => '',
        'contact'    => '',
        'updated_at' => ''
    ];

    if ($profilesCollection !== null) {
        $profile = $profilesCollection->findOne(['user_id' => $userId]);
        if ($profile) {
            $profileData['age']        = $profile['age'] ?? '';
            $profileData['dob']        = $profile['dob'] ?? '';
            $profileData['contact']    = $profile['contact'] ?? '';
            $profileData['updated_at'] = $profile['updated_at'] ?? '';
        }
    }

    sendResponse('success', 'Profile fetched', [
        'user' => [
            'id'    => $user['id'],
            'name'  => htmlspecialchars($user['name'], ENT_QUOTES, 'UTF-8'),
            'email' => htmlspecialchars($user['email'], ENT_QUOTES, 'UTF-8')
        ],
        'profile' => $profileData
    ]);
}

// ─── Handle POST — Update Profile ───────────────────────────
if ($method === 'POST') {

    $age     = sanitize($_POST['age'] ?? '');
    $dob     = sanitize($_POST['dob'] ?? '');
    $contact = sanitize($_POST['contact'] ?? '');

    // ─── Field-Level Validation ─────────────────────────────
    $errors = [];

    if (!empty($age)) {
        if (!is_numeric($age) || (int)$age < 1 || (int)$age > 150) {
            $errors['age'] = 'Age must be between 1 and 150';
        }
    }

    if (!empty($dob)) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
            $errors['dob'] = 'Date format must be YYYY-MM-DD';
        } else {
            // Verify it's a real date
            $parts = explode('-', $dob);
            if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
                $errors['dob'] = 'Please enter a valid date';
            }
            // Cannot be in the future
            if (strtotime($dob) > time()) {
                $errors['dob'] = 'Date of birth cannot be in the future';
            }
        }
    }

    if (!empty($contact)) {
        if (!preg_match('/^\d{7,15}$/', $contact)) {
            $errors['contact'] = 'Contact must be 7-15 digits only';
        }
    }

    if (!empty($errors)) {
        sendResponse('error', 'Please fix the following errors', ['field_errors' => $errors]);
    }

    // Upsert profile in MongoDB
    if ($profilesCollection === null) {
        sendResponse('error', 'Profile storage (MongoDB) is not available. Please ensure MongoDB is running.');
    }

    $profilesCollection->updateOne(
        ['user_id' => $userId],
        ['$set' => [
            'user_id'    => $userId,
            'age'        => $age,
            'dob'        => $dob,
            'contact'    => $contact,
            'updated_at' => date('Y-m-d H:i:s')
        ]],
        ['upsert' => true]
    );

    sendResponse('success', 'Profile updated successfully');
}

// ─── Handle DELETE — Logout ─────────────────────────────────
if ($method === 'DELETE') {

    // Clear both token mappings
    $redis->del("token:$token");
    $redis->del("user_token:$userId");

    sendResponse('success', 'Logged out successfully');
}

// ─── Fallback ───────────────────────────────────────────────
sendResponse('error', 'Method not allowed');
