import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment } from '../../scripts/scripts.js';
import { getHostname } from '../../scripts/utils.js';

/**
 * Format currency value
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Create table HTML from asset allocation data
 */
function renderTable(data) {
  const assets = data.asset_allocation || [];
  
  let tableHTML = `
    <div class="asset-allocation-container">
      <table class="asset-allocation-table">
        <thead>
          <tr>
            <th>Asset Class</th>
            <th>Allocation %</th>
            <th>Value</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  assets.forEach(asset => {
    const trendClass = asset.trend.toLowerCase().replace(' ', '-');
    tableHTML += `
      <tr>
        <td class="asset-class">${asset.asset_class}</td>
        <td class="allocation-percentage">
          <div class="percentage-bar-container">
            <div class="percentage-bar" style="width: ${asset.allocation_percentage}%"></div>
            <span class="percentage-text">${asset.allocation_percentage}%</span>
          </div>
        </td>
        <td class="value">${formatCurrency(asset.value)}</td>
        <td class="trend ${trendClass}">${asset.trend}</td>
      </tr>
    `;
  });
  
  tableHTML += `
        </tbody>
      </table>
    </div>
  `;
  
  return tableHTML;
}

/**
 * Decorates the asset allocation block
 * @param {Element} block
 */
export default async function decorate(block) {
  // Configuration
  const CONFIG = {
    DEFAULT_ENDPOINT: '/asset-allocation.json'
  };
  
  // Get the endpoint URL from the block (first row)
  const endpointPath = block.querySelector(':scope div:nth-child(1) > div')?.textContent?.trim() || CONFIG.DEFAULT_ENDPOINT;
  
  // Clear block content
  block.innerHTML = '';
  
  const isAuthor = isAuthorEnvironment();
  
  // Prepare request configuration based on environment
  let apiUrl;
  
  // Check if endpointPath is a full URL or a relative path
  const isFullUrl = endpointPath.startsWith('http://') || endpointPath.startsWith('https://');
  
  if (isFullUrl) {
    // Use the full URL as provided
    apiUrl = `${endpointPath}?ts=${Date.now()}`;
  } else if (isAuthor) {
    // In author mode, prepend AEM author URL
    const aemauthorurl = getMetadata('authorurl') || '';
    apiUrl = `${aemauthorurl}${endpointPath}?ts=${Date.now()}`;
  } else {
    // For published/preview environment with relative path, use current origin
    const baseUrl = window.location.origin;
    apiUrl = `${baseUrl}${endpointPath}?ts=${Date.now()}`;
  }
  
  const requestConfig = {
    url: apiUrl,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  
  try {
    // Fetch data
    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: requestConfig.headers,
    });
    
    if (!response.ok) {
      console.error(`Error fetching asset allocation data: ${response.status}`);
      block.innerHTML = '<p class="error">Unable to load asset allocation data.</p>';
      return;
    }
    
    let assetData;
    try {
      assetData = await response.json();
    } catch (parseError) {
      console.error('Error parsing asset allocation JSON:', parseError);
      block.innerHTML = '<p class="error">Error parsing data.</p>';
      return;
    }
    
    if (!assetData || !assetData.asset_allocation) {
      console.error('No valid asset allocation data found');
      block.innerHTML = '<p class="error">No data available.</p>';
      return;
    }
    
    // Render the table
    block.innerHTML = renderTable(assetData);
    
  } catch (error) {
    console.error('Error rendering asset allocation:', {
      error: error.message,
      stack: error.stack,
      endpointPath,
      isAuthor
    });
    block.innerHTML = '<p class="error">Unable to load asset allocation.</p>';
  }
}

