/**
 * storyCanvas.js — Motor D3.js para as animações do scrollytelling
 * 
 * Controla toda a camada visual SVG durante a narrativa:
 * - Corpo central (terra/estrela)
 * - Linhas orbitais
 * - Nuvens de planetas animados
 */

import { planetsDataset, STORY_METHODS } from './data.js';

const CANVAS_SIZE = 560;

export class StoryCanvas {
    constructor(svgSelector) {
        this.svg = d3.select(svgSelector);
        this.svg.attr('viewBox', `0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`);

        // Grupo raiz centrado
        this.rootG = this.svg.append('g')
            .attr('transform', `translate(${CANVAS_SIZE / 2}, ${CANVAS_SIZE / 2})`);

        // Camadas (ordem z importa)
        this.orbitLinesG = this.rootG.append('g').attr('class', 'orbit-lines').style('opacity', 0);
        this.centralG = this.rootG.append('g').attr('class', 'central-body');
        this.planetsG = this.rootG.append('g').attr('class', 'planets-cloud');

        // Corpo central
        this.centralDot = this.centralG.append('circle')
            .attr('r', 0)
            .attr('fill', '#111111')
            .style('opacity', 0);

        // Linhas de órbita
        this._buildOrbitLines();

        // Tracking
        this.currentMethodIdx = 0;
    }

    // =========================================
    // CONSTRUÇÃO INTERNA
    // =========================================

    _buildOrbitLines() {
        const radii = [70, 130, 190, 250];
        radii.forEach(r => {
            this.orbitLinesG.append('circle')
                .attr('r', r)
                .attr('fill', 'none')
                .attr('stroke', '#d4d4d4')
                .attr('stroke-dasharray', '3,4')
                .attr('stroke-width', 0.6);
        });
    }

    // =========================================
    // ANIMAÇÕES POR SLIDE
    // =========================================

    /**
     * Slide 0: Capa — Corpo central grande e sólido, sem planetas
     */
    animateSlide0() {
        this.centralDot.interrupt().transition().duration(900)
            .attr('r', 42)
            .attr('cx', 0)
            .attr('cy', -160)
            .style('opacity', 1);

        this.orbitLinesG.transition().duration(600).style('opacity', 0);
        this.planetsG.selectAll('.story-pt').transition().duration(400)
            .attr('r', 0).style('opacity', 0).remove();
    }

    /**
     * Slide 1: "8 planetas" — Corpo deslocado, 8 pontos do Sistema Solar
     */
    animateSlide1() {
        // Desloca e reduz o corpo central
        this.centralDot.interrupt().transition().duration(1000)
            .attr('r', 18)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', 1);

        // Mostra órbitas fracas
        this.orbitLinesG.transition().duration(800).style('opacity', 0.25);

        // 8 planetas do Sistema Solar (tons neutros)
        const solarData = d3.range(8).map(i => ({
            id: `solar-${i}`,
            r: 55 + i * 24,
            angle: (i * Math.PI / 3.7) + (Math.random() * 0.3),
            color: '#b0b0b0',
            size: 3 + Math.random() * 2.5
        }));

        const sel = this.planetsG.selectAll('.story-pt')
            .data(solarData, d => d.id);

        sel.exit().transition().duration(400).attr('r', 0).style('opacity', 0).remove();

        sel.enter().append('circle')
            .attr('class', 'story-pt')
            .attr('fill', d => d.color)
            .attr('r', 0)
            .attr('cx', d => Math.cos(d.angle) * (d.r * 0.3))
            .attr('cy', d => Math.sin(d.angle) * (d.r * 0.3))
            .style('opacity', 0)
            .merge(sel)
            .transition().duration(1200)
            .attr('cx', d => Math.cos(d.angle) * d.r)
            .attr('cy', d => Math.sin(d.angle) * d.r)
            .attr('r', d => d.size)
            .style('opacity', 0.6);
    }

    /**
     * Slide 2: Nuvem de método — Mostra planetas por método de detecção
     */
    animateSlide2(methodIdx = null) {
        if (methodIdx !== null) {
            this.currentMethodIdx = methodIdx;
        }

        // Centraliza e encolhe o corpo
        this.centralDot.interrupt().transition().duration(800)
            .attr('r', 14)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', 1);

        this.orbitLinesG.transition().duration(600).style('opacity', 0.5);

        this._renderMethodCloud();
    }

    /**
     * Avança para o próximo método no storytelling
     * Retorna true se há mais métodos, false se completou todos
     */
    nextMethod() {
        if (this.currentMethodIdx < STORY_METHODS.length - 1) {
            this.currentMethodIdx++;
            this._renderMethodCloud();
            return true;
        }
        return false;
    }

    /**
     * Retorna o método atual sendo exibido
     */
    getCurrentMethod() {
        return STORY_METHODS[this.currentMethodIdx];
    }

    /**
     * Retorna o índice do método atual
     */
    getCurrentMethodIdx() {
        return this.currentMethodIdx;
    }

    /**
     * Reseta o índice de método para o início
     */
    resetMethodIdx() {
        this.currentMethodIdx = 0;
    }

    /**
     * Slide 3: Contador — Dissolve os planetas, prepara para o counter
     */
    animateSlide3() {
        this.centralDot.interrupt().transition().duration(800)
            .attr('r', 22)
            .attr('cx', 0)
            .attr('cy', 0)
            .style('opacity', 1);

        this.orbitLinesG.transition().duration(600).style('opacity', 0.08);

        this.planetsG.selectAll('.story-pt')
            .transition().duration(600)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();
    }

    // =========================================
    // HELPERS
    // =========================================

    _renderMethodCloud() {
        const method = STORY_METHODS[this.currentMethodIdx];
        const methodData = planetsDataset
            .filter(d => d.method === method.name)
            .slice(0, 300);

        const sel = this.planetsG.selectAll('.story-pt')
            .data(methodData, d => d.id);

        sel.exit()
            .transition().duration(500)
            .attr('r', 0)
            .style('opacity', 0)
            .remove();

        const enter = sel.enter().append('circle')
            .attr('class', 'story-pt')
            .attr('fill', method.color)
            .attr('cx', d => Math.cos(d.angle) * (d.radius * 0.4) + (Math.random() - 0.5) * 20)
            .attr('cy', d => Math.sin(d.angle) * (d.radius * 0.4) + (Math.random() - 0.5) * 20)
            .attr('r', 0)
            .style('opacity', 0);

        enter.merge(sel)
            .transition().duration(900)
            .attr('cx', d => Math.cos(d.angle) * d.radius)
            .attr('cy', d => Math.sin(d.angle) * d.radius)
            .attr('r', d => d.size * 0.85)
            .attr('fill', method.color)
            .style('opacity', 0.85);
    }
}
