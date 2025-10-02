<?php
// Include the core authentication logic
require_once 'auth.php';

// Check if the user is already logged in (Unit II: State Management - Sessions)
if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    // If logged in, redirect them to the main application
    header('Location: index.html');
    exit;
}

// Handle form submission
$error_message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Simple authentication check (Unit I: Conditional Statement - if/else)
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    // Hardcoded credentials for demonstration (Replace with database checks later - Unit IV)
    if ($username === 'student' && $password === 'password123') {
        // Successful login: Set session variables (Unit II: State Management - Sessions)
        $_SESSION['logged_in'] = true;
        $_SESSION['username'] = $username;
        header('Location: index.html');
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
    <link rel="stylesheet" href="style.css">
    <style>
        .login-container { max-width: 400px; margin: 80px auto; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .login-container h2 { text-align: center; color: #2563eb; margin-bottom: 25px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937; }
        .form-group input { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; box-sizing: border-box; }
        .form-group input:focus { border-color: #2563eb; outline: none; }
        .error { color: #ef4444; text-align: center; margin-bottom: 15px; }
        .btn-primary { width: 100%; padding: 12px; background-color: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 600; transition: background-color 0.2s; }
        .btn-primary:hover { background-color: #1d4ed8; }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>TrendTracker Login</h2>
        <?php if ($error_message): ?>
            <p class="error"><?= $error_message ?></p>
        <?php endif; ?>

        <!-- Unit II: HTML Form using POST method -->
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
