// Progressive-enhancement layer.
// All content renders from static HTML in index.html + css/index.css.
// This script only ENHANCES: scroll-reveal animation, theme toggle, and
// minor niceties. The site is fully functional with this file absent.

document.addEventListener('DOMContentLoaded', () => {
    /* ---------------------------------------------------------------
       Scroll reveal
       The .reveal sections start hidden only when JS is active (html.js,
       set inline in <head>); the observer fades them in on scroll.
       --------------------------------------------------------------- */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    /* ---------------------------------------------------------------
       Theme toggle (light/dark) with persistence
       --------------------------------------------------------------- */
    const themeBtns = document.querySelectorAll('.theme-toggle');
    const sunIcons = document.querySelectorAll('.site-nav .sun-icon');
    const moonIcons = document.querySelectorAll('.site-nav .moon-icon');

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const isDarkActive = () => {
        const scheme = getComputedStyle(document.documentElement).colorScheme;
        return scheme === 'dark' || (scheme === 'light dark' && prefersDark.matches);
    };

    const updateIcons = () => {
        const dark = isDarkActive();
        sunIcons.forEach(icon => icon.style.display = dark ? 'block' : 'none');
        moonIcons.forEach(icon => icon.style.display = dark ? 'none' : 'block');
    };

    updateIcons();
    prefersDark.addEventListener('change', updateIcons);

    themeBtns.forEach(btn => btn.addEventListener('click', () => {
        const newTheme = isDarkActive() ? 'light' : 'dark';
        document.documentElement.style.colorScheme = newTheme;
        localStorage.setItem('theme', newTheme);
        updateIcons();
    }));

    /* ---------------------------------------------------------------
       Minor niceties
       --------------------------------------------------------------- */
    // Close the mobile menu after a nav link is tapped.
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle) {
        document.querySelectorAll('#nav-links a').forEach(link => {
            link.addEventListener('click', () => { navToggle.checked = false; });
        });
    }

    // Keep the footer year current.
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});
