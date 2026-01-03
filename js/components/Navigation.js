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

            @media (max-width: 600px) {
                ul {
                    gap: 1.25rem;
                }
                nav {
                    padding: 0 1rem;
                }
                .logo {
                    font-size: 1rem;
                }
                a {
                    font-size: 0.85rem;
                }
            }
        </style>
        <nav>
            <a href="#about" class="logo">Adam von Kannewurff</a>
            <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#resume">Resume</a></li>
                <li><a href="#projects">Projects</a></li>
            </ul>
        </nav>
        `;

        // Smooth scroll implementation for shadow DOM links
        this.shadowRoot.querySelectorAll('a').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                if (href.startsWith('#')) {
                    e.preventDefault();
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
