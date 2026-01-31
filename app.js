/**
 * LOINC Browser - FHIR Terminology Services Client
 * A web-based interface for querying LOINC codes via FHIR API
 */

// ===== Configuration =====
// ===== Configuration =====
const CONFIG = {
    // FIX: Set to relative path '/fhir'. 
    // The Cloudflare Worker will intercept this and forward it to the real server.
    defaultServer: '/fhir', 
    
    // Keep this for reference, but it won't be used actively
    directServer: 'http://84.8.248.255:8080/fhir',
    
    loincSystem: 'http://loinc.org',
    timeout: 30000,
    maxHistoryItems: 20
};

// ===== State Management =====
const state = {
    connected: false,
    serverUrl: CONFIG.defaultServer,
    lastResponse: null,
    searchHistory: JSON.parse(localStorage.getItem('loincSearchHistory') || '[]')
};

// ===== DOM Elements =====
const DOM = {
    // Server
    serverUrl: document.getElementById('serverUrl'),
    connectBtn: document.getElementById('connectBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    serverInfo: document.getElementById('serverInfo'),
    
    // Operations
    tabs: document.querySelectorAll('.tab-btn'),
    lookupPanel: document.getElementById('lookupPanel'),
    validatePanel: document.getElementById('validatePanel'),
    searchPanel: document.getElementById('searchPanel'),
    subsumesPanel: document.getElementById('subsumesPanel'),
    
    // Lookup
    lookupCode: document.getElementById('lookupCode'),
    lookupProperty: document.getElementById('lookupProperty'),
    lookupLang: document.getElementById('lookupLang'),
    lookupBtn: document.getElementById('lookupBtn'),
    
    // Validate
    validateCode: document.getElementById('validateCode'),
    validateDisplay: document.getElementById('validateDisplay'),
    validateBtn: document.getElementById('validateBtn'),
    
    // Search
    searchTerm: document.getElementById('searchTerm'),
    searchFilter: document.getElementById('searchFilter'),
    searchCount: document.getElementById('searchCount'),
    searchBtn: document.getElementById('searchBtn'),
    
    // Subsumes
    codeA: document.getElementById('codeA'),
    codeB: document.getElementById('codeB'),
    subsumesBtn: document.getElementById('subsumesBtn'),
    
    // Results
    resultsTitle: document.getElementById('resultsTitle'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    resultsContent: document.getElementById('resultsContent'),
    errorMessage: document.getElementById('errorMessage'),
    errorText: document.getElementById('errorText'),
    
    // Result Cards
    summaryCard: document.getElementById('summaryCard'),
    summaryBody: document.getElementById('summaryBody'),
    propertiesCard: document.getElementById('propertiesCard'),
    propertiesBody: document.getElementById('propertiesBody'),
    designationsCard: document.getElementById('designationsCard'),
    designationsBody: document.getElementById('designationsBody'),
    jsonCard: document.getElementById('jsonCard'),
    jsonBody: document.getElementById('jsonBody'),
    rawJson: document.getElementById('rawJson'),
    searchResultsCard: document.getElementById('searchResultsCard'),
    searchResultsBody: document.getElementById('searchResultsBody'),
    resultCount: document.getElementById('resultCount'),
    validationCard: document.getElementById('validationCard'),
    validationBody: document.getElementById('validationBody'),
    
    // Actions
    copyJsonBtn: document.getElementById('copyJsonBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    clearBtn: document.getElementById('clearBtn'),
    
    // Other
    toastContainer: document.getElementById('toastContainer'),
    recentCodes: document.getElementById('recentCodes'),
    exampleChips: document.querySelectorAll('.chip')
};

// ===== Utility Functions =====

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show loading indicator
 */
function showLoading() {
    DOM.loadingIndicator.classList.remove('hidden');
    DOM.welcomeMessage.classList.add('hidden');
    DOM.resultsContent.classList.add('hidden');
    DOM.errorMessage.classList.add('hidden');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    DOM.loadingIndicator.classList.add('hidden');
}

/**
 * Show error message
 */
function showError(message) {
    hideLoading();
    DOM.errorMessage.classList.remove('hidden');
    DOM.errorText.textContent = message;
    DOM.welcomeMessage.classList.add('hidden');
    DOM.resultsContent.classList.add('hidden');
}

/**
 * Show results
 */
function showResults() {
    hideLoading();
    DOM.errorMessage.classList.add('hidden');
    DOM.welcomeMessage.classList.add('hidden');
    DOM.resultsContent.classList.remove('hidden');
}

/**
 * Update connection status
 */
function updateConnectionStatus(status, serverName = '') {
    const statusDot = DOM.connectionStatus.querySelector('.status-dot');
    const statusText = DOM.connectionStatus.querySelector('.status-text');
    
    statusDot.className = 'status-dot ' + status;
    
    switch(status) {
        case 'connected':
            statusText.textContent = 'Connected';
            DOM.serverInfo.textContent = `Connected to: ${state.serverUrl}`;
            if (serverName) {
                DOM.serverInfo.textContent += ` (${serverName})`;
            }
            break;
        case 'connecting':
            statusText.textContent = 'Connecting...';
            DOM.serverInfo.textContent = 'Connecting...';
            break;
        case 'disconnected':
        default:
            statusText.textContent = 'Disconnected';
            DOM.serverInfo.textContent = 'Not connected';
    }
}

/**
 * Add to search history
 */
function addToHistory(code, display) {
    const existing = state.searchHistory.findIndex(h => h.code === code);
    if (existing !== -1) {
        state.searchHistory.splice(existing, 1);
    }
    
    state.searchHistory.unshift({ code, display, timestamp: Date.now() });
    
    if (state.searchHistory.length > CONFIG.maxHistoryItems) {
        state.searchHistory.pop();
    }
    
    localStorage.setItem('loincSearchHistory', JSON.stringify(state.searchHistory));
    updateRecentCodes();
}

/**
 * Update recent codes datalist
 */
function updateRecentCodes() {
    DOM.recentCodes.innerHTML = state.searchHistory
        .map(h => `<option value="${h.code}">${h.display || h.code}</option>`)
        .join('');
}

// ===== API Functions =====

/**
 * Make FHIR API request
 */
async function fhirRequest(endpoint, params = {}) {
    const url = new URL(state.serverUrl + endpoint);
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, v));
            } else {
                url.searchParams.append(key, value);
            }
        }
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/fhir+json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.issue?.[0]?.diagnostics || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

