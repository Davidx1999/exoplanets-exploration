/**
 * network-graph.js — Grafo de Rede Force-Directed
 * 
 * Visualiza relações: Método de Descoberta → Tipo Planetário → Década
 * Nós representam cada entidade; arestas conectam quando há planetas
 * que foram descobertos por aquele método, são daquele tipo, e naquela década.
 * Espessura das arestas proporcional à quantidade de planetas.
 */

import { getMethodColor, getTypeColor } from './utils.js';

const DECADE_COLOR = '#64748B';

export class NetworkGraph {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.allData = data;

        if (!this.container) return;
        this._init();
    }

    _init() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width || 400;
        this.height = rect.height || 340;

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        // Construir nós e links
        const { nodes, links } = this._buildGraph();

        // Escalas de espessura
        const maxWeight = d3.max(links, d => d.weight) || 1;
        const linkWidthScale = d3.scaleLinear()
            .domain([1, maxWeight])
            .range([0.5, 6])
            .clamp(true);

        const linkAlphaScale = d3.scaleLinear()
            .domain([1, maxWeight])
            .range([0.08, 0.35])
            .clamp(true);

        // Simulação de forças
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.3))
            .force('charge', d3.forceManyBody().strength(-120))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(d => d.size + 4))
            .on('tick', ticked);

        // Links
        const link = this.svg.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', 'rgba(255,255,255,0.15)')
            .attr('stroke-width', d => linkWidthScale(d.weight))
            .attr('stroke-opacity', d => linkAlphaScale(d.weight));

        // Nós
        const node = this.svg.append('g')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Círculos dos nós
        node.append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => d.color)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('fill-opacity', 0.2)
            .attr('stroke-opacity', 0.6);

        // Labels dos nós
        node.append('text')
            .text(d => d.label)
            .attr('x', d => d.size + 5)
            .attr('y', 3)
            .attr('fill', 'rgba(255,255,255,0.55)')
            .attr('font-size', '9px')
            .attr('font-weight', '500');

        // Tooltip nos nós
        node.append('title')
            .text(d => `${d.label}\n${d.group}: ${d.count} planetas`);

        function ticked() {
            link.attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }

    _buildGraph() {
        const nodes = [];
        const links = [];
        const nodeSet = new Set();

        // Coletar métodos únicos, tipos únicos, décadas únicas
        const methods = new Set();
        const types = new Set();
        const decades = new Set();

        // Contar conexões: método→tipo, tipo→década
        const methodTypeCount = {};
        const typeDecadeCount = {};

        this.allData.forEach(d => {
            if (!d.methodPT || !d.type || !d.decade) return;
            methods.add(d.methodPT);
            types.add(d.type);
            decades.add(d.decade);

            const mtKey = `${d.methodPT}→${d.type}`;
            methodTypeCount[mtKey] = (methodTypeCount[mtKey] || 0) + 1;

            const tdKey = `${d.type}→${d.decade}`;
            typeDecadeCount[tdKey] = (typeDecadeCount[tdKey] || 0) + 1;
        });

        // Criar nós de método
        methods.forEach(m => {
            const count = this.allData.filter(d => d.methodPT === m).length;
            if (count < 5) return; // Filtrar métodos com poucos registros
            const id = `method:${m}`;
            nodes.push({
                id, label: m, group: 'Método', color: getMethodColor(m),
                count, size: Math.max(6, Math.sqrt(count) * 0.8)
            });
            nodeSet.add(id);
        });

        // Criar nós de tipo
        types.forEach(t => {
            if (t === 'Desconhecido') return;
            const count = this.allData.filter(d => d.type === t).length;
            const id = `type:${t}`;
            nodes.push({
                id, label: t, group: 'Tipo', color: getTypeColor(t),
                count, size: Math.max(6, Math.sqrt(count) * 0.7)
            });
            nodeSet.add(id);
        });

        // Criar nós de década
        decades.forEach(dec => {
            if (dec === 'Desconhecida') return;
            const count = this.allData.filter(d => d.decade === dec).length;
            const id = `decade:${dec}`;
            nodes.push({
                id, label: dec, group: 'Década', color: DECADE_COLOR,
                count, size: Math.max(5, Math.sqrt(count) * 0.5)
            });
            nodeSet.add(id);
        });

        // Criar links método→tipo
        Object.entries(methodTypeCount).forEach(([key, weight]) => {
            if (weight < 3) return;
            const [method, type] = key.split('→');
            const source = `method:${method}`;
            const target = `type:${type}`;
            if (nodeSet.has(source) && nodeSet.has(target)) {
                links.push({ source, target, weight });
            }
        });

        // Criar links tipo→década
        Object.entries(typeDecadeCount).forEach(([key, weight]) => {
            if (weight < 5) return;
            const [type, decade] = key.split('→');
            const source = `type:${type}`;
            const target = `decade:${decade}`;
            if (nodeSet.has(source) && nodeSet.has(target)) {
                links.push({ source, target, weight });
            }
        });

        return { nodes, links };
    }
}
