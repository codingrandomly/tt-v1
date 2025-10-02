<?php
// UNIT I/II: Setting Headers for JSON and CORS
// This tells the browser the content type and allows cross-origin requests.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
// Allows POST requests for form submissions (Unit II: Working with Forms)
header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); 
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests for CORS (Unit II: Working with Forms - Request Handling)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Configuration (Unit I: Variables & Constants) ---
$FINCRUX_API_BASE = "https://api.fincrux.org/v1/";
$FINCRUX_API_KEY = "QiCUsVbfjEfyCSJUNGR9xS"; 

// --- Input Handling (Unit II: Super Global Variables - $_GET & $_POST) ---
// We first look for parameters in GET (used by our current JS logic)
$input_params = $_GET;

// If the request method is POST (e.g., from an HTML form submission), read the raw body
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Read the raw JSON data from the request body
    $raw_post_data = file_get_contents('php://input');
    // Decode the JSON data (Unit II: Functions - json_decode)
    $post_params = json_decode($raw_post_data, true);
    
    // Merge POST data into our main parameters, prioritizing POST data
    if ($post_params && is_array($post_params)) {
        $input_params = array_merge($input_params, $post_params);
    }
}

$endpoint = $input_params['endpoint'] ?? null;
$ticker = $input_params['ticker'] ?? null;
$period = $input_params['period'] ?? null;
$interval = $input_params['interval'] ?? null;
$limit = $input_params['limit'] ?? null;

// Validate essential input (Unit I: Conditional Statement - if)
if (!$endpoint) {
    echo json_encode(['status' => 'error', 'message' => 'Endpoint not specified.']);
    exit;
}

// Build the Fincrux URL
$api_url = $FINCRUX_API_BASE . $endpoint;
$query_params = array('apiKey' => $FINCRUX_API_KEY);

// Add parameters relevant to the endpoint (Unit II: Functions - http_build_query)
if ($ticker) $query_params['ticker'] = $ticker;
if ($period) $query_params['period'] = $period;
if ($interval) $query_params['interval'] = $interval;
if ($limit) $query_params['limit'] = $limit;

// Final Fincrux URL
$final_url = $api_url . '?' . http_build_query($query_params);

// --- Fetching Data using cURL (Unit III: Working with Files - Network I/O) ---
$ch = curl_init(); 
curl_setopt($ch, CURLOPT_URL, $final_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1); 
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); 
curl_setopt($ch, CURLOPT_TIMEOUT, 15); 

$response_data = curl_exec($ch); 
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE); 
$error = curl_error($ch); 
curl_close($ch); 

// --- Error Checking and Response (Unit I: Conditional Statement) ---
if ($error) {
    // Respond to JavaScript with the cURL error
    echo json_encode(['status' => 'error', 'message' => 'cURL Error: ' . $error]);
} elseif ($http_code !== 200) {
    // Respond with the specific API server error
    echo json_encode(['status' => 'error', 'message' => 'API Error: HTTP Status ' . $http_code, 'api_response' => $response_data]);
} else {
    // Successful API call
    $json_response = json_decode($response_data, true);

    // Echo the specific 'data' field back to the JavaScript
    echo json_encode(['status' => 'success', 'data' => $json_response['data'] ?? $json_response]);
}
?>