/**
 * Test server connection
 */
async function testConnection() {
    state.serverUrl = DOM.serverUrl.value.trim().replace(/\/$/, '');
    updateConnectionStatus('connecting');
    
    try {
        const metadata = await fhirRequest('/metadata');
        state.connected = true;
        
        const serverName = metadata.software?.name || 'FHIR Server';
        updateConnectionStatus('connected', serverName);
        showToast(`Connected to ${serverName}`, 'success');
        
        return true;
    } catch (error) {
        state.connected = false;
        updateConnectionStatus('disconnected');
        showToast(`Connection failed: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Lookup code
 */
async function lookupCode(code, properties = [], language = '') {
    const params = {
        system: CONFIG.loincSystem,
        code: code
    };
    
    if (properties.length > 0) {
        params.property = properties;
    }
    
    if (language) {
        params.displayLanguage = language;
    }
    
    return await fhirRequest('/CodeSystem/$lookup', params);
}

/**
 * Validate code
 */
async function validateCode(code, display = '') {
    const params = {
        system: CONFIG.loincSystem,
        code: code
    };
    
    if (display) {
        params.display = display;
    }
    
    return await fhirRequest('/CodeSystem/$validate-code', params);
}

/**
 * Search concepts (using ValueSet $expand)
 */
async function searchConcepts(term, filter = '', count = 20) {
    const params = {
        url: CONFIG.loincSystem,
        filter: term,
        count: count
    };
    
    return await fhirRequest('/ValueSet/$expand', params);
}

/**
 * Test subsumption
 */
async function testSubsumption(codeA, codeB) {
    const params = {
        system: CONFIG.loincSystem,
        codeA: codeA,
        codeB: codeB
    };
    
    return await fhirRequest('/CodeSystem/$subsumes', params);
}

// ===== Display Functions =====

/**
 * Display lookup results
 */
function displayLookupResults(data) {
    state.lastResponse = data;
    
    // Reset visibility
    DOM.summaryCard.classList.remove('hidden');
    DOM.propertiesCard.classList.remove('hidden');
    DOM.designationsCard.classList.remove('hidden');
    DOM.jsonCard.classList.remove('hidden');
    DOM.searchResultsCard.classList.add('hidden');
    DOM.validationCard.classList.add('hidden');
    
    const params = data.parameter || [];
    
    // Extract summary info
    const getName = (name) => params.find(p => p.name === name);
    const name = getName('name')?.valueString || 'LOINC';
    const system = getName('system')?.valueString || CONFIG.loincSystem;
    const display = getName('display')?.valueString || '';
    const code = DOM.lookupCode.value;
    
    // Add to history
    addToHistory(code, display);
    
    // Update results title
    DOM.resultsTitle.innerHTML = `<i class="fas fa-clipboard-list"></i> ${code} - ${display || 'No display'}`;
    
    // Display summary
    DOM.summaryBody.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Code</span>
            <span class="summary-value code">${code}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">System</span>
            <span class="summary-value">${name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Display</span>
            <span class="summary-value">${display || 'N/A'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">System URI</span>
            <span class="summary-value"><a href="${system}" target="_blank">${system}</a></span>
        </div>
    `;
    
    // Extract and display properties
    const properties = params.filter(p => p.name === 'property');
    if (properties.length > 0) {
        const propertiesHtml = properties.map(prop => {
            const parts = prop.part || [];
            const code = parts.find(p => p.name === 'code')?.valueCode || '';
            const valuePart = parts.find(p => p.name === 'value');
            let value = '';
            
            if (valuePart?.valueString) {
                value = valuePart.valueString;
            } else if (valuePart?.valueCoding) {
                const coding = valuePart.valueCoding;
                value = `${coding.display || coding.code} (${coding.code})`;
            } else if (valuePart?.valueCode) {
                value = valuePart.valueCode;
            } else if (valuePart?.valueBoolean !== undefined) {
                value = valuePart.valueBoolean ? 'Yes' : 'No';
            }
            
            return `
                <tr>
                    <td><span class="property-code">${code}</span></td>
                    <td>${escapeHtml(value)}</td>
                </tr>
            `;
        }).join('');
        
        DOM.propertiesBody.innerHTML = `
            <table class="properties-table">
                <thead>
                    <tr>
                        <th style="width: 200px;">Property</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${propertiesHtml}
                </tbody>
            </table>
        `;
    } else {
        DOM.propertiesBody.innerHTML = '<p>No properties available</p>';
    }
    
    // Extract and display designations
    const designations = params.filter(p => p.name === 'designation');
    if (designations.length > 0) {
        // Group by language
        const byLanguage = {};
        
        designations.forEach(desig => {
            const parts = desig.part || [];
            const language = parts.find(p => p.name === 'language')?.valueCode || 'en';
            const use = parts.find(p => p.name === 'use')?.valueCoding?.display || 
                       parts.find(p => p.name === 'use')?.valueCoding?.code || 'Display';
            const value = parts.find(p => p.name === 'value')?.valueString || '';
            
            if (!byLanguage[language]) {
                byLanguage[language] = [];
            }
            
            byLanguage[language].push({ use, value });
        });
        
        const designationsHtml = Object.entries(byLanguage).map(([lang, items]) => `
            <div class="designation-group">
                <div class="designation-language">
                    <i class="fas fa-globe"></i>
                    ${getLanguageName(lang)} (${lang})
                </div>
                ${items.map(item => `
                    <div class="designation-item">
                        <div class="designation-use">${escapeHtml(item.use)}</div>
                        <div class="designation-value">${escapeHtml(item.value)}</div>
                    </div>
                `).join('')}
            </div>
        `).join('');
        
        DOM.designationsBody.innerHTML = designationsHtml;
    } else {
        DOM.designationsBody.innerHTML = '<p>No designations/translations available</p>';
    }
    
    // Display raw JSON
    DOM.rawJson.textContent = JSON.stringify(data, null, 2);
    
    showResults();
}

/**
 * Display validation results
 */
function displayValidationResults(data, code) {
    state.lastResponse = data;
    
    // Reset visibility
    DOM.summaryCard.classList.add('hidden');
    DOM.propertiesCard.classList.add('hidden');
    DOM.designationsCard.classList.add('hidden');
    DOM.searchResultsCard.classList.add('hidden');
    DOM.validationCard.classList.remove('hidden');
    DOM.jsonCard.classList.remove('hidden');
    
    const params = data.parameter || [];
    const result = params.find(p => p.name === 'result')?.valueBoolean;
    const display = params.find(p => p.name === 'display')?.valueString || '';
    const message = params.find(p => p.name === 'message')?.valueString || '';
    
    DOM.resultsTitle.innerHTML = `<i class="fas fa-check-double"></i> Validation: ${code}`;
    
    if (result) {
        DOM.validationCard.classList.remove('invalid');
        DOM.validationBody.innerHTML = `
            <div class="validation-result">
                <div class="validation-icon valid">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="validation-details">
                    <h4>Valid Code</h4>
                    <p>The code <strong>${code}</strong> exists in LOINC</p>
                    ${display ? `<p>Display: <strong>${escapeHtml(display)}</strong></p>` : ''}
                </div>
            </div>
        `;
    } else {
        DOM.validationCard.classList.add('invalid');
        DOM.validationBody.innerHTML = `
            <div class="validation-result">
                <div class="validation-icon invalid">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="validation-details">
                    <h4>Invalid Code</h4>
                    <p>The code <strong>${code}</strong> was not found in LOINC</p>
                    ${message ? `<p>${escapeHtml(message)}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    DOM.rawJson.textContent = JSON.stringify(data, null, 2);
    
    showResults();
}

/**
 * Display search results
 */
function displaySearchResults(data) {
    state.lastResponse = data;
    
    // Reset visibility
    DOM.summaryCard.classList.add('hidden');
    DOM.propertiesCard.classList.add('hidden');
    DOM.designationsCard.classList.add('hidden');
    DOM.validationCard.classList.add('hidden');
    DOM.searchResultsCard.classList.remove('hidden');
    DOM.jsonCard.classList.remove('hidden');
    
    const expansion = data.expansion || {};
    const contains = expansion.contains || [];
    const total = expansion.total || contains.length;
    
    DOM.resultsTitle.innerHTML = `<i class="fas fa-search"></i> Search Results`;
    DOM.resultCount.textContent = `${contains.length} of ${total} results`;
    
    if (contains.length > 0) {
        const resultsHtml = contains.map(item => `
            <div class="search-result-item" data-code="${item.code}">
                <div class="search-result-code">${item.code}</div>
                <div class="search-result-display">${escapeHtml(item.display || 'No display')}</div>
            </div>
        `).join('');
        
        DOM.searchResultsBody.innerHTML = resultsHtml;
        
        // Add click handlers
        DOM.searchResultsBody.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                DOM.lookupCode.value = code;
                switchToTab('lookup');
                performLookup();
            });
        });
    } else {
        DOM.searchResultsBody.innerHTML = '<p>No results found</p>';
    }
    
    DOM.rawJson.textContent = JSON.stringify(data, null, 2);
    
    showResults();
}

