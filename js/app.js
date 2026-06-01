/**
 * app.js — Orquestrador principal da aplicação
 * 
 * Coordena todos os componentes:
 * - ScrollController (navegação cinemática)
 * - StoryCanvas (animações D3 do storytelling)
 * - Dashboard (painel interativo)
 * - Counter (animação de contagem)
 * 
 * Gerencia transições entre a vista de história e o dashboard.
 */

import { STORY_METHODS } from './data.js';
import { ScrollController } from './scrollController.js';
import { StoryCanvas } from './storyCanvas.js';
import { Dashboard } from './dashboard.js';
import { Counter } from './counter.js';

class App {
    constructor() {
        this.storyCanvas = null;
        this.scrollController = null;
        this.dashboard = null;
        this.counter = null;
        this.currentView = 'story'; // 'story' | 'dashboard'
    }

    // =========================================
    // BOOTSTRAP
    // =========================================

    init() {
        // 1. Story Canvas (D3)
        this.storyCanvas = new StoryCanvas('#story-canvas');

        // 2. Counter
        this.counter = new Counter('counter-num');

        // 3. Scroll Controller
        this.scrollController = new ScrollController({
            totalSlides: 4,
            onSlideChange: (idx) => this._onSlideChange(idx),
            cooldownMs: 1200
        });
        this.scrollController.init();

        // 4. Dashboard
        this.dashboard = new Dashboard();
        this.dashboard.init();
        this.dashboard.onBackClick = () => this.transitionToStory();

        // 5. Interceptar scroll no slide 2 (ciclo de métodos)
        window.addEventListener('story:attemptNext', (e) => {
            this._handleMethodCycle(e);
        });

        // 6. Enter button
        const enterBtn = document.getElementById('btn-enter-dashboard');
        if (enterBtn) {
            enterBtn.addEventListener('click', () => this.transitionToDashboard());
        }

        // 7. Animação inicial (slide 0)
        this.storyCanvas.animateSlide0();
    }

    // =========================================
    // SLIDE TRANSITIONS
    // =========================================

    _onSlideChange(index) {
        switch (index) {
            case 0:
                this.storyCanvas.animateSlide0();
                this.storyCanvas.resetMethodIdx();
                this._updateMethodDisplay();
                break;
            case 1:
                this.storyCanvas.animateSlide1();
                break;
            case 2:
                this.storyCanvas.resetMethodIdx();
                this.storyCanvas.animateSlide2(0);
                this._updateMethodDisplay();
                break;
            case 3:
                this.storyCanvas.animateSlide3();
                this.counter.start();
                break;
        }
    }

    /**
     * Intercepta o avanço no slide 2 para ciclar entre métodos
     * antes de avançar para o slide 3
     */
    _handleMethodCycle(e) {
        const currentSlide = this.scrollController.getCurrentSlide();

        if (currentSlide === 2) {
            const hasMore = this.storyCanvas.nextMethod();
            if (hasMore) {
                this._updateMethodDisplay();
                // Cancela o avanço padrão — fica no slide 2
                e.preventDefault();
                return;
            }
            // Se não tem mais métodos, deixa avançar normalmente para slide 3
        }
    }

    /**
     * Atualiza os textos do método no HTML do slide 2
     */
    _updateMethodDisplay() {
        const method = this.storyCanvas.getCurrentMethod();
        if (!method) return;

        const nameEl = document.getElementById('story-method-name');
        const descEl = document.getElementById('story-method-desc');

        if (nameEl) {
            nameEl.textContent = method.name;
            nameEl.style.color = method.color;
        }
        if (descEl) {
            descEl.textContent = method.desc;
        }
    }

    // =========================================
    // VIEW TRANSITIONS (Story <=> Dashboard)
    // =========================================

    transitionToDashboard() {
        if (this.currentView === 'dashboard') return;
        this.currentView = 'dashboard';

        // Desativa scroll do storytelling
        this.scrollController.disable();

        // Fade out story
        const storyView = document.getElementById('story-view');
        storyView.classList.add('fade-out');

        setTimeout(() => {
            storyView.classList.add('hidden');

            // Show dashboard
            this.dashboard.show();
        }, 1000);
    }

    transitionToStory() {
        if (this.currentView === 'story') return;
        this.currentView = 'story';

        // Fade out dashboard
        this.dashboard.hide();

        setTimeout(() => {
            // Mostra story novamente
            const storyView = document.getElementById('story-view');
            storyView.classList.remove('hidden');

            // Pequeno delay para o browser recalcular
            requestAnimationFrame(() => {
                storyView.classList.remove('fade-out');
            });

            // Reativa scroll
            this.scrollController.enable();

            // Volta para o slide 3 (último)
            this.scrollController.goTo(3);
            this.storyCanvas.animateSlide3();
            this.counter.start();
        }, 1000);
    }
}

// =========================================
// BOOT
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
