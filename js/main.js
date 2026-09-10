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
        // CSS light-dark() can't be read back from JS as two values, and the
        // <canvas> in js/tank/ has to retint its ground marks to stay visible
        // against the new background. Nothing else listens for this.
        document.dispatchEvent(new CustomEvent('themechange'));
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

    /* ---------------------------------------------------------------
       Whimsy: the drivable tank (js/tank/, see README).

       Deliberately deferred until after `load` and then to idle time.
       boot.js is a couple of KB and decides whether the tank should come
       out at all; only if it should does it pull in Three.js. Nothing
       here touches the critical path.
       --------------------------------------------------------------- */
    const bootTank = () => import('./tank/boot.js')
        .then(m => m.init())
        .catch(err => console.warn('[tank] unavailable', err));

    const scheduleTank = () => 'requestIdleCallback' in window
        ? requestIdleCallback(bootTank, { timeout: 3000 })
        : setTimeout(bootTank, 400);

    if (document.readyState === 'complete') scheduleTank();
    else window.addEventListener('load', scheduleTank, { once: true });
});
