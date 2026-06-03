/**
 * scatterplot.js — Scatterplot Massa × Raio com Canvas + SVG híbrido
 * 
 * Renderiza 6.000+ pontos usando Canvas2D para performance,
 * com SVG overlay para eixos, zonas classificatórias, e interação.
 * 
 * Usa D3.js para escalas, eixos e zoom.
 */

import { getMethodColor, renderValue, hasCalculatedValues, formatNumber } from './utils.js';

// ============================================
// CONSTANTES DE LAYOUT
// ============================================
const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

// Zonas classificatórias do scatterplot (em unidades reais)
const ZONES = [
    { name: 'Terrestres',      xMin: 0.01,  xMax: 2,     yMin: 0.01,  yMax: 1.25,  color: 'rgba(52,211,153,0.04)', border: 'rgba(52,211,153,0.12)' },
    { name: 'Super-Terras',    xMin: 2,     xMax: 10,    yMin: 1.25,  yMax: 2.0,   color: 'rgba(96,165,250,0.04)', border: 'rgba(96,165,250,0.12)' },
    { name: 'Netunianos',      xMin: 2,     xMax: 60,    yMin: 2.0,   yMax: 6.0,   color: 'rgba(167,139,250,0.04)', border: 'rgba(167,139,250,0.12)' },
    { name: 'Gigantes Gasosos', xMin: 10,   xMax: 15000, yMin: 6.0,   yMax: 40,    color: 'rgba(249,115,22,0.04)', border: 'rgba(249,115,22,0.12)' },
];

// ============================================
// CLASSE PRINCIPAL
// ============================================

export class Scatterplot {
    constructor(containerId, data, { onSelect, onHover, onUnhover }) {
        this.container = document.getElementById(containerId);
        this.canvas = document.getElementById('scatter-canvas');
        this.svgEl = document.getElementById('scatter-svg');
        this.tooltipEl = document.getElementById('scatter-tooltip');
        this.allData = data;
        this.filteredData = data;
        this.selectedPlanet = null;
        this.hoveredPlanet = null;
        this.onSelect = onSelect || (() => {});
        this.onHover = onHover || (() => {});
        this.onUnhover = onUnhover || (() => {});

        this.ctx = this.canvas.getContext('2d');
        this.svg = d3.select(this.svgEl);
        this.width = 0;
        this.height = 0;
        this.innerW = 0;
        this.innerH = 0;
        this.xScale = null;
        this.yScale = null;
        this.currentTransform = d3.zoomIdentity;
        this.quadtree = null;

        this._init();
    }

    _init() {
        this._resize();
        this._buildScales();
        this._buildAxes();
        this._buildZoom();
        this._buildQuadtree();
        this._bindEvents();
        this._drawCanvas();

        // Observar redimensionamento
        this._resizeObserver = new ResizeObserver(() => {
            this._resize();
            this._buildScales();
            this._updateAxes();
            this._buildQuadtree();
            this._drawCanvas();
        });
        this._resizeObserver.observe(this.container);
    }

    // ---- LAYOUT ----
    _resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.innerW = this.width - MARGIN.left - MARGIN.right;
        this.innerH = this.height - MARGIN.top - MARGIN.bottom;

