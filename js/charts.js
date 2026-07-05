/**
 * charts.js — Componentes de Gráficos com D3.js (Figma Redesign)
 * 
 * 1. DoughnutChart: Métodos de Descoberta com legenda interativa
 * 2. LineChart: Evolução temporal de descobertas por ano
 * 3. SizeBarChart: Barras verticais para os 4 tipos de exoplanetas
 * 4. DistanceAreaChart: Gráfico de área para distribuição de distâncias
 */

import { getMethodColor, getTypeColor, formatNumber } from './utils.js';

// ============================================
// 1. DOUGHNUT CHART — Métodos de Descoberta
// ============================================

export class DoughnutChart {
    constructor(containerId, data, { onClick }) {
        this.container = document.getElementById(containerId);
        this.allData = data;
        this.onClick = onClick || (() => { });
        this.selectedMethod = null;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this.container.innerHTML = `
            <div style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: space-between; padding: 0 10px;">
                <div class="doughnut-svg-container" style="flex: 1; height: 100%; position: relative; min-width: 150px;"></div>
                <div class="doughnut-legend" style="width: 190px; flex-shrink: 0;"></div>
            </div>
        `;

        this.svgContainer = this.container.querySelector('.doughnut-svg-container');
        this.legendContainer = this.container.querySelector('.doughnut-legend');

        this._render();

        // Resize Observer
        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _render() {
        this.svgContainer.innerHTML = '';
        this.legendContainer.innerHTML = '';

        const rect = this.svgContainer.getBoundingClientRect();
        const width = rect.width || 180;
        const height = rect.height || 180;
        const radius = Math.min(width, height) / 2 - 10;

        if (radius <= 0) return;

        // Agregar dados
        const counts = d3.rollup(
            this.allData,
            v => v.length,
            d => {
                const m = d.methodPT;
                if (['Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta'].includes(m)) {
                    return m;
                }
                return 'Outros';
            }
        );

        const total = d3.sum(counts.values());
        const chartData = Array.from(counts, ([method, count]) => ({ method, count }))
            .sort((a, b) => b.count - a.count);

        // SVG
        const svg = d3.select(this.svgContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2}, ${height / 2})`);

        const pie = d3.pie()
            .value(d => d.count)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(radius * 0.55)
            .outerRadius(radius * 0.9);

        const arcHover = d3.arc()
            .innerRadius(radius * 0.55)
            .outerRadius(radius * 0.98);

        // Desenhar fatias
        const path = svg.selectAll('path')
            .data(pie(chartData))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => getMethodColor(d.data.method))
            .attr('opacity', d => {
                if (!this.selectedMethod) return 0.8;
                return d.data.method === this.selectedMethod ? 1.0 : 0.2;
            })
            .attr('stroke', '#080810')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                this._handleClick(d.data.method);
            })
            .on('mouseenter', function (event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr('d', arcHover)
                    .attr('opacity', 1);
            })
            .on('mouseleave', (event, d) => {
                const activePath = svg.selectAll('path').filter(x => x.data.method === d.data.method);
                activePath.transition().duration(200)
                    .attr('d', arc)
                    .attr('opacity', this.selectedMethod ? (d.data.method === this.selectedMethod ? 1.0 : 0.2) : 0.8);
            });

        // Renderizar Legenda
        chartData.forEach(d => {
            const pct = ((d.count / total) * 100).toFixed(1);
            const color = getMethodColor(d.method);
            const isSelected = this.selectedMethod === d.method;

            const item = document.createElement('div');
            item.className = 'doughnut-legend-item';
            item.style.cursor = 'pointer';
            item.style.opacity = this.selectedMethod ? (isSelected ? '1' : '0.35') : '1';
            item.style.fontWeight = isSelected ? '700' : '400';

            item.innerHTML = `
                <div class="doughnut-legend-color" style="background:${color}"></div>
                <div class="doughnut-legend-label" style="color: ${isSelected ? '#fff' : 'inherit'}">${d.method}</div>
                <div class="doughnut-legend-val">${pct}%</div>
            `;

            item.onclick = () => {
                this._handleClick(d.method);
            };

            this.legendContainer.appendChild(item);
        });
    }

    _handleClick(method) {
        if (this.selectedMethod === method) {
            this.selectedMethod = null;
        } else {
            this.selectedMethod = method;
        }

        this._render();
        this.onClick(this.selectedMethod);
    }

    updateData(newData) {
        this.allData = newData;
        this._render();
    }

    reset() {
        this.selectedMethod = null;
        this._render();
    }
}

// ============================================
// 2. LINE CHART — Exoplanetas por Ano
// ============================================

export class LineChart {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.allData = data;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this._render();

        // Resize Observer
        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _render() {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 400;
        const height = rect.height || 230;
        const margin = { top: 15, right: 15, bottom: 35, left: 45 };

        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        if (innerW <= 0 || innerH <= 0) return;

        // Agregar descobertas por ano (não acumulado)
        const yearCounts = d3.rollup(
            this.allData.filter(d => d.year !== null),
            v => v.length,
            d => d.year
        );

        const chartData = Array.from(yearCounts, ([year, count]) => ({ year, count }))
            .sort((a, b) => a.year - b.year);

        if (chartData.length === 0) {
            this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.2);font-size:12px;">Sem dados disponíveis</div>';
            return;
        }

        // SVG
        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Escalas
        const x = d3.scaleLinear()
            .domain(d3.extent(chartData, d => d.year))
            .range([0, innerW]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count) * 1.15 || 10])
            .range([innerH, 0]);

        // Eixos
        const xAxis = d3.axisBottom(x)
            .ticks(Math.min(8, chartData.length))
            .tickFormat(d3.format('d'))
            .tickSize(-innerH);

        const yAxis = d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('d'))
            .tickSize(-innerW);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerH})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        // Estilizar eixos e linhas de grade
        g.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.06)');
        g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.03)');

        // Gradiente linear para a área preenchida
        const areaGrad = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'line-area-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');

        areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#60A5FA').attr('stop-opacity', 0.22);
        areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#60A5FA').attr('stop-opacity', 0.0);

        // Desenhar área
        const area = d3.area()
            .x(d => x(d.year))
            .y0(innerH)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', 'url(#line-area-gradient)')
            .attr('d', area);

        // Desenhar linha
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', 'none')
            .attr('stroke', '#60A5FA')
            .attr('stroke-width', 2)
            .attr('d', line);

        // Interação de Hover (Tooltip na linha)
        const hoverLine = g.append('line')
            .attr('y1', 0)
            .attr('y2', innerH)
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);

        const hoverCircle = g.append('circle')
            .attr('r', 4)
            .attr('fill', '#60A5FA')
            .attr('stroke', '#080810')
            .attr('stroke-width', 1.5)
            .style('opacity', 0);

        const tooltipWrap = d3.select(this.container)
            .append('div')
            .style('position', 'absolute')
            .style('background', 'rgba(8, 8, 16, 0.95)')
            .style('border', '1px solid rgba(255,255,255,0.12)')
            .style('border-radius', '4px')
            .style('padding', '6px 10px')
            .style('font-size', '14px')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('z-index', 5);

        // Overlay transparente para eventos de mouse
        g.append('rect')
            .attr('width', innerW)
            .attr('height', innerH)
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const yearVal = Math.round(x.invert(mx));

                // Encontrar o dado mais próximo
                let closest = chartData[0];
                let minDiff = Infinity;
                chartData.forEach(d => {
                    const diff = Math.abs(d.year - yearVal);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = d;
                    }
                });

                if (closest) {
                    const cx = x(closest.year);
                    const cy = y(closest.count);

                    hoverLine.attr('x1', cx).attr('x2', cx).style('opacity', 1);
                    hoverCircle.attr('cx', cx).attr('cy', cy).style('opacity', 1);

                    tooltipWrap
                        .style('display', 'block')
                        .html(`<strong>Ano:</strong> ${closest.year}<br><strong>Descobertas:</strong> ${closest.count}`)
                        .style('left', `${cx + margin.left + 15}px`)
                        .style('top', `${cy}px`);
                }
            })
            .on('mouseleave', () => {
                hoverLine.style('opacity', 0);
                hoverCircle.style('opacity', 0);
                tooltipWrap.style('display', 'none');
            });
    }

    updateData(newData) {
        this.allData = newData;
        this._render();
    }
}

// ============================================
// 3. SIZE BAR CHART — Distribuição de Tamanho
// ============================================

export class SizeBarChart {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.allData = data;
        this.selectedType = null;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this._render();

        // Resize Observer
        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _render() {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 400;
        const height = rect.height || 230;
        const margin = { top: 15, right: 15, bottom: 35, left: 45 };

        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        if (innerW <= 0 || innerH <= 0) return;

        // Agregar por tipo
        const counts = { 'Terrestre': 0, 'Super-Terra': 0, 'Netuniano': 0, 'Gigante Gasoso': 0 };
        this.allData.forEach(d => {
            if (counts[d.type] !== undefined) {
                counts[d.type]++;
            }
        });

        const chartData = Object.entries(counts).map(([type, count]) => ({ type, count }));

        // SVG
        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Escalas
        const x = d3.scaleBand()
            .domain(chartData.map(d => d.type))
            .range([0, innerW])
            .padding(0.35);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count) * 1.15 || 10])
            .range([innerH, 0]);

        // Eixos
        const xAxis = d3.axisBottom(x)
            .tickSize(0);

        const yAxis = d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('d'))
            .tickSize(-innerW);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerH})`)
            .call(xAxis)
            .selectAll('.tick text')
            .attr('dy', '10px');

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        // Estilizar eixos e linhas de grade
        g.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.06)');
        g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.03)');

        // Desenhar barras com cantos superiores arredondados
        g.selectAll('.bar')
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.type))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => innerH - y(d.count))
            .attr('fill', d => getTypeColor(d.type))
            .attr('opacity', d => {
                if (!this.selectedType) return 0.8;
                return d.type === this.selectedType ? 1.0 : 0.25;
            })
            .attr('stroke', d => d.type === this.selectedType ? '#fff' : 'none')
            .attr('stroke-width', d => d.type === this.selectedType ? 1.5 : 0)
            .attr('rx', 4)
            .on('mouseenter', (event, d) => {
                const isSel = this.selectedType && d.type === this.selectedType;
                d3.select(event.currentTarget).transition().duration(150)
                    .attr('opacity', 1.0)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', isSel ? 1.5 : 1.0);
            })
            .on('mouseleave', (event, d) => {
                const isSel = this.selectedType && d.type === this.selectedType;
                d3.select(event.currentTarget).transition().duration(150)
                    .attr('opacity', this.selectedType ? (d.type === this.selectedType ? 1.0 : 0.25) : 0.8)
                    .attr('stroke', isSel ? '#fff' : 'none')
                    .attr('stroke-width', isSel ? 1.5 : 0);
            });

        // Contagens em cima de cada barra
        g.selectAll('.bar-val-label')
            .data(chartData)
            .enter()
            .append('text')
            .attr('x', d => x(d.type) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 6)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(255,255,255,0.6)')
            .attr('font-size', '14px')
            .attr('font-family', "'Share Tech Mono', monospace")
            .text(d => d.count > 0 ? formatNumber(d.count, 0) : '');
    }

    updateData(newData) {
        this.allData = newData;
        this._render();
    }

    selectType(type) {
        this.selectedType = type === 'all' ? null : type;
        this._render();
    }
}

