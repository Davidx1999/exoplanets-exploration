import { formatNumber, getMethodColor, getTypeColor } from './utils.js';

let tlCumulative = false;
let barChartMode = 'type'; // 'type' | 'method'

// Player state
let playerInterval = null;
let playerYear = 1992;
let playerPlaying = false;

// Temporal explorer mode: 'cumulative' | 'yearly'
let explorerMode = 'cumulative';

// Time range for the temporal explorer
let explorerStartYear = null; // null = from the beginning
let explorerEndYear = null;   // null = to the end

// Formatters
const fmtNumber = d => new Intl.NumberFormat('pt-BR').format(d);

// ============================================
// SETUP
// ============================================

export function setupTimelineModeToggle(onToggle) {
    const btnExact = document.getElementById('tl-mode-exact');
    const btnCumul = document.getElementById('tl-mode-cumulative');
    if (!btnExact || !btnCumul) return;

    btnExact.onclick = () => {
        tlCumulative = false;
        btnExact.classList.add('active');
        btnCumul.classList.remove('active');
        onToggle();
    };
    btnCumul.onclick = () => {
        tlCumulative = true;
        btnCumul.classList.add('active');
        btnExact.classList.remove('active');
        onToggle();
    };
}

export function setupBarChartModeToggle(onToggle) {
    const btnType = document.getElementById('bar-mode-type');
    const btnMethod = document.getElementById('bar-mode-method');
    if (!btnType || !btnMethod) return;

    btnType.onclick = () => {
        barChartMode = 'type';
        btnType.classList.add('active');
        btnMethod.classList.remove('active');
        onToggle();
    };
    btnMethod.onclick = () => {
        barChartMode = 'method';
        btnMethod.classList.add('active');
        btnType.classList.remove('active');
        onToggle();
    };
}

// ============================================
// 1. HORIZONTAL BAR CHART — Planetas por Tipo ou Método
// ============================================

const PLANET_TYPES_ORDER = ['Gigante Gasoso', 'Netuniano', 'Super-Terra', 'Terrestre'];
const MAIN_METHODS = ['Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta', 'Pulsar Timing'];

let _barChartState = { mode: null, w: 0, h: 0 };

