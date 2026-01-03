class ResumeSection extends HTMLElement {
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
                background: #f5f4f2; /* Warm subtle grey for separation */
            }

            .container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 0 2rem;
            }

            h2 {
                font-size: 2.5rem;
                margin-bottom: 3rem;
                color: var(--text-main, #27272a);
            }

            .grid {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 4rem;
            }

            .sidebar {
                display: flex;
                flex-direction: column;
                gap: 2rem;
            }

            .card {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                border: 1px solid var(--border-color, #ddd1c7);
            }

            h3 { margin-bottom: 1rem; color: var(--text-main, #27272a); }
            
            ul {
                list-style: none;
                padding: 0;
                margin: 0;
                color: var(--text-muted, #52525b);
                font-size: 0.95rem;
            }

            li { margin-bottom: 0.5rem; }

            .timeline-item {
                margin-bottom: 3rem;
                padding-left: 2rem;
                border-left: 2px solid var(--primary, #4a5c44);
                position: relative;
            }

            .timeline-item::before {
                content: '';
                position: absolute;
                left: -7px;
                top: 0;
                width: 12px;
                height: 12px;
                background: var(--primary, #4a5c44);
                border-radius: 50%;
            }

            .year {
                font-weight: 700;
                color: var(--primary, #4a5c44);
                margin-bottom: 0.5rem;
                display: block;
                font-size: 0.9rem;
            }

            .role { font-size: 1.5rem; margin-bottom: 0.25rem; color: var(--text-main, #27272a); }
            .company { font-weight: 600; color: var(--text-muted, #52525b); margin-bottom: 1rem; display: block; }

            p { color: var(--text-muted); line-height: 1.6; }

            @media (max-width: 850px) {
                .grid { grid-template-columns: 1fr; gap: 2rem; }
            }
        </style>
        <div class="container">
            <h2>Resume</h2>
            <div class="grid">
                <div class="sidebar">
                    <div class="card">
                        <h3>Technical Skills</h3>
                        <ul>
                            <li><strong>Languages:</strong> Java, C/C++, TypeScript, Python, SQL, HTML/CSS</li>
                            <li><strong>Frameworks:</strong> Node.js, Vue, Jest, Material-UI, FastAPI</li>
                            <li><strong>Technologies:</strong> AWS, Azure, Docker, Kubernetes, Salesforce, Git</li>
                        </ul>
                    </div>
                    <div class="card" style="margin-top: 2rem;">
                        <h3>Certifications</h3>
                        <ul>
                            <li>CompTIA Security+</li>
                            <li>Scrum Master</li>
                            <li>ServiceNow Administrator</li>
                            <li>Salesforce Multi-Certified (Admin, Dev, Architect, Consultant)</li>
                        </ul>
                    </div>
                    <div class="card" style="margin-top: 2rem;">
                        <h3>Education</h3>
                        <ul>
                            <li><strong>M.S. Computer Science</strong><br>Georgia Tech</li>
                            <li><strong>B.S. Industrial Engineering</strong><br>Virginia Tech</li>
                        </ul>
                    </div>
                </div>
                <div class="main-content">
                    <div class="timeline-item">
                        <span class="year">June 2019 - Present</span>
                        <h3 class="role">Senior Software Engineer</h3>
                        <span class="company">KPMG | New York, NY</span>
                        <p>Designed, developed, and deployed full-stack web apps (Node.js, TypeScript, Vue) in DoD Secret environments. Leveraged GitLab CI/CD for Docker/AWS ECS deployments. Led Salesforce development for 5 product teams and acted as Scrum Master for ServiceNow implementations.</p>
                    </div>
                    <div class="timeline-item">
                        <span class="year">June 2018 - August 2018</span>
                        <h3 class="role">Federal Advisory Intern</h3>
                        <span class="company">KPMG | McLean, VA</span>
                        <p>Performed business analysis and operations/maintenance for a full-stack web app, including requirements gathering and SQL testing.</p>
                    </div>
                    <div class="timeline-item">
                        <span class="year">Jan 2023 - Dec 2025</span>
                        <h3 class="role">Master of Science Student</h3>
                        <span class="company">Georgia Institute of Technology</span>
                        <p>Specialized in Distributed Computing, Operating Systems, and High-Performance Computing.</p>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
}

customElements.define('resume-section', ResumeSection);
