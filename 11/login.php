<?php
// UNIT II: State Management - Sessions Overview

// Start the session at the very beginning of the script.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Set header to return JSON (Critical for AJAX modal login)
header('Content-Type: application/json');

// Handle form submission (Unit II: Working with Forms)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Read the raw JSON data from the request body sent by the AJAX request
    $raw_post_data = file_get_contents('php://input');
    $data = json_decode($raw_post_data, true);
    
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    // Simple authentication check (Unit I: Conditional Statement - if/else)
    // Hardcoded credentials for demonstration: student / password123
    if ($username === 'student' && $password === 'password123') {
        // Successful login: Set session variables (Unit II: State Management - Sessions)
        $_SESSION['logged_in'] = true;
        $_SESSION['username'] = $username;
        
        // Return success message
        echo json_encode(['status' => 'success']);
    } else {
        // Return error message
        echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
    }
} else {
    // If accessed via GET or any non-POST method (e.g., direct URL access)
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
exit;
?>