export function buildZoomableBarChart(data, activeValue = null, onBarClick = null, maxYear = null, forceAnimate = false, minYear = null) {
    const svgEl = d3.select('#zoomable-bar-svg');

    if (!data || data.length === 0) { svgEl.selectAll('*').remove(); return; }

    const isTypeMode = barChartMode === 'type';
    const categories = isTypeMode ? PLANET_TYPES_ORDER : MAIN_METHODS;
    const colorFn = isTypeMode ? getTypeColor : getMethodColor;
    const fieldKey = isTypeMode ? 'type' : 'methodPT';

    // Filter by maxYear and minYear if provided
    let filtered = maxYear ? data.filter(d => d.year && d.year <= maxYear) : data;
    if (minYear) filtered = filtered.filter(d => d.year && d.year >= minYear);

    const rollup = d3.rollup(filtered, v => v.length, d => d[fieldKey]);
    const barData = categories
        .map(cat => ({ category: cat, count: rollup.get(cat) || 0 }));

    // Always show all categories (even if 0), sorted by count descending
    const sortedBarData = d3.sort(barData, d => -d.count);

    const rect = svgEl.node().getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const margin = { top: 6, right: 0, bottom: 22, left: 0 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    // Row layout: each category gets a label line + a bar line
    const rowHeight = innerH / sortedBarData.length;
    const labelHeight = 14;
    const barHeight = Math.min(Math.max(rowHeight - labelHeight - 4, 8), 22);

    // Compute a "nice" max just above the top bar value so the axis always ends at 100% width
    const topCount = d3.max(sortedBarData, d => d.count) || 0;
    const floorLimit = isTypeMode ? 3000 : 5000;
    const rawMax = Math.max(topCount, floorLimit);
    // Round up to the nearest "nice" step
    const step = rawMax <= 1000 ? 100 : rawMax <= 5000 ? 500 : 1000;
    const maxValLimit = Math.ceil(rawMax / step) * step;

    // x scale (count → width)
    const scX = d3.scaleLinear()
        .domain([0, maxValLimit])
        .range([0, innerW]);

    const shouldAnimate = forceAnimate || !maxYear || maxYear >= 2025;

    // Always update viewBox so it's perfectly 100% width on resize
    svgEl.attr('viewBox', [0, 0, w, h]);

    // Check if full rebuild is needed
    let g = svgEl.select('g.main-group');
    const needsRebuild = (_barChartState.mode !== barChartMode || g.empty());

    if (needsRebuild || shouldAnimate) {
        svgEl.selectAll('*').remove();
        g = svgEl.append('g')
            .attr('class', 'main-group')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Grid lines (behind bars)
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisBottom(scX).ticks(5).tickSize(innerH).tickFormat(''))
            .call(gAxis => {
                gAxis.select('.domain').remove();
                gAxis.selectAll('.tick line')
                    .attr('stroke', 'rgba(255,255,255,0.04)')
                    .attr('stroke-dasharray', '2,2');
            });

        // Bottom Axis
        const xAxis = d3.axisBottom(scX).ticks(5).tickFormat(d3.format('d')).tickSize(4).tickSizeOuter(0);
        const xAxisG = g.append('g')
            .attr('class', 'x-axis axis')
            .attr('transform', `translate(0,${innerH})`)
            .call(xAxis);

        xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');
        xAxisG.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
        xAxisG.selectAll('.tick text')
            .attr('fill', 'rgba(255,255,255,0.4)')
            .attr('font-size', '8.5px')
            .attr('font-family', "'Share Tech Mono', monospace")
            .attr('dy', '8px');
    } else {
        // Update grid and axis positions smoothly if w/h changed
        const tGrid = svgEl.transition().duration(150);

        g.attr('transform', `translate(${margin.left},${margin.top})`);

        g.select('.grid').transition(tGrid)
            .call(d3.axisBottom(scX).ticks(5).tickSize(innerH).tickFormat(''))
            .call(gAxis => {
                gAxis.select('.domain').remove();
                gAxis.selectAll('.tick line')
                    .attr('stroke', 'rgba(255,255,255,0.04)')
                    .attr('stroke-dasharray', '2,2');
            });

        const xAxis = d3.axisBottom(scX).ticks(5).tickFormat(d3.format('d')).tickSize(4).tickSizeOuter(0);
        const xAxisG = g.select('.x-axis').transition(tGrid)
            .attr('transform', `translate(0,${innerH})`)
            .call(xAxis);

        xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');
        xAxisG.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.15)');
        xAxisG.selectAll('.tick text')
            .attr('fill', 'rgba(255,255,255,0.4)')
            .attr('font-size', '8.5px')
            .attr('font-family', "'Share Tech Mono', monospace")
            .attr('dy', '8px');
    }

    const rowsGroup = g.selectAll('.bar-row')
        .data(sortedBarData, d => d.category);

    rowsGroup.exit().remove();

    // Enter
    const rowsEnter = rowsGroup.enter()
        .append('g')
        .attr('class', 'bar-row')
        .style('cursor', 'pointer')
        .attr('transform', (d, i) => `translate(0,${i * rowHeight})`);

    // Category label
    rowsEnter.append('text')
        .attr('class', 'cat-label')
        .attr('x', 0)
        .attr('y', labelHeight - 2)
        .attr('font-size', '10.5px')
        .attr('font-family', "'Public Sans', sans-serif");

    // Bar rect
    rowsEnter.append('rect')
        .attr('class', 'bar-rect')
        .attr('x', 0)
        .attr('y', labelHeight + 1)
        .attr('height', barHeight)
        .attr('rx', 3);

    // Count value
    rowsEnter.append('text')
        .attr('class', 'bar-val')
        .attr('y', labelHeight + 1 + barHeight / 2 + 1)
        .attr('alignment-baseline', 'middle')
        .attr('font-size', '10px')
        .attr('font-family', "'Share Tech Mono', monospace");

    // Merge enter + update
    const rowsUpdate = rowsGroup.merge(rowsEnter);

    // Interaction on merge so we don't recreate listeners unnecessarily, or just attach them to enter
    // Interaction closure captures latest activeValue
    rowsUpdate
        .on('mouseenter', (e, d) => {
            const rowG = d3.select(e.currentTarget);
            rowG.select('rect')
                .transition().duration(120)
                .attr('opacity', 1)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            showTooltip(e, d.category, `${fmtNumber(d.count)} planetas`);
            if (window.starMapHighlightByFilter) window.starMapHighlightByFilter(p => p[fieldKey] === d.category);
        })
        .on('mouseleave', (e, d) => {
            const rowG = d3.select(e.currentTarget);
            const isDimmed = activeValue && activeValue !== d.category;
            const isActive = activeValue === d.category;
            rowG.select('rect')
                .transition().duration(120)
                .attr('opacity', isDimmed ? 0.25 : 0.85)
                .attr('stroke', isActive ? '#fff' : 'none')
                .attr('stroke-width', isActive ? 1.5 : 0);
            hideTooltip();
            if (window.applyChartHighlight) window.applyChartHighlight();
        })
        .on('click', (e, d) => { if (onBarClick) onBarClick(d.category); });

    // Update positions and values
    // Using a transition for everything so rows move smoothly if order changes
    const t = svgEl.transition().duration(shouldAnimate ? 400 : 150);

    rowsUpdate.transition(t)
        .attr('transform', (d, i) => `translate(0,${i * rowHeight})`);

    rowsUpdate.select('.cat-label')
        .text(d => d.category)
        .attr('fill', d => (activeValue && activeValue !== d.category) ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)')
        .attr('font-weight', d => (activeValue === d.category) ? '600' : '400');

    if (shouldAnimate) {
        // Drop to 0 and animate up
        rowsUpdate.select('.bar-rect')
            .attr('width', 0)
            .attr('fill', d => colorFn(d.category))
            .attr('opacity', d => (activeValue && activeValue !== d.category) ? 0.25 : 0.85)
            .attr('stroke', d => activeValue === d.category ? '#fff' : 'none')
            .attr('stroke-width', d => activeValue === d.category ? 1.5 : 0)
            .transition().duration(600).ease(d3.easeCubicOut)
            .attr('width', d => d.count > 0 ? Math.max(4, scX(d.count)) : 0);

        rowsUpdate.select('.bar-val')
            .attr('opacity', 0)
            .text(d => d.count > 0 ? fmtNumber(d.count) : '')
            .attr('fill', d => (activeValue && activeValue !== d.category) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)')
            .attr('x', d => (d.count > 0 ? Math.max(4, scX(d.count)) : 0) + 6)
            .transition().duration(600).ease(d3.easeCubicOut)
            .attr('opacity', 1);
    } else {
        // Smoothly interpolate from current width
        rowsUpdate.select('.bar-rect')
            .attr('fill', d => colorFn(d.category))
            .attr('opacity', d => (activeValue && activeValue !== d.category) ? 0.25 : 0.85)
            .attr('stroke', d => activeValue === d.category ? '#fff' : 'none')
            .attr('stroke-width', d => activeValue === d.category ? 1.5 : 0)
            .transition(t)
            .attr('width', d => d.count > 0 ? Math.max(4, scX(d.count)) : 0);

        rowsUpdate.select('.bar-val')
            .attr('fill', d => (activeValue && activeValue !== d.category) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)')
            .text(d => d.count > 0 ? fmtNumber(d.count) : '')
            .attr('opacity', 1) // stay visible
            .transition(t)
            .attr('x', d => (d.count > 0 ? Math.max(4, scX(d.count)) : 0) + 6);
    }

    _barChartState = { mode: barChartMode, w, h };
}

export function getBarChartMode() {
    return barChartMode;
}

// ============================================
// 2. CONNECTED SCATTERPLOT — Descobertas por Tipo ao longo do tempo
// ============================================

export function buildConnectedScatter(data, focusPlanet = null, maxYear = null, forceAnimate = false, minYear = null) {
    const svgEl = d3.select('#connected-scatter-svg');
    svgEl.selectAll('*').remove();

    if (!data || data.length === 0) return;

    const rect = svgEl.node().getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const margin = { top: 12, right: 10, bottom: 28, left: 34 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const isTypeMode = barChartMode === 'type';
    const categories = isTypeMode ? PLANET_TYPES_ORDER : MAIN_METHODS;
    const fieldKey = isTypeMode ? 'type' : 'methodPT';
    const colorFn = isTypeMode ? getTypeColor : getMethodColor;

    const shouldAnimate = forceAnimate || !maxYear || maxYear >= 2025;

    // Group by year + category
    const catsInData = categories.filter(c =>
        data.some(d => d[fieldKey] === c)
    );

    const yearRange = d3.extent(data.filter(d => d.year && d.year > 1980), d => d.year);
    if (!yearRange[0]) return;

    const years = d3.range(yearRange[0], yearRange[1] + 1);

    // Build series per category
    const nested = d3.rollup(data, v => v.length, d => d[fieldKey], d => d.year);

    const seriesData = catsInData.map(cat => {
        const yearMap = nested.get(cat) || new Map();
        let cumulative = 0;
        const points = years.map(year => {
            const count = yearMap.get(year) || 0;
            cumulative += count;
            return {
                year,
                count: tlCumulative ? cumulative : count,
                category: cat
            };
        });
        return { category: cat, points };
    });

    // Scales
    const xDomain = d3.extent(years);
    const allCounts = seriesData.flatMap(s => s.points.map(p => p.count));
    const maxY = d3.max(allCounts) || 1;

    const scX = d3.scaleLinear()
        .domain(xDomain)
        .range([margin.left, w - margin.right]);

    const scY = d3.scaleLinear()
        .domain([0, maxY * 1.1]).nice()
        .range([h - margin.bottom, margin.top]);

    // Axes
    const gx = svgEl.append('g')
        .attr('transform', `translate(0,${h - margin.bottom})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(scX)
            .ticks(Math.min(8, years.length))
            .tickFormat(d3.format('d'))
            .tickSizeOuter(0)
        );

    svgEl.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .attr('class', 'axis')
        .call(d3.axisLeft(scY).ticks(5).tickSizeOuter(0))
        .call(g => g.select('.domain').remove());

    // Grid lines
    svgEl.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(scY).ticks(5).tickSize(-innerW).tickFormat(''))
        .call(g => {
            g.select('.domain').remove();
            g.selectAll('.tick line')
                .attr('stroke', 'rgba(255,255,255,0.04)');
        });

    // Line generator
    const line = d3.line()
        .curve(d3.curveCatmullRom)
        .x(d => scX(d.year))
        .y(d => scY(d.count));

    // Helper: compute total path length
    function pathLength(pathNode) {
        try { return pathNode.getTotalLength(); } catch { return 0; }
    }

    // Draw each category series
    seriesData.forEach(series => {
        const color = colorFn(series.category);
        const isFocused = focusPlanet && focusPlanet[fieldKey] === series.category;

        // Filter points by maxYear and minYear if provided
        let visiblePoints = maxYear ? series.points.filter(p => p.year <= maxYear) : series.points;
        if (minYear) visiblePoints = visiblePoints.filter(p => p.year >= minYear);

        // Line path with animation
        const path = svgEl.append('path')
            .datum(visiblePoints)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', isFocused ? 2.5 : 1.8)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('opacity', focusPlanet ? (isFocused ? 0.9 : 0.15) : 0.7)
            .attr('d', line);

        // Animate the line drawing
        if (shouldAnimate) {
            const totalLen = pathLength(path.node());
            if (totalLen > 0) {
                path
                    .attr('stroke-dasharray', `0,${totalLen}`)
                    .transition()
                    .duration(2000)
                    .ease(d3.easeLinear)
                    .attr('stroke-dasharray', `${totalLen},${totalLen}`);
            }
        }

        // Dots
        const dotsG = svgEl.append('g');
        const dotInterval = Math.max(1, Math.floor(visiblePoints.length / 20));

        dotsG.selectAll('circle')
            .data(visiblePoints.filter((d, i) =>
                d.count > 0 && (i % dotInterval === 0 || i === visiblePoints.length - 1)
            ))
            .join('circle')
            .attr('class', 'scatter-dot')
            .attr('cx', d => scX(d.year))
            .attr('cy', d => scY(d.count))
            .attr('r', isFocused ? 6 : 5)
            .attr('fill', color)
            .attr('stroke', 'rgba(0,0,0,0.6)')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0)
            .style('cursor', 'pointer')
            .on('click', (e, d) => {
                if (window.toggleHighlightYear) window.toggleHighlightYear(d.year);
            })
            .on('mouseenter', (e, d) => {
                d3.select(e.currentTarget).attr('r', 9).attr('opacity', 1).attr('stroke', '#fff');
                showTooltip(e, `${d.category} — ${d.year}`, `${fmtNumber(d.count)} planetas`);
                if (window.starMapHighlightByFilter) window.starMapHighlightByFilter(p => p[fieldKey] === d.category);
            })
            .on('mouseleave', (e, d) => {
                d3.select(e.currentTarget).attr('r', isFocused ? 6 : 5)
                    .attr('stroke', 'rgba(0,0,0,0.6)')
                    .attr('opacity', focusPlanet ? (isFocused ? 0.8 : 0.15) : 0.6);
                hideTooltip();
                if (window.applyChartHighlight) window.applyChartHighlight();
            });

        if (shouldAnimate) {
            dotsG.selectAll('circle').transition()
                .delay((d, i) => (i / (visiblePoints.length / dotInterval)) * 2000)
                .attr('opacity', focusPlanet ? (isFocused ? 0.8 : 0.15) : 0.6);
        } else {
            dotsG.selectAll('circle')
                .attr('opacity', focusPlanet ? (isFocused ? 0.8 : 0.15) : 0.6);
        }
    });

    // Legend removed for cleaner chart appearance
}

// ============================================
// 3. ANIMATED BUBBLE CHART — Explorador Temporal
// ============================================

let bubbleChartState = {
    data: [],
    svgEl: null,
    scX: null,
    scY: null,
    scR: null,
    margin: null,
    w: 0,
    h: 0
};

export function buildBubbleChart(data, currentYear = playerYear) {
    const svgEl = d3.select('#bubble-chart-svg');
    svgEl.selectAll('*').remove();

    if (!data || data.length === 0) return;

    const rect = svgEl.node().getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const margin = { top: 12, right: 10, bottom: 28, left: 34 };

    // Filter to valid data points with mass and radius
    const valid = data.filter(d =>
        d.mass > 0 && d.radius > 0 && d.year && d.year > 1980
    );

    if (valid.length === 0) return;

    // Scales
    const scX = d3.scaleLog()
        .domain(d3.extent(valid, d => d.mass)).nice()
        .range([margin.left, w - margin.right]);

    const scY = d3.scaleLog()
        .domain(d3.extent(valid, d => d.radius)).nice()
        .range([h - margin.bottom, margin.top]);

    // Save state for updates
    bubbleChartState = { data: valid, svgEl, scX, scY, margin, w, h };

    // Axes
    const xTicks = [0.1, 1, 10, 100, 1000, 10000];
    svgEl.append('g')
        .attr('transform', `translate(0,${h - margin.bottom})`)
        .attr('class', 'axis')
        .call(d3.axisBottom(scX)
            .tickValues(xTicks.filter(v => v >= scX.domain()[0] && v <= scX.domain()[1]))
            .tickFormat(d => d >= 1000 ? d / 1000 + 'k' : d)
            .tickSizeOuter(0)
        );

    svgEl.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .attr('class', 'axis')
        .call(d3.axisLeft(scY)
            .tickValues([0.5, 1, 5, 10, 20].filter(v => v >= scY.domain()[0] && v <= scY.domain()[1]))
            .tickSizeOuter(0)
        )
        .call(g => g.select('.domain').remove());

    // Reference lines
    if (scX.domain()[0] <= 1 && scX.domain()[1] >= 1) {
        svgEl.append('line')
            .attr('x1', scX(1)).attr('x2', scX(1))
            .attr('y1', margin.top).attr('y2', h - margin.bottom)
            .attr('stroke', 'rgba(255,255,255,0.06)')
            .attr('stroke-dasharray', '3,4');
    }
    if (scY.domain()[0] <= 1 && scY.domain()[1] >= 1) {
        svgEl.append('line')
            .attr('x1', margin.left).attr('x2', w - margin.right)
            .attr('y1', scY(1)).attr('y2', scY(1))
            .attr('stroke', 'rgba(255,255,255,0.06)')
            .attr('stroke-dasharray', '3,4');
    }

    // Axis labels
    svgEl.append('text')
        .attr('x', w / 2).attr('y', h - 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', '7.5px')
        .attr('font-family', "'Public Sans', sans-serif")
        .text('Massa (M⊕)');

    svgEl.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -h / 2).attr('y', 10)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', '7.5px')
        .attr('font-family', "'Public Sans', sans-serif")
        .text('Raio (R⊕)');

    // Bubble group (will be updated)
    svgEl.append('g').attr('class', 'bubble-group');

    // Initial render
    updateBubbleChart(currentYear);
}

export function updateBubbleChart(year, startYear = null) {
    const { data, svgEl, scX, scY, margin, w, h, activeValue } = bubbleChartState;
    if (!svgEl || data.length === 0) return;

    const isTypeMode = barChartMode === 'type';
    const colorFn = isTypeMode ? getTypeColor : getMethodColor;
    const fieldKey = isTypeMode ? 'type' : 'methodPT';

    const bubbleG = svgEl.select('.bubble-group');
    let filtered = data.filter(d => d.year <= year);
    if (startYear != null) filtered = filtered.filter(d => d.year >= startYear);

    const circles = bubbleG.selectAll('circle')
        .data(filtered, d => d.name);

    // Enter
    circles.enter()
        .append('circle')
        .attr('class', 'bubble')
        .attr('cx', d => scX(d.mass))
        .attr('cy', d => scY(d.radius))
        .attr('r', 0)
        .attr('fill', d => colorFn(d[fieldKey]))
        .attr('stroke', 'rgba(0,0,0,0.7)')
        .attr('stroke-width', 1)
        .attr('opacity', 0.65)
        .style('cursor', 'pointer')
        .on('click', (e, d) => {
            if (window.selectPlanet) window.selectPlanet(d);
        })
        .on('mouseenter', (e, d) => {
            d3.select(e.currentTarget).attr('r', 9).attr('opacity', 1).attr('stroke', '#fff');
            showTooltip(e, d.name, `${d.year} — ${d[fieldKey]}<br>Massa (Terra): ${fmtNumber(d.mass)} M⊕<br>Raio: ${fmtNumber(d.radius)} R⊕`);
            if (window.starMapHighlightByFilter) window.starMapHighlightByFilter(p => p.id === d.id);
        })
        .on('mouseleave', (e, d) => {
            d3.select(e.currentTarget)
                .attr('r', (activeValue && activeValue !== d[fieldKey]) ? 2.5 : 5.5)
                .attr('stroke', 'rgba(0,0,0,0.7)');
            hideTooltip();
            if (window.applyChartHighlight) window.applyChartHighlight();
        })
        .transition()
        .duration(300)
        .attr('r', 2.5);

    // Update (sort by descending year for proper layering)
    circles
        .sort((a, b) => d3.descending(a.year, b.year))
        .transition()
        .duration(600)
        .attr('cx', d => scX(d.mass))
        .attr('cy', d => scY(d.radius))
        .attr('fill', d => colorFn(d[fieldKey]))
        .attr('r', d => (activeValue && activeValue !== d[fieldKey]) ? 2.5 : 5.5)
        .attr('stroke', 'rgba(0,0,0,0.7)')
        .attr('opacity', d => (activeValue && activeValue !== d[fieldKey]) ? 0.2 : 0.65);

    // Exit
    circles.exit()
        .transition()
        .duration(200)
        .attr('r', 0)
        .remove();

    // Update year display
    const yearDisplay = document.getElementById('bubble-year-display');
    if (yearDisplay) yearDisplay.textContent = year;
}

// ============================================
// PLAYER CONTROLS
// ============================================

export function setupPlayerControls(data, onYearChange) {
    const playBtn = document.getElementById('player-play-btn');
    const sliderEnd = document.getElementById('player-slider');
    const sliderStart = document.getElementById('player-slider-start');
    const trackFill = document.getElementById('slider-track-fill');

    const iconShape = document.getElementById('player-icon-shape');
    const toggleBtn = document.getElementById('toggle-timeline-btn');
    const timelineControls = document.getElementById('timeline-controls');
    const timelineSeparator = document.getElementById('timeline-separator');

    const yearDisplayEnd = document.getElementById('bubble-year-display');
    const yearDisplayStart = document.getElementById('bubble-year-display-start');

    // Explorer mode elements
    const btnModeYearly = document.getElementById('explorer-mode-yearly');
    const btnModeCumulative = document.getElementById('explorer-mode-cumulative');
    const btnModeRange = document.getElementById('explorer-mode-range');

    if (!playBtn || !sliderEnd || !sliderStart) return;

    // Set range from data
    const years = data.filter(d => d.year && d.year > 1980).map(d => d.year);
    const minYear = d3.min(years) || 1992;
    const maxYear = d3.max(years) || 2025;

    sliderEnd.min = minYear;
    sliderEnd.max = maxYear;
    sliderEnd.value = minYear;

    sliderStart.min = minYear;
    sliderStart.max = maxYear;
    sliderStart.value = minYear;

    // Default to inactive state
    playerYear = 2050;
    let isTimelineActive = false;

    const updateSliderUI = () => {
        const min = parseInt(sliderEnd.min);
        const max = parseInt(sliderEnd.max);
        const valEnd = parseInt(sliderEnd.value);
        const valStart = parseInt(sliderStart.value);

        const percentEnd = (valEnd - min) / (max - min);
        const offsetEnd = `calc(${percentEnd * 100}% - ${percentEnd * 14}px + 7px)`;
        if (yearDisplayEnd) {
            yearDisplayEnd.style.left = offsetEnd;
            yearDisplayEnd.textContent = valEnd;
        }

        const percentStart = (valStart - min) / (max - min);
        const offsetStart = `calc(${percentStart * 100}% - ${percentStart * 14}px + 7px)`;
        if (yearDisplayStart) {
            yearDisplayStart.style.left = offsetStart;
            yearDisplayStart.textContent = valStart;
        }

        if (trackFill) {
            if (explorerMode === 'range') {
                trackFill.style.left = `calc(${percentStart * 100}%)`;
                trackFill.style.width = `calc(${(percentEnd - percentStart) * 100}%)`;
            } else if (explorerMode === 'yearly') {
                trackFill.style.left = `calc(${percentEnd * 100}%)`;
                trackFill.style.width = '0%';
            } else { // cumulative
                trackFill.style.left = '0%';
                trackFill.style.width = `calc(${percentEnd * 100}%)`;
            }
        }
    };

    const getEffectiveRange = () => {
        if (!isTimelineActive) return { start: null, end: 2050 };
        const valEnd = parseInt(sliderEnd.value);
        const valStart = parseInt(sliderStart.value);

        if (explorerMode === 'yearly') {
            return { start: valEnd, end: valEnd };
        } else if (explorerMode === 'range') {
            return { start: valStart, end: valEnd };
        } else {
            return { start: minYear, end: valEnd };
        }
    };

    const fireChange = () => {
        const range = getEffectiveRange();
        onYearChange(range.end, range.start);
    };

    const updateModeUI = () => {
        if (btnModeYearly) btnModeYearly.classList.toggle('active', explorerMode === 'yearly');
        if (btnModeCumulative) btnModeCumulative.classList.toggle('active', explorerMode === 'cumulative');
        if (btnModeRange) btnModeRange.classList.toggle('active', explorerMode === 'range');

        if (explorerMode === 'range') {
            sliderStart.style.pointerEvents = 'auto';
            sliderStart.style.opacity = '1';
            if (yearDisplayStart) yearDisplayStart.style.display = 'block';
        } else {
            sliderStart.style.pointerEvents = 'none';
            sliderStart.style.opacity = '0';
            if (yearDisplayStart) yearDisplayStart.style.display = 'none';
        }
        updateSliderUI();
    };

    if (btnModeYearly) {
        btnModeYearly.onclick = () => {
            explorerMode = 'yearly';
            updateModeUI();
            if (isTimelineActive) fireChange();
        };
    }
    if (btnModeCumulative) {
        btnModeCumulative.onclick = () => {
            explorerMode = 'cumulative';
            updateModeUI();
            if (isTimelineActive) fireChange();
        };
    }
    if (btnModeRange) {
        btnModeRange.onclick = () => {
            explorerMode = 'range';
            updateModeUI();
            if (isTimelineActive) fireChange();
        };
    }

    sliderEnd.oninput = () => {
        if (explorerMode === 'range' && parseInt(sliderEnd.value) < parseInt(sliderStart.value)) {
            sliderStart.value = sliderEnd.value;
        }
        updateSliderUI();
        if (isTimelineActive) {
            playerYear = parseInt(sliderEnd.value);
            fireChange();
        }
    };

    sliderStart.oninput = () => {
        if (explorerMode === 'range' && parseInt(sliderStart.value) > parseInt(sliderEnd.value)) {
            sliderEnd.value = sliderStart.value;
        }
        updateSliderUI();
        if (isTimelineActive) {
            playerYear = parseInt(sliderEnd.value);
            fireChange();
        }
    };

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            isTimelineActive = !isTimelineActive;
            const container = document.getElementById('floating-player-container');
            if (isTimelineActive) {
                toggleBtn.classList.add('active');
                toggleBtn.style.background = 'rgba(255,255,255,0.15)';
                toggleBtn.style.padding = '8px'; // Make it smaller
                toggleBtn.title = "Desativar Explorador";
                toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

                if (container) container.classList.add('active');
                if (timelineControls) timelineControls.style.display = 'flex';
                if (timelineSeparator) timelineSeparator.style.display = 'block';

                playerYear = parseInt(sliderEnd.value);
                updateSliderUI();
                fireChange();
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.style.background = 'var(--accent-blue)';
                toggleBtn.style.padding = '8px 16px';
                toggleBtn.title = "Ativar Explorador Temporal";
                toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <span id="toggle-timeline-text" style="white-space: nowrap;">Ativar Explorador Temporal</span>`;

                if (container) container.classList.remove('active');
                if (timelineControls) timelineControls.style.display = 'none';
                if (timelineSeparator) timelineSeparator.style.display = 'none';

                stopPlayer();
                playerYear = 2050; // Use a future year to "disable" the limit
                fireChange();
            }
        };
    }

    // Play/Pause
    playBtn.onclick = () => {
        if (playerPlaying) {
            stopPlayer();
        } else {
            startPlayer(parseInt(sliderEnd.max), (y) => {
                sliderEnd.value = y;
                if (explorerMode === 'range' && parseInt(sliderEnd.value) < parseInt(sliderStart.value)) {
                    sliderStart.value = sliderEnd.value;
                }
                updateSliderUI();
                const range = getEffectiveRange();
                onYearChange(range.end, range.start);
            }, sliderEnd, sliderStart);
        }
    };

    updateModeUI();
}

