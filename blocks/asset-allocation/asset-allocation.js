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
 * Color palette for pie chart
 */
const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
];

/**
 * Draw pie chart on canvas with animation
 */
function drawPieChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 10;
  
  let currentAngle = -Math.PI / 2; // Start at top
  let animationProgress = 0;
  const animationDuration = 3000; // 3 seconds total
  const sliceDelay = 300; // Delay between each slice
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Calculate slice data
  const slices = data.map((asset, index) => {
    const sliceAngle = (asset.allocation_percentage / 100) * 2 * Math.PI;
    const slice = {
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle,
      color: CHART_COLORS[index % CHART_COLORS.length],
      index: index,
    };
    currentAngle += sliceAngle;
    return slice;
  });
  
  // Animation function
  function animate(timestamp) {
    if (!animationProgress) animationProgress = timestamp;
    const elapsed = timestamp - animationProgress;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each slice with fade-in
    slices.forEach((slice, index) => {
      const sliceStartTime = index * sliceDelay;
      const sliceElapsed = Math.max(0, elapsed - sliceStartTime);
      const sliceProgress = Math.min(sliceElapsed / 1200, 1); // 1200ms per slice
      
      if (sliceProgress > 0) {
        // Calculate opacity (fade in)
        const opacity = sliceProgress;
        
        // Draw slice
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, slice.startAngle, slice.endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = slice.color;
        ctx.fill();
        
        // Draw slice border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    });
    
    // Continue animation if not complete
    if (elapsed < animationDuration) {
      requestAnimationFrame(animate);
    } else {
      // Final draw at full opacity
      ctx.globalAlpha = 1;
      // Add flash effect at end
      canvas.classList.add('flash-animation');
    }
  }
  
  // Start animation
  requestAnimationFrame(animate);
}

/**
 * Create pie chart HTML
 */
function createPieChart(data) {
  const assets = data.asset_allocation || [];
  
  const chartHTML = `
    <div class="pie-chart-container">
      <canvas id="allocation-pie-chart" width="300" height="300"></canvas>
      <div class="chart-legend">
        ${assets.map((asset, index) => `
          <div class="legend-item">
            <span class="legend-color" style="background-color: ${CHART_COLORS[index % CHART_COLORS.length]}"></span>
            <span class="legend-label">${asset.asset_class}</span>
            <span class="legend-value">${asset.allocation_percentage}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  return chartHTML;
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
    
    // Render the visualization
    const visualizationHTML = `
      <div class="asset-allocation-wrapper">
        ${createPieChart(assetData)}
        ${renderTable(assetData)}
      </div>
    `;
    block.innerHTML = visualizationHTML;
    
    // Draw the pie chart after DOM is updated
    const canvas = block.querySelector('#allocation-pie-chart');
    if (canvas) {
      drawPieChart(canvas, assetData.asset_allocation);
    }
    
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

