class ProjectsSection extends HTMLElement {
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

            h2 {
                font-size: 2.5rem;
                margin-bottom: 1rem;
                color: var(--text-main, #1a2e05);
            }

            .desc {
                color: var(--text-muted, #365314);
                margin-bottom: 3rem;
                max-width: 600px;
                font-size: 1.1rem;
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 2rem;
            }
        </style>
        <div class="container">
            <h2>Projects</h2>
            <p class="desc">A selection of recent work focusing on clean code and sustainable web standards.</p>

            <div class="grid">
                <project-card 
                    title="Awakening AI - HackOMSCS Winner" 
                    description="AI-powered fridge analysis app using Computer Vision to identify ingredients and recommend recipes. Built with Azure Cloud Services."
                    tags="Azure, Computer Vision, Full Stack"
                    image="../public/hackOMSCS.png"
                    link="#">
                </project-card>

                <project-card 
                    title="Multi-Paxos Implementation" 
                    description="Fault-tolerant distributed consensus algorithm implemented from scratch handling leader election, log replication, and garbage collection."
                    tags="Java, Distributed Systems"
                    image="../public/Paxos_nodes.jpg"
                    link="#">
                </project-card>

                <project-card 
                    title="MapReduce Framework" 
                    description="Distributed data processing framework in C++ using gRPC for worker management, fault tolerance, and data sharding."
                    tags="C++, gRPC, Distributed Computing"
                    image="../public/MapReduce_Server.jpg"
                    link="#">
                </project-card>
            </div>
        </div>
        `;
    }
}

customElements.define('projects-section', ProjectsSection);
