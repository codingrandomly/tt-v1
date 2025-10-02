<?php
// UNIT I: Server-Side Execution
// This MUST be the first thing in the file to ensure session_start() runs for the Logout link.
require_once 'auth.php'; 
// NOTE: The function require_login() has been REMOVED to allow public access.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TrendTracker - Stock Screening & Analysis</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="loading-overlay" class="loading" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--bg-primary); z-index: 5000; display: none; flex-direction: column; gap: 1rem; font-size: 1.2rem;">
        <i class="fas fa-spinner fa-spin fa-3x"></i>
        <span>Loading Market Data...</span>
    </div>

    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-brand" onclick="showPage('home')">
                <i class="fas fa-chart-line"></i>
                <span>TrendTracker</span>
            </div>
            
            <div class="nav-menu">
                <a href="index.php" onclick="showPage('home')">Home</a>
                <a href="#" onclick="showPage('screens')">Screens</a>
                <a href="#" onclick="showPage('portfolio')">Portfolio</a>
                <a href="#" onclick="showPage('news')">News</a>
                <a href="#" onclick="showPage('tools')">Tools</a>
                
                <?php
                // Display Logout or Login based on session state (Unit II: State Management)
                if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
                    // Logged in: Show Logout button
                    echo '<a href="auth.php?action=logout">Logout</a>'; 
                } else {
                    // Logged out: Show Login button, now opens the modal
                    echo '<a href="#" onclick="openLoginModal(event)">Login</a>';
                }
                ?>
            </div>
        </div>
    </nav>

    <div id="homepage" class="page active">
        <div class="hero-section">
            <div class="container">
                <h1>Stock Analysis Made Simple</h1>
                <p>Search, analyze, and screen stocks with powerful financial data.</p>
                
                <div class="search-container">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="company-search" placeholder="Search for a company by name or ticker..." autocomplete="off">
                        <div id="search-dropdown" class="search-dropdown"></div>
                    </div>
                </div>
                <div class="quick-filter-container">
                    <button class="quick-filter-btn" onclick="showPage('screens'); applyPresetFilter('low-pe')">
                        <i class="fas fa-chart-line"></i> Low PE Value Stocks
                    </button>
                    <button class="quick-filter-btn" onclick="showPage('screens'); applyPresetFilter('high-growth')">
                        <i class="fas fa-rocket"></i> High Growth Potential
                    </button>
                    <button class="quick-filter-btn" onclick="showPage('portfolio')">
                        <i class="fas fa-briefcase"></i> View My Portfolio
                    </button>
                </div>
                </div>
        </div>

        <div class="container">
            <div class="market-summary-section">
                <h2 class="text-center">Today's Market Snapshot</h2>
                <div class="market-indices-grid">
                    <div class="market-card">
                        <h4>SENSEX</h4>
                        <p id="index-sensex-price">0.00</p>
                        <span id="index-sensex-change" class="change positive">0.00%</span>
                    </div>
                    <div class="market-card">
                        <h4>NIFTY 50</h4>
                        <p id="index-nifty-price">0.00</p>
                        <span id="index-nifty-change" class="change negative">0.00%</span>
                    </div>
                </div>
            </div>

            <div class="features-section">
                <h2 class="text-center">Powerful Stock Analysis Tools</h2>
                <div class="features-grid">
                    <div class="feature-card" onclick="showPage('screens')">
                        <i class="fas fa-filter"></i>
                        <h3>Stock Screener</h3>
                        <p>Filter stocks based on financial ratios and custom queries</p>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-chart-bar"></i>
                        <h3>Financial Analysis</h3>
                        <p>Comprehensive P&L, Balance Sheet, and Cash Flow analysis</p>
                    </div>
                    <div class="feature-card">
                        <i class="fas fa-robot"></i>
                        <h3>AI Assistant</h3>
                        <p>Get instant answers to your financial analysis questions</p>
                    </div>
                    <div class="feature-card" onclick="showPage('portfolio')">
                        <i class="fas fa-briefcase"></i>
                        <h3>Portfolio Tracker</h3>
                        <p>Track and analyze your investment portfolio performance</p>
                    </div>
                    <div class="feature-card" onclick="showPage('news')">
                        <i class="fas fa-newspaper"></i>
                        <h3>Market News</h3>
                        <p>Stay updated with latest financial news and market insights</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="company-page" class="page">
        <div class="container">
            <div class="company-header">
                <button class="back-btn" onclick="showPage('home')">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </button>
                
                <div class="company-info">
                    <h1 id="company-name">Company Name</h1>
                    <div class="company-meta">
                        <span id="company-ticker">TICKER</span>
                        <span class="price" id="company-price">₹0.00</span>
                        <span class="change" id="company-change"><i class="fas fa-caret-up change-indicator"></i> 0.00%</span> 
                    </div>
                </div>
            </div>

            <div class="ratios-section">
                <h3>Key Ratios</h3>
                <div class="ratios-grid">
                    <div class="ratio-card">
                        <h4>Market Cap</h4>
                        <p id="market-cap">₹0 Cr</p>
                    </div>
                    <div class="ratio-card">
                        <h4>P/E Ratio</h4>
                        <p id="pe-ratio">0.0</p>
                    </div>
                    <div class="ratio-card">
                        <h4>ROE</h4>
                        <p id="roe">0.0%</p>
                    </div>
                    <div class="ratio-card">
                        <h4>Debt/Equity</h4>
                        <p id="debt-equity">0.0</p>
                    </div>
                    <div class="ratio-card">
                        <h4>Revenue</h4>
                        <p id="revenue">₹0 Cr</p>
                    </div>
                    <div class="ratio-card">
                        <h4>Net Profit</h4>
                        <p id="net-profit">₹0 Cr</p>
                    </div>
                </div>
            </div>

            <div class="chart-section">
                <h3>Price Chart</h3>
                <div class="chart-controls">
                    <button class="chart-btn active" onclick="loadChart('1Y')">1Y</button>
                    <button class="chart-btn" onclick="loadChart('1M')">1M</button>
                    <button class="chart-btn" onclick="loadChart('3M')">3M</button>
                    <button class="chart-btn" onclick="loadChart('6M')">6M</button>
                    <button class="chart-btn" onclick="loadChart('5Y')">5Y</button>
                </div>
                <div class="chart-container">
                    <canvas id="price-chart"></canvas>
                </div>
            </div>

            <div class="chart-section">
                <h3>Financial Ratios Trend</h3>
                <div class="chart-container">
                    <canvas id="ratios-chart"></canvas>
                </div>
            </div>

            <div class="peer-comparison">
                <h3>Peer Comparison</h3>
                <div class="peer-table-container">
                    <table class="peer-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Market Cap</th>
                                <th>P/E</th>
                                <th>ROE</th>
                                <th>Revenue Growth</th>
                                <th>Debt/Equity</th>
                            </tr>
                        </thead>
                        <tbody id="peer-comparison-data">
                            </tbody>
                    </table>
                </div>
            </div>

            <div class="tabs">
                <button class="tab active" onclick="showTab(event, 'profit-loss')">Profit & Loss</button>
                <button class="tab" onclick="showTab(event, 'balance-sheet')">Balance Sheet</button>
                <button class="tab" onclick="showTab(event, 'cash-flow')">Cash Flow</button>
            </div>

            <div id="profit-loss-tab" class="tab-content active">
                <div class="financial-table-container">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Particulars</th>
                                <th>2024</th>
                                <th>2023</th>
                                <th>2022</th>
                                <th>2021</th>
                                <th>2020</th>
                            </tr>
                        </thead>
                        <tbody id="profit-loss-data">
                            </tbody>
                    </table>
                </div>
            </div>

            <div id="balance-sheet-tab" class="tab-content">
                <div class="financial-table-container">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Particulars</th>
                                <th>2024</th>
                                <th>2023</th>
                                <th>2022</th>
                                <th>2021</th>
                                <th>2020</th>
                            </tr>
                        </thead>
                        <tbody id="balance-sheet-data">
                            </tbody>
                    </table>
                </div>
            </div>

            <div id="cash-flow-tab" class="tab-content">
                <div class="financial-table-container">
                    <table class="financial-table">
                        <thead>
                            <tr>
                                <th>Particulars</th>
                                <th>2024</th>
                                <th>2023</th>
                                <th>2022</th>
                                <th>2021</th>
                                <th>2020</th>
                            </tr>
                        </thead>
                        <tbody id="cash-flow-data">
                            </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div id="screens-page" class="page">
        <div class="container">
            <div class="screens-header">
                <button class="back-btn" onclick="showPage('home')">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </button>
                <h1>Stock Screener</h1>
                <p>Filter and analyze stocks using powerful screening tools</p>
            </div>

            <div class="screens-content">
                <div class="screens-sidebar">
                    <h3>Pre-made Screens</h3>
                    <div class="screen-list">
                        <div class="screen-item" onclick="applyPresetFilter('high-growth')">
                            <i class="fas fa-rocket"></i>
                            <span>High Growth Stocks</span>
                        </div>
                        <div class="screen-item" onclick="applyPresetFilter('low-pe')">
                            <i class="fas fa-chart-line"></i>
                            <span>Low PE Stocks</span>
                        </div>
                        <div class="screen-item" onclick="applyPresetFilter('high-dividend')">
                            <i class="fas fa-coins"></i>
                            <span>High Dividend Stocks</span>
                        </div>
                        <div class="screen-item" onclick="applyPresetFilter('large-cap')">
                            <i class="fas fa-building"></i>
                            <span>Large Cap Stocks</span>
                        </div>
                        <div class="screen-item" onclick="applyPresetFilter('all')">
                            <i class="fas fa-list"></i>
                            <span>All Stocks</span>
                        </div>
                    </div>

                    <h3>Query Builder</h3>
                    <div class="query-builder">
                        <textarea id="custom-query" placeholder="Example: MarketCap > 500000000000 AND PE < 20 AND ROE > 15" rows="4"></textarea>
                        <button class="apply-filter-btn" onclick="applyCustomFilter()">Apply Filter</button>
                        <div class="query-hint">
                            Use these fields: 
                            <span class="hint-tag">MarketCap</span>
                            <span class="hint-tag">PE</span>
                            <span class="hint-tag">ROE</span>
                            <span class="hint-tag">Dividend</span>
                            <span class="hint-tag">Growth</span>
                            <span class="hint-tag">Price</span>
                        </div>
                        </div>

                </div>

                <div class="screens-main">
                    <div class="results-header">
                        <h3 id="results-title">All Stocks</h3>
                        <span id="results-count">0 companies found</span>
                    </div>

                    <div class="table-container">
                        <table class="stock-table">
                            <thead>
                                <tr>
                                    <th onclick="sortTable('name')">
                                        Company <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('marketCap')">
                                        Market Cap <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('pe')">
                                        P/E <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('roe')">
                                        ROE <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('dividend')">
                                        Dividend % <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('growth')">
                                        Profit Growth <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('salesGrowth')">
                                        Sales Growth <i class="fas fa-sort"></i>
                                    </th>
                                    <th onclick="sortTable('price')">
                                        Price <i class="fas fa-sort"></i>
                                    </th>
                                </tr>
                            </thead>
                            <tbody id="stock-table-body">
                                </tbody>
                        </table>
                    </div>

                    <div class="pagination">
                        <button id="prev-btn" onclick="previousPage()">
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <span id="page-info">Page 1 of 1</span>
                        <button id="next-btn" onclick="nextPage()">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="portfolio-page" class="page">
        <div class="container">
            <div class="page-header">
                <h1>Portfolio Tracker</h1>
                <p>Track and analyze your investment portfolio</p>
            </div>
            
            <div class="portfolio-summary">
                <div class="portfolio-card">
                    <h4>Total Value</h4>
                    <p class="portfolio-value" id="portfolio-total-value">₹0</p>
                    <span class="portfolio-change" id="portfolio-total-pnl"></span>
                </div>
                <div class="portfolio-card">
                    <h4>Day's Gain/Loss</h4>
                    <p class="portfolio-value" id="portfolio-day-pnl">₹+0</p>
                    <span class="portfolio-change positive" id="portfolio-day-percent">0.00%</span>
                </div>
                <div class="portfolio-card">
                    <h4>Total Gain/Loss</h4>
                    <p class="portfolio-value" id="portfolio-absolute-pnl">₹+0</p>
                    <span class="portfolio-change positive" id="portfolio-absolute-percent">0.00%</span>
                </div>
            </div>

            <div class="portfolio-chart-section">
                <h3>Portfolio Performance (1Y)</h3>
                <div class="chart-container">
                    <canvas id="portfolio-chart"></canvas>
                </div>
            </div>

            <div class="holdings-section">
                <h3>Holdings</h3>
                <div class="table-container">
                    <table class="stock-table">
                        <thead>
                            <tr>
                                <th>Stock</th>
                                <th>Qty</th>
                                <th>Avg Price</th>
                                <th>Current Price</th>
                                <th>P&L</th>
                                <th>Weight</th>
                            </tr>
                        </thead>
                        <tbody id="holdings-data">
                            </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div id="news-page" class="page">
        <div class="container">
            <div class="page-header">
                <h1>Market News</h1>
                <p>Latest financial news and market insights</p>
            </div>
            
            <div class="news-grid">
                <div class="news-card">
                    <div class="news-image">
                        <img src="https://placehold.co/400x200/2563eb/ffffff?text=Market+Update" alt="Market News" onerror="this.onerror=null; this.src='https://placehold.co/400x200/2563eb/ffffff?text=Market+Update';">
                    </div>
                    <div class="news-content">
                        <h3>Indian Markets Hit New All-Time High</h3>
                        <p>Sensex crosses 75,000 mark for the first time as banking and IT stocks lead the rally...</p>
                        <div class="news-meta">
                            <span>2 hours ago</span>
                            <span>Market Update</span>
                        </div>
                    </div>
                </div>
                
                <div class="news-card">
                    <div class="news-image">
                         <img src="https://placehold.co/400x200/10b981/ffffff?text=Earnings+Report" alt="Tech News" onerror="this.onerror=null; this.src='https://placehold.co/400x200/10b981/ffffff?text=Earnings+Report';">
                    </div>
                    <div class="news-content">
                        <h3>Tech Giants Report Strong Q4 Earnings</h3>
                        <p>Major technology companies exceed analyst expectations with robust revenue growth...</p>
                        <div class="news-meta">
                            <span>4 hours ago</span>
                            <span>Earnings</span>
                        </div>
                    </div>
                </div>
                
                <div class="news-card">
                    <div class="news-image">
                         <img src="https://placehold.co/400x200/f59e0b/ffffff?text=RBI+Decision" alt="Banking News" onerror="this.onerror=null; this.src='https://placehold.co/400x200/f59e0b/ffffff?text=RBI+Decision';">
                    </div>
                    <div class="news-content">
                        <h3>RBI Maintains Repo Rate at 6.5%</h3>
                        <p>Central bank keeps interest rates unchanged citing inflation concerns and growth outlook...</p>
                        <div class="news-meta">
                            <span>6 hours ago</span>
                            <span>Policy</span>
                        </div>
                    </div>
                </div>
                
                <div class="news-card">
                    <div class="news-image">
                        <img src="https://placehold.co/400x200/ef4444/ffffff?text=FII+Inflow" alt="Investment News" onerror="this.onerror=null; this.src='https://placehold.co/400x200/ef4444/ffffff?text=FII+Inflow';">
                    </div>
                    <div class="news-content">
                        <h3>Foreign Investors Increase India Allocation</h3>
                        <p>FIIs show renewed interest in Indian equities amid strong economic fundamentals...</p>
                        <div class="news-meta">
                            <span>8 hours ago</span>
                            <span>Investment</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="tools-page" class="page">
        <div class="container">
            <div class="page-header">
                <h1>Analysis Tools</h1>
                <p>Advanced tools for financial analysis and research</p>
            </div>
            
            <div class="tools-grid">
                <div class="tool-card">
                    <i class="fas fa-calculator"></i>
                    <h3>Ratio Calculator</h3>
                    <p>Calculate important financial ratios</p>
                </div>
                <div class="tool-card">
                    <i class="fas fa-chart-pie"></i>
                    <h3>Portfolio Analyzer</h3>
                    <p>Analyze your investment portfolio</p>
                </div>
                <div class="tool-card">
                    <i class="fas fa-search-dollar"></i>
                    <h3>Stock Comparison</h3>
                    <p>Compare multiple stocks side by side</p>
                </div>
                <div class="tool-card">
                    <i class="fas fa-chart-area"></i>
                    <h3>Technical Analysis</h3>
                    <p>Advanced charting and technical indicators</p>
                </div>
                <div class="tool-card">
                    <i class="fas fa-coins"></i>
                    <h3>Dividend Tracker</h3>
                    <p>Track dividend payments and yields</p>
                </div>
                <div class="tool-card">
                    <i class="fas fa-balance-scale"></i>
                    <h3>Risk Assessment</h3>
                    <p>Analyze portfolio risk and volatility</p>
                </div>
            </div>
        </div>
    </div>

    <div id="about-page" class="page">
        <div class="container">
            <div class="page-header">
                <h1>About TrendTracker</h1>
                <p>Your comprehensive stock analysis platform</p>
            </div>
            
            <div class="about-content">
                <div class="about-section">
                    <h3>Our Mission</h3>
                    <p>TrendTracker provides powerful stock screening and analysis tools to help investors make informed decisions. Our platform combines comprehensive financial data with intuitive design to deliver professional-grade analysis capabilities.</p>
                </div>
                
                <div class="about-section">
                    <h3>Key Features</h3>
                    <ul>
                        <li>Advanced stock screening with custom queries</li>
                        <li>Comprehensive financial statement analysis</li>
                        <li>Real-time market data and ratios</li>
                        <li>AI-powered financial assistant</li>
                        <li>Professional-grade data visualization</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <div id="chatbot-widget" class="chatbot-widget">
        <div class="chatbot-header" onclick="toggleChatbot()">
            <i class="fas fa-robot"></i>
            <span>Financial Assistant</span>
            <i class="fas fa-chevron-up chatbot-toggle"></i>
        </div>
        <div class="chatbot-body">
            <div class="chatbot-messages" id="chatbot-messages">
                <div class="message bot-message">
                    <i class="fas fa-robot"></i>
                    <span>Please wait while market data is being loaded...</span>
                </div>
            </div>
            <div class="chatbot-input">
                <input type="text" id="chatbot-input-field" placeholder="Ask about PE ratio, ROE, etc..." onkeypress="handleChatInput(event)">
                <button onclick="sendChatMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>
    
    <div id="login-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>User Login</h2>
                <span class="close-btn" onclick="closeLoginModal()">&times;</span>
            </div>
            <p id="modal-error-message" class="error-message" style="display: none;"></p>

            <form id="login-form">
                <div class="form-group">
                    <label for="modal-username">Username (student)</label>
                    <input type="text" id="modal-username" name="username" value="student" required>
                </div>
                <div class="form-group">
                    <label for="modal-password">Password (password123)</label>
                    <input type="password" id="modal-password" name="password" value="password123" required>
                </div>
                <button type="submit" class="btn-primary">Login</button>
            </form>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>