function startPlayer(maxYear, onYearChange, sliderEnd, sliderStart) {
    playerPlaying = true;
    const playBtn = document.getElementById('player-play-btn');
    const iconShape = document.getElementById('player-icon-shape');
    if (playBtn) playBtn.classList.add('playing');

    // Change to pause icon
    if (iconShape) iconShape.setAttribute('d', 'M8 5 L8 19 M16 5 L16 19');

    // If at end, restart
    if (parseInt(sliderEnd.value) >= maxYear) {
        playerYear = parseInt(sliderEnd.min);
        sliderEnd.value = playerYear;
        if (sliderStart && explorerMode === 'range') sliderStart.value = playerYear;
        onYearChange(playerYear);
    } else {
        playerYear = parseInt(sliderEnd.value);
    }

    playerInterval = setInterval(() => {
        playerYear++;
        if (playerYear > maxYear) {
            stopPlayer();
        } else {
            onYearChange(playerYear);
        }
    }, 800);
}

function stopPlayer() {
    playerPlaying = false;
    if (playerInterval) {
        clearInterval(playerInterval);
        playerInterval = null;
    }
    const playBtn = document.getElementById('player-play-btn');
    const iconShape = document.getElementById('player-icon-shape');
    if (playBtn) playBtn.classList.remove('playing');

    // Change back to play icon (minimalist triangle)
    if (iconShape) iconShape.setAttribute('d', 'M6 4 L18 12 L6 20 Z');
}

export function cleanupPlayer() {
    stopPlayer();
}

// ============================================
// 4. RIGHT PANEL CHIPS (preserved)
// ============================================

export function renderChips(data, selectedMethod = null, selectedType = null, onFilter = null) {
    const cont = document.getElementById('mbars-container');
    if (!cont) return;

    cont.innerHTML = '';

    // Wrap for Type
    const typeWrap = document.createElement('div');
    typeWrap.className = 'chips-grid';
    typeWrap.style.marginBottom = '8px';

    ['Gigante Gasoso', 'Netuniano', 'Super-Terra', 'Terrestre'].forEach(item => {
        const color = getTypeColor(item);
        const isActive = selectedType === item;

        const chip = document.createElement('button');
        chip.className = `map-chip ${isActive ? 'active' : ''}`;
        chip.innerHTML = `<span class="chip-dot" style="background:${color}"></span><span class="chip-label">${item}</span>`;

        if (isActive) {
            chip.style.borderColor = color;
            chip.style.background = `${color}11`;
        }

        chip.onclick = () => {
            if (onFilter) onFilter(item, 'type');
        };
        typeWrap.appendChild(chip);
    });
    cont.appendChild(typeWrap);

    // Wrap for Method
    const methodWrap = document.createElement('div');
    methodWrap.className = 'chips-grid';

    ['Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta', 'Pulsar Timing'].forEach(item => {
        const color = getMethodColor(item);
        const isActive = selectedMethod === item;

        const chip = document.createElement('button');
        chip.className = `map-chip ${isActive ? 'active' : ''}`;
        chip.innerHTML = `<span class="chip-dot" style="background:${color}"></span><span class="chip-label">${item}</span>`;

        if (isActive) {
            chip.style.borderColor = color;
            chip.style.background = `${color}11`;
        }

        chip.onclick = () => {
            if (onFilter) onFilter(item, 'method');
        };
        methodWrap.appendChild(chip);
    });
    cont.appendChild(methodWrap);
}

