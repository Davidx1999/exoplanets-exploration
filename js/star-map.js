/**
 * js/star-map.js — Mapa Estelar Interativo de Exoplanetas
 * 
 * Mapeia todos os planetas em coordenadas polares em relação à Terra (centro):
 * - Distância radial (R) = distância em anos-luz (escala de potência 0.4)
 * - Ângulo (theta) = hash determinista do nome da estrela
 * 
 * Suporta arrastar, zoom in/out (d3-zoom), clique para focar e alternância 
 * de cores entre Tipo Planetário e Método de Descoberta.
 */

import { getMethodColor, getTypeColor, formatNumber } from './utils.js';

export class StarMap {
    constructor(containerId, data, { onSelect }) {
        this.container = document.getElementById(containerId);
        this.allData = data;
        this.onSelect = onSelect || (() => { });

        this.selectedPlanet = null;
        this.colorMode = 'type'; // 'type' | 'method'
        this.width = 0;
        this.height = 0;
        this.currentTransform = d3.zoomIdentity;

        if (!this.container) return;
        this._init();
    }

    _init() {
        // Criar estrutura básica interna
        this.container.innerHTML = `
            <div class="star-map-wrapper" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
                <div class="star-map-controls" style="position: absolute; top: 12px; left: 16px; z-index: 10; display: flex; gap: 8px; align-items: center;">
                    <div class="map-toggle-group" style="display: flex; background: #252538; border: 1px solid #444462; border-radius: 6px; padding: 2px;">
                        <button class="map-toggle-btn active" id="map-color-type" style="background: #2563eb; border: none; color: #fff; padding: 4px 10px; font-size: 14px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">Tipo de Planeta</button>
                        <button class="map-toggle-btn" id="map-color-method" style="background: #252538; border: none; color: #ffffff; padding: 4px 10px; font-size: 14px; font-weight: 600; border-radius: 4px; cursor: pointer; transition: all 0.2s;">Método</button>
                    </div>
                    <button class="map-reset-btn" id="map-reset-zoom" style="background: #252538; border: 1px solid #444462; color: #fff; padding: 4px 10px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s;">Resetar Visão</button>
                </div>
                <div class="star-map-legend" style="position: absolute; bottom: 12px; left: 16px; z-index: 10; display: flex; flex-wrap: wrap; gap: 12px; max-width: 80%; pointer-events: none; background: rgba(8,8,16,0.5); padding: 6px 10px; border-radius: 6px; backdrop-filter: blur(4px);"></div>
                <div class="star-map-tooltip" style="position: absolute; background: rgba(8, 8, 16, 0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 10px 12px; font-size: 14px; pointer-events: none; display: none; z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.5); min-width: 180px;"></div>
                <svg class="star-map-svg" style="width: 100%; height: 100%; cursor: grab; background: radial-gradient(circle at center, #06060c 0%, #010103 100%);"></svg>
            </div>
        `;

        this.svgEl = this.container.querySelector('.star-map-svg');
        this.svg = d3.select(this.svgEl);
        this.tooltip = this.container.querySelector('.star-map-tooltip');
        this.legendContainer = this.container.querySelector('.star-map-legend');

        this._setupEvents();
        this._render();

        // Resize observer
        this._resizeObserver = new ResizeObserver(() => {
            this._render();
        });
        this._resizeObserver.observe(this.container);
    }

    _setupEvents() {
        const btnType = this.container.querySelector('#map-color-type');
        const btnMethod = this.container.querySelector('#map-color-method');
        const btnReset = this.container.querySelector('#map-reset-zoom');

        btnType.onclick = () => {
            this.colorMode = 'type';
            btnType.classList.add('active');
            btnType.style.background = '#2563eb';
            btnType.style.color = '#fff';
            btnMethod.classList.remove('active');
            btnMethod.style.background = '#252538';
            btnMethod.style.color = '#ffffff';
            this._updateColors();
            this._renderLegend();
        };

        btnMethod.onclick = () => {
            this.colorMode = 'method';
            btnMethod.classList.add('active');
            btnMethod.style.background = '#2563eb';
            btnMethod.style.color = '#fff';
            btnType.classList.remove('active');
            btnType.style.background = '#252538';
            btnType.style.color = '#ffffff';
            this._updateColors();
            this._renderLegend();
        };

        btnReset.onclick = () => {
            this.resetZoom();
        };
    }

