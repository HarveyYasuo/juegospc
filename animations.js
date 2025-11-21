/**
 * GamesPC - Advanced Animations & Interactions
 * Apple App Store inspired 3D effects and scroll animations
 */

// Utility: Debounce function for performance
function debounce(func, wait = 10) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utility: Throttle function for scroll events
function throttle(func, limit = 16) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Scroll Reveal Animation
 * Reveals elements as they enter the viewport
 */
class ScrollReveal {
    constructor() {
        this.elements = document.querySelectorAll('.reveal');
        this.windowHeight = window.innerHeight;
        this.init();
    }

    init() {
        // Add reveal class to sections
        const sections = document.querySelectorAll('.features, .app-gallery, .app-features-section, .download-section');
        sections.forEach(section => {
            if (!section.classList.contains('hero')) {
                section.classList.add('reveal');
            }
        });

        // Add reveal to feature items
        const featureItems = document.querySelectorAll('.feature-item, .feature-card');
        featureItems.forEach((item, index) => {
            item.classList.add('reveal');
            item.style.transitionDelay = `${index * 0.1}s`;
        });

        this.checkElements();
        window.addEventListener('scroll', throttle(() => this.checkElements(), 100));
        window.addEventListener('resize', debounce(() => {
            this.windowHeight = window.innerHeight;
            this.checkElements();
        }, 250));
    }

    checkElements() {
        this.elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;

            if (elementTop < this.windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    }
}

/**
 * 3D Card Tilt Effect
 * Creates a 3D tilt effect on cards following mouse movement
 */
class CardTilt {
    constructor(selector) {
        this.cards = document.querySelectorAll(selector);
        this.init();
    }

    init() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => this.handleMouseMove(e, card));
            card.addEventListener('mouseleave', () => this.handleMouseLeave(card));
            card.addEventListener('mouseenter', () => this.handleMouseEnter(card));
        });
    }

    handleMouseMove(e, card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * 10; // Max 10 degrees
        const rotateY = ((centerX - x) / centerX) * 10;

        card.style.transform = `
      perspective(1000px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale3d(1.05, 1.05, 1.05)
    `;
    }

    handleMouseLeave(card) {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        card.style.transition = 'transform 0.5s ease';
    }

    handleMouseEnter(card) {
        card.style.transition = 'none';
    }
}

/**
 * Parallax Effect for Hero Section
 * Creates depth by moving background at different speed
 */
class ParallaxEffect {
    constructor() {
        this.hero = document.querySelector('.hero');
        if (!this.hero) return;

        this.init();
    }

    init() {
        window.addEventListener('scroll', throttle(() => this.updateParallax(), 16));
    }

    updateParallax() {
        const scrolled = window.pageYOffset;
        const parallaxSpeed = 0.5;

        if (this.hero) {
            this.hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
        }
    }
}

/**
 * Smooth Scroll for Anchor Links
 */
class SmoothScroll {
    constructor() {
        this.links = document.querySelectorAll('a[href^="#"]');
        this.init();
    }

    init() {
        this.links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#' || href === '#download-button') return;

                e.preventDefault();
                const target = document.querySelector(href);

                if (target) {
                    const headerOffset = 80;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
}

/**
 * Enhanced Gallery Slider with Touch Support
 */
class EnhancedSlider {
    constructor() {
        this.slider = document.querySelector('.slider');
        this.slides = document.querySelectorAll('.slider img');
        this.dotsContainer = document.querySelector('.slider-dots');

        if (!this.slider || this.slides.length === 0) return;

        this.currentSlide = 0;
        this.isAutoPlaying = true;
        this.autoPlayInterval = null;
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.init();
    }

    init() {
        this.createNavigationButtons();
        this.setupTouchEvents();
        this.startAutoPlay();

        // Pause on hover
        this.slider.parentElement.addEventListener('mouseenter', () => this.pauseAutoPlay());
        this.slider.parentElement.addEventListener('mouseleave', () => this.startAutoPlay());
    }

    createNavigationButtons() {
        const container = this.slider.parentElement;

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.className = 'slider-nav slider-prev';
        prevBtn.setAttribute('aria-label', 'Previous slide');
        prevBtn.addEventListener('click', () => this.previousSlide());

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.className = 'slider-nav slider-next';
        nextBtn.setAttribute('aria-label', 'Next slide');
        nextBtn.addEventListener('click', () => this.nextSlide());

        container.appendChild(prevBtn);
        container.appendChild(nextBtn);

        // Add styles
        this.addNavigationStyles();
    }

    addNavigationStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .slider-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 10;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
      }
      
      .slider-nav:hover {
        background: rgba(0, 123, 255, 0.8);
        transform: translateY(-50%) scale(1.1);
      }
      
      .slider-prev {
        left: 20px;
      }
      
      .slider-next {
        right: 20px;
      }
      
      @media (max-width: 768px) {
        .slider-nav {
          width: 40px;
          height: 40px;
          font-size: 1rem;
        }
        
        .slider-prev {
          left: 10px;
        }
        
        .slider-next {
          right: 10px;
        }
      }
    `;
        document.head.appendChild(style);
    }

    setupTouchEvents() {
        this.slider.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.pauseAutoPlay();
        });

        this.slider.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
            this.startAutoPlay();
        });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.nextSlide();
            } else {
                this.previousSlide();
            }
        }
    }

    nextSlide() {
        this.currentSlide = (this.currentSlide + 1) % this.slides.length;
        this.updateDots();
    }

    previousSlide() {
        this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
        this.updateDots();
    }

    updateDots() {
        if (this.dotsContainer) {
            const dots = this.dotsContainer.querySelectorAll('span');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentSlide);
            });
        }
    }

    startAutoPlay() {
        if (this.isAutoPlaying) return;

        this.isAutoPlaying = true;
        this.autoPlayInterval = setInterval(() => {
            this.nextSlide();
        }, 4000);
    }

    pauseAutoPlay() {
        this.isAutoPlaying = false;
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
}

/**
 * Animated Counter for Statistics
 */
class AnimatedCounter {
    constructor(selector) {
        this.counters = document.querySelectorAll(selector);
        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        this.counters.forEach(counter => observer.observe(counter));
    }

    animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += step;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };

        updateCounter();
    }
}

/**
 * Performance Monitor
 * Detects low-end devices and reduces animations
 */
class PerformanceMonitor {
    constructor() {
        this.checkPerformance();
    }

    checkPerformance() {
        // Check if device prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Check connection speed
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const slowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

        if (prefersReducedMotion || slowConnection) {
            document.body.classList.add('reduce-animations');
            this.addReducedAnimationStyles();
        }
    }

    addReducedAnimationStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .reduce-animations * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    `;
        document.head.appendChild(style);
    }
}

/**
 * Initialize all animations and effects
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check performance first
    new PerformanceMonitor();

    // Initialize scroll reveal
    new ScrollReveal();

    // Initialize 3D card tilt effect
    new CardTilt('.feature-item');
    new CardTilt('.feature-card');

    // Initialize parallax effect
    new ParallaxEffect();

    // Initialize smooth scroll
    new SmoothScroll();

    // Initialize enhanced slider
    new EnhancedSlider();

    // Add loading animation
    document.body.classList.add('loaded');

    // Log initialization
    console.log('🎨 GamesPC animations initialized');
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ScrollReveal,
        CardTilt,
        ParallaxEffect,
        SmoothScroll,
        EnhancedSlider,
        AnimatedCounter,
        PerformanceMonitor
    };
}
