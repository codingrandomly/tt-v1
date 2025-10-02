<?php
// UNIT II: State Management - Sessions Overview

// Start the session at the very beginning of the script.
// This must be called before any output (HTML) is sent to the browser.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- Logout Logic (Accessed via index.html?action=logout) ---
// UNIT II: Query String (for action=logout)
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    // Clear all session variables
    $_SESSION = array(); 
    
    // Destroy the session (Unit II)
    session_destroy();
    
    // Redirect to the login page
    header('Location: login.php');
    exit;
}

// --- Mandatory Login Check Function ---
// UNIT I: Conditional Statement - if else
function require_login() {
    if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
        // If not logged in, redirect them immediately
        header('Location: login.php');
        exit;
    }
}
?>