/**
 * Display subsumption results
 */
function displaySubsumptionResults(data, codeA, codeB) {
    state.lastResponse = data;
    
    // Reset visibility
    DOM.summaryCard.classList.add('hidden');
    DOM.propertiesCard.classList.add('hidden');
    DOM.designationsCard.classList.add('hidden');
    DOM.searchResultsCard.classList.add('hidden');
    DOM.validationCard.classList.remove('hidden');
    DOM.jsonCard.classList.remove('hidden');
    
    const params = data.parameter || [];
    const outcome = params.find(p => p.name === 'outcome')?.valueCode || 'not-subsumed';
    
    DOM.resultsTitle.innerHTML = `<i class="fas fa-sitemap"></i> Subsumption Test`;
    
    const outcomeDescriptions = {
        'equivalent': `Code ${codeA} and ${codeB} are equivalent`,
        'subsumes': `Code ${codeA} subsumes (is parent of) ${codeB}`,
        'subsumed-by': `Code ${codeA} is subsumed by (is child of) ${codeB}`,
        'not-subsumed': `No hierarchical relationship between ${codeA} and ${codeB}`
    };
    
    const isRelated = outcome !== 'not-subsumed';
    
    DOM.validationCard.classList.toggle('invalid', !isRelated);
    DOM.validationBody.innerHTML = `
        <div class="validation-result">
            <div class="validation-icon ${isRelated ? 'valid' : 'invalid'}">
                <i class="fas fa-${isRelated ? 'sitemap' : 'times-circle'}"></i>
            </div>
            <div class="validation-details">
                <h4>${outcome.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
                <p>${outcomeDescriptions[outcome] || outcome}</p>
            </div>
        </div>
    `;
    
    DOM.rawJson.textContent = JSON.stringify(data, null, 2);
    
    showResults();
}

