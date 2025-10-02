<?php
// UNIT II: Demonstrates direct form handling using $_POST

// --- Configuration ---
// Note: This API Key is exposed to the client if this file is accessed directly.
// In a real scenario, the fetch logic would be moved to the server-side, 
// similar to what is done inside your api_proxy.php.
$FINCRUX_API_BASE = "https://api.fincrux.org/v1/";
$FINCRUX_API_KEY = "QiCUsVbfjEfyCSJUNGR9xS"; 

$stock_data = null;
$error_message = null;

// --- Form Submission Handler (Unit II: Working with Forms - $_POST) ---
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // 1. Capture form input using $_POST
    $ticker = strtoupper($_POST['ticker_input'] ?? '');
    
    // 2. Validate input
    if (empty($ticker)) {
        $error_message = "Please enter a valid stock ticker symbol.";
    } else {
        // 3. Construct the API URL for the direct fetch (Server-side simulation)
        $final_url = $FINCRUX_API_BASE . 'quote' . '?' . http_build_query([
            'ticker' => $ticker,
            'apiKey' => $FINCRUX_API_KEY
        ]);

        // 4. Fetching Data using cURL (Server-side I/O)
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $final_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response_data = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        // 5. Process API Response (Unit I: Conditional Statement)
        if ($http_code == 200) {
            $json_response = json_decode($response_data, true);
            $stock_data = $json_response['data'] ?? null;
            if (!$stock_data) {
                $error_message = "Stock not found or invalid response received.";
            }
        } else {
            $error_message = "API request failed with HTTP status: " . $http_code;
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PHP Form Stock Lookup</title>
    <style>
        body { font-family: sans-serif; background-color: #f8fafc; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        input[type="text"], button { padding: 10px; margin-right: 10px; border: 1px solid #ccc; border-radius: 4px; }
        button { background-color: #2563eb; color: white; cursor: pointer; border: none; }
        .error { color: #ef4444; margin-top: 15px; }
        .result-box { border: 1px solid #10b981; padding: 15px; margin-top: 20px; background-color: #f0fff0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Unit II: Direct PHP Form Submission Demo</h2>
        
        <!-- Unit II: The HTML Form -->
        <form method="POST" action="manual_stock_lookup.php">
            <label for="ticker_input">Enter Ticker (e.g., RELIANCE):</label>
            <input type="text" id="ticker_input" name="ticker_input" placeholder="e.g., TCS" required>
            <button type="submit">Lookup Stock</button>
        </form>

        <?php 
        // Display Error Message
        if ($error_message): ?>
            <p class="error">Error: <?= $error_message ?></p>
        <?php endif; 

        // Display Results (Unit I: Conditional Statement, Unit II: Variables Scope)
        if ($stock_data): ?>
            <div class="result-box">
                <h3><?= $stock_data['name'] ?? $stock_data['symbol'] ?> (<?= $stock_data['symbol'] ?>)</h3>
                <p><strong>Current Price:</strong> ₹<?= number_format($stock_data['last'], 2) ?></p>
                <p><strong>Change:</strong> <?= number_format($stock_data['change'], 2) ?>%</p>
                <p><strong>Market Cap:</strong> <?= $stock_data['marketCap'] ?></p>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