    _render() {
        // Limpar SVG
        this.svg.selectAll('*').remove();

        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        if (this.width <= 0 || this.height <= 0) return;

        // Escala de potência para distâncias reais (Terra no centro)
        // 0.4 de expoente suaviza a distribuição e reduz o acúmulo no meio
        const maxDist = 28000; 
        const maxR = Math.min(this.width, this.height) * 1.5;

        this.rScale = d3.scalePow()
            .exponent(0.26)
            .domain([0, maxDist])
            .range([0, maxR]);

        // Criar grupo base para zoom
        this.g = this.svg.append('g').attr('class', 'map-group');

        // Adicionar filtros decorativos para brilho (glow)
        const defs = this.svg.append('defs');
        defs.append('filter')
            .attr('id', 'sun-glow')
            .append('feGaussianBlur')
            .attr('stdDeviation', 5)
            .attr('result', 'coloredBlur');

        const feMerge = defs.select('#sun-glow').append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Desenhar grid de distâncias concêntricas (Anos-luz)
        const circles = [100, 1000, 5000, 10000, 20000];
        const gridG = this.g.append('g').attr('class', 'grid-group');

        circles.forEach(dist => {
            const r = this.rScale(dist);
            // Círculo
            gridG.append('circle')
                .attr('cx', this.width / 2)
                .attr('cy', this.height / 2)
                .attr('r', r)
                .attr('fill', 'none')
                .attr('stroke', 'rgba(255,255,255,0.03)')
                .attr('stroke-width', 0.8)
                .attr('stroke-dasharray', '4,6');

            // Rótulo da distância
            gridG.append('text')
                .attr('x', this.width / 2 + r)
                .attr('y', this.height / 2 - 4)
                .attr('fill', 'rgba(255,255,255,0.12)')
                .attr('font-size', '14px')
                .attr('font-family', "'Share Tech Mono', monospace")
                .attr('text-anchor', 'middle')
                .text(`${dist} al`);
        });

        // Desenhar eixos radiais (linhas em cruz)
        gridG.append('line')
            .attr('x1', this.width / 2 - maxR)
            .attr('y1', this.height / 2)
            .attr('x2', this.width / 2 + maxR)
            .attr('y2', this.height / 2)
            .attr('stroke', 'rgba(255,255,255,0.015)')
            .attr('stroke-width', 0.5);

        gridG.append('line')
            .attr('x1', this.width / 2)
            .attr('y1', this.height / 2 - maxR)
            .attr('x2', this.width / 2)
            .attr('y2', this.height / 2 + maxR)
            .attr('stroke', 'rgba(255,255,255,0.015)')
            .attr('stroke-width', 0.5);

        // Desenhar o Sol/Terra no centro do mapa
        const centerG = this.g.append('g').attr('class', 'center-earth');
        centerG.append('circle')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', 8)
            .attr('fill', 'rgba(96,165,250,0.15)')
            .attr('filter', 'url(#sun-glow)');

        centerG.append('circle')
            .attr('cx', this.width / 2)
            .attr('cy', this.height / 2)
            .attr('r', 2)
            .attr('fill', '#60A5FA');

        // Preparar pontos das estrelas com offset para evitar sobreposição em sistemas multi-planetários
        const starCounts = {};
        const starIndices = {};
        this.allData.forEach(d => {
            const star = d.star || d.name;
            starCounts[star] = (starCounts[star] || 0) + 1;
        });

        const processedPoints = this.allData.map((d, i) => {
            const dist = d.distLY !== null && d.distLY > 0 ? d.distLY : 1500; // fallback
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

            // Se for um sistema com múltiplos planetas, distribui-os em um círculo orbital ao redor do centro do sistema
            if (totalPlanets > 1) {
                const baseRadius = d.radius || 1.0;
                const starSize = Math.max(3.2, Math.min(10, 2.5 + Math.sqrt(baseRadius) * 1.1));
                const offsetRadius = starSize * 2.2 + planetIndex * 2.8; // espaçamento orbital
                const offsetAngle = (planetIndex / totalPlanets) * 2 * Math.PI;
                px += offsetRadius * Math.cos(offsetAngle);
                py += offsetRadius * Math.sin(offsetAngle);
            }

            return {
                data: d,
                x: px,
                y: py,
                id: `star-${i}`
            };
        });

        // Desenhar estrelas como círculos SVG
        this.starsG = this.g.append('g').attr('class', 'stars-group');

        const starSelection = this.starsG.selectAll('.star-dot')
            .data(processedPoints)
            .enter()
            .append('circle')
            .attr('class', 'star-dot')
            .attr('id', d => d.id)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => {
                // Tamanho proporcional ao raio planetário, se houver
                const rad = d.data.radius || 1.0;
                return Math.max(1.8, Math.min(6, 1.5 + Math.sqrt(rad) * 0.8));
            })
            .attr('fill', d => this._getColor(d.data))
            .attr('opacity', 0.65)
            .style('cursor', 'pointer')
            .style('transition', 'r 0.15s ease, opacity 0.15s ease');

