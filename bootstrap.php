<?php
// bootstrap.php

// --- ERROR REPORTING (para desarrollo, comentar en producción) ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// --- CORS HEADERS ---
header('Access-Control-Allow-Origin: https://gamesog.netlify.app');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, ngrok-skip-browser-warning');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- DATABASE CONNECTION ---
include 'db_connect.php';

// --- DEFAULT RESPONSE ARRAY ---
$response = ['success' => false, 'message' => ''];
?>