/**
 * js/star-map.js — Mapa Estelar Interativo de Exoplanetas (Canvas 2D)
 * 
 * Performance: Migrado de SVG (6K+ <circle> DOM nodes) para Canvas 2D.
 * - Renderização batch de todos os pontos em ~2ms por frame
 * - Hit-testing via d3.quadtree() em vez de event listeners por elemento
 * - Zoom/pan via d3.zoom() aplicando transformação no Canvas
 * - Animação de chegada via requestAnimationFrame único
 */

import { getMethodColor, getTypeColor, formatNumber } from './utils.js';

export class StarMap {
    constructor(containerId, data, { onSelect }) {
        this.container = document.getElementById(containerId);
        this.fullData = data;
        this.allData = data;
        this.visibleNames = new Set(data.map(d => d.name));
        this.onSelect = onSelect || (() => { });

        this.selectedPlanet = null;
        this.currentHighlightFilter = null;
        this.colorMode = 'type'; // 'type' | 'method'
        this.width = 0;
        this.height = 0;
        this.currentTransform = d3.zoomIdentity;
        this.needsArrivalAnimation = true;
        this.resizeTimeout = null;
        this.timeLimitYear = null;
        this.timeLimitStartYear = null;

        // Canvas state
        this.canvas = null;
        this.ctx = null;
        this.points = []; // Pre-computed positions
        this.quadtree = null;
        this.hoveredPoint = null;
        this.arrivalProgress = 1.0; // 0 → 1 arrival animation
        this._arrivalRaf = null;
        this._needsRedraw = true;
        this._redrawRaf = null;
        this.dpr = window.devicePixelRatio || 1;

        if (!this.container) return;
        this._init();
    }

