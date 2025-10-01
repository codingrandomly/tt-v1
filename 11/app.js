// --- API CONFIGURATION ---
const API_BASE_URL = "https://stock.indianapi.in/";
const API_KEY = "sk-live-VZE1udfc3spNGKATbBNinFKbU2jSlAbnd9qNR72t"; // YOUR API KEY

// --- GLOBAL DATA STATE (To be populated by API) ---
let companies = [];          // Array of all companies for search/main table 
let stockData = [];          // Detailed stock data for screening 
let portfolioData = {        // Portfolio holdings and historical performance
    holdings: [],
    performance: []
};
let financialData = {};      // Detailed financial statements by ticker
// NOTE: chatbotResponses is defined lower down in the file (Line 806) and will cause a duplicate declaration error here.
// We will only declare it once near the end of the file.

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
 * Generates simple mock price history for the charts
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
 * @param {number} num - The number to format.
 */
function formatCurrency(num) {
    if (typeof num !== 'number' || isNaN(num)) return 'N/A';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 10000000) { // 1 Crore (10 million)
        return `${sign}₹${(absNum / 10000000).toFixed(2)} Cr`;
    } else if (absNum >= 100000) { // 1 Lakh (100 thousand)
        return `${sign}₹${(absNum / 100000).toFixed(2)} L`;
    }
    return `${sign}₹${absNum.toFixed(2)}`;
}

// --- API INTEGRATION POINT (LIVE DATA RESTORED) ---

// --- NEW MOCK DATA STRUCTURE FOR GUARANTEED LOAD ---
const INITIAL_MOCK_COMPANIES = [
    { name: "Reliance Industries", ticker: "RELIANCE", price: 2856.75, change: 2.34, sector: "Energy", marketCap: 19324560000000, pe: 35.1, roe: 12.4 },
    { name: "Tata Consultancy Services", ticker: "TCS", price: 3834.50, change: -1.23, sector: "IT", marketCap: 13987650000000, pe: 28.5, roe: 45.2 },
    { name: "HDFC Bank", ticker: "HDFCBANK", price: 1667.25, change: 0.89, sector: "Banking", marketCap: 12345670000000, pe: 20.3, roe: 16.8 },
    { name: "Infosys", ticker: "INFY", price: 1489.40, change: 1.56, sector: "IT", marketCap: 6543210000000, pe: 22.3, roe: 28.9 },
    { name: "ITC Limited", ticker: "ITC", price: 456.75, change: -0.34, sector: "FMCG", marketCap: 5678900000000, pe: 24.7, roe: 22.1 }
];

/**
 * This function fetches all initial data using the API key.
 * Now runs AFTER mock data is loaded.
 */
async function fetchDataAndInitialize() {
    try {
        document.querySelector('#chatbot-messages span').textContent = "Attempting to fetch live data...";
        
        // 1. Fetch the list of all available tickers
        const listEndpoint = `${API_BASE_URL}list?api_key=${API_KEY}`;
        const listResponse = await fetch(listEndpoint);
        
        if (!listResponse.ok) {
            throw new Error(`HTTP error! status: ${listResponse.status}`);
        }
        
        const listData = await listResponse.json();

        if (listData.status !== "success" || !listData.data || listData.data.length === 0) {
            throw new Error(listData.message || "Failed to fetch stock list.");
        }

        // Map the list to the 'companies' structure
        const apiCompanies = listData.data
            .filter(item => item.Symbol && item.Name)
            .map(item => ({
                name: item.Name,
                ticker: item.Symbol,
                // Mocking financial metrics for all stocks but RELIANCE
                price: Math.random() * 2000 + 100, 
                change: Math.random() * 5 - 2.5,  
                marketCap: (Math.random() * 1000000000000) + 10000000000,
                pe: Math.random() * 50 + 10,
                roe: Math.random() * 30 + 5,
                sector: "General",
                dividend: 1.2 + Math.random() * 3,
                growth: 5 + Math.random() * 15,
                salesGrowth: 10 + Math.random() * 10
            }));
        
        // Overwrite initial mock data with the list data
        companies = apiCompanies;
        stockData = [...companies];
        filteredStocks = [...stockData];


        // 2. Fetch detailed data for one specific stock (RELIANCE)
        await fetchDetailData("RELIANCE"); 

        
        // 3. Re-initialize UI with live data updates (run after data structures are fully populated)
        setupSearch();
        loadScreensPage(); 
        
        document.querySelector('#chatbot-messages span').textContent = `Success! Over ${companies.length} tickers loaded. Search for any company or view the Screens page.`;

    } catch (error) {
        console.error("Live Data Fetch Failed:", error);
        document.querySelector('#chatbot-messages span').textContent = "Live data failed to load. Using fallback demo data.";
    }
}

/**
 * Fetches detailed stock data for a single stock and mocks the necessary structure.
 */
