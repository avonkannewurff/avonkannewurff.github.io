class AboutSection extends HTMLElement {
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
                padding: 0;
            }

            .container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 0 2rem;
            }

            .hero {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }

            h1 {
                font-size: clamp(2.5rem, 8vw, 4.5rem);
                line-height: 1.1;
                margin: 0;
                color: var(--text-main, #27272a);
            }

            .highlight {
                color: var(--primary, #4a5c44);
            }

            p {
                font-size: 1.25rem;
                max-width: 650px;
                color: var(--text-muted, #52525b);
                margin: 0 0 1rem 0;
                line-height: 1.6;
            }

            .cta-group {
                display: flex;
                gap: 1rem;
                margin-top: 1rem;
            }

            .btn {
                padding: 0.8rem 2rem;
                border-radius: 4px;
                font-weight: 600;
                text-decoration: none;
                transition: all 0.3s ease;
                display: inline-block;
            }

            .btn-primary {
                background: var(--primary, #4a5c44);
                color: white;
            }

            .btn-primary:hover {
                background: var(--primary-dark, #2d3b2a);
            }

            .btn-outline {
                border: 1px solid var(--border-color, #ddd1c7);
                color: var(--text-main, #27272a);
            }

            .btn-outline:hover {
                background: var(--bg-body, #f5f4f0);
            }

            @media (max-width: 768px) {
                :host { padding: 60px 0; }
                .container { padding: 0 1rem; }
            }
        </style>
        <div class="container hero">
            <h1>Systems <span class="highlight">thinking</span>.</h1>
            <p>
                I'm Adam von Kannewurff, a software developer focused on web and systems applications.
            </p>
            <div class="cta-group">
                <a href="#resume" class="btn btn-outline">My Resume</a>
                <a href="#projects" class="btn btn-primary">View Projects</a>
            </div>
        </div>
        `;

        // Delegate link clicks to main window for SPA smooth scroll
        this.shadowRoot.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const headerOffset = 70;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    history.pushState(null, null, link.getAttribute('href'));
                }
            });
        });
    }
}

customElements.define('about-section', AboutSection);