// ===== Helper Functions =====

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get language name from code
 */
function getLanguageName(code) {
    const languages = {
        'en': 'English',
        'de-DE': 'German',
        'es-ES': 'Spanish (Spain)',
        'es-MX': 'Spanish (Mexico)',
        'es-AR': 'Spanish (Argentina)',
        'fr-FR': 'French',
        'it-IT': 'Italian',
        'nl-NL': 'Dutch',
        'pt-BR': 'Portuguese (Brazil)',
        'zh-CN': 'Chinese',
        'ko-KR': 'Korean',
        'pl-PL': 'Polish',
        'uk-UA': 'Ukrainian',
        'cs-CZ': 'Czech'
    };
    return languages[code] || code;
}

/**
 * Switch to tab
 */
function switchToTab(tabName) {
    // Update tab buttons
    DOM.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update panels
    const panels = {
        lookup: DOM.lookupPanel,
        validate: DOM.validatePanel,
        search: DOM.searchPanel,
        subsumes: DOM.subsumesPanel
    };
    
    Object.entries(panels).forEach(([name, panel]) => {
        panel.classList.toggle('hidden', name !== tabName);
    });
}

// ===== Action Functions =====

/**
 * Perform lookup
 */
async function performLookup() {
    const code = DOM.lookupCode.value.trim();
    if (!code) {
        showToast('Please enter a LOINC code', 'warning');
        return;
    }
    
    if (!state.connected) {
        const connected = await testConnection();
        if (!connected) return;
    }
    
    showLoading();
    
    try {
        const selectedProperties = Array.from(DOM.lookupProperty.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v);
        
        const language = DOM.lookupLang.value;
        
        const result = await lookupCode(code, selectedProperties, language);
        displayLookupResults(result);
    } catch (error) {
        showError(`Lookup failed: ${error.message}`);
        showToast(`Lookup failed: ${error.message}`, 'error');
    }
}