async function fetchDetailData(ticker) {
    try {
        const detailEndpoint = `${API_BASE_URL}stock?api_key=${API_KEY}&ticker=${ticker}`;
        const detailResponse = await fetch(detailEndpoint);
        
        if (!detailResponse.ok) {
            throw new Error(`HTTP error! status: ${detailResponse.status}`);
        }
        
        const detailData = await detailResponse.json();
        
        if (detailData.status !== "success" || !detailData.data) {
            throw new Error(detailData.message || `API returned error for ${ticker}.`);
        }
        
        const stock = detailData.data;
        const currentPrice = parseFloat(stock.currentPrice.replace(/,/g, ''));
        const marketCapNum = parseFloat(stock.marketCap.replace(/[^0-9.]/g, '')) * 10000000; 
        const change = parseFloat(stock.change.replace(/[^0-9.-]/g, ''));
        const peNum = parseFloat(stock.pe);
        const roeNum = parseFloat(stock.roe);

        // Update the stock entry with real data
        const companyIndex = companies.findIndex(c => c.ticker === ticker);
        if (companyIndex > -1) {
            const updatedData = {
                price: currentPrice, 
                change: change, 
                marketCap: marketCapNum,
                name: stock.name, 
                sector: stock.sector,
                pe: peNum,
                roe: roeNum,
                priceHistory: {
                    '1M': generateMockHistory(currentPrice, 30),
                    '1Y': generateMockHistory(currentPrice, 365),
                }
            };
            companies[companyIndex] = {...companies[companyIndex], ...updatedData};
            stockData[companyIndex] = {...stockData[companyIndex], ...updatedData};
            
        } else {
            // Add if RELIANCE wasn't in the list for some reason
            companies.push({ name: stock.name, ticker: stock.ticker, price: currentPrice, change: change, sector: stock.sector, marketCap: marketCapNum, pe: peNum, roe: roeNum });
        }

        // Populate 'financialData' (Mocked statements, Real key metrics)
        financialData[ticker] = {
            profitLoss: [
                { item: "Revenue", 2024: marketCapNum/5, 2023: marketCapNum/6, 2022: marketCapNum/7, 2021: marketCapNum/8, 2020: marketCapNum/9 },
                { item: "EBITDA", 2024: marketCapNum/10, 2023: marketCapNum/11, 2022: marketCapNum/12, 2021: marketCapNum/13, 2020: marketCapNum/14 },
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
                marketCap: formatCurrency(marketCapNum), pe: peNum.toFixed(1), roe: roeNum.toFixed(1) + '%', 
                debtEquity: (Math.random() * 0.5 + 0.1).toFixed(2),
                revenue: formatCurrency(marketCapNum/5), netProfit: formatCurrency(marketCapNum/30)
            }
        };
        
        // Mock portfolio data using the real price
        portfolioData = {
            holdings: [
                { ticker: ticker, name: stock.name, qty: 50, avgPrice: currentPrice * 0.9, currentPrice: currentPrice, weight: 18.5 },
                { ticker: "TCS", name: "Tata Consultancy Services", qty: 25, avgPrice: 3234.50, currentPrice: 3834.50, weight: 15.2 },
            ],
            performance: generateMockHistory(currentPrice * 1000, 365) 
        };
        
    } catch (error) {
        console.error("Detail Data Fetch Error:", error);
        // Fail silently here, initialization will rely on the list data
    }
}

// --- INITIALIZATION AND DOM READY ---

function initializeApp() {
    // 1. GUARANTEE that the UI has data to work with (Mock Data)
    companies = INITIAL_MOCK_COMPANIES;
    stockData = [...companies].map(c => ({
        ...c,
        dividend: 1.2 + Math.random() * 3,
        growth: 5 + Math.random() * 15,
        salesGrowth: 10 + Math.random() * 10
    }));
    
    // Add mock financial data for all initial stocks
    companies.forEach(company => {
        const marketCapNum = company.marketCap;
        const ticker = company.ticker;
        financialData[ticker] = {
            profitLoss: [{ item: "Revenue", 2024: marketCapNum/5, 2023: marketCapNum/6, 2022: marketCapNum/7, 2021: marketCapNum/8, 2020: marketCapNum/9 }],
            balanceSheet: [{ item: "Total Assets", 2024: marketCapNum*1.5, 2023: marketCapNum*1.4, 2022: marketCapNum*1.3, 2021: marketCapNum*1.2, 2020: marketCapNum*1.1 }],
            cashFlow: [{ item: "Operating Cash Flow", 2024: marketCapNum/15, 2023: marketCapNum/16, 2022: marketCapNum/17, 2021: marketCapNum/18, 2020: marketCapNum/19 }],
            keyMetrics: { 
                marketCap: formatCurrency(marketCapNum), pe: company.pe?.toFixed(1) || 'N/A', roe: company.roe?.toFixed(1) + '%' || 'N/A', 
                debtEquity: (Math.random() * 0.5 + 0.1).toFixed(2), revenue: formatCurrency(marketCapNum/5), netProfit: formatCurrency(marketCapNum/30)
            }
        };
        company.priceHistory = {
            '1M': generateMockHistory(company.price, 30),
            '1Y': generateMockHistory(company.price, 365),
        };
    });
    
    // Set initial UI state
    filteredStocks = [...stockData];
    setupSearch();
    loadScreensPage(); 
    setupChatbot();
    document.querySelector('#chatbot-messages span').textContent = "Demo data loaded. Searching for live updates...";

    // 2. RUN LIVE API FETCH to UPDATE the data
    fetchDataAndInitialize();
}