        // Canvas: usar device pixel ratio para nitidez
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // SVG: dimensões iguais
        this.svgEl.setAttribute('width', this.width);
        this.svgEl.setAttribute('height', this.height);
    }

    // ---- ESCALAS ----
    _buildScales() {
        // Escala logarítmica para massa (eixo X)
        this.xScale = d3.scaleLog()
            .domain([0.01, 15000])
            .range([MARGIN.left, MARGIN.left + this.innerW])
            .clamp(true);

        // Escala logarítmica para raio (eixo Y)
        this.yScale = d3.scaleLog()
            .domain([0.3, 40])
            .range([MARGIN.top + this.innerH, MARGIN.top])
            .clamp(true);
    }

    // ---- EIXOS SVG ----
    _buildAxes() {
        this.svg.selectAll('*').remove();

        const g = this.svg.append('g').attr('class', 'axes-group');

        // Eixo X
        this.xAxisG = g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${MARGIN.top + this.innerH})`);

        // Eixo Y
        this.yAxisG = g.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${MARGIN.left}, 0)`);

        // Labels dos eixos
        g.append('text')
            .attr('class', 'axis-label')
            .attr('x', MARGIN.left + this.innerW / 2)
            .attr('y', this.height - 8)
            .attr('text-anchor', 'middle')
            .text('Massa (× Terra)');

        g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', `rotate(-90)`)
            .attr('x', -(MARGIN.top + this.innerH / 2))
            .attr('y', 16)
            .attr('text-anchor', 'middle')
            .text('Raio (× Terra)');

        // Zonas classificatórias
        const zonesG = g.append('g').attr('class', 'zones-group');
        this._drawZones(zonesG);

        // Grupo de zoom overlay (para capturar eventos de mouse/toque)
        this.zoomRect = g.append('rect')
            .attr('class', 'zoom-rect')
            .attr('x', MARGIN.left)
            .attr('y', MARGIN.top)
            .attr('width', this.innerW)
            .attr('height', this.innerH)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair');

        this._updateAxes();
    }

    _updateAxes() {
        const xScaleZ = this.currentTransform.rescaleX(this.xScale);
        const yScaleZ = this.currentTransform.rescaleY(this.yScale);

        const xAxis = d3.axisBottom(xScaleZ)
            .ticks(6, '~s')
            .tickSize(-this.innerH);
        const yAxis = d3.axisLeft(yScaleZ)
            .ticks(5, '~s')
            .tickSize(-this.innerW);

        this.xAxisG.call(xAxis)
            .selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.04)');

        this.yAxisG.call(yAxis)
            .selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.04)');

        // Estilizar os textos dos ticks
        this.xAxisG.selectAll('.tick text').attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', '14px');
        this.yAxisG.selectAll('.tick text').attr('fill', 'rgba(255,255,255,0.35)').attr('font-size', '14px');
        this.xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');
        this.yAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)');

        // Atualizar zonas
        this._updateZones(xScaleZ, yScaleZ);
    }

    _drawZones(zonesG) {
        this.zoneRects = [];

        ZONES.forEach(z => {
            const rect = zonesG.append('rect')
                .attr('fill', z.color)
                .attr('stroke', z.border)
                .attr('stroke-width', 0.5)
                .attr('rx', 4);
            this.zoneRects.push({ el: rect, zone: z });
        });
    }

    _updateZones(xScale, yScale) {
        this.zoneRects.forEach(({ el, zone }) => {
            const x1 = Math.max(MARGIN.left, xScale(zone.xMin));
            const x2 = Math.min(MARGIN.left + this.innerW, xScale(zone.xMax));
            const y1 = Math.max(MARGIN.top, yScale(zone.yMax));
            const y2 = Math.min(MARGIN.top + this.innerH, yScale(zone.yMin));
            el.attr('x', x1).attr('y', y1)
              .attr('width', Math.max(0, x2 - x1))
              .attr('height', Math.max(0, y2 - y1));
        });
    }

    // ---- ZOOM D3 ----
    _buildZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 20])
            .translateExtent([[MARGIN.left, MARGIN.top], [MARGIN.left + this.innerW, MARGIN.top + this.innerH]])
            .extent([[MARGIN.left, MARGIN.top], [MARGIN.left + this.innerW, MARGIN.top + this.innerH]])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this._updateAxes();
                this._drawCanvas();
            });

        this.svg.call(this.zoom);
    }

    // ---- QUADTREE PARA BUSCA ESPACIAL ----
    _buildQuadtree() {
        const xS = this.currentTransform.rescaleX(this.xScale);
        const yS = this.currentTransform.rescaleY(this.yScale);

        this.quadtree = d3.quadtree()
            .x(d => xS(d.mass))
            .y(d => yS(d.radius))
            .addAll(this.filteredData.filter(d => d.mass !== null && d.radius !== null));
    }

    // ---- BINDINGN DE EVENTOS ----
    _bindEvents() {
        // Mousemove → hover + tooltip
        this.svgEl.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._handleHover(mx, my);
        });

        this.svgEl.addEventListener('mouseleave', () => {
            this._hideTooltip();
            this.hoveredPlanet = null;
            this._drawCanvas();
            this.onUnhover();
        });

        // Click → selecionar planeta
        this.svgEl.addEventListener('click', (e) => {
            const rect = this.container.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._handleClick(mx, my);
        });
    }

    _handleHover(mx, my) {
        if (!this.quadtree) return;

        const xS = this.currentTransform.rescaleX(this.xScale);
        const yS = this.currentTransform.rescaleY(this.yScale);

        // Encontrar o ponto mais próximo
        const found = this.quadtree.find(mx, my, 15);

        if (found && found.mass !== null && found.radius !== null) {
            this.hoveredPlanet = found;
            this._showTooltip(found, mx, my);
            this._drawCanvas();
            this.onHover(found);
        } else {
            if (this.hoveredPlanet) {
                this.hoveredPlanet = null;
                this._hideTooltip();
                this._drawCanvas();
                this.onUnhover();
            }
        }
    }

    _handleClick(mx, my) {
        if (!this.quadtree) return;

        const found = this.quadtree.find(mx, my, 15);

        if (found && found.mass !== null && found.radius !== null) {
            this.selectedPlanet = found;
            this._drawCanvas();
            this.onSelect(found);
        } else {
            this.selectedPlanet = null;
            this._drawCanvas();
            this.onSelect(null);
        }
    }

    // ---- TOOLTIP ----
    _showTooltip(planet, x, y) {
        const mass = renderValue(planet.mass, '× Terra', { decimals: 2 });
        const radius = renderValue(planet.radius, '× Terra', { decimals: 2 });
        const color = getMethodColor(planet.methodPT);

        this.tooltipEl.innerHTML = `
            <div class="tooltip-name">${planet.name}</div>
            <div class="tooltip-row">
                <span class="tooltip-key">Massa</span>
                <span class="tooltip-val">${mass.text}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-key">Raio</span>
                <span class="tooltip-val">${radius.text}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-key">Método</span>
                <span class="tooltip-val"><span class="tooltip-dot" style="background:${color}"></span>${planet.methodPT}</span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-key">Ano</span>
                <span class="tooltip-val">${planet.year || '—'}</span>
            </div>`;

        // Posicionar tooltip (evitando sair da tela)
        const ttW = 200;
        const ttH = 120;
        let tx = x + 16;
        let ty = y - 20;
        if (tx + ttW > this.width) tx = x - ttW - 12;
        if (ty + ttH > this.height) ty = this.height - ttH - 10;
        if (ty < 0) ty = 10;

        this.tooltipEl.style.left = tx + 'px';
        this.tooltipEl.style.top = ty + 'px';
        this.tooltipEl.classList.add('visible');
    }

    _hideTooltip() {
        this.tooltipEl.classList.remove('visible');
    }

    // ---- RENDERIZAÇÃO CANVAS ----
    _drawCanvas() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        const xS = this.currentTransform.rescaleX(this.xScale);
        const yS = this.currentTransform.rescaleY(this.yScale);

        // Clip ao viewport interno
        ctx.save();
        ctx.beginPath();
        ctx.rect(MARGIN.left, MARGIN.top, this.innerW, this.innerH);
        ctx.clip();

        const hasSel = this.selectedPlanet !== null;

        // Desenhar todos os pontos
        this.filteredData.forEach(d => {
            if (d.mass === null || d.radius === null) return;

            const px = xS(d.mass);
            const py = yS(d.radius);

            // Culling: não desenhar fora do viewport
            if (px < MARGIN.left - 5 || px > MARGIN.left + this.innerW + 5) return;
            if (py < MARGIN.top - 5 || py > MARGIN.top + this.innerH + 5) return;

            const color = getMethodColor(d.methodPT);
            const isSelected = this.selectedPlanet && d.name === this.selectedPlanet.name;
            const isHovered = this.hoveredPlanet && d.name === this.hoveredPlanet.name;

            let alpha = hasSel ? (isSelected ? 1.0 : 0.12) : 0.65;
            let radius = 2.5;

            if (isHovered) {
                alpha = 1.0;
                radius = 5;
            }
            if (isSelected) {
                radius = 6;
            }

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.fill();

            // Anel de destaque para hover/seleção
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.globalAlpha = 1.0;
        });

        ctx.restore();
    }

    // ---- API PÚBLICA ----

    /**
     * Atualiza os dados filtrados e redesenha.
     * @param {Array} filtered - Array de planetas filtrados
     */
    updateData(filtered) {
        this.filteredData = filtered;
        this._buildQuadtree();
        this._drawCanvas();

        // Atualizar contagem
        const countEl = document.getElementById('scatter-count');
        if (countEl) {
            const visible = filtered.filter(d => d.mass !== null && d.radius !== null).length;
            countEl.textContent = `${formatNumber(visible, 0)} planetas visíveis`;
        }
    }

    /**
     * Seleciona um planeta programaticamente.
     * @param {object|null} planet
     */
    select(planet) {
        this.selectedPlanet = planet;
        this._drawCanvas();
    }

    /**
     * Reseta zoom para a visão padrão.
     */
    resetZoom() {
        this.svg.transition().duration(600).call(this.zoom.transform, d3.zoomIdentity);
    }

    /**
     * Destrói o scatterplot e limpa observers.
     */
    destroy() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
