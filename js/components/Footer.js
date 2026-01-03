class AppFooter extends HTMLElement {
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
                background: var(--bg-surface, #faf9f6);
                border-top: 1px solid var(--border-color, #ddd1c7);
                padding: 0;
                height: 35px; /* Half of header height (70px) */
                position: sticky;
                bottom: 0;
                z-index: 900;
                margin-top: 0;
            }

            footer {
                max-width: 1100px;
                margin: 0 auto;
                padding: 0 2rem;
                height: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .social-links {
                display: flex;
                gap: 2rem;
            }

            .social-links a {
                color: var(--text-main, #27272a);
                text-decoration: none;
                font-weight: 600;
                font-size: 0.95rem;
                transition: color 0.3s ease;
            }

            .social-links a:hover {
                color: var(--primary, #4a5c44);
            }

            .copyright {
                color: var(--text-muted, #52525b);
                font-size: 0.9rem;
                font-weight: 400;
            }

            @media (max-width: 600px) {
                footer {
                    flex-direction: column;
                    gap: 1rem;
                }
                .social-links {
                    gap: 1.25rem;
                }
            }
        </style>
        <footer>
            <div class="copyright">
                &copy; ${new Date().getFullYear()} Adam von Kannewurff
            </div>
            <div class="social-links">
                <a href="https://github.com/avonkannewurff" target="_blank">GitHub</a>
                <a href="https://www.linkedin.com/in/avonkannewurff/" target="_blank">LinkedIn</a>
                <a href="mailto:avonkannewurff@gmail.com">Email</a>
            </div>
        </footer>
        `;
    }
}

customElements.define('app-footer', AppFooter);
