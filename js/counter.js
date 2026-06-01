/**
 * counter.js — Animação do contador cinemático
 * 
 * Anima o número de exoplanetas confirmados de 0 até o valor alvo
 * com interpolação suave e formatação localizada.
 */

import { TOTAL_DISCOVERIES } from './data.js';

export class Counter {
    constructor(elementId) {
        this.el = document.getElementById(elementId);
        this.timer = null;
        this.target = TOTAL_DISCOVERIES;
    }

    /**
     * Inicia a contagem animada de 0 até o alvo
     */
    start() {
        this.stop();

        if (!this.el) return;

        let value = 0;
        this.el.textContent = '0';

        const step = Math.ceil(this.target / 90);
        const interval = 16;

        this.timer = setInterval(() => {
            value = Math.min(value + step, this.target);
            this.el.textContent = `+${value.toLocaleString('pt-BR')}`;

            if (value >= this.target) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }, interval);
    }

    /**
     * Para a animação em andamento
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Reseta o contador para zero
     */
    reset() {
        this.stop();
        if (this.el) {
            this.el.textContent = '0';
        }
    }
}
