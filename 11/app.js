// --- API CONFIGURATION (PHP PROXY) ---
// This URL points to our PHP proxy file (Crucial for avoiding CORS errors)
const PROXY_URL = "api_proxy.php"; 

// --- GEMINI API CONFIGURATION ---
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
const GEMINI_API_KEY = "AIzaSyDJTQS61tkYqq0i6orYgTH7Bgpw9xzDlIk"; // Your Working Gemini Key

// FIX: Using a comprehensive list of known Indian tickers for mock data fallback.
const RELIABLE_TICKERS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC", "SBIN", "KOTAKBANK", 
    "HINDUNILVR", "ICICIBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI",
    "HCLTECH", "WIPRO", "AXISBANK", "TECHM", "NESTLEIND", "LT", 
    "TITAN", "SUNPHARMA", "DRREDDY", "ADANIPORTS", "BHARTIARTL", 
    "INDUSINDBK", "ULTRACEMCO", "GRASIM", "M&M", "TATASTEEL", "NTPC",
    "POWERGRID", "ONGC", "BPCL", "IOC", "COALINDIA", "GAIL", "HDFC"
];

const API_HEADERS = {
    'Content-Type': 'application/json'
};

// --- GLOBAL DATA STATE ---
let companies = [];          
let stockData = [];          
let portfolioData = {        
    holdings: [],
    performance: []
};
let financialData = {};      


// Global UI state
let currentPage = 'home';
let currentCompany = null;
let filteredStocks = [];
const itemsPerPage = 10;
let currentPageNum = 1;
let sortColumn = null;
let sortDirection = 'asc';
let chartInstances = {};

// --- UTILITY FUNCTIONS ---

/**
 * Generates mock price history for filling missing data
 */
function generateMockHistory(startPrice, days) {
    const history = [];
    let price = startPrice * 0.95; 
    for (let i = 0; i < days; i++) {
        price = price * (1 + (Math.random() * 0.01 - 0.005));
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        history.push({
            date: date.toISOString().split('T')[0],
            price: parseFloat(price.toFixed(2))
        });
    }
    return history;
}

/**
 * Formats numbers into Indian currency scale (Lakhs, Crores) and adds ₹ prefix.
 */
function formatCurrency(num) {
    if (typeof num !== 'number' || isNaN(num) || num === null) return 'N/A';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 10000000) { // 1 Crore (10 million)
        return `${sign}₹${(absNum / 10000000).toFixed(2)} Cr`;
    } else if (absNum >= 100000) { // 1 Lakh (100 thousand)
        return `${sign}₹${(absNum / 100000).toFixed(2)} L`;
    }
    return `${sign}₹${absNum.toFixed(2)}`;
}

// Mock data generation function
function createMockCompanyData(ticker) {
    const basePrice = Math.random() * 3000 + 500;
    const marketCapBase = (Math.random() * 1000 + 100) * 10000000;

    return {
        name: ticker + ' Corp.', 
        ticker: ticker,
        price: basePrice, 
        change: Math.random() * 5 - 2.5,  
        marketCap: marketCapBase,
        pe: Math.random() * 50 + 10,
        roe: Math.random() * 30 + 5,
        sector: ["IT", "Energy", "Banking", "FMCG"][Math.floor(Math.random() * 4)],
        dividend: 1.2 + Math.random() * 3,
        growth: 5 + Math.random() * 15,
        salesGrowth: 10 + Math.random() * 10,
        // Generate all time periods for mock data stability
        priceHistory: {
            '1M': generateMockHistory(basePrice, 30),
            '3M': generateMockHistory(basePrice, 90),
            '6M': generateMockHistory(basePrice, 180),
            '1Y': generateMockHistory(basePrice, 365),
            '5Y': generateMockHistory(basePrice, 1825),
        }
    };
}


// --- FINCRUX DATA FETCHING LOGIC (via PHP Proxy) ---

