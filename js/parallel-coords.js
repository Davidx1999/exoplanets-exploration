/**
 * js/parallel-coords.js — Coordenadas Paralelas D3.js
 *
 * Visualização multivariável para explorar simultaneamente
 * Massa, Raio, Órbita, Temperatura da Estrela e Distância
 * de exoplanetas filtrados no dashboard.
 */

import { getTypeColor, getMethodColor, formatNumber } from './utils.js';

// ============================================
// ESTADO DO MÓDULO
// ============================================
let svg, g, tooltip;
let dimensions, xScale, yScales;
let currentData = [];
let highlightedPlanet = null;
let hovered = null;

const DIMS = [
    { key: 'mass',     label: 'Massa (M⊕)',            scaleType: 'log' },
    { key: 'radius',   label: 'Raio (R⊕)',             scaleType: 'log' },
    { key: 'density',  label: 'Densidade (g/cm³)',     scaleType: 'log' },
    { key: 'eqTempC',  label: 'Temp. Equilíbrio (°C)', scaleType: 'linear' },
    { key: 'orbper',   label: 'Período (dias)',        scaleType: 'log' },
];

const MARGIN = { top: 36, right: 10, bottom: 8, left: 10 };

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function isValid(d) {
    return DIMS.every(dim => {
        const v = d[dim.key];
        if (v == null || isNaN(v)) return false;
        if (dim.scaleType === 'log' && v <= 0) return false;
        return true;
    });
}

function getColor(d) {
    return getTypeColor(d.type);
}

// ============================================
// CRIAÇÃO DOS EIXOS
// ============================================
function createScales(data, width, height) {
    const innerH = height - MARGIN.top - MARGIN.bottom;

    xScale = d3.scalePoint()
        .domain(DIMS.map(d => d.key))
        .range([0, width - MARGIN.left - MARGIN.right])
        .padding(0.08);

    yScales = {};
    DIMS.forEach(dim => {
        const extent = d3.extent(data, d => d[dim.key]);
        // Pad extents slightly
        const lo = extent[0] * 0.8;
        const hi = extent[1] * 1.2;

        if (dim.scaleType === 'log') {
            yScales[dim.key] = d3.scaleLog()
                .domain([Math.max(lo, 0.001), hi])
                .range([innerH, 0])
                .clamp(true);
        } else {
            yScales[dim.key] = d3.scaleLinear()
                .domain([lo, hi])
                .range([innerH, 0])
                .nice();
        }
    });
}

function renderAxes() {
    const innerH = parseFloat(svg.attr('height')) - MARGIN.top - MARGIN.bottom;

    // Remove old axes
    g.selectAll('.pc-axis').remove();

    DIMS.forEach(dim => {
        const axisG = g.append('g')
            .attr('class', 'pc-axis')
            .attr('transform', `translate(${xScale(dim.key)},0)`);

        const ticks = dim.scaleType === 'log' ? 4 : 5;

        const axis = d3.axisLeft(yScales[dim.key])
            .ticks(ticks, dim.scaleType === 'log' ? '.0e' : '~s')
            .tickSize(-4);

        axisG.call(axis);

        // Style axis
        axisG.selectAll('path')
            .attr('stroke', 'rgba(255,255,255,0.2)');
        axisG.selectAll('line')
            .attr('stroke', 'rgba(255,255,255,0.1)');
        axisG.selectAll('text')
            .attr('fill', 'rgba(255,255,255,0.5)')
            .attr('font-size', '9px')
            .attr('font-family', 'var(--font-mono)');

        // Axis label
        axisG.append('text')
            .attr('y', -14)
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(255,255,255,0.75)')
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .attr('font-family', 'var(--font-sans)')
            .text(dim.label);
    });
}

// ============================================
// PATH GENERATOR
// ============================================
function linePath(d) {
    return d3.line()
        .defined(([key]) => d[key] != null && d[key] > 0)
        .x(([key]) => xScale(key))
        .y(([key]) => yScales[key](d[key]))
        .curve(d3.curveMonotoneX)(DIMS.map(dim => [dim.key, d[dim.key]]));
}

// ============================================
// RENDERIZAÇÃO
// ============================================
function renderLines(data, maxYear, startYear) {
    const visibleData = data.filter(d => {
        if (maxYear && d.year > maxYear) return false;
        if (startYear && d.year < startYear) return false;
        return true;
    });

    // Background lines (all data, faded)
    const lines = g.selectAll('.pc-line')
        .data(visibleData, d => d.name);

    lines.exit().remove();

    const enter = lines.enter()
        .append('path')
        .attr('class', 'pc-line');

    enter.merge(lines)
        .attr('d', linePath)
        .attr('fill', 'none')
        .attr('stroke', d => {
            const isHighlighted = highlightedPlanet && d.name === highlightedPlanet.name;
            const isHovered = hovered && d.name === hovered.name;
            if ((highlightedPlanet || hovered) && !isHighlighted && !isHovered) {
                return 'rgba(100, 100, 100, 0.1)'; // Very dark
            }
            return getColor(d);
        })
        .attr('stroke-width', 1)
        .attr('stroke-opacity', d => {
            const isHighlighted = highlightedPlanet && d.name === highlightedPlanet.name;
            const isHovered = hovered && d.name === hovered.name;
            if (isHighlighted || isHovered) return 1;
            if (highlightedPlanet || hovered) return 1; // Base opacity is 1 because rgba already has alpha
            return 0.3; // Default opacity when nothing is hovered/selected
        })
        .attr('pointer-events', 'stroke')
        .on('mouseenter', function(event, d) {
            hovered = d;
            updateHighlightVisuals();
            showTooltip(event, d);
        })
        .on('mousemove', function(event, d) {
            showTooltip(event, d);
        })
        .on('mouseleave', function() {
            hovered = null;
            updateHighlightVisuals();
            hideTooltip();
        })
        .on('click', function(event, d) {
            event.stopPropagation();
            if (window.selectPlanet) window.selectPlanet(d);
        })
        .sort((a, b) => {
            // Draw highlighted/hovered on top
            const aHigh = (highlightedPlanet && a.name === highlightedPlanet.name) || (hovered && a.name === hovered.name);
            const bHigh = (highlightedPlanet && b.name === highlightedPlanet.name) || (hovered && b.name === hovered.name);
            return aHigh - bHigh;
        });
}

function updateHighlightVisuals() {
    g.selectAll('.pc-line')
        .attr('stroke', d => {
            const isHighlighted = highlightedPlanet && d.name === highlightedPlanet.name;
            const isHovered = hovered && d.name === hovered.name;
            if ((highlightedPlanet || hovered) && !isHighlighted && !isHovered) {
                return 'rgba(100, 100, 100, 0.1)'; // Very dark line
            }
            return getColor(d);
        })
        .attr('stroke-opacity', d => {
            const isHighlighted = highlightedPlanet && d.name === highlightedPlanet.name;
            const isHovered = hovered && d.name === hovered.name;
            if (isHighlighted || isHovered) return 1;
            if (highlightedPlanet || hovered) return 1; // Since color is changed to rgba with alpha, base opacity is 1
            return 0.3;
        })
        .attr('stroke-width', d => {
            const isHighlighted = highlightedPlanet && d.name === highlightedPlanet.name;
            const isHovered = hovered && d.name === hovered.name;
            if (isHighlighted) return 2.5;
            if (isHovered) return 2;
            return 1;
        })
        .sort((a, b) => {
            const aHigh = (highlightedPlanet && a.name === highlightedPlanet.name) || (hovered && a.name === hovered.name);
            const bHigh = (highlightedPlanet && b.name === highlightedPlanet.name) || (hovered && b.name === hovered.name);
            return aHigh - bHigh;
        });
}

// ============================================
// TOOLTIP
// ============================================
function showTooltip(event, d) {
    if (!tooltip) return;
    tooltip.style.display = 'block';
    tooltip.innerHTML = `
        <div style="font-weight:700; font-size:13px; color:#fff; margin-bottom:4px;">${d.name}</div>
        <div style="font-size:11px; color:rgba(255,255,255,0.6); margin-bottom:6px;">${d.methodPT}</div>
        <div style="display:grid; grid-template-columns: auto 1fr; gap:2px 8px; font-size:11px;">
            <span style="color:rgba(255,255,255,0.5);">Massa</span><span style="color:#fff; font-family:var(--font-mono);">${formatNumber(d.mass)} M⊕</span>
            <span style="color:rgba(255,255,255,0.5);">Raio</span><span style="color:#fff; font-family:var(--font-mono);">${formatNumber(d.radius)} R⊕</span>
            <span style="color:rgba(255,255,255,0.5);">Densidade</span><span style="color:#fff; font-family:var(--font-mono);">${formatNumber(d.density, 2)} g/cm³</span>
            <span style="color:rgba(255,255,255,0.5);">T. Equilíbrio</span><span style="color:#fff; font-family:var(--font-mono);">${formatNumber(d.eqTempC, 0)} °C</span>
            <span style="color:rgba(255,255,255,0.5);">Período</span><span style="color:#fff; font-family:var(--font-mono);">${formatNumber(d.orbper, 2)} dias</span>
        </div>
    `;

    // Position relative to container
    const container = svg.node().parentNode;
    const rect = container.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    
    let x = event.clientX - rect.left + 12;
    let y = event.clientY - rect.top - 10;

    // Keep in bounds
    if (x + tRect.width > rect.width) x = event.clientX - rect.left - tRect.width - 12;
    if (y + tRect.height > rect.height) y = rect.height - tRect.height - 10;
    if (y < 0) y = 10;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
}

// ============================================
// API PÚBLICA
// ============================================

/**
 * Constrói ou reconstrói as Coordenadas Paralelas.
 * @param {Array} data - Array de planetas já filtrados por applyFilters()
 * @param {Object|null} selectedPlanet - Planeta selecionado globalmente
 * @param {Number|null} maxYear - Ano máximo do explorador temporal
 * @param {Number|null} startYear - Ano inicial do explorador temporal
 */
export function buildParallelCoordinates(data, selectedPlanet = null, maxYear = null, startYear = null) {
    highlightedPlanet = selectedPlanet;

    const container = document.getElementById('parallel-coords-container');
    if (!container) return;

    // Calculate density and Celsius temp if needed
    data.forEach(d => {
        if (d.mass != null && d.radius != null && d.density == null) {
            d.density = (d.mass / Math.pow(d.radius, 3)) * 5.51; // Earth's density is ~5.51 g/cm³
        }
        if (d.eqTemp != null && d.eqTempC == null) {
            d.eqTempC = d.eqTemp - 273.15;
        }
    });

    // Filter only valid entries
    const valid = data.filter(isValid);
    currentData = valid;

    if (valid.length === 0) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; height:100%; color:rgba(255,255,255,0.4); font-size:13px; font-family:var(--font-sans);">
                Nenhum planeta com todos os dados disponíveis
            </div>`;
        return;
    }

    // Get container dimensions
    const w = container.clientWidth || 340;
    const h = container.clientHeight || 280;

    // Create SVG if not exists
    if (!svg || !container.contains(svg.node())) {
        container.innerHTML = '';
        svg = d3.select(container)
            .append('svg')
            .attr('width', w)
            .attr('height', h)
            .style('overflow', 'visible');

        g = svg.append('g')
            .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

        // Tooltip element
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'pc-tooltip';
        tooltipEl.style.cssText = 'position:absolute; display:none; background:rgba(0,0,0,0.92); border:1px solid rgba(255,255,255,0.12); border-radius:6px; padding:10px 12px; pointer-events:none; z-index:100; box-shadow:0 8px 24px rgba(0,0,0,0.6); min-width:180px;';
        container.appendChild(tooltipEl);
        tooltip = tooltipEl;
    } else {
        svg.attr('width', w).attr('height', h);
    }

    createScales(valid, w, h);
    renderAxes();
    renderLines(valid, maxYear, startYear);
}

/**
 * Atualiza o highlight do planeta selecionado (chamado por selectPlanet).
 */
export function highlightParallelCoords(planet) {
    highlightedPlanet = planet;
    updateHighlightVisuals();
}
