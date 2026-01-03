class ProjectCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return ['title', 'description', 'image', 'link', 'tags'];
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const title = this.getAttribute('title') || 'Project Title';
        const description = this.getAttribute('description') || 'Project description goes here...';
        const image = this.getAttribute('image') || 'https://via.placeholder.com/600x400?text=Project+Image';
        const link = this.getAttribute('link') || '#';
        const tags = this.getAttribute('tags') ? this.getAttribute('tags').split(',') : [];

        this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: block;
                height: 100%;
            }

            .card {
                background: var(--bg-surface, #ffffff);
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: var(--radius-md, 8px);
                overflow: hidden;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            .card:hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-md, 0 10px 15px -3px rgba(0,0,0,0.1));
            }

            .image-container {
                width: 100%;
                aspect-ratio: 16 / 9;
                overflow: hidden;
            }

            img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.5s ease;
            }

            .card:hover img {
                transform: scale(1.05);
            }

            .content {
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                flex-grow: 1;
            }

            h3 {
                margin: 0 0 0.5rem 0;
                color: var(--text-main, #27272a);
                font-size: 1.25rem;
            }

            p {
                color: var(--text-muted, #52525b);
                font-size: 0.95rem;
                margin-bottom: 1.5rem;
                flex-grow: 1;
            }

            .tags {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }

            .tag {
                background: var(--bg-body, #f5f4f0);
                border: 1px solid var(--border-color, #ddd1c7);
                color: var(--text-muted, #52525b);
                padding: 0.2rem 0.6rem;
                border-radius: 100px;
                font-size: 0.75rem;
                font-weight: 500;
            }

            .link {
                color: var(--primary, #4a5c44);
                font-weight: 600;
                text-decoration: none;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }

            .link:hover {
                text-decoration: underline;
            }
        </style>
        <div class="card">
            <div class="image-container">
                <img src="${image}" alt="${title}">
            </div>
            <div class="content">
                <div class="tags">
                    ${tags.map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
                </div>
                <h3>${title}</h3>
                <p>${description}</p>
                <a href="${link}" class="link">View Project &rarr;</a>
            </div>
        </div>
        `;
    }
}

customElements.define('project-card', ProjectCard);