async function fetchFincrux(endpoint, params = {}) {
    // Add API key to query parameters
    const urlParams = new URLSearchParams({ ...params }).toString();
    const url = `${PROXY_URL}?endpoint=${endpoint}&${urlParams}`;
    
    try {
        const response = await fetch(url, { headers: API_HEADERS });
        if (!response.ok) {
            console.error(`Proxy returned HTTP error: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.data; 
    } catch (e) {
        console.error(`Fetch failed via proxy:`, e);
        return null;
    }
}

async function fetchQuote(ticker) { return fetchFincrux('quote', { ticker: ticker }); }
async function fetchKeyMetrics(ticker) { 
    const data = await fetchFincrux('metrics', { ticker: ticker, period: 'annual' });
    return data ? data : []; 
}
async function fetchHistoricalData(ticker) {
    const data = await fetchFincrux('history', { ticker: ticker, interval: '1d', limit: 250 });
    return data; 
}

// NEW: Global Loading Toggle
function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        const icon = overlay.querySelector('i');
        if (icon) {
            if (show) {
                icon.classList.add('fa-spin');
            } else {
                icon.classList.remove('fa-spin');
            }
        }
        overlay.style.display = show ? 'flex' : 'none';
    }
}


async function fetchDataAndInitialize() {
    try {
        toggleLoading(true); 
        document.querySelector('#chatbot-messages span').textContent = "Attempting to fetch live data (via PHP proxy)...";
        
        let liveTickers = RELIABLE_TICKERS; 
        let successCount = 0;

        // 1. Fetch Master Stock List (List of all tickers)
        const allSymbols = await fetchFincrux('stock/list');

        if (allSymbols && allSymbols.length > 0) {
            liveTickers = allSymbols
                .filter(s => s.exchange === 'NSE' || s.exchange === 'BSE')
                .slice(0, 50)
                .map(s => s.symbol);
        }

        document.querySelector('#chatbot-messages span').textContent = `Fetching quotes & metrics for ${liveTickers.length} stocks...`;

        // 2. Fetch Quotes and Key Metrics concurrently
        const quotePromises = liveTickers.map(ticker => fetchQuote(ticker));
        const keyMetricsPromises = liveTickers.map(ticker => fetchKeyMetrics(ticker));
        
        const [allQuotes, allMetrics] = await Promise.all([
            Promise.allSettled(quotePromises), 
            Promise.allSettled(keyMetricsPromises)
        ]);

        let liveCompanies = [];
        
        // 3. Process Fetched Data and Merge with Mock
        liveTickers.forEach((ticker, index) => {
            const quoteResult = allQuotes[index];
            const metricsResult = allMetrics[index];

            const quote = quoteResult.status === 'fulfilled' && quoteResult.value ? quoteResult.value : null;
            const metrics = metricsResult.status === 'fulfilled' && Array.isArray(metricsResult.value) ? metricsResult.value : [];

            const mock = createMockCompanyData(ticker);
            
            if (quote) successCount++;
            
            // Fincrux fields: last, changePercent, marketCap
            const lastPrice = quote?.last || mock.price;
            const marketCap = quote?.marketCap || mock.marketCap;
            const pe = metrics.length > 0 ? metrics[0].peRatio : mock.pe;
            const roe = metrics.length > 0 ? metrics[0].roe : mock.roe;

            let companyData = {
                ticker: ticker,
                name: quote?.name || mock.name, 
                price: lastPrice,
                change: quote?.changePercent || mock.change,
                sector: quote?.exchange || mock.sector,
                
                marketCap: marketCap, pe: pe, roe: roe, 
                dividend: mock.dividend, growth: mock.growth, salesGrowth: mock.salesGrowth,
                priceHistory: mock.priceHistory, 
            };
            
            liveCompanies.push(companyData);
        });

        companies = liveCompanies;
        stockData = [...companies];
        filteredStocks = [...stockData];

        // 4. Fetch Historical data for the main stock (RELIANCE)
        const historicalData = await fetchHistoricalData("RELIANCE");
        
        const relianceCompany = companies.find(c => c.ticker === "RELIANCE");
        if (historicalData && relianceCompany && historicalData.length > 0) {
            const history = historicalData.map(d => ({
                date: d.date.split('T')[0],
                price: d.close
            }));
            
            // Update ALL required periods with slices of the real history
            relianceCompany.priceHistory = {
                '1M': history.slice(-21), 
                '3M': history.slice(-63),
                '6M': history.slice(-126),
                '1Y': history, // Up to 250 days from Fincrux limit
                '5Y': generateMockHistory(relianceCompany.price, 1825) // Keep mock for long periods
            };
        }

        // 5. Final initialization and display update
        companies.forEach(company => populateFinancialData(company.ticker, company));
        
        setupSearch(); 
        loadScreensPage(); 
        
        document.querySelector('#chatbot-messages span').textContent = 
            `Success! Live data loaded for ${successCount}/${liveTickers.length} stocks via PHP proxy.`;

    } catch (error) {
        console.error("Data Fetch Failed (Using Mock Fallback):", error);
        document.querySelector('#chatbot-messages span').textContent = "Live data failed to load. Using fallback demo data.";
        
        // If API fails, re-initialize with the initial mock data
        companies = RELIABLE_TICKERS.map(createMockCompanyData);
        stockData = [...companies];
        filteredStocks = [...stockData];
        companies.forEach(company => populateFinancialData(company.ticker, company));
        setupSearch(); 
        loadScreensPage(); 
    } finally {
        toggleLoading(false); 
    }
}

/**
 * Populates the financialData object for a given ticker (Mocks statements, uses real ratios if available)
 */
function populateFinancialData(ticker, company) {
    const marketCapNum = company.marketCap || 100000000000;
    
    financialData[ticker] = {
        // Mocked financial statements using market cap as base scale
        profitLoss: [
            { item: "Revenue", 2024: marketCapNum/5, 2023: marketCapNum/6, 2022: marketCapNum/7, 2021: marketCapNum/8, 2020: marketCapNum/9 },
            { item: "Net Profit", 2024: marketCapNum/30, 2023: marketCapNum/35, 2022: marketCapNum/40, 2021: marketCapNum/45, 2020: marketCapNum/50 }
        ],
        balanceSheet: [
            { item: "Total Assets", 2024: marketCapNum*1.5, 2023: marketCapNum*1.4, 2022: marketCapNum*1.3, 2021: marketCapNum*1.2, 2020: marketCapNum*1.1 },
            { item: "Total Liabilities", 2024: marketCapNum*0.5, 2023: marketCapNum*0.4, 2022: marketCapNum*0.3, 2021: marketCapNum*0.2, 2020: marketCapNum*0.1 }
        ],
        cashFlow: [
            { item: "Operating Cash Flow", 2024: marketCapNum/15, 2023: marketCapNum/16, 2022: marketCapNum/17, 2021: marketCapNum/18, 2020: marketCapNum/19 },
            { item: "Free Cash Flow", 2024: marketCapNum/20, 2023: marketCapNum/21, 2022: marketCapNum/22, 2021: marketCapNum/23, 2020: marketCapNum/24 }
        ],
        keyMetrics: { 
            marketCap: formatCurrency(marketCapNum), 
            pe: company.pe?.toFixed(1) || 'N/A', 
            roe: company.roe?.toFixed(1) + '%' || 'N/A', 
            debtEquity: (Math.random() * 0.5 + 0.1).toFixed(2),
            revenue: formatCurrency(marketCapNum/5), 
            netProfit: formatCurrency(marketCapNum/30)
        }
    };
    
    // Mock Portfolio Data 
    if (ticker === RELIABLE_TICKERS[0]) {
        portfolioData = {
            holdings: [
                { ticker: ticker, name: company.name, qty: 50, avgPrice: company.price * 0.9, currentPrice: company.price, weight: 18.5 },
                { ticker: "TCS", name: "TCS Corp.", qty: 25, avgPrice: 3234.50, currentPrice: companies.find(c => c.ticker === "TCS")?.price || 3834.50, weight: 15.2 },
            ],
            performance: generateMockHistory(company.price * 1000, 365) 
        };
    }
}


// --- INITIALIZATION AND DOM READY ---

function initializeApp() {
    // 1. GUARANTEE that the UI has data to work with (Mock Data)
    companies = RELIABLE_TICKERS.map(createMockCompanyData);
    stockData = [...companies];
    
    // Add initial mock financial data
    companies.forEach(company => populateFinancialData(company.ticker, company));
    
    // Set initial UI state
    filteredStocks = [...stockData];
    
    // Call setup functions
    setupSearch(); 
    loadScreensPage(); 
    setupChatbot();
    setupModalLogin(); 
    updateMarketSummary(); // <-- NEW CALL for widget data
    document.querySelector('#chatbot-messages span').textContent = "Demo data loaded. Searching for live updates...";

    // 2. RUN LIVE API FETCH to UPDATE the data
    fetchDataAndInitialize();
    
    // NEW: Set initial active state for Home link
    window.showPage('home');
}


document.addEventListener('DOMContentLoaded', initializeApp);


// --- CORE APPLICATION LOGIC (Includes Active Nav State) ---

window.showPage = function(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page === 'home' ? 'homepage' : page + '-page').classList.add('active');
    currentPage = page;
    
    // --- NEW: Handle active navigation state ---
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active-nav'));
    // Select based on onclick attribute matching the page name (e.g., 'screens')
    const targetLink = document.querySelector(`.nav-menu a[onclick*="'${page}'"]`);
    if (targetLink) {
         targetLink.classList.add('active-nav');
    } else if (page === 'home') {
         // Handle the "Home" link which is a special case in your HTML structure
         document.querySelector('.nav-menu a[href="index.php"]').classList.add('active-nav');
    }
    // --- END NEW ---

    if (page === 'screens') {
        loadScreensPage();
    } else if (page === 'portfolio') {
        loadPortfolioPage();
    }
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('company-search');
    const dropdown = document.getElementById('search-dropdown');
    
    // CRITICAL FIX: Verify elements exist before attaching listeners
    if (!searchInput || !dropdown) {
        console.error("Search input elements not found. Cannot initialize search.");
        return;
    }
    
    // FIX: Attach event listener directly to input for maximum reliability
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        // Check if companies array is empty OR query is empty
        if (query.length === 0 || companies.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Find top 10 matches
        const matches = companies.filter(company => 
            // FIX: Added checks to ensure .name and .ticker exist before calling .toLowerCase()
            (company.name && company.name.toLowerCase().includes(query)) || 
            (company.ticker && company.ticker.toLowerCase().includes(query))
        ).slice(0, 10);
        
        dropdown.innerHTML = matches.map(company => `
            <div class="search-item" onclick="selectCompany('${company.ticker}')">
                <div><div class="search-item-name">${company.name}</div>
                <div class="search-item-ticker">${company.ticker}</div></div>
                <div class="price">${formatCurrency(company.price)}</div>
            </div>
        `).join('') || '<div class="search-item">No companies found</div>';
        dropdown.style.display = 'block';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-container')) {
            dropdown.style.display = 'none';
        }
    });
}

// Company selection and data loading
window.selectCompany = function(ticker) {
    currentCompany = ticker;
    const company = companies.find(c => c.ticker === ticker);
    const data = financialData[ticker];

    if (company) {
        // Update header details
        document.getElementById('company-name').textContent = company.name;
        document.getElementById('company-ticker').textContent = company.ticker;
        document.getElementById('company-price').textContent = formatCurrency(company.price);
        
        const changeElement = document.getElementById('company-change');
        const change = company.change || 0;
        
        // NEW: Indicator Icon Logic
        const iconClass = change >= 0 ? 'fa-caret-up' : 'fa-caret-down';
        const iconHtml = `<i class="fas ${iconClass} change-indicator"></i>`;

        changeElement.innerHTML = `${iconHtml} ${change > 0 ? '+' : ''}${change.toFixed(2)}%`; // Use innerHTML to inject the icon
        changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;


        if (data) {
            // Update key metrics
            document.getElementById('market-cap').textContent = data.keyMetrics.marketCap || 'N/A';
            document.getElementById('pe-ratio').textContent = data.keyMetrics.pe || 'N/A';
            document.getElementById('roe').textContent = data.keyMetrics.roe || 'N/A';
            document.getElementById('debt-equity').textContent = data.keyMetrics.debtEquity || 'N/A';
            document.getElementById('revenue').textContent = data.keyMetrics.revenue || 'N/A';
            document.getElementById('net-profit').textContent = data.keyMetrics.netProfit || 'N/A';
            
            // Load tables and charts
            loadFinancialTable('profit-loss-data', data.profitLoss);
            loadFinancialTable('balance-sheet-data', data.balanceSheet);
            loadFinancialTable('cash-flow-data', data.cashFlow);
            // FIX: Load the 1Y chart by default, which is the most reliable mock or real data we fetch
            loadPriceChart(ticker, '1Y'); 
            loadRatiosChart(ticker);
            loadPeerComparison(ticker);
            showTab(null, 'profit-loss', true);
        } else {
             // Fallback for missing detailed data
            alert(`Detailed financial data (P&L, Balance Sheet) not found for ${ticker}. Only showing key metrics.`);
            // Clear detailed sections
            document.getElementById('market-cap').textContent = formatCurrency(company.marketCap);
            document.getElementById('pe-ratio').textContent = company.pe?.toFixed(1) || 'N/A';
            document.getElementById('roe').textContent = company.roe?.toFixed(1) + '%' || 'N/A';
            document.getElementById('debt-equity').textContent = 'N/A';
            document.getElementById('revenue').textContent = 'N/A';
            document.getElementById('net-profit').textContent = 'N/A';

            document.getElementById('profit-loss-data').innerHTML = '<tr><td colspan="6" class="text-center">Data Unavailable</td></tr>';
            document.getElementById('balance-sheet-data').innerHTML = '<tr><td colspan="6" class="text-center">Data Unavailable</td></tr>';
            document.getElementById('cash-flow-data').innerHTML = '<tr><td colspan="6" class="text-center">Data Unavailable</td></tr>';
        }
        
        showPage('company');
        // The search dropdown is now handled by document.addEventListener('click')
    }
}

// Charting functions
window.loadChart = function(period) {
    if (currentCompany) {
        loadPriceChart(currentCompany, period);
        document.querySelectorAll('.chart-controls .chart-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.chart-controls button[onclick="loadChart('${period}')"]`)?.classList.add('active');
    }
}

function loadPriceChart(ticker, period) {
    const company = companies.find(c => c.ticker === ticker);
    const history = company?.priceHistory?.[period]; 
    const ctx = document.getElementById('price-chart');
    
    if (chartInstances.price) chartInstances.price.destroy(); // Always destroy old chart first

    if (!ctx || !history || history.length === 0) {
        // Find the parent element to replace the canvas with a message
        const container = ctx ? ctx.parentElement : document.querySelector('.chart-section .chart-container');
        if (container) {
            container.innerHTML = '<p class="text-center" style="padding: 2rem;">Historical price data not available for this period.</p>';
        }
        return;
    }
    
    // Restore Canvas element if it was replaced by a message
    if (ctx.tagName !== 'CANVAS') {
         const container = document.querySelector('.chart-section .chart-container');
         if (container) {
             container.innerHTML = '<canvas id="price-chart"></canvas>';
             const newCtx = document.getElementById('price-chart');
             if (newCtx) {
                 // Recreate chart instance on the new canvas
                 chartInstances.price = new Chart(newCtx, {
                    type: 'line',
                    data: {
                        labels: history.map(d => d.date),
                        datasets: [{
                            label: 'Price', data: history.map(d => d.price),
                            borderColor: '#2563eb', 
                            // START FIX: Gradient background and styling
                            backgroundColor: function(context) {
                                const chart = context.chart;
                                const {ctx, chartArea} = chart;
                                if (!chartArea) return;
                                
                                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
                                gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
                                return gradient;
                            },
                            // END FIX
                            borderWidth: 2, 
                            fill: true, 
                            tension: 0.3, // Smoothing the line
                            pointRadius: 0, // Remove points
                            pointHoverRadius: 5 // Add hover effect
                        }]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { 
                            legend: { display: false } 
                        },
                        scales: {
                            x: { grid: { display: false } },
                            y: { beginAtZero: false, grid: { color: '#e5e7eb' } }
                        },
                        // Tooltip appearance fix for clarity
                        interaction: {
                            intersect: false,
                            mode: 'index',
                        },
                        tooltips: {
                            mode: 'index',
                            intersect: false,
                        }
                    }
                });
             }
         }
         return;
    }

    // Standard chart creation on existing canvas
    chartInstances.price = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(d => d.date),
            datasets: [{
                label: 'Price', data: history.map(d => d.price),
                borderColor: '#2563eb',
                // START FIX: Gradient background and styling
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return;
                    
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
                    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
                    return gradient;
                },
                // END FIX
                borderWidth: 2, 
                fill: true, 
                tension: 0.3, // Smoothing the line
                pointRadius: 0, // Remove points
                pointHoverRadius: 5 // Add hover effect
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false } 
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: false, grid: { color: '#e5e7eb' } }
            },
            // Tooltip appearance fix for clarity
            interaction: {
                intersect: false,
                mode: 'index',
            },
            tooltips: {
                mode: 'index',
                intersect: false,
            }
        }
    });
}
function loadRatiosChart(ticker) {
    const ctx = document.getElementById('ratios-chart');
    if (chartInstances.ratios) chartInstances.ratios.destroy();
    
    if (stockData.length === 0) return;
    const years = ['2020', '2021', '2022', '2023', '2024'];
    const peData = years.map((_, i) => stockData.find(s => s.ticker === ticker)?.pe * (1 + (Math.random() * 0.2 - 0.1) * i / 5) || 20);
    const roeData = years.map((_, i) => stockData.find(s => s.ticker === ticker)?.roe * (1 + (Math.random() * 0.2 - 0.1) * i / 5) || 15);

    chartInstances.ratios = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { 
                    label: 'P/E Ratio', data: peData, 
                    borderColor: '#2563eb', yAxisID: 'y', 
                    tension: 0.3, pointRadius: 3, pointBackgroundColor: '#2563eb'
                },
                { 
                    label: 'ROE (%)', data: roeData, 
                    borderColor: '#10b981', yAxisID: 'y1',
                    tension: 0.3, pointRadius: 3, pointBackgroundColor: '#10b981'
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
function loadPeerComparison(ticker) {
    const currentStock = stockData.find(s => s.ticker === ticker);
    const tbody = document.getElementById('peer-comparison-data');
    if (!tbody || !currentStock) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Peer data unavailable.</td></tr>';
        return;
    }
    
    // Filter stocks in the same sector
    const comparisonData = stockData.filter(s => s.sector === currentStock.sector);
    
    tbody.innerHTML = comparisonData.map((stock, index) => `
        <tr onclick="selectCompany('${stock.ticker}')">
            <td class="company-cell">${stock.name}${stock.ticker === currentStock.ticker ? ' (Current)' : ''}</td>
            <td class="number-cell">${formatCurrency(stock.marketCap)}</td>
            <td class="number-cell">${stock.pe?.toFixed(1) || 'N/A'}</td>
            <td class="number-cell">${stock.roe?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell ${stock.salesGrowth > 15 ? 'positive' : 'negative'}">${stock.salesGrowth?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell">${(Math.random() * 0.8 + 0.1).toFixed(2)}</td>
        </tr>
    `).join('');
}

// Financial table logic
function loadFinancialTable(tableId, data) {
    const tbody = document.getElementById(tableId);
    if (!tbody || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No Data Available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td style="font-weight: 600;">${row.item}</td>
            <td class="number-cell">${formatCurrency(row[2024])}</td>
            <td class="number-cell">${formatCurrency(row[2023])}</td>
            <td class="number-cell">${formatCurrency(row[2022])}</td>
            <td class="number-cell">${formatCurrency(row[2021])}</td>
            <td class="number-cell">${formatCurrency(row[2020])}</td>
        </tr>
    `).join('');
}

// Tab switching
window.showTab = function(event, tabName, reset = false) {
    document.querySelectorAll('.tabs .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const targetTab = reset 
        ? document.querySelector(`.tabs .tab[onclick*="'${tabName}'"]`)
        : event?.target;
        
    targetTab?.classList.add('active');
    document.getElementById(tabName + '-tab')?.classList.add('active');
}

// Screens page logic
function loadScreensPage() {
    if (stockData.length === 0) {
        document.getElementById('stock-table-body').innerHTML = '<tr><td colspan="8" class="text-center">No Stock Data Available.</td></tr>'; // colspan updated
        return;
    }
    applyPresetFilter('all');
}
window.applyPresetFilter = function(filterType) { 
    let filtered = stockData;
    
    switch(filterType) {
        case 'high-growth':
            filtered = stockData.filter(s => s.growth > 15);
            break;
        case 'low-pe':
            filtered = stockData.filter(s => s.pe < 25);
            break;
        case 'high-dividend':
            filtered = stockData.filter(s => s.dividend > 2);
            break;
        case 'large-cap':
            filtered = stockData.filter(s => s.marketCap > 10000000000000); // 10 Lakh Crore
            break;
        default:
            filtered = stockData;
    }
    
    filteredStocks = filtered;
    currentPageNum = 1;
    document.getElementById('results-title').textContent = filterType.replace('-', ' ').toUpperCase() + ' Results';
    displayStocks(filtered);
}
window.applyCustomFilter = function() { 
    const query = document.getElementById('custom-query').value.trim();
    if (!query) return;
    
    try {
        const filtered = stockData.filter(stock => {
            const safeStock = {
                MarketCap: stock.marketCap, PE: stock.pe, ROE: stock.roe, Price: stock.price, Dividend: stock.dividend, Growth: stock.growth, SalesGrowth: stock.salesGrowth
            };
            let evalQuery = query
                .replace(/MarketCap/gi, safeStock.MarketCap)
                .replace(/PE/gi, safeStock.PE)
                .replace(/ROE/gi, safeStock.ROE)
                .replace(/Price/gi, safeStock.Price)
                .replace(/Dividend/gi, safeStock.Dividend)
                .replace(/Growth/gi, safeStock.Growth)
                .replace(/SalesGrowth/gi, safeStock.SalesGrowth)
                .replace(/AND/gi, '&&')
                .replace(/OR/gi, '||');
            
            return new Function('return ' + evalQuery)();
        });

        filteredStocks = filtered;
        currentPageNum = 1;
        document.getElementById('results-title').textContent = 'Custom Filter Results';
        displayStocks(filtered);
    } catch (error) {
        alert("Invalid query syntax. Please check your filter statement.");
        console.error("Query Error:", error);
    }
}
function evaluateQuery(query, stock) { 
    try {
        const safeStock = {
            MarketCap: stock.marketCap, PE: stock.pe, ROE: stock.roe, Price: stock.price
        };
        let evalQuery = query
            .replace(/MarketCap/gi, safeStock.MarketCap)
            .replace(/PE/gi, safeStock.PE)
            .replace(/ROE/gi, safeStock.ROE)
            .replace(/Price/gi, safeStock.Price)
            .replace(/AND/gi, '&&')
            .replace(/OR/gi, '||');
        
        return new Function('return ' + evalQuery)();
    } catch (e) {
        return false;
    }
} 

// Display stocks in table (UPDATED for new columns)
function displayStocks(stocks) {
    const tbody = document.getElementById('stock-table-body');
    if (!tbody) return;
    
    if (stocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No results matched the filter criteria.</td></tr>'; // colspan updated
        document.getElementById('results-count').textContent = `0 companies found`;
        return;
    }
    
    const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
    const startIndex = (currentPageNum - 1) * itemsPerPage;
    const pageStocks = stocks.slice(startIndex, startIndex + itemsPerPage);
    
    tbody.innerHTML = pageStocks.map(stock => `
        <tr onclick="selectCompany('${stock.ticker}')">
            <td class="company-cell">${stock.name}</td>
            <td class="number-cell">${formatCurrency(stock.marketCap)}</td>
            <td class="number-cell">${stock.pe?.toFixed(1) || 'N/A'}</td>
            <td class="number-cell">${stock.roe?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell">${stock.dividend?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell ${stock.growth > 15 ? 'positive' : ''}">${stock.growth?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell ${stock.salesGrowth > 15 ? 'positive' : ''}">${stock.salesGrowth?.toFixed(1) || 'N/A'}%</td>
            <td class="number-cell">${formatCurrency(stock.price)}</td>
        </tr>
    `).join('');
    
    document.getElementById('page-info').textContent = `Page ${currentPageNum} of ${totalPages}`;
    document.getElementById('prev-btn').disabled = currentPageNum === 1;
    document.getElementById('next-btn').disabled = currentPageNum >= totalPages;
    document.getElementById('results-count').textContent = `${stocks.length} companies found`;
}

// Pagination
window.nextPage = function() { 
    const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
    if (currentPageNum < totalPages) {
        currentPageNum++;
        displayStocks(filteredStocks);
    }
}
window.previousPage = function() {
     if (currentPageNum > 1) {
        currentPageNum--;
        displayStocks(filteredStocks);
    }
}

// Table sorting
window.sortTable = function(column) { 
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredStocks.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
    
    displayStocks(filteredStocks);
}

// Portfolio functions 
function loadPortfolioPage() {
    loadPortfolioChart();
    loadHoldingsData();
    updatePortfolioSummary();
}
function loadPortfolioChart() {
    const ctx = document.getElementById('portfolio-chart');
    if (chartInstances.portfolio) chartInstances.portfolio.destroy();
    
    if (portfolioData.performance.length === 0) {
        if(ctx) ctx.parentElement.innerHTML = '<p class="text-center">Portfolio performance data is not available.</p>';
        return;
    }

    chartInstances.portfolio = new Chart(ctx, {
        type: 'line',
        data: {
            labels: portfolioData.performance.map(d => d.date),
            datasets: [{
                label: 'Portfolio Value', data: portfolioData.performance.map(d => d.price),
                borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2, fill: true, tension: 0.1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
function loadHoldingsData() {
    const tbody = document.getElementById('holdings-data');
    if (!tbody || portfolioData.holdings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No Holdings Found</td></tr>';
        return;
    }
    
    tbody.innerHTML = portfolioData.holdings.map(holding => {
        const currentValue = holding.qty * holding.currentPrice;
        const investedValue = holding.qty * holding.avgPrice;
        const pnl = currentValue - investedValue;
        const pnlPercent = (pnl / investedValue) * 100;
        
        return `
            <tr onclick="selectCompany('${holding.ticker}')">
                <td class="company-cell">${holding.name}</td>
                <td class="number-cell">${holding.qty}</td>
                <td class="number-cell">${formatCurrency(holding.avgPrice)}</td>
                <td class="number-cell">${formatCurrency(holding.currentPrice)}</td>
                <td class="number-cell ${pnl >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(pnl)} (${pnlPercent.toFixed(1)}%)
                </td>
                <td class="number-cell">${holding.weight.toFixed(1)}%</td>
            </tr>
        `;
    }).join('');
}
function updatePortfolioSummary() {
    // Only calculate if there are holdings
    if (portfolioData.holdings.length === 0) {
        document.getElementById('portfolio-total-value').textContent = '₹0.00';
        document.getElementById('portfolio-day-pnl').textContent = '₹+0.00';
        document.getElementById('portfolio-absolute-pnl').textContent = '₹+0.00';
        document.getElementById('portfolio-day-percent').textContent = '0.00%';
        document.getElementById('portfolio-absolute-percent').textContent = '0.00%';
        return;
    }

    const totalCurrentValue = portfolioData.holdings.reduce((sum, h) => sum + h.qty * h.currentPrice, 0);
    const totalInvestedValue = portfolioData.holdings.reduce((sum, h) => sum + h.qty * h.avgPrice, 0);

    const totalPnl = totalCurrentValue - totalInvestedValue;
    const totalPnlPercent = (totalPnl / totalInvestedValue) * 100;

    // Use the primary holding's stock for day change calculation
    const primaryTicker = portfolioData.holdings[0].ticker;
    const stockChange = companies.find(c => c.ticker === primaryTicker)?.change || 0; 
    const dayPnl = totalCurrentValue * (stockChange / 100 || 0);
    const dayPnlPercent = (dayPnl / totalCurrentValue) * 100;

    document.getElementById('portfolio-total-value').textContent = formatCurrency(totalCurrentValue);
    
    document.getElementById('portfolio-day-pnl').textContent = `${dayPnl >= 0 ? '+' : ''}${formatCurrency(dayPnl)}`;
    document.getElementById('portfolio-day-percent').textContent = `${dayPnl >= 0 ? '+' : ''}${dayPnlPercent.toFixed(2)}%`;
    document.getElementById('portfolio-day-pnl').parentElement.querySelector('.portfolio-change').className = `portfolio-change ${dayPnl >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('portfolio-absolute-pnl').textContent = `${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)}`;
    document.getElementById('portfolio-absolute-percent').textContent = `${totalPnl >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`;
    document.getElementById('portfolio-absolute-pnl').parentElement.querySelector('.portfolio-change').className = `portfolio-change ${totalPnl >= 0 ? 'positive' : 'negative'}`;
}

// NEW: Market Summary Update
function updateMarketSummary() {
    // Mock data for Sensex and Nifty (using random changes to simulate market)
    const sensexBase = 74000;
    const niftyBase = 22500;

    const sensexChangeRaw = (Math.random() * 1.5 - 0.75); // -0.75% to +0.75%
    const niftyChangeRaw = (Math.random() * 1.2 - 0.6);   // -0.6% to +0.6%

    const sensexPrice = sensexBase * (1 + sensexChangeRaw / 100);
    const niftyPrice = niftyBase * (1 + niftyChangeRaw / 100);

    const formatChange = (change) => `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const getColorClass = (change) => change >= 0 ? 'positive' : 'negative';

    document.getElementById('index-sensex-price').textContent = sensexPrice.toFixed(2);
    document.getElementById('index-sensex-change').textContent = formatChange(sensexChangeRaw);
    document.getElementById('index-sensex-change').className = `change ${getColorClass(sensexChangeRaw)}`;

    document.getElementById('index-nifty-price').textContent = niftyPrice.toFixed(2);
    document.getElementById('index-nifty-change').textContent = formatChange(niftyChangeRaw);
    document.getElementById('index-nifty-change').className = `change ${getColorClass(niftyChangeRaw)}`;
}


// Chatbot functionality
window.toggleChatbot = function() { document.getElementById('chatbot-widget')?.classList.toggle('collapsed'); }
window.handleChatInput = function(event) { if (event.key === 'Enter') sendChatMessage(); }
window.sendChatMessage = function() { 
    const input = document.getElementById('chatbot-input-field');
    const message = input.value.trim();
    if (!message) return;
    addChatMessage(message, 'user');
    input.value = '';
    
    // Switch to Gemini API call instead of simple lookup
    generateGeminiResponse(message).then(response => {
        addChatMessage(response, 'bot');
    }).catch(error => {
        console.error("Gemini API Error:", error);
        addChatMessage("Sorry, I'm having trouble connecting to the AI assistant right now.", 'bot');
    });
}

// NEW: Gemini API function
async function generateGeminiResponse(userQuery) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        return "Please insert your Gemini API Key in app.js to enable the AI assistant.";
    }

    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    
    // System Instruction to guide the AI's persona
    const systemPrompt = "You are a friendly, knowledgeable Financial Assistant named 'TrendTracker AI'. Answer questions concisely about financial terms, stock ratios (PE, ROE, etc.), and investment concepts. Keep your responses short, under 150 words.";

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        // Use Google Search grounding for up-to-date financial context
        tools: [{ "google_search": {} }], 
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
            // Handle case where API returns error message in response body (e.g., rate limit)
            return `AI Error: ${result.error?.message || "Could not generate a response."}`;
        }
    } catch (error) {
        console.error("Fetch/Network error during Gemini call:", error);
        return "A network error occurred while reaching the AI service.";
    }
}
// END NEW GEMINI API FUNCTION

function addChatMessage(message, sender) { 
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    const icon = sender === 'bot' ? 'fa-robot' : 'fa-user';
    messageDiv.innerHTML = `<i class=\"fas ${icon}\"></i><span>${message}</span>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
// Note: generateBotResponse is now removed as it's replaced by generateGeminiResponse

// Old static chatbot responses kept as fallback structure only, though unused.
let chatbotResponses = {     
    "pe ratio": "Price-to-Earnings ratio measures valuation relative to earnings. A lower PE is generally considered better for value investors.",
    "roe": "ROE (Return on Equity) measures management efficiency in generating profit from shareholders' equity.",
    "market cap": "Market Capitalization is the total value of a company's outstanding shares. It is the company's size.",
    "dividend": "Dividend is a payment made by a corporation to its shareholders.",
    "hello": "Hello! I am your financial assistant, ready to answer questions about stock ratios and terms.",
    "thank you": "You're welcome! Let me know if you have any other questions."
};

function setupChatbot() { document.getElementById('chatbot-widget')?.classList.add('collapsed'); }

// --- NEW MODAL LOGIN JAVASCRIPT LOGIC ---

/**
 * Opens the login modal and prevents the default link action.
 */
window.openLoginModal = function(event) {
    event.preventDefault(); // Stop the link from trying to navigate
    document.getElementById('login-modal').classList.add('is-visible');
    // Clear any previous error messages
    document.getElementById('modal-error-message').style.display = 'none';
}

/**
 * Closes the login modal.
 */
window.closeLoginModal = function() {
    document.getElementById('login-modal').classList.remove('is-visible');
}

/**
 * Attaches the AJAX submission handler to the login form after the DOM loads.
 */
function setupModalLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault(); // Stop default form submission/page reload
        
        const username = document.getElementById('modal-username').value;
        const password = document.getElementById('modal-password').value;
        const errorMessageElement = document.getElementById('modal-error-message');

        try {
            const response = await fetch('login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // Send data as JSON
                },
                body: JSON.stringify({ username: username, password: password }) // Send credentials as JSON payload
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Successful login: Close modal and refresh the page to update the navbar
                closeLoginModal();
                window.location.reload(); 
            } else {
                // Failed login: Display error message
                errorMessageElement.textContent = result.message || 'Login failed due to an unknown error.';
                errorMessageElement.style.display = 'block';
            }
        } catch (error) {
            console.error('Network or Parse Error during login:', error);
            errorMessageElement.textContent = 'A network error occurred. Could not connect to the server.';
            errorMessageElement.style.display = 'block';
        }
    });
    
    // Close modal if user clicks outside of it
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('login-modal');
        if (event.target === modal) {
            closeLoginModal();
        }
    });
}