// ============================================
// 5. MINI BARS (legacy export kept for backwards compat)
// ============================================

export function updateBars(data, selectedValue = null, onFilter = null, mode = 'type') {
    renderChips(data, selectedValue, onFilter, mode);
}

// ============================================
// FILTER CHIPS BAR
// ============================================

export function renderFilters(state, onRemove, onClearAll) {
    const fb = document.getElementById('filters-bar');
    if (!fb) return;
    fb.innerHTML = '';

    let hasFilters = false;

    function addChip(label, val, key) {
        hasFilters = true;
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.innerHTML = `<span>${label}: </span> <span style="color:var(--text); font-weight:700;">${val}</span> <span class="x">✕</span>`;
        chip.onclick = () => onRemove(key);
        fb.appendChild(chip);
    }

    if (state.selectedMethod && state.selectedMethod !== 'all') {
        addChip('Método', state.selectedMethod, 'method');
    }
    if (state.selectedType && state.selectedType !== 'all') {
        addChip('Tipo', state.selectedType, 'type');
    }
    if (state.searchQuery) {
        addChip('Busca', state.searchQuery, 'search');
    }

    if (hasFilters) {
        const clearBtn = document.createElement('div');
        clearBtn.className = 'clear-all-btn';
        clearBtn.innerText = 'Limpar Tudo';
        clearBtn.onclick = onClearAll;
        fb.appendChild(clearBtn);
    }
}

// ============================================
// TOOLTIP HELPERS
// ============================================

const tooltip = document.getElementById('tooltip');
export function showTooltip(e, title, sub) {
    if (!tooltip) return;
    tooltip.innerHTML = `<div class="t-title">${title}</div><div class="t-sub">${sub}</div>`;
    tooltip.style.opacity = 1;

    let x = e.clientX + 15;
    let y = e.clientY + 15;

    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 15;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 15;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

export function hideTooltip() {
    if (tooltip) tooltip.style.opacity = 0;
}
