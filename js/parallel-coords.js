/**
 * parallel-coords.js — Gráfico de Coordenadas Paralelas
 * 
 * Eixos paralelos: Ano, Massa, Raio, Período Orbital, Distância
 * Cada linha = um planeta, colorida pelo método de descoberta.
 * Brush em cada eixo para filtrar o dataset.
 */

import { getMethodColor, formatNumber } from './utils.js';

export class ParallelCoords {
    constructor(containerId, data, { onBrush }) {
        this.container = document.getElementById(containerId);
        this.allData = data;
        this.onBrush = onBrush || (() => {});
        this.brushes = {};

        if (!this.container) return;
        this._init();
    }

    _init() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width || 600;
        this.height = rect.height || 340;
        const margin = { top: 30, right: 30, bottom: 20, left: 30 };

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        const innerW = this.width - margin.left - margin.right;
        const innerH = this.height - margin.top - margin.bottom;

        // Eixos a exibir
        const dimensions = [
            { key: 'year',    label: 'Ano',       type: 'linear', domain: [1992, 2026] },
            { key: 'mass',    label: 'Massa (M⊕)', type: 'log',    domain: [0.01, 15000] },
            { key: 'radius',  label: 'Raio (R⊕)',  type: 'log',    domain: [0.3, 40] },
            { key: 'orbper',  label: 'Período (d)', type: 'log',    domain: [0.1, 1000000] },
            { key: 'distLY',  label: 'Distância (a.l.)', type: 'log', domain: [1, 30000] },
        ];

        // Filtrar dados que tenham pelo menos ano e um valor numérico
        const validData = this.allData.filter(d => d.year !== null);
        // Amostrar para performance (max 1500 linhas)
        const sampleSize = Math.min(1500, validData.length);
        const step = Math.max(1, Math.floor(validData.length / sampleSize));
        const sampled = validData.filter((_, i) => i % step === 0);

        // Escala X: posição de cada eixo
        const xScale = d3.scalePoint()
            .domain(dimensions.map(d => d.key))
            .range([0, innerW])
            .padding(0.1);

        // Escalas Y por dimensão
        const yScales = {};
        dimensions.forEach(dim => {
            if (dim.type === 'log') {
                yScales[dim.key] = d3.scaleLog()
                    .domain(dim.domain)
                    .range([innerH, 0])
                    .clamp(true);
            } else {
                yScales[dim.key] = d3.scaleLinear()
                    .domain(dim.domain)
                    .range([innerH, 0]);
            }
        });

        const g = this.svg.append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Desenhar linhas (uma por planeta)
        const line = d3.line();

        this.lineGroup = g.append('g').attr('class', 'lines');
        
        this.lines = this.lineGroup.selectAll('.pc-line')
            .data(sampled)
            .enter()
            .append('path')
            .attr('class', 'pc-line')
            .attr('d', d => {
                const points = dimensions.map(dim => {
                    const val = d[dim.key];
                    if (val === null || val === undefined || val <= 0) return null;
                    return [xScale(dim.key), yScales[dim.key](val)];
                }).filter(p => p !== null);
                return points.length >= 2 ? line(points) : null;
            })
            .attr('fill', 'none')
            .attr('stroke', d => getMethodColor(d.methodPT))
            .attr('stroke-width', 0.6)
            .attr('opacity', 0.15);

        // Desenhar eixos
        dimensions.forEach(dim => {
            const axisG = g.append('g')
                .attr('class', 'pc-axis')
                .attr('transform', `translate(${xScale(dim.key)}, 0)`);

            // Linha do eixo
            axisG.append('line')
                .attr('y1', 0)
                .attr('y2', innerH)
                .attr('stroke', 'rgba(255,255,255,0.15)')
                .attr('stroke-width', 1);

            // Label
            axisG.append('text')
                .attr('y', -12)
                .attr('text-anchor', 'middle')
                .attr('fill', 'rgba(255,255,255,0.5)')
                .attr('font-size', '14px')
                .attr('font-weight', '600')
                .text(dim.label);

            // Ticks (poucos)
            const ticks = yScales[dim.key].ticks(4);
            ticks.forEach(tick => {
                const ty = yScales[dim.key](tick);
                if (isNaN(ty)) return;
                axisG.append('text')
                    .attr('x', -8)
                    .attr('y', ty)
                    .attr('dy', '0.3em')
                    .attr('text-anchor', 'end')
                    .attr('fill', 'rgba(255,255,255,0.25)')
                    .attr('font-size', '14px')
                    .attr('font-family', "'Share Tech Mono', monospace")
                    .text(dim.type === 'log' ? d3.format('~s')(tick) : tick);
            });

            // Brush vertical por eixo
            const brush = d3.brushY()
                .extent([[-12, 0], [12, innerH]])
                .on('brush end', (event) => {
                    if (!event.selection) {
                        delete this.brushes[dim.key];
                    } else {
                        const [y0, y1] = event.selection;
                        const lo = yScales[dim.key].invert(y1); // invertido (y1 > y0 visualmente)
                        const hi = yScales[dim.key].invert(y0);
                        this.brushes[dim.key] = [Math.min(lo, hi), Math.max(lo, hi)];
                    }
                    this._applyBrush();
                });

            axisG.append('g')
                .attr('class', 'brush')
                .call(brush)
                .selectAll('rect')
                .attr('fill', 'rgba(96,165,250,0.08)')
                .attr('stroke', 'rgba(96,165,250,0.2)')
                .attr('rx', 3);
        });
    }

    _applyBrush() {
        // Filtrar e destacar linhas que passam por todos os brushes ativos
        const activeKeys = Object.keys(this.brushes);

        if (activeKeys.length === 0) {
            this.lines.attr('opacity', 0.15).attr('stroke-width', 0.6);
            this.onBrush(null);
            return;
        }

        this.lines
            .attr('opacity', d => {
                const pass = activeKeys.every(key => {
                    const val = d[key];
                    if (val === null || val === undefined) return false;
                    const [lo, hi] = this.brushes[key];
                    return val >= lo && val <= hi;
                });
                return pass ? 0.5 : 0.03;
            })
            .attr('stroke-width', d => {
                const pass = activeKeys.every(key => {
                    const val = d[key];
                    if (val === null || val === undefined) return false;
                    const [lo, hi] = this.brushes[key];
                    return val >= lo && val <= hi;
                });
                return pass ? 1.2 : 0.4;
            });

        this.onBrush(this.brushes);
    }

    /**
     * Destaca um planeta específico nas coordenadas paralelas.
     */
    highlight(planet) {
        if (!planet) {
            this.lines.attr('opacity', 0.15).attr('stroke-width', 0.6);
            return;
        }

        this.lines
            .attr('opacity', d => d.name === planet.name ? 1.0 : 0.05)
            .attr('stroke-width', d => d.name === planet.name ? 2.5 : 0.4);
    }
}