    _init() {
        this.container.innerHTML = `
            <div class="star-map-wrapper" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
                <div class="star-map-legend" style="display: none;"></div>
                <div class="star-map-tooltip" style="position: absolute; background: rgba(0, 0, 0, 0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 10px 12px; font-size: 14px; pointer-events: none; display: none; z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.5); min-width: 180px;"></div>
                <canvas class="star-map-canvas" style="width: 100%; height: 100%; cursor: grab; display: block;"></canvas>
            </div>
        `;

        this.canvas = this.container.querySelector('.star-map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = this.container.querySelector('.star-map-tooltip');
        this.legendContainer = this.container.querySelector('.star-map-legend');

        this._setupInteractions();
        this._computeLayout();
        this._setupZoom();
        this._renderLegend();
        this.requestRedraw();

        // Resize observer
        this._resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const rect = entry.contentRect;
                if (Math.abs(rect.width - this.width) > 5 || Math.abs(rect.height - this.height) > 5) {
                    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
                    this.resizeTimeout = setTimeout(() => {
                        this._computeLayout();
                        this.requestRedraw();
                    }, 300);
                }
            }
        });
        this._resizeObserver.observe(this.container);

        if (this.needsArrivalAnimation) {
            this._runArrivalTransition();
            this.needsArrivalAnimation = false;
        }
    }

    _computeLayout() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        if (this.width <= 0 || this.height <= 0) return;

        // Set canvas size with DPR
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Scale
        const maxDist = 28000;
        const maxR = Math.min(this.width, this.height) * 0.45;
        this.maxR = maxR;

        this.rScale = d3.scalePow()
            .exponent(0.26)
            .domain([0, maxDist])
            .range([0, maxR]);

        // Compute points
        const starCounts = {};
        const starIndices = {};
        this.fullData.forEach(d => {
            const star = d.star || d.name;
            starCounts[star] = (starCounts[star] || 0) + 1;
        });

        this.points = this.fullData.map((d, i) => {
            const dist = d.distLY !== null && d.distLY > 0 ? d.distLY : 1500;
            const star = d.star || d.name;
            const totalPlanets = starCounts[star] || 1;

            if (starIndices[star] === undefined) {
                starIndices[star] = 0;
            } else {
                starIndices[star]++;
            }
            const planetIndex = starIndices[star];

            const baseTheta = this._getStarAngle(star);
            const baseR = this.rScale(dist);

            let px = this.width / 2 + baseR * Math.cos(baseTheta);
            let py = this.height / 2 + baseR * Math.sin(baseTheta);

            if (totalPlanets > 1) {
                const baseRadius = d.radius || 1.0;
                const starSize = Math.max(3.2, Math.min(10, 2.5 + Math.sqrt(baseRadius) * 1.1));
                const offsetRadius = starSize * 2.2 + planetIndex * 2.8;
                const offsetAngle = (planetIndex / totalPlanets) * 2 * Math.PI;
                px += offsetRadius * Math.cos(offsetAngle);
                py += offsetRadius * Math.sin(offsetAngle);
            }

            const rad = d.radius || 1.0;
            const r = Math.max(1.2, Math.min(4.5, 0.8 + Math.sqrt(rad) * 0.6));

            return {
                data: d,
                x: px,
                y: py,
                r: r,
                distFromCenter: Math.sqrt((px - this.width / 2) ** 2 + (py - this.height / 2) ** 2)
            };
        });

        // Build quadtree for hit-testing
        this.quadtree = d3.quadtree()
            .x(d => d.x)
            .y(d => d.y)
            .addAll(this.points);
    }

    _setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 40])
            .extent([[0, 0], [this.width, this.height]])
            .on('start', () => {
                this.isZooming = true;
                this.canvas.style.cursor = 'grabbing';
            })
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.requestRedraw();
            })
            .on('end', () => {
                this.isZooming = false;
                this.canvas.style.cursor = 'grab';
            });

        d3.select(this.canvas).call(this.zoom);
    }

    _setupInteractions() {
        // Mouse move — quadtree hit-testing
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isZooming) return;

            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // Invert transform to get data coordinates
            const t = this.currentTransform;
            const dataX = (mx - t.x) / t.k;
            const dataY = (my - t.y) / t.k;

            // Search quadtree for nearest point within hit radius
            const hitRadius = 8 / t.k; // Adjust hit radius by zoom level
            const found = this.quadtree.find(dataX, dataY, hitRadius);

            if (found && found !== this.hoveredPoint) {
                // Check visibility
                if (this._isInteractable(found.data)) {
                    this.hoveredPoint = found;
                    this.canvas.style.cursor = 'pointer';
                    this._showTooltip(found.data, e);
                    this.requestRedraw();
                } else {
                    if (this.hoveredPoint) {
                        this.hoveredPoint = null;
                        this.canvas.style.cursor = 'grab';
                        this._hideTooltip();
                        this.requestRedraw();
                    }
                }
            } else if (!found && this.hoveredPoint) {
                this.hoveredPoint = null;
                this.canvas.style.cursor = 'grab';
                this._hideTooltip();
                this.requestRedraw();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.hoveredPoint) {
                this.hoveredPoint = null;
                this._hideTooltip();
                this.requestRedraw();
            }
        });

        // Click — select planet
        this.canvas.addEventListener('click', (e) => {
            if (this.isZooming) return;

            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const t = this.currentTransform;
            const dataX = (mx - t.x) / t.k;
            const dataY = (my - t.y) / t.k;

            const hitRadius = 10 / t.k;
            const found = this.quadtree.find(dataX, dataY, hitRadius);

            if (found && this._isInteractable(found.data)) {
                this._selectPlanet(found.data, found.x, found.y);
            }
        });
    }

    // ---- RENDERING ----

    requestRedraw() {
        if (this._redrawRaf) return;
        this._redrawRaf = requestAnimationFrame(() => {
            this._redrawRaf = null;
            this._draw();
        });
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.width * this.dpr;
        const h = this.height * this.dpr;
        const t = this.currentTransform;

        ctx.clearRect(0, 0, w, h);

        // Fill background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        // Draw grid
        this._drawGrid(ctx);

        // Draw center (Earth/Sun)
        this._drawCenter(ctx);

        // Draw all star points (batch)
        this._drawStars(ctx);

        // Draw hovered point highlight
        if (this.hoveredPoint) {
            this._drawHighlightRing(ctx, this.hoveredPoint);
        }

        // Draw selected point highlight
        if (this.selectedPlanet) {
            const selPoint = this.points.find(p => p.data.name === this.selectedPlanet.name);
            if (selPoint && selPoint !== this.hoveredPoint) {
                this._drawHighlightRing(ctx, selPoint);
            }
        }

        ctx.restore();
    }

    _drawGrid(ctx) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const maxR = this.maxR;

        // Distance circles
        const circles = [100, 1000, 5000, 10000, 20000];
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 6]);

        circles.forEach(dist => {
            const r = this.rScale(dist);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.font = "14px 'Share Tech Mono', monospace";
            ctx.textAlign = 'center';
            ctx.fillText(`${dist} al`, cx + r, cy - 4);
        });

        ctx.setLineDash([]);

        // Cross axes
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - maxR, cy);
        ctx.lineTo(cx + maxR, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - maxR);
        ctx.lineTo(cx, cy + maxR);
        ctx.stroke();
    }

    _drawCenter(ctx) {
        const cx = this.width / 2;
        const cy = this.height / 2;

        // Glow
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
        grad.addColorStop(0, 'rgba(96,165,250,0.15)');
        grad.addColorStop(1, 'rgba(96,165,250,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = '#60A5FA';
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawStars(ctx) {
        const arrivalProg = this.arrivalProgress;
        const maxR = this.maxR || 1;

        // Sort for batch rendering by color
        const colorBatches = new Map();

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const d = p.data;

            // Visibility check
            if (!this._isTimeVisible(d)) continue;

            // Arrival animation: scale radius based on distance progress
            let drawR = p.r;
            if (arrivalProg < 1) {
                const normalizedDist = p.distFromCenter / maxR;
                const pointProgress = Math.max(0, (arrivalProg - normalizedDist * 0.6) / 0.4);
                if (pointProgress <= 0) continue;
                drawR *= Math.min(1, pointProgress);
            }

            const opacity = this._getOpacity(d);
            if (opacity <= 0.01) continue;

            const color = this._getColor(d);

            // Batch by color+opacity for efficient rendering
            const key = `${color}|${Math.round(opacity * 100)}`;
            if (!colorBatches.has(key)) {
                colorBatches.set(key, []);
            }
            colorBatches.get(key).push({ x: p.x, y: p.y, r: drawR });
        }

        // Render batches
        for (const [key, batch] of colorBatches) {
            const [color, opacityStr] = key.split('|');
            const opacity = parseInt(opacityStr) / 100;

            ctx.globalAlpha = opacity;
            ctx.fillStyle = color;

            for (const pt of batch) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
    }

    _drawHighlightRing(ctx, point) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;

        // Glow effect
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Draw the point brighter
        ctx.globalAlpha = 1;
        ctx.fillStyle = this._getColor(point.data);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ---- HELPERS ----

    _getStarAngle(starName) {
        let hash = 0;
        for (let i = 0; i < starName.length; i++) {
            hash = starName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % 360) * Math.PI / 180;
    }

    _getColor(d) {
        if (this.colorMode === 'type') {
            return getTypeColor(d.type);
        } else {
            return getMethodColor(d.methodPT);
        }
    }

    _isTimeVisible(d) {
        if (!this.timeLimitYear) return true;
        if (this.timeLimitYear >= 2025 && !this.timeLimitStartYear) return true;
        if (d.year > this.timeLimitYear) return false;
        if (this.timeLimitStartYear && d.year < this.timeLimitStartYear) return false;
        return true;
    }

    _isInteractable(data) {
        if (this.timeLimitYear && data.year > this.timeLimitYear) return false;
        if (this.timeLimitStartYear && data.year < this.timeLimitStartYear) return false;

        const isCategoryActive = this.visibleNames.size < this.fullData.length;
        if (isCategoryActive && !this.visibleNames.has(data.name)) return false;

        const hasHighlight = this.currentHighlightFilter != null;
        if (hasHighlight && !this.currentHighlightFilter(data)) return false;

        return true;
    }

    _getOpacity(data) {
        if (this.timeLimitYear && data.year > this.timeLimitYear) return 0;
        if (this.timeLimitStartYear && data.year < this.timeLimitStartYear) return 0;

        const isCategoryActive = this.visibleNames.size < this.fullData.length;
        const inCategory = this.visibleNames.has(data.name);

        const hasHighlight = this.currentHighlightFilter != null;
        const matchesHighlight = hasHighlight ? this.currentHighlightFilter(data) : false;

        let isFocused = true;
        let isFocusModeActive = false;

        if (isCategoryActive) {
            isFocusModeActive = true;
            isFocused = isFocused && inCategory;
        }

        if (hasHighlight) {
            isFocusModeActive = true;
            isFocused = isFocused && matchesHighlight;
        }

        if (this.selectedPlanet) {
            if (data.name === this.selectedPlanet.name) return 1.0;

            if (isFocusModeActive) {
                return isFocused ? 0.12 : 0.12;
            } else {
                return 0.15;
            }
        }

        if (isFocusModeActive) {
            return isFocused ? 1.0 : 0.08;
        }

        return 0.65;
    }

    _updateColors() {
        this.requestRedraw();
    }

    _renderLegend() {
        this.legendContainer.innerHTML = '';
        if (this.colorMode === 'type') {
            const types = ['Terrestre', 'Super-Terra', 'Netuniano', 'Gigante Gasoso'];
            types.forEach(t => {
                const color = getTypeColor(t);
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:14px;color:rgba(255,255,255,0.6)';
                item.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block"></span><span>${t}</span>`;
                this.legendContainer.appendChild(item);
            });
        } else {
            const methods = ['Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta', 'Pulsar Timing'];
            methods.forEach(m => {
                const color = getMethodColor(m);
                const item = document.createElement('div');
                item.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:14px;color:rgba(255,255,255,0.6)';
                item.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block"></span><span>${m}</span>`;
                this.legendContainer.appendChild(item);
            });
        }
    }

    _showTooltip(planet, event) {
        const rect = this.container.getBoundingClientRect();
        const tx = event.clientX - rect.left + 14;
        const ty = event.clientY - rect.top - 10;

        const dist = planet.distLY ? `${Math.round(planet.distLY).toLocaleString('pt-BR')} a.l.` : 'Sem dados';
        const typeColor = getTypeColor(planet.type);

        this.tooltip.innerHTML = `
            <div style="font-weight: 800; color: #fff; margin-bottom: 4px;">${planet.name}</div>
            <div style="display: flex; gap: 4px; margin-bottom: 6px;">
                <span style="font-size: 14px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 10px; background:${typeColor}22; color:${typeColor}; border:1px solid ${typeColor}44;">${planet.type}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 2px;">
                <span>Estrela:</span>
                <span style="color: #fff; font-weight: 600;">${planet.star}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 2px;">
                <span>Distância:</span>
                <span style="color: #fff; font-weight: 600; font-family: monospace;">${dist}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: rgba(255,255,255,0.5); font-size: 14px;">
                <span>Método:</span>
                <span style="color: #fff; font-weight: 600;">${planet.methodPT}</span>
            </div>
        `;

        // Ensure tooltip stays in viewport
        let finalX = tx;
        let finalY = ty;
        this.tooltip.style.display = 'block';
        const tRect = this.tooltip.getBoundingClientRect();
        if (finalX + tRect.width > this.width) finalX = tx - tRect.width - 28;
        if (finalY + tRect.height > this.height) finalY = ty - tRect.height - 20;

        this.tooltip.style.left = `${finalX}px`;
        this.tooltip.style.top = `${finalY}px`;
    }

    _hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    _selectPlanet(planet, x, y) {
        this.selectedPlanet = planet;
        this.onSelect(planet);
        this.requestRedraw();

        if (planet && x !== undefined && y !== undefined) {
            const scale = 6;
            const tx = this.width / 2 - x * scale;
            const ty = this.height / 2 - y * scale;

            d3.select(this.canvas).transition()
                .duration(800)
                .ease(d3.easeCubicOut)
                .call(this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
    }

    // ---- PUBLIC API ----

    setTimeLimit(year, startYear = null) {
        this.timeLimitYear = year;
        this.timeLimitStartYear = startYear;
        this.requestRedraw();
    }

    highlight(planet, preserveFilter = false) {
        if (!preserveFilter) {
            this.currentHighlightFilter = null;
        }
        this.selectedPlanet = planet;
        this.requestRedraw();
    }

    highlightByFilter(filterFn) {
        this.currentHighlightFilter = filterFn;
        this.requestRedraw();
    }

    clearHighlight() {
        this.currentHighlightFilter = null;
        if (this.selectedPlanet) {
            this.highlight(this.selectedPlanet);
        } else {
            this.requestRedraw();
        }
    }

    resetZoom() {
        d3.select(this.canvas).transition()
            .duration(800)
            .call(this.zoom.transform, d3.zoomIdentity);
        this._selectPlanet(null);
    }

    updateData(filtered) {
        this.allData = filtered;
        this.visibleNames = new Set(filtered.map(d => d.name));
        this.requestRedraw();
    }

    animateArrival() {
        this.needsArrivalAnimation = true;
        if (this.width > 0 && this.height > 0) {
            this._runArrivalTransition();
            this.needsArrivalAnimation = false;
        }
    }

    _runArrivalTransition() {
        if (this._arrivalRaf) cancelAnimationFrame(this._arrivalRaf);

        this.arrivalProgress = 0;
        const duration = 1500; // ms
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            this.arrivalProgress = Math.min(1, elapsed / duration);

            // Ease out cubic
            this.arrivalProgress = 1 - Math.pow(1 - this.arrivalProgress, 3);

            this._draw();

            if (this.arrivalProgress < 1) {
                this._arrivalRaf = requestAnimationFrame(animate);
            } else {
                this._arrivalRaf = null;
                this.arrivalProgress = 1;
            }
        };

        this._arrivalRaf = requestAnimationFrame(animate);
    }

    destroy() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._arrivalRaf) cancelAnimationFrame(this._arrivalRaf);
        if (this._redrawRaf) cancelAnimationFrame(this._redrawRaf);
    }
}
