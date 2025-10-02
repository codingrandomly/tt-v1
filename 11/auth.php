<?php
// UNIT II: State Management - Sessions Overview

// Start the session at the very beginning of the script.
// This must be called before any output (HTML) is sent to the browser.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- Logout Logic (Accessed via index.php?action=logout) ---
// UNIT II: Query String (for action=logout)
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    // Clear all session variables
    $_SESSION = array(); 
    
    // Destroy the session (Unit II)
    session_destroy();
    
    // CORRECTED REDIRECT: Redirect to the index page instead of the login endpoint
    header('Location: index.php');
    exit;
}

// --- Login Check Function (Kept for optional future use, but not actively used here) ---
// This function is defined to check login status, but it DOES NOT enforce a redirect.
// It is used by the index.php file to decide whether to show 'Login' or 'Logout'.
function is_logged_in() {
    return isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true;
}

// NOTE: The function require_login() has been completely removed to allow public access to index.php.
?>