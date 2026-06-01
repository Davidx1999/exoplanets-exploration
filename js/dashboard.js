/**
 * dashboard.js — Módulo do Dashboard ("Panorama") interativo
 * 
 * Gerencia os componentes do painel:
 * - KPI cards (métricas)
 * - Legenda com filtros interativos
 * - Ficha técnica do planeta selecionado
 * - Integração com o DashboardCanvas (D3)
 */

import { METHODS_CONFIG, TOTAL_DISCOVERIES, YEAR_RANGE, planetsDataset } from './data.js';
import { DashboardCanvas } from './dashboardCanvas.js';

export class Dashboard {
    constructor() {
        this.canvas = null;
        this.selectedPlanet = planetsDataset[0];
        this.onBackClick = null;
    }

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    init() {
        this.canvas = new DashboardCanvas('#dashboard-canvas');
        this.canvas.onPlanetSelect = (planet) => this.updatePlanetCard(planet);

        // Event: zoom reset
        const resetBtn = document.getElementById('btn-zoom-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.canvas.resetZoom());
        }

        // Event: back button
        const backBtn = document.getElementById('btn-back-story');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.onBackClick) this.onBackClick();
            });
        }

        // Keyboard: ESC para resetar zoom
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.canvas.isZoomed) {
                this.canvas.resetZoom();
            }
        });

        // Render
        this.renderKPIs();
        this.renderLegend();
        this.updatePlanetCard(this.selectedPlanet);
        this.canvas.render();
        this.canvas.reset();
    }

    // =========================================
    // KPIs
    // =========================================

    renderKPIs() {
        const el = document.getElementById('kpi-discoveries');
        if (el) el.textContent = `+${TOTAL_DISCOVERIES.toLocaleString('pt-BR')}`;

        const elPeriod = document.getElementById('kpi-period');
        if (elPeriod) elPeriod.textContent = YEAR_RANGE;

        // Método dominante: Trânsito
        const elMethod = document.getElementById('kpi-method-name');
        if (elMethod) elMethod.textContent = 'Trânsito';

        const elMethodPct = document.getElementById('kpi-method-pct');
        if (elMethodPct) elMethodPct.textContent = '53,4% das descobertas';
    }

    // =========================================
    // LEGENDA COM FILTROS
    // =========================================

    renderLegend() {
        const container = document.getElementById('legend-list');
        if (!container) return;

        container.innerHTML = '';
        const currentFilter = this.canvas.getFilter();

        Object.entries(METHODS_CONFIG).forEach(([key, value]) => {
            const isActive = currentFilter === null || currentFilter === key;

            const btn = document.createElement('button');
            btn.className = 'legend-item';
            if (currentFilter === key) btn.classList.add('active');
            if (currentFilter !== null && currentFilter !== key) btn.classList.add('dimmed');

            btn.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span class="legend-color" style="background-color: ${value.color}"></span>
                    <span class="legend-label">${value.label}</span>
                </div>
                <span class="legend-percent">${value.percent}</span>
            `;

            btn.addEventListener('click', () => {
                this.canvas.setFilter(key);
                this.renderLegend();
            });

            container.appendChild(btn);
        });
    }

    // =========================================
    // FICHA DO PLANETA
    // =========================================

    updatePlanetCard(planet) {
        this.selectedPlanet = planet;

        const name = document.getElementById('card-planet-name');
        const year = document.getElementById('card-planet-year');
        const method = document.getElementById('card-planet-method');
        const type = document.getElementById('card-planet-type');
        const mass = document.getElementById('card-planet-mass');

        if (name) name.textContent = planet.name;
        if (year) year.textContent = planet.year;
        if (type) type.textContent = planet.type;
        if (mass) mass.textContent = planet.mass;

        if (method) {
            const conf = METHODS_CONFIG[planet.method];
            method.innerHTML = `
                <span class="method-dot" style="background-color: ${conf ? conf.color : '#999'}"></span>
                ${planet.method}
            `;
        }
    }

    // =========================================
    // SHOW / HIDE
    // =========================================

    show() {
        const el = document.getElementById('dashboard-view');
        if (el) {
            el.classList.add('active');
        }
        // Re-render em caso de resize
        this.canvas.render();
        this.canvas.reset();
    }

    hide() {
        const el = document.getElementById('dashboard-view');
        if (el) {
            el.classList.remove('active');
        }
    }
}
