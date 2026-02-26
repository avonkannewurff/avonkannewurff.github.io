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
                background: light-dark(#f5f4f2, #18181b); /* Warm subtle grey for separation */
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

            .resume-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 3rem;
            }

            .resume-header h2 {
                margin-bottom: 0;
            }

            .download-btn {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                background: var(--primary, #4a5c44);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 0.95rem;
                transition: background 0.3s ease;
            }

            .download-btn:hover {
                background: var(--primary-dark, #364532);
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
                background: light-dark(white, #27272a);
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

            .timeline-item ul {
                list-style-type: disc;
                padding-left: 1.25rem;
                margin-top: 0.75rem;
                color: var(--text-muted);
                line-height: 1.6;
            }

            .timeline-item li {
                margin-bottom: 0.5rem;
            }

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
            <div class="resume-header">
                <h2>Resume</h2>
                <a href="public/Adam von Kannewurff_Resume.pdf" download class="download-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Download PDF
                </a>
            </div>
            <div class="grid">
                <div class="sidebar">
                    <div class="card">
                        <h3>Technical Skills</h3>
                        <ul>
                            <li><strong>Languages:</strong> Java, C/C++, JavaScript/TypeScript, Python, SQL (Postgres), HTML/CSS</li>
                            <li style="margin-top: 0.5rem;"><strong>Cloud & DevOps:</strong> AWS, Azure, Kubernetes, Docker, Terraform (HCL/CDKTF), GitLab CI/CD, Splunk</li>
                            <li style="margin-top: 0.5rem;"><strong>Frameworks:</strong> Node.js, FastAPI, React, Vue, Vitest, Jest</li>
                        </ul>
                    </div>
                    <div class="card" style="margin-top: 2rem;">
                        <h3>Certifications</h3>
                        <ul>
                            <li><strong>Salesforce:</strong> Architect: Data, Development Lifecycle and Deployment, Sharing and Visibility, Application, +8 other certifications</li>
                            <li style="margin-top: 0.5rem;"><strong>Other:</strong> CompTIA Security+, Scrum Master, ServiceNow Administrator</li>
                        </ul>
                    </div>
                    <div class="card" style="margin-top: 2rem;">
                        <h3>Education</h3>
                        <ul>
                            <li><strong>M.S. Computer Science</strong><br>Georgia Institute of Technology<br><span style="font-size: 0.85em; color: var(--text-muted);">Jan 2023 - Dec 2025</span></li>
                            <li style="margin-top: 0.75rem;"><strong>B.S. Industrial Engineering</strong><br>Virginia Polytechnic Institute and State University<br><span style="font-size: 0.85em; color: var(--text-muted);">Sep 2014 - May 2019</span></li>
                        </ul>
                    </div>
                </div>
                <div class="main-content">
                    <div class="timeline-item">
                        <span class="year">June 2019 - Present</span>
                        <h3 class="role">Senior Software Engineer</h3>
                        <span class="company">KPMG | New York, NY</span>
                        <ul>
                            <li>Orchestrated the consolidation of multiple legacy personnel systems into a unified Salesforce platform; led 5 cross-functional teams to deliver 6 applications, scaling capacity to 300,000 total users and 5,000+ DAU</li>
                            <li>Architected a fleet optimization engine in an IL4 environment using time-series and simulation ML models; reduced planning cycles by 75% and provided stakeholders with predictive insights that replaced reactive legacy workflows</li>
                            <li>Engineered the infrastructure for a multi-million dollar IoT smart warehouse, implementing hyper-converged virtualization to process 1,000+ RFID scans per second via 100+ physical devices using high-availability networking</li>
                            <li>Led 3 teams through enterprise ServiceNow implementation, delivering 5 Healthcare HR applications to 1,000 DAU</li>
                            <li>Developed full-stack MVP accelerator, reducing "Time-to-MVP" time by 50%, contributing to multiple contracts wins</li>
                            <li>Supported migration of CDKTF in-house IaC library to native HCL, enabling continued operations of infrastructure services</li>
                        </ul>
                    </div>
                    <div class="timeline-item">
                        <span class="year">June 2018 - August 2018</span>
                        <h3 class="role">Federal Advisory Intern</h3>
                        <span class="company">KPMG | McLean, VA</span>
                        <ul>
                            <li>Developed framework to facilitate pursuance of software contracts, reducing proposal preparation time by 40%</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
}

customElements.define('resume-section', ResumeSection);
