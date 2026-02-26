class AppNav extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: block;
                width: 100%;
                position: fixed;
                top: 0;
                left: 0;
                z-index: 1000;
                background: var(--bg-surface, #ffffff);
                border-bottom: 1px solid var(--border-color, #ddd1c7);
                height: var(--header-height, 70px);
            }

            nav {
                max-width: 1100px;
                margin: 0 auto;
                height: 100%;
                padding: 0 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .logo {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--primary, #4a5c44);
                text-decoration: none;
                letter-spacing: -0.02em;
            }

            ul {
                display: flex;
                gap: 2.5rem;
                list-style: none;
                margin: 0;
                padding: 0;
            }

            a {
                color: var(--text-main, #27272a);
                text-decoration: none;
                font-weight: 600;
                font-size: 0.95rem;
                transition: color 0.3s ease;
                position: relative;
            }

            a:hover {
                color: var(--primary, #4a5c44);
            }

            .nav-left {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            #hamburger-btn {
                display: none;
                background: none;
                border: none;
                padding: 0;
                color: var(--text-main, #27272a);
                cursor: pointer;
            }

            .nav-right {
                display: flex;
                align-items: center;
                gap: 2.5rem;
            }

            @media (max-width: 600px) {
                #hamburger-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                nav {
                    padding: 0 1rem;
                }
                .logo {
                    font-size: 1rem;
                }
                .nav-right {
                    gap: 1rem;
                }
                #nav-links {
                    display: none;
                    position: absolute;
                    top: var(--header-height, 70px);
                    left: 0;
                    width: 100%;
                    flex-direction: column;
                    gap: 0;
                    background: var(--bg-surface, #ffffff);
                    border-bottom: 1px solid var(--border-color, #ddd1c7);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                #nav-links.show {
                    display: flex;
                }
                #nav-links li {
                    width: 100%;
                    padding: 1.25rem 1rem;
                    border-top: 1px solid var(--border-color, #ddd1c7);
                    text-align: left;
                }
                a {
                    font-size: 1rem;
                }
                .nav-btn-group {
                    justify-content: flex-start;
                }
            }

            .nav-btn-group {
                display: flex;
                align-items: center;
            }
            .nav-btn-group .nav-resume-link {
                padding-right: 0.75rem;
            }
            .nav-btn-group .nav-download-link {
                display: flex;
                align-items: center;
                padding-left: 0.75rem;
                border-left: 1px solid var(--border-color, #ddd1c7);
                color: var(--text-muted, #52525b);
            }
            .nav-btn-group .nav-download-link:hover {
                color: var(--primary, #4a5c44);
            }

            #theme-toggle {
                background: none;
                border: none;
                cursor: pointer;
                color: var(--text-main, #27272a);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: color 0.3s ease;
            }
            #theme-toggle:hover {
                color: var(--primary, #4a5c44);
            }
            .sun-icon { display: none; }
            .moon-icon { display: block; }
        </style>
        <nav>
            <div class="nav-left">
                <button id="hamburger-btn" aria-label="Toggle navigation" title="Toggle navigation">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                </button>
                <a href="#about" class="logo">Adam von Kannewurff</a>
            </div>
            <div class="nav-right">
                <ul id="nav-links">
                    <li><a href="#about">About</a></li>
                    <li class="nav-btn-group">
                        <a href="#resume" class="nav-resume-link">Resume</a>
                        <a href="public/Adam von Kannewurff_Resume.pdf" download class="nav-download-link" title="Download Resume" aria-label="Download Resume">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        </a>
                    </li>
                    <li><a href="#projects">Projects</a></li>
                </ul>
                <button id="theme-toggle" aria-label="Toggle theme" title="Toggle theme">
                    <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                </button>
            </div>
        </nav>
        `;

        // Theme toggle logic
        const themeBtn = this.shadowRoot.getElementById('theme-toggle');
        const sunIcon = this.shadowRoot.querySelector('.sun-icon');
        const moonIcon = this.shadowRoot.querySelector('.moon-icon');

        const updateIcons = () => {
            const currentScheme = getComputedStyle(document.documentElement).colorScheme;
            const isDark = currentScheme === 'dark' ||
                (currentScheme === 'light dark' && window.matchMedia('(prefers-color-scheme: dark)').matches);

            if (isDark) {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        };

        // Initial setup and listeners
        updateIcons();
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateIcons);

        // Allow listening for custom theme changes if needed
        document.addEventListener('theme-changed', updateIcons);

        themeBtn.addEventListener('click', () => {
            const currentScheme = getComputedStyle(document.documentElement).colorScheme;
            const isCurrentlyDark = currentScheme === 'dark' ||
                (currentScheme === 'light dark' && window.matchMedia('(prefers-color-scheme: dark)').matches);

            const newTheme = isCurrentlyDark ? 'light' : 'dark';
            document.documentElement.style.colorScheme = newTheme;
            localStorage.setItem('theme', newTheme);

            // Dispatch event for components to react to if needed
            document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: newTheme } }));
            updateIcons();
        });

        // Smooth scroll implementation for shadow DOM links
        const navLinksElement = this.shadowRoot.getElementById('nav-links');

        // Hamburger toggle logic
        const hamburgerBtn = this.shadowRoot.getElementById('hamburger-btn');
        hamburgerBtn.addEventListener('click', () => {
            navLinksElement.classList.toggle('show');
        });

        this.shadowRoot.querySelectorAll('a').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();

                    // Close mobile menu if open
                    navLinksElement.classList.remove('show');

                    const targetId = href.substring(1);
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        // Calculate offset for fixed header
                        const headerHeight = 70;
                        const elementPosition = targetElement.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: "smooth"
                        });

                        // Update URL without jump
                        history.pushState(null, null, href);
                    }
                }
            });
        });
    }
}

customElements.define('app-nav', AppNav);