document.addEventListener('DOMContentLoaded', initializeApp);


// --- CORE APPLICATION LOGIC ---

// ----------------------------------------------------
// FIX 1 & 2: Explicitly define global functions (showPage, toggleChatbot)
// to fix ReferenceErrors on HTML element click events.
// ----------------------------------------------------

window.showPage = function(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page === 'home' ? 'homepage' : page + '-page').classList.add('active');
    currentPage = page;
    
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
    if (!searchInput || !dropdown) return;
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        if (query.length === 0 || companies.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Find top 10 matches
        const matches = companies.filter(company => 
            company.name.toLowerCase().includes(query) || 
            company.ticker.toLowerCase().includes(query)
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
        changeElement.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
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
            loadPriceChart(ticker, '1M');
            loadRatiosChart(ticker);
            loadPeerComparison(ticker);
            showTab(null, 'profit-loss', true);
        } else {
             // Handle case where we have basic info but not detailed financial data (e.g., from the API list call)
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
        document.getElementById('search-dropdown').style.display = 'none';
        document.getElementById('company-search').value = '';
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
    if (!ctx || !history) {
        if (ctx) ctx.parentElement.innerHTML = '<p class="text-center">Historical price data not available.</p>';
        if (chartInstances.price) chartInstances.price.destroy();
        return;
    }
    if (chartInstances.price) chartInstances.price.destroy();

    chartInstances.price = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(d => d.date),
            datasets: [{
                label: 'Price', data: history.map(d => d.price),
                borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2, fill: true, tension: 0.1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
            datasets: [{ label: 'P/E Ratio', data: peData, borderColor: '#2563eb', yAxisID: 'y' },
                       { label: 'ROE (%)', data: roeData, borderColor: '#10b981', yAxisID: 'y1' }]
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
        <tr class="${stock.ticker === currentStock.ticker ? 'current-company' : ''}" onclick="selectCompany('${stock.ticker}')">
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
        document.getElementById('stock-table-body').innerHTML = '<tr><td colspan="5" class="text-center">No Stock Data Available.</td></tr>';
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
                MarketCap: stock.marketCap, PE: stock.pe, ROE: stock.roe, Price: stock.price, Dividend: stock.dividend, Growth: stock.growth
            };
            let evalQuery = query
                .replace(/MarketCap/gi, safeStock.MarketCap)
                .replace(/PE/gi, safeStock.PE)
                .replace(/ROE/gi, safeStock.ROE)
                .replace(/Price/gi, safeStock.Price)
                .replace(/Dividend/gi, safeStock.Dividend)
                .replace(/Growth/gi, safeStock.Growth)
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

// Display stocks in table
function displayStocks(stocks) {
    const tbody = document.getElementById('stock-table-body');
    if (!tbody) return;
    
    if (stocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No results matched the filter criteria.</td></tr>';
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
    const holding = portfolioData.holdings[0];
    if (!holding) {
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

    // Use a placeholder stock for change calculation if the holding stock data isn't complete
    const stockChange = companies.find(c => c.ticker === holding.ticker)?.change || 0; 
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

// Chatbot functionality
window.toggleChatbot = function() { document.getElementById('chatbot-widget')?.classList.toggle('collapsed'); }
window.handleChatInput = function(event) { if (event.key === 'Enter') sendChatMessage(); }
window.sendChatMessage = function() { 
    const input = document.getElementById('chatbot-input-field');
    const message = input.value.trim();
    if (!message) return;
    addChatMessage(message, 'user');
    input.value = '';
    
    setTimeout(() => {
        const response = generateBotResponse(message);
        addChatMessage(response, 'bot');
    }, 500);
}
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
function generateBotResponse(message) { 
    const lowerMessage = message.toLowerCase();
    
    for (const [key, response] of Object.entries(chatbotResponses)) {
        if (lowerMessage.includes(key)) {
            return response;
        }
    }
    return "I'm still learning the market. Try asking about a specific stock ticker or a financial term that is in my knowledge base!";
}

// FIX 1: Move definition of chatbotResponses to the bottom to avoid redeclaration error.
let chatbotResponses = {     
    "pe ratio": "Price-to-Earnings ratio measures valuation relative to earnings. A lower PE is generally considered better for value investors.",
    "roe": "ROE (Return on Equity) measures management efficiency in generating profit from shareholders' equity.",
    "market cap": "Market Capitalization is the total value of a company's outstanding shares. It is the company's size.",
    "dividend": "Dividend is a payment made by a corporation to its shareholders.",
    "hello": "Hello! I am your financial assistant, ready to answer questions about stock ratios and terms.",
    "thank you": "You're welcome! Let me know if you have any other questions."
};

function setupChatbot() { document.getElementById('chatbot-widget')?.classList.add('collapsed'); }