        // Eventos de interação
        starSelection
            .on('mouseenter', (event, d) => {
                if (this.isZooming) return;
                this._showTooltip(d.data, event);
                d3.select(event.currentTarget)
                    .attr('opacity', 1.0)
                    .attr('r', d3.select(event.currentTarget).attr('r') * 1.5 + 2)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1.2);
            })
            .on('mouseleave', (event, d) => {
                this._hideTooltip();
                const baseRadius = d.data.radius || 1.0;
                const origR = Math.max(1.8, Math.min(6, 1.5 + Math.sqrt(baseRadius) * 0.8));
                d3.select(event.currentTarget)
                    .attr('r', origR)
                    .attr('stroke', 'none')
                    .attr('opacity', this.selectedPlanet ? (d.data.name === this.selectedPlanet.name ? 1.0 : 0.15) : 0.65);
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                this._selectPlanet(d.data, d.x, d.y);
            });

        // Configurar zoom e drag
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 40])
            .extent([[0, 0], [this.width, this.height]])
            .on('start', () => {
                this.isZooming = true;
                this.svg.attr('cursor', 'grabbing');
            })
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.g.attr('transform', event.transform);
            })
            .on('end', () => {
                this.isZooming = false;
                this.svg.attr('cursor', 'grab');
            });

        this.svg.call(this.zoom);

        // Clique no fundo limpa a seleção
        this.svg.on('click', () => {
            this._selectPlanet(null);
        });

        // Se já houver um planeta selecionado, manter opacidades
        if (this.selectedPlanet) {
            this.highlight(this.selectedPlanet);
        }

        // Renderizar a legenda
        this._renderLegend();
    }

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

    _updateColors() {
        if (!this.starsG) return;
        this.starsG.selectAll('.star-dot')
            .attr('fill', d => this._getColor(d.data));
    }

    _renderLegend() {
        this.legendContainer.innerHTML = '';
        if (this.colorMode === 'type') {
            const types = ['Terrestre', 'Super-Terra', 'Netuniano', 'Gigante Gasoso'];
            types.forEach(t => {
                const color = getTypeColor(t);
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '5px';
                item.style.fontSize = '14px';
                item.style.color = 'rgba(255,255,255,0.6)';
                item.innerHTML = `
                    <span style="width: 7px; height: 7px; border-radius: 50%; background:${color}; display:inline-block"></span>
                    <span>${t}</span>
                `;
                this.legendContainer.appendChild(item);
            });
        } else {
            const methods = ['Trânsito', 'Velocidade Radial', 'Micro-lente', 'Imagem Direta', 'Pulsar Timing'];
            methods.forEach(m => {
                const color = getMethodColor(m);
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '5px';
                item.style.fontSize = '14px';
                item.style.color = 'rgba(255,255,255,0.6)';
                item.innerHTML = `
                    <span style="width: 7px; height: 7px; border-radius: 50%; background:${color}; display:inline-block"></span>
                    <span>${m}</span>
                `;
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

        this.tooltip.style.left = `${tx}px`;
        this.tooltip.style.top = `${ty}px`;
        this.tooltip.style.display = 'block';
    }

    _hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    _selectPlanet(planet, x, y) {
        this.selectedPlanet = planet;
        this.onSelect(planet);
        this.highlight(planet);

        if (planet && x !== undefined && y !== undefined) {
            // Dar zoom suave e focar no ponto clicado
            const scale = 6;
            const tx = this.width / 2 - x * scale;
            const ty = this.height / 2 - y * scale;

            this.svg.transition()
                .duration(800)
                .ease(d3.easeCubicOut)
                .call(this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
    }

    // ---- API PÚBLICA ----

    /**
     * Destaca o planeta selecionado no mapa estelar diminuindo a opacidade dos outros
     */
    highlight(planet) {
        this.selectedPlanet = planet;
        if (!this.starsG) return;

        if (planet) {
            this.starsG.selectAll('.star-dot')
                .attr('opacity', d => d.data.name === planet.name ? 1.0 : 0.15);
        } else {
            this.starsG.selectAll('.star-dot')
                .attr('opacity', 0.65);
        }
    }

    /**
     * Reseta a escala e translação da câmera para a visão geral
     */
    resetZoom() {
        this.svg.transition()
            .duration(800)
            .call(this.zoom.transform, d3.zoomIdentity);
        this._selectPlanet(null);
    }

    /**
     * Atualiza dados filtrados
     */
    updateData(filtered) {
        this.allData = filtered;
        this._render();
    }

    destroy() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