// ============================================
// 4. DISTANCE AREA CHART — Distribuição por Distância
// ============================================

export class DistanceAreaChart {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.allData = data;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this._render();

        // Resize Observer
        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _render() {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 400;
        const height = rect.height || 230;
        const margin = { top: 15, right: 15, bottom: 35, left: 45 };

        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        if (innerW <= 0 || innerH <= 0) return;

        // Filtrar distâncias válidas (até 8500 anos-luz para representatividade)
        const distances = this.allData
            .map(d => d.distLY)
            .filter(d => d !== null && d > 0 && d <= 8500);

        if (distances.length === 0) {
            this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.2);font-size:12px;">Sem dados de distância</div>';
            return;
        }

        // Criar bins com D3
        const xDomainMax = d3.max(distances) || 5000;
        const bin = d3.bin()
            .domain([0, xDomainMax])
            .thresholds(24);

        const binned = bin(distances);
        const chartData = binned.map(b => ({
            x0: b.x0,
            x1: b.x1,
            count: b.length
        }));

        // SVG
        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Escalas
        const x = d3.scaleLinear()
            .domain([0, xDomainMax])
            .range([0, innerW]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count) * 1.15 || 10])
            .range([innerH, 0]);

        // Eixos
        const xAxis = d3.axisBottom(x)
            .ticks(6)
            .tickFormat(d => `${d} al`)
            .tickSize(-innerH);

        const yAxis = d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('d'))
            .tickSize(-innerW);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerH})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        // Estilizar eixos e linhas de grade
        g.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.06)');
        g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.03)');

        // Gradiente roxo elétrico/violeta do Figma
        const areaGrad = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'dist-area-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');

        areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#A78BFA').attr('stop-opacity', 0.25);
        areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#A78BFA').attr('stop-opacity', 0.0);

        // Desenhar área contínua
        const area = d3.area()
            .x(d => x((d.x0 + d.x1) / 2))
            .y0(innerH)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', 'url(#dist-area-gradient)')
            .attr('d', area);

        // Desenhar linha superior
        const line = d3.line()
            .x(d => x((d.x0 + d.x1) / 2))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', 'none')
            .attr('stroke', '#A78BFA')
            .attr('stroke-width', 2)
            .attr('d', line);
    }

    updateData(newData) {
        this.allData = newData;
        this._render();
    }
}

