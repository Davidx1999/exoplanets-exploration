/**
 * dashboardCanvas.js — Motor D3.js para o dashboard interativo ("Panorama")
 * 
 * Responsável por:
 * - Renderização orbital dos exoplanetas
 * - Zoom interativo com foco em planetas
 * - Tooltips flutuantes
 * - Filtragem por método de detecção
 */

import { planetsDataset, METHODS_CONFIG } from './data.js';

const DB_WIDTH = 600;
const DB_HEIGHT = 500;

export class DashboardCanvas {
    constructor(svgSelector) {
        this.svg = d3.select(svgSelector);
        this.svg.attr('viewBox', `0 0 ${DB_WIDTH} ${DB_HEIGHT}`);

        // Fundo invisível para capturar eventos de drag/pan corretamente
        this.svg.append('rect')
            .attr('width', DB_WIDTH)
            .attr('height', DB_HEIGHT)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        // Root group com zoom
        this.rootG = this.svg.append('g')
            .attr('transform', `translate(${DB_WIDTH / 2}, ${DB_HEIGHT / 2})`);

        // Zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                this.rootG.attr('transform', event.transform);
                
                // Exibe o botão de retorno caso o zoom/pan seja modificado do padrão
                const t = event.transform;
                const isDefault = Math.abs(t.k - 1) < 0.01 && Math.abs(t.x) < 0.1 && Math.abs(t.y) < 0.1;
                this._toggleZoomReset(!isDefault);
            });

        // Registrar o zoom no SVG para habilitar drag, pan e roda do mouse
        this.svg.call(this.zoom);

        // State
        this.filteredMethod = null;
        this.isZoomed = false;
        this.onPlanetSelect = null;

        // Build layers
        this._buildGuides();
        this._buildCenter();
        this._buildPlanetsGroup();
        this._buildTooltip();
    }

    // =========================================
    // CONSTRUÇÃO
    // =========================================

    _buildGuides() {
        this.guidesG = this.rootG.append('g').attr('class', 'db-guides');
        [55, 110, 170, 235].forEach(r => {
            this.guidesG.append('circle')
                .attr('r', r)
                .attr('fill', 'none')
                .attr('stroke', '#e0e0e0')
                .attr('stroke-width', 0.7)
                .attr('stroke-dasharray', '2,3');
        });
    }

    _buildCenter() {
        this.centerG = this.rootG.append('g').attr('class', 'db-center');
        
        // Glow sutil
        this.centerG.append('circle')
            .attr('r', 16)
            .attr('fill', 'rgba(0,0,0,0.03)');
        
        // Core
        this.centerG.append('circle')
            .attr('r', 6)
            .attr('fill', '#111111');
    }

    _buildPlanetsGroup() {
        this.planetsG = this.rootG.append('g').attr('class', 'db-planets');
    }

    _buildTooltip() {
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'viz-tooltip');
    }

    // =========================================
    // RENDERIZAÇÃO E ATUALIZAÇÃO
    // =========================================

    /**
     * Renderiza ou atualiza os planetas no dashboard
     */
    render() {
        const data = this.filteredMethod
            ? planetsDataset.filter(d => d.method === this.filteredMethod)
            : planetsDataset;

        const sel = this.planetsG.selectAll('.db-planet')
            .data(data, d => d.id);

        // Exit
        sel.exit()
            .transition().duration(400)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();

        // Enter
        const enter = sel.enter().append('circle')
            .attr('class', 'db-planet')
            .attr('cx', d => Math.cos(d.angle) * d.radius)
            .attr('cy', d => Math.sin(d.angle) * d.radius)
            .attr('fill', d => d.color)
            .attr('r', 0)
            .style('opacity', 0)
            .style('cursor', 'pointer');

        // Enter + Update
        enter.merge(sel)
            .on('mouseover', (event, d) => this._showTooltip(event, d))
            .on('mousemove', (event) => this._moveTooltip(event))
            .on('mouseleave', () => this._hideTooltip())
            .on('click', (event, d) => {
                if (event.defaultPrevented) return;
                this.zoomToPlanet(d);
            })
            .transition().duration(800)
            .attr('r', d => d.size)
            .style('opacity', 0.85);
    }

    // =========================================
    // FILTRO
    // =========================================

    setFilter(methodKey) {
        this.filteredMethod = this.filteredMethod === methodKey ? null : methodKey;
        this.render();
        return this.filteredMethod;
    }

    getFilter() {
        return this.filteredMethod;
    }

    clearFilter() {
        this.filteredMethod = null;
        this.render();
    }

    // =========================================
    // ZOOM
    // =========================================

    zoomToPlanet(planet) {
        this.isZoomed = true;

        // Notifica callback
        if (this.onPlanetSelect) {
            this.onPlanetSelect(planet);
        }

        // Dim guides + center
        this.guidesG.transition().duration(400).style('opacity', 0);
        this.centerG.transition().duration(400).style('opacity', 0);

        // Focus the selected planet
        this.planetsG.selectAll('.db-planet')
            .transition().duration(500)
            .style('opacity', d => d.id === planet.id ? 1 : 0.35)
            .attr('r', d => d.id === planet.id ? 18 : d.size);

        const tx = Math.cos(planet.angle) * planet.radius;
        const ty = Math.sin(planet.angle) * planet.radius;

        // Remove previous zoom rings
        this.planetsG.selectAll('.zoomed-rings').remove();

        // Draw focus rings
        const focusG = this.planetsG.append('g')
            .attr('class', 'zoomed-rings')
            .attr('transform', `translate(${tx}, ${ty})`);

        focusG.append('circle')
            .attr('r', 36)
            .attr('fill', 'none')
            .attr('stroke', planet.color)
            .attr('stroke-opacity', 0.35)
            .attr('stroke-width', 1.5)
            .style('opacity', 0)
            .transition().duration(600).style('opacity', 1);

        focusG.append('ellipse')
            .attr('rx', 50)
            .attr('ry', 11)
            .attr('fill', 'none')
            .attr('stroke', planet.color)
            .attr('stroke-opacity', 0.2)
            .attr('stroke-width', 1)
            .attr('transform', 'rotate(-15)')
            .style('opacity', 0)
            .transition().duration(600).style('opacity', 1);

        // Animate SVG zoom
        this.svg.transition().duration(1000)
            .call(
                this.zoom.transform,
                d3.zoomIdentity
                    .translate(DB_WIDTH / 2, DB_HEIGHT / 2)
                    .scale(2.5)
                    .translate(-tx, -ty)
            );

        // Show reset button
        this._toggleZoomReset(true);
    }

    resetZoom() {
        this.isZoomed = false;

        this.guidesG.transition().duration(500).style('opacity', 1);
        this.centerG.transition().duration(500).style('opacity', 1);
        this.planetsG.selectAll('.zoomed-rings').remove();

        this.planetsG.selectAll('.db-planet')
            .transition().duration(700)
            .style('opacity', 0.85)
            .attr('r', d => d.size);

        this.svg.transition().duration(900)
            .call(this.zoom.transform, d3.zoomIdentity);

        this._toggleZoomReset(false);
    }

    // =========================================
    // TOOLTIP
    // =========================================

    _showTooltip(event, d) {
        this.tooltip.style('display', 'block')
            .html(`
                <div class="tooltip-name">${d.name}</div>
                <div class="tooltip-type">${d.type} · ${d.year}</div>
                <div class="tooltip-method">
                    <span class="method-dot" style="background-color: ${d.color}"></span>
                    ${d.method}
                </div>
            `);
    }

    _moveTooltip(event) {
        this.tooltip
            .style('left', (event.pageX + 14) + 'px')
            .style('top', (event.pageY - 14) + 'px');
    }

    _hideTooltip() {
        this.tooltip.style('display', 'none');
    }

    // =========================================
    // HELPERS
    // =========================================

    _toggleZoomReset(show) {
        const btn = document.getElementById('btn-zoom-reset');
        if (!btn) return;
        if (show) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }

    /**
     * Reseta o estado do canvas para o inicial (sem zoom)
     */
    reset() {
        this.svg.call(this.zoom.transform, d3.zoomIdentity);
    }
}
