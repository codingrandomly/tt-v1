<?php
// Include the core authentication logic, which starts the session
require_once 'auth.php';

// Handle form submission (Unit II: Working with Forms)
$error_message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Capture form input using $_POST (Unit II: Super Global Variables)
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    // Simple authentication check (Unit I: Conditional Statement - if/else)
    // Hardcoded credentials for demonstration: student / password123
    if ($username === 'student' && $password === 'password123') {
        // Successful login: Set session variables (Unit II: State Management - Sessions)
        $_SESSION['logged_in'] = true;
        $_SESSION['username'] = $username;
        
        // Redirect to the main application page
        header('Location: index.php');
        exit;
    } else {
        $error_message = 'Invalid username or password.';
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>User Login (PHP Demo)</title>
    <!-- Use the main CSS file for styling consistency -->
    <link rel="stylesheet" href="style.css">
    <style>
        /* Specific CSS for the Login Box */
        .login-container { max-width: 400px; margin: 80px auto; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .login-container h2 { text-align: center; color: var(--primary-color); margin-bottom: 25px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); }
        .form-group input { width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; }
        .form-group input:focus { border-color: var(--primary-color); outline: none; }
        .error { color: var(--error-color); text-align: center; margin-bottom: 15px; }
        .btn-primary { width: 100%; padding: 12px; background-color: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; transition: background-color 0.2s; }
        .btn-primary:hover { background-color: var(--primary-dark); }
        
        /* Center the login page content */
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: var(--bg-secondary); }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>TrendTracker Login</h2>
        <?php if ($error_message): ?>
            <p class="error"><?= $error_message ?></p>
        <?php endif; ?>

        <!-- Unit II: HTML Form using POST method, action targets this same file -->
        <form method="POST" action="login.php">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" value="student" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" value="password123" required>
            </div>
            <button type="submit" class="btn-primary">Login</button>
        </form>
    </div>
</body>
</html>