// ============================================
// 5. TIMELINE CHART — Linha do Tempo e Filtros
// ============================================

export class TimelineChart {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.togglesContainer = document.getElementById('timeline-methods-toggles');
        this.allData = data;
        this.filteredData = data;
        this.activeMethod = 'all'; // 'all' ou nome do método

        if (!this.container) return;
        this._init();
    }

    _init() {
        this._renderToggles();
        this._render();

        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _renderToggles() {
        if (!this.togglesContainer) return;
        this.togglesContainer.innerHTML = '';

        const methods = ['all', 'Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta', 'Pulsar Timing'];

        methods.forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'scale-btn';
            btn.style.margin = '2px';
            btn.style.fontFamily = "'Public Sans', sans-serif";
            btn.style.fontSize = '14px';
            btn.style.padding = '4px 8px';
            btn.style.borderRadius = '4px';
            btn.style.border = '1px solid rgba(255,255,255,0.08)';
            btn.style.cursor = 'pointer';

            if (m === 'all') {
                btn.textContent = 'Todos';
                btn.style.background = this.activeMethod === 'all' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.02)';
                btn.style.color = '#fff';
            } else {
                btn.textContent = m;
                const color = getMethodColor(m);
                if (this.activeMethod === m) {
                    btn.style.background = color + '33';
                    btn.style.borderColor = color;
                    btn.style.color = '#fff';
                } else {
                    btn.style.background = 'rgba(255,255,255,0.02)';
                    btn.style.color = 'rgba(255,255,255,0.5)';
                }
            }

            btn.onclick = () => {
                this.activeMethod = m;
                this._renderToggles();
                this._render();
            };

            this.togglesContainer.appendChild(btn);
        });
    }

    _render() {
        this.container.innerHTML = '';
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 400;
        const height = rect.height || 220;
        const margin = { top: 15, right: 15, bottom: 25, left: 45 };

        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        if (innerW <= 0 || innerH <= 0) return;

        // Filtrar pelo método ativo
        let dataForChart = this.filteredData;
        if (this.activeMethod !== 'all') {
            dataForChart = dataForChart.filter(d => d.methodPT === this.activeMethod);
        }

        // Agrupar
        const yearCounts = d3.rollup(
            dataForChart.filter(d => d.year !== null),
            v => v.length,
            d => d.year
        );

        const chartData = Array.from(yearCounts, ([year, count]) => ({ year, count }))
            .sort((a, b) => a.year - b.year);

        if (chartData.length === 0) {
            this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.2);font-size:11px;">Sem descobertas registradas</div>';
            return;
        }

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(chartData, d => d.year))
            .range([0, innerW]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count) * 1.15 || 10])
            .range([innerH, 0]);

        const xAxis = d3.axisBottom(x)
            .ticks(Math.min(8, chartData.length))
            .tickFormat(d3.format('d'))
            .tickSize(-innerH);

        const yAxis = d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('d'))
            .tickSize(-innerW);

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerH})`)
            .call(xAxis);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis);

        const activeColor = this.activeMethod === 'all' ? '#60A5FA' : getMethodColor(this.activeMethod);

        const gradId = `timeline-grad-${this.activeMethod.replace(/\s+/g, '-')}`;
        const defs = svg.append('defs');
        const areaGrad = defs.append('linearGradient')
            .attr('id', gradId)
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');
        areaGrad.append('stop').attr('offset', '0%').attr('stop-color', activeColor).attr('stop-opacity', 0.25);
        areaGrad.append('stop').attr('offset', '100%').attr('stop-color', activeColor).attr('stop-opacity', 0.0);

        const area = d3.area()
            .x(d => x(d.year))
            .y0(innerH)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', `url(#${gradId})`)
            .attr('d', area);

        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        g.append('path')
            .datum(chartData)
            .attr('fill', 'none')
            .attr('stroke', activeColor)
            .attr('stroke-width', 2)
            .attr('d', line);

        const hoverLine = g.append('line')
            .attr('y1', 0)
            .attr('y2', innerH)
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);

        const hoverCircle = g.append('circle')
            .attr('r', 4)
            .attr('fill', activeColor)
            .attr('stroke', '#080810')
            .attr('stroke-width', 1.5)
            .style('opacity', 0);

        const tooltipWrap = d3.select(this.container)
            .append('div')
            .style('position', 'absolute')
            .style('background', 'rgba(8, 8, 16, 0.95)')
            .style('border', '1px solid rgba(255,255,255,0.12)')
            .style('border-radius', '4px')
            .style('padding', '6px 10px')
            .style('font-size', '14px')
            .style('pointer-events', 'none')
            .style('display', 'none')
            .style('z-index', 5);

        g.append('rect')
            .attr('width', innerW)
            .attr('height', innerH)
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .on('mousemove', (event) => {
                const [mx] = d3.pointer(event);
                const yearVal = Math.round(x.invert(mx));

                let closest = chartData[0];
                let minDiff = Infinity;
                chartData.forEach(d => {
                    const diff = Math.abs(d.year - yearVal);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = d;
                    }
                });

                if (closest) {
                    const cx = x(closest.year);
                    const cy = y(closest.count);

                    hoverLine.attr('x1', cx).attr('x2', cx).style('opacity', 1);
                    hoverCircle.attr('cx', cx).attr('cy', cy).style('opacity', 1);

                    tooltipWrap
                        .style('display', 'block')
                        .html(`<strong>Ano:</strong> ${closest.year}<br><strong>Descobertas:</strong> ${closest.count}`)
                        .style('left', `${cx + margin.left + 15}px`)
                        .style('top', `${cy}px`);
                }
            })
            .on('mouseleave', () => {
                hoverLine.style('opacity', 0);
                hoverCircle.style('opacity', 0);
                tooltipWrap.style('display', 'none');
            });
    }

    updateData(newData) {
        this.filteredData = newData;
        this._render();
    }

    selectMethod(method) {
        this.activeMethod = method;
        this._renderToggles();
        this._render();
    }
}

