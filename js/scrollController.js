/**
 * scrollController.js — Controlador de scroll cinemático
 * 
 * Gerencia a navegação entre slides do storytelling:
 * - Wheel/touch com cooldown
 * - Fade in/out de slides HTML
 * - Navegação por dots laterais
 * - Barra de progresso
 * - Indicador de ano
 */

export class ScrollController {
    constructor({ totalSlides, onSlideChange, cooldownMs = 1200 }) {
        this.totalSlides = totalSlides;
        this.currentSlide = 0;
        this.locked = false;
        this.cooldownMs = cooldownMs;
        this.lastScrollTime = 0;
        this.onSlideChange = onSlideChange;
        this.active = true;

        // Touch tracking
        this.touchStartY = 0;

        // DOM refs
        this.slides = [];
        this.navDots = [];
        this.progressBar = null;
        this.yearIndicator = null;

        // Year labels por slide
        this.yearLabels = ['', '1950', '1990 – 2009', 'Hoje'];
    }

    // =========================================
    // INICIALIZAÇÃO
    // =========================================

    init() {
        this._cacheSlides();
        this._buildNavDots();
        this._bindProgressBar();
        this._bindYearIndicator();
        this._bindEvents();
        this._showSlide(0);
    }

    // =========================================
    // NAVEGAÇÃO
    // =========================================

    goTo(index) {
        if (this.locked || index === this.currentSlide) return;
        if (index < 0 || index >= this.totalSlides) return;

        this.locked = true;

        // Fade out current
        const current = this.slides[this.currentSlide];
        if (current) {
            current.classList.remove('active');
        }

        // Pequeno delay para o crossfade
        setTimeout(() => {
            this.currentSlide = index;
            this._showSlide(index);
            this._updateNav();

            // Notifica o callback
            if (this.onSlideChange) {
                this.onSlideChange(index);
            }

            // Desbloqueia após a transição
            setTimeout(() => {
                this.locked = false;
            }, 600);
        }, 350);
    }

    next() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.goTo(this.currentSlide + 1);
        }
    }

    prev() {
        if (this.currentSlide > 0) {
            this.goTo(this.currentSlide - 1);
        }
    }

    getCurrentSlide() {
        return this.currentSlide;
    }

    // =========================================
    // ATIVAÇÃO / DESATIVAÇÃO
    // =========================================

    enable() {
        this.active = true;
    }

    disable() {
        this.active = false;
    }

    // =========================================
    // INTERNOS
    // =========================================

    _cacheSlides() {
        for (let i = 0; i < this.totalSlides; i++) {
            const el = document.getElementById(`slide-${i}`);
            if (el) this.slides.push(el);
        }
    }

    _showSlide(index) {
        this.slides.forEach((slide, i) => {
            if (i === index) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });
    }

    _buildNavDots() {
        const container = document.getElementById('nav-dots');
        if (!container) return;

        container.innerHTML = '';
        for (let i = 0; i < this.totalSlides; i++) {
            const dot = document.createElement('button');
            dot.className = `nav-dot${i === 0 ? ' active' : ''}`;
            dot.setAttribute('aria-label', `Ir para slide ${i + 1}`);
            dot.addEventListener('click', () => this.goTo(i));
            container.appendChild(dot);
            this.navDots.push(dot);
        }
    }

    _bindProgressBar() {
        this.progressBar = document.getElementById('progress-bar');
    }

    _bindYearIndicator() {
        this.yearIndicator = document.getElementById('year-indicator');
    }

    _updateNav() {
        // Dots
        this.navDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentSlide);
        });

        // Progress bar
        if (this.progressBar) {
            const pct = (this.currentSlide / (this.totalSlides - 1)) * 100;
            this.progressBar.style.width = `${pct}%`;
        }

        // Year indicator
        if (this.yearIndicator) {
            const label = this.yearLabels[this.currentSlide] || '';
            this.yearIndicator.textContent = label;
            this.yearIndicator.classList.toggle('visible', !!label);
        }
    }

    _bindEvents() {
        // Wheel
        window.addEventListener('wheel', (e) => this._handleWheel(e), { passive: false });

        // Touch
        window.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: true });
        window.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: true });

        // Keyboard (setas)
        window.addEventListener('keydown', (e) => {
            if (!this.active) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                this._attemptNext();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prev();
            }
        });
    }

    _handleWheel(e) {
        if (!this.active) return;
        e.preventDefault();

        const now = Date.now();
        if (now - this.lastScrollTime < this.cooldownMs) return;

        if (e.deltaY > 30) {
            this._attemptNext();
            this.lastScrollTime = now;
        } else if (e.deltaY < -30) {
            this.prev();
            this.lastScrollTime = now;
        }
    }

    _handleTouchStart(e) {
        this.touchStartY = e.touches[0].clientY;
    }

    _handleTouchEnd(e) {
        if (!this.active) return;
        const diff = this.touchStartY - e.changedTouches[0].clientY;

        const now = Date.now();
        if (now - this.lastScrollTime < this.cooldownMs) return;

        if (diff > 50) {
            this._attemptNext();
            this.lastScrollTime = now;
        } else if (diff < -50) {
            this.prev();
            this.lastScrollTime = now;
        }
    }

    /**
     * Tenta avançar. Emite evento customizado se estiver no último slide
     * para que o app.js decida o que fazer (ex: sub-scroll no slide 2 para métodos)
     */
    _attemptNext() {
        // Emite evento para o app interceptar (ex: ciclo de métodos no slide 2)
        const event = new CustomEvent('story:attemptNext', {
            detail: { currentSlide: this.currentSlide },
            cancelable: true
        });
        const cancelled = !window.dispatchEvent(event);
        
        // Se não foi cancelado por ninguém, avança normalmente
        if (!cancelled) {
            this.next();
        }
    }
}