/**
 * Perform validation
 */
async function performValidation() {
    const code = DOM.validateCode.value.trim();
    if (!code) {
        showToast('Please enter a LOINC code', 'warning');
        return;
    }
    
    if (!state.connected) {
        const connected = await testConnection();
        if (!connected) return;
    }
    
    showLoading();
    
    try {
        const display = DOM.validateDisplay.value.trim();
        const result = await validateCode(code, display);
        displayValidationResults(result, code);
    } catch (error) {
        showError(`Validation failed: ${error.message}`);
        showToast(`Validation failed: ${error.message}`, 'error');
    }
}

/**
 * Perform search
 */
async function performSearch() {
    const term = DOM.searchTerm.value.trim();
    if (!term) {
        showToast('Please enter a search term', 'warning');
        return;
    }
    
    if (!state.connected) {
        const connected = await testConnection();
        if (!connected) return;
    }
    
    showLoading();
    
    try {
        const filter = DOM.searchFilter.value;
        const count = parseInt(DOM.searchCount.value) || 20;
        const result = await searchConcepts(term, filter, count);
        displaySearchResults(result);
    } catch (error) {
        showError(`Search failed: ${error.message}`);
        showToast(`Search failed: ${error.message}`, 'error');
    }
}

/**
 * Perform subsumption test
 */