// ============================================
// 6. METHOD BAR CHART — Quantidade por Método
// ============================================

export class MethodBarChart {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.allData = data;
        this.filteredData = data;
        this.selectedMethod = null;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this._render();

        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _render() {
        this.container.innerHTML = '';
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 340;
        const height = rect.height || 220;
        const margin = { top: 10, right: 35, bottom: 20, left: 95 };

        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        if (innerW <= 0 || innerH <= 0) return;

        const counts = d3.rollup(
            this.filteredData,
            v => v.length,
            d => d.methodPT || 'Outros'
        );

        const chartData = Array.from(counts, ([method, count]) => ({ method, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        if (chartData.length === 0) {
            this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.2);font-size:11px;">Sem dados disponíveis</div>';
            return;
        }

        const svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const y = d3.scaleBand()
            .domain(chartData.map(d => d.method))
            .range([0, innerH])
            .padding(0.25);

        const x = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count) || 10])
            .range([0, innerW]);

        const yAxis = d3.axisLeft(y)
            .tickSize(0);

        const xAxis = d3.axisBottom(x)
            .ticks(4)
            .tickFormat(d3.format('~s'))
            .tickSize(-innerH);

        g.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .selectAll('.tick text')
            .attr('dx', '-6px')
            .attr('fill', 'rgba(255,255,255,0.65)')
            .style('font-size', '14px');

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${innerH})`)
            .call(xAxis);

        g.selectAll('.bar')
            .data(chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('y', d => y(d.method))
            .attr('x', 0)
            .attr('height', y.bandwidth())
            .attr('width', d => x(d.count))
            .attr('fill', d => getMethodColor(d.method))
            .attr('opacity', d => {
                if (!this.selectedMethod) return 0.8;
                return d.method === this.selectedMethod ? 1.0 : 0.25;
            })
            .attr('stroke', d => d.method === this.selectedMethod ? '#fff' : 'none')
            .attr('stroke-width', d => d.method === this.selectedMethod ? 1.5 : 0)
            .attr('rx', 2)
            .on('mouseenter', (event, d) => {
                const isSel = this.selectedMethod && d.method === this.selectedMethod;
                d3.select(event.currentTarget).transition().duration(150)
                    .attr('opacity', 1.0)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', isSel ? 1.5 : 1.0);
            })
            .on('mouseleave', (event, d) => {
                const isSel = this.selectedMethod && d.method === this.selectedMethod;
                d3.select(event.currentTarget).transition().duration(150)
                    .attr('opacity', this.selectedMethod ? (d.method === this.selectedMethod ? 1.0 : 0.25) : 0.8)
                    .attr('stroke', isSel ? '#fff' : 'none')
                    .attr('stroke-width', isSel ? 1.5 : 0);
            });

        g.selectAll('.bar-label')
            .data(chartData)
            .enter()
            .append('text')
            .attr('y', d => y(d.method) + y.bandwidth() / 2 + 3)
            .attr('x', d => x(d.count) + 4)
            .attr('fill', 'rgba(255,255,255,0.65)')
            .attr('font-size', '14px')
            .attr('font-family', "'Share Tech Mono', monospace")
            .text(d => formatNumber(d.count, 0));
    }

    updateData(newData) {
        this.filteredData = newData;
        this._render();
    }

    selectMethod(method) {
        this.selectedMethod = method === 'all' ? null : method;
        this._render();
    }
}

