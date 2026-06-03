/**
 * planet-card.js — Ficha Técnica Lateral do Planeta Selecionado
 * 
 * Renderiza informações detalhadas do exoplaneta com:
 * - Identidade (nome, tipo, ano, método)
 * - Dados físicos e estelares
 * - Barra de gravidade relativa
 * - Animação canvas do astronauta pulando
 * - Indicador de valores calculados
 */

import { renderValue, hasCalculatedValues, getMethodColor, getTypeColor } from './utils.js';

// ============================================
// CONFIGURAÇÃO DA ANIMAÇÃO (Ajustado para tamanho compacto)
// ============================================
const ASTRO_BASE_JUMP = 22;     // Altura base do pulo (pixels)
const ASTRO_BASE_SPEED = 0.04;  // Velocidade base de ciclo
const ASTRO_CANVAS_W = 80;
const ASTRO_CANVAS_H = 60;

// ============================================
// CLASSE PRINCIPAL
// ============================================

export class PlanetCard {
    constructor() {
        this.cardEl = document.getElementById('planet-card');
        this.emptyEl = document.getElementById('planet-card-empty');
        this.contentEl = document.getElementById('planet-card-content');
        this.canvas = document.getElementById('astronaut-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.planet = null;
        this.animFrame = null;
        this.time = 0;

        // Referenciar todos os campos
        this.fields = {
            name:       document.getElementById('card-name'),
            type:       document.getElementById('card-type'),
            year:       document.getElementById('card-year'),
            method:     document.getElementById('card-method'),
            mass:       document.getElementById('card-mass'),
            radius:     document.getElementById('card-radius'),
            dist:       document.getElementById('card-dist'),
            star:       document.getElementById('card-star'),
            stemp:      document.getElementById('card-stemp'),
            sysplanets: document.getElementById('card-sysplanets'),
            orbper:     document.getElementById('card-orbper'),
            gravValue:  document.getElementById('card-grav-value'),
            gravBar:    document.getElementById('card-grav-bar'),
            gravEarth:  document.getElementById('card-grav-earth'),
            astroNote:  document.getElementById('astronaut-note'),
            calcNote:   document.getElementById('card-calc-note'),
        };
    }

    /**
     * Mostra a ficha para um planeta.
     * @param {object} planet - Objeto do planeta do dataset
     */
    show(planet) {
        if (!planet || !this.cardEl) return;
        this.planet = planet;

        // Mostrar conteúdo e ocultar empty state
        if (this.emptyEl) this.emptyEl.style.display = 'none';
        if (this.contentEl) this.contentEl.style.display = 'flex';

        // ---- Identidade ----
        this._setText('name', planet.name);
        
        const typeColor = getTypeColor(planet.type);
        this.fields.type.textContent = planet.type || 'Desconhecido';
        this.fields.type.style.background = typeColor + '18';
        this.fields.type.style.color = typeColor;
        this.fields.type.style.border = `1px solid ${typeColor}44`;

        // ---- Dados Físicos ----
        this._setField('year', planet.year, '');
        this._setMethodField(planet);
        this._setField('mass', planet.mass, '× Terra', { decimals: 2 });
        this._setField('radius', planet.radius, '× Terra', { decimals: 2 });
        
        // Distância em anos-luz
        if (planet.distLY !== null && planet.distLY !== undefined) {
            this._setFieldDirect('dist', `${planet.distLY.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} a.l.`);
        } else {
            this._setMissing('dist');
        }

        this._setFieldDirect('star', planet.star || 'Desconhecida');
        this._setField('stemp', planet.starTemp, 'K', { decimals: 0 });
        this._setField('sysplanets', planet.numPlanets, '', { decimals: 0 });
        
        // Período orbital
        if (planet.orbper !== null && planet.orbper !== undefined) {
            const days = planet.orbper;
            let orbText;
            if (days < 1) {
                orbText = `${(days * 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas`;
            } else if (days > 365.25) {
                orbText = `${(days / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos`;
            } else {
                orbText = `${days.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
            }
            this._setFieldDirect('orbper', orbText);
        } else {
            this._setMissing('orbper');
        }

        // ---- Gravidade ----
        this._renderGravity(planet);

        // ---- Nota de valores calculados ----
        if (hasCalculatedValues(planet)) {
            this.fields.calcNote.classList.remove('card-calc-hidden');
        } else {
            this.fields.calcNote.classList.add('card-calc-hidden');
        }

        // Iniciar animação do astronauta
        this._startAstroAnimation(planet.gravity);
    }

    hide() {
        if (!this.cardEl) return;
        if (this.emptyEl) this.emptyEl.style.display = 'flex';
        if (this.contentEl) this.contentEl.style.display = 'none';
        this.planet = null;
        this._stopAstroAnimation();
    }

    // ---- HELPERS DE RENDERIZAÇÃO ----

    _setText(field, text) {
        if (this.fields[field]) this.fields[field].textContent = text || '—';
    }

    _setField(field, value, unit, opts = {}) {
        if (!this.fields[field]) return;
        const result = renderValue(value, unit, opts);
        this.fields[field].textContent = result.text;
        this.fields[field].classList.toggle('missing', result.isMissing);
    }

    _setFieldDirect(field, text) {
        if (!this.fields[field]) return;
        this.fields[field].textContent = text;
        this.fields[field].classList.remove('missing');
    }

    _setMissing(field) {
        if (!this.fields[field]) return;
        this.fields[field].textContent = 'Sem dados registrados';
        this.fields[field].classList.add('missing');
    }

    _setMethodField(planet) {
        if (!this.fields.method) return;
        const color = getMethodColor(planet.methodPT);
        this.fields.method.innerHTML = `<span class="mdot" style="background:${color}; margin-right:5px"></span>${planet.methodPT || '—'}`;
        this.fields.method.classList.remove('missing');
    }

    // ---- GRAVIDADE ----

    _renderGravity(planet) {
        const g = planet.gravity;

        if (g === null || g === undefined) {
            this.fields.gravValue.textContent = '—';
            this.fields.gravBar.style.width = '0%';
            this.fields.astroNote.textContent = 'Sem dados suficientes para calcular gravidade.';
            return;
        }

        // Valor formatado
        this.fields.gravValue.textContent = `${g.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}g`;

        // Cor da barra baseada na intensidade
        let barColor;
        if (g < 0.5) barColor = '#34D399';        // Verde — baixa
        else if (g < 1.5) barColor = '#60A5FA';    // Azul — terrestre
        else if (g < 5) barColor = '#FACC15';       // Amarelo — alta
        else barColor = '#EF4444';                  // Vermelho — extrema

        // Largura da barra (log scale, max visual = 100% a ~50g)
        const maxG = 50;
        const barPct = Math.min(100, (Math.log10(g + 0.1) / Math.log10(maxG + 0.1)) * 100);
        this.fields.gravBar.style.width = barPct + '%';
        this.fields.gravBar.style.background = barColor;

        // Marcador da Terra (g = 1.0)
        const earthPct = (Math.log10(1.0 + 0.1) / Math.log10(maxG + 0.1)) * 100;
        if (this.fields.gravEarth) {
            this.fields.gravEarth.style.left = earthPct + '%';
        }

        // Descrição
        let desc;
        if (g < 0.3) desc = 'Gravidade muito baixa. O astronauta flutua com facilidade.';
        else if (g < 0.8) desc = 'Gravidade baixa. Pulos altíssimos e movimentos leves.';
        else if (g < 1.3) desc = 'Gravidade similar à Terra. Confortável para humanos.';
        else if (g < 3.0) desc = 'Gravidade elevada. Esforço físico significativo.';
        else if (g < 10) desc = 'Gravidade extrema. Movimentação quase impossível.';
        else desc = 'Gravidade esmagadora. Letal sem exoesqueleto assistido.';
        
        this.fields.astroNote.textContent = desc;
    }

    // ---- ANIMAÇÃO DO ASTRONAUTA ----

    _startAstroAnimation(gravity) {
        this._stopAstroAnimation();
        if (!this.ctx) return;

        const g = gravity || 1.0;
        const jumpHeight = ASTRO_BASE_JUMP / Math.sqrt(g);
        const cycleSpeed = ASTRO_BASE_SPEED * Math.sqrt(g);

        const animate = () => {
            this.time += cycleSpeed;
            const ctx = this.ctx;
            const w = ASTRO_CANVAS_W;
            const h = ASTRO_CANVAS_H;

            ctx.clearRect(0, 0, w, h);

            // Chão
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(0, h - 4, w, 4);

            // Calcular Y do pulo
            const phase = Math.max(0, Math.sin(this.time));
            const y = h - 4 - phase * jumpHeight;

            // Sombra no chão (diminui com a altura)
            const shadowAlpha = 0.15 * (1 - phase * 0.6);
            const shadowW = 14 * (1 - phase * 0.3);
            ctx.beginPath();
            ctx.ellipse(w / 2, h - 2, shadowW, 3, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${shadowAlpha})`;
            ctx.fill();

            // Corpo do astronauta
            const cx = w / 2;
            const bodyH = 16;
            const bodyW = 10;

            // Corpo
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(cx - bodyW / 2, y - bodyH, bodyW, bodyH, 3);
            ctx.fill();

            // Capacete
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = '#080810';
            ctx.beginPath();
            ctx.arc(cx, y - bodyH - 4, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Visor
            ctx.fillStyle = 'rgba(96,165,250,0.5)';
            ctx.beginPath();
            ctx.arc(cx + 1, y - bodyH - 4, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Pernas (movem quando no ar)
            const legSpread = phase * 4;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            // Perna esquerda
            ctx.beginPath();
            ctx.moveTo(cx - 2, y);
            ctx.lineTo(cx - 2 - legSpread, y + 8);
            ctx.stroke();
            // Perna direita
            ctx.beginPath();
            ctx.moveTo(cx + 2, y);
            ctx.lineTo(cx + 2 + legSpread, y + 8);
            ctx.stroke();

            this.animFrame = requestAnimationFrame(animate);
        };

        this.animFrame = requestAnimationFrame(animate);
    }

    _stopAstroAnimation() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
        this.time = 0;
    }
}