async function performSubsumption() {
    const codeA = DOM.codeA.value.trim();
    const codeB = DOM.codeB.value.trim();
    
    if (!codeA || !codeB) {
        showToast('Please enter both codes', 'warning');
        return;
    }
    
    if (!state.connected) {
        const connected = await testConnection();
        if (!connected) return;
    }
    
    showLoading();
    
    try {
        const result = await testSubsumption(codeA, codeB);
        displaySubsumptionResults(result, codeA, codeB);
    } catch (error) {
        showError(`Subsumption test failed: ${error.message}`);
        showToast(`Subsumption test failed: ${error.message}`, 'error');
    }
}

/**
 * Copy JSON to clipboard
 */
function copyJson() {
    if (!state.lastResponse) {
        showToast('No data to copy', 'warning');
        return;
    }
    
    const json = JSON.stringify(state.lastResponse, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        showToast('JSON copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
    });
}

/**
 * Download JSON
 */
function downloadJson() {
    if (!state.lastResponse) {
        showToast('No data to download', 'warning');
        return;
    }
    
    const json = JSON.stringify(state.lastResponse, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `loinc-response-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Download started', 'success');
}

/**
 * Clear results
 */
function clearResults() {
    state.lastResponse = null;
    DOM.welcomeMessage.classList.remove('hidden');
    DOM.resultsContent.classList.add('hidden');
    DOM.errorMessage.classList.add('hidden');
    DOM.resultsTitle.innerHTML = '<i class="fas fa-clipboard-list"></i> Results';
    showToast('Results cleared', 'info');
}

// ===== Event Listeners =====

// Connect button
DOM.connectBtn.addEventListener('click', testConnection);

// Tab switching
DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchToTab(tab.dataset.tab);
    });
});

// Operation buttons
DOM.lookupBtn.addEventListener('click', performLookup);
DOM.validateBtn.addEventListener('click', performValidation);
DOM.searchBtn.addEventListener('click', performSearch);
DOM.subsumesBtn.addEventListener('click', performSubsumption);

// Enter key support
DOM.lookupCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performLookup();
});

DOM.validateCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performValidation();
});

DOM.searchTerm.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// Action buttons
DOM.copyJsonBtn.addEventListener('click', copyJson);
DOM.downloadBtn.addEventListener('click', downloadJson);
DOM.clearBtn.addEventListener('click', clearResults);

// Example chips
DOM.exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const code = chip.dataset.code;
        DOM.lookupCode.value = code;
        switchToTab('lookup');
        performLookup();
    });
});

// Collapse buttons
document.querySelectorAll('.btn-collapse').forEach(btn => {
    btn.addEventListener('click', () => {
        const cardBody = btn.closest('.result-card').querySelector('.card-body');
        const isCollapsed = cardBody.classList.toggle('collapsed');
        btn.classList.toggle('collapsed', isCollapsed);
        btn.querySelector('i').className = `fas fa-chevron-${isCollapsed ? 'down' : 'up'}`;
    });
});

// Server URL enter key
DOM.serverUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') testConnection();
});

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    updateRecentCodes();
    
    // Auto-connect on load
    setTimeout(() => {
        testConnection();
    }, 500);
});

