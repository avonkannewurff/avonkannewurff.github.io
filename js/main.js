// Import shared UI components
import './components/Navigation.js';
import './components/Footer.js';
import './components/ProjectCard.js';

// Import Section components for SPA
import './components/AboutSection.js';
import './components/ResumeSection.js';
import './components/ProjectsSection.js';

// Global scroll reveal and smooth scroll logic
document.addEventListener('DOMContentLoaded', () => {
    // Scroll Reveal implementation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Initial check for elements
    const observeElements = () => {
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    };

    // Web Components might render after DOMContentLoaded
    setTimeout(observeElements, 100);

    // Handle initial hash in URL
    if (window.location.hash) {
        setTimeout(() => {
            const id = window.location.hash.substring(1);
            const target = document.getElementById(id);
            if (target) {
                const headerHeight = 70;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
                window.scrollTo({ top: offsetPosition, behavior: 'auto' });
            }
        }, 300);
    }
});
