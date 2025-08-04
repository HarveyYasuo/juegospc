   document.addEventListener('DOMContentLoaded', () => {
            const navButtons = document.querySelectorAll('.nav-button');
            const contentSections = document.querySelectorAll('.content-section');
            const filterButtons = document.querySelectorAll('.filter-btn');
            const toolGrid = document.getElementById('tool-grid');
            const toolDetails = document.getElementById('tool-details');

            const toolsData = [
                { id: 'chatgpt', name: 'ChatGPT', icon: '💬', category: 'Asistente', description: 'Asistente de IA conversacional avanzado para lluvia de ideas, resumen y análisis de datos.', bestFor: 'Escritores, marketers, analistas, educadores.', reason: 'Su versatilidad y capacidad de análisis de archivos lo hacen indispensable para la productividad diaria.' },
                { id: 'gemini', name: 'Google Gemini', icon: '✨', category: 'Asistente', description: 'Asistente de IA multimodal (texto, código, imagen, video) con razonamiento sofisticado.', bestFor: 'Programadores, creativos, analistas.', reason: 'Su capacidad multimodal permite una creación de contenido y una interacción sin precedentes.' },
                { id: 'copilot', name: 'Microsoft Copilot', icon: ' copiloto', category: 'Asistente', description: 'Suite de productividad integrada en Microsoft 365 para automatizar tareas empresariales.', bestFor: 'Todos los profesionales de negocios (usuarios de M365).', reason: 'Su integración nativa en el ecosistema empresarial lo convierte en el estándar de facto.' },
                { id: 'canva', name: 'Canva Magic Studio', icon: '🎨', category: 'Visual', description: 'Herramientas de diseño gráfico impulsadas por IA para crear visuales profesionales rápidamente.', bestFor: 'Marketers, gerentes de redes sociales, educadores.', reason: 'Democratiza el diseño gráfico, permitiendo crear contenido de marca sin experiencia previa.' },
                { id: 'jasper', name: 'Jasper AI', icon: '✍️', category: 'Contenido', description: 'Plataforma para generación de contenido de marketing de alto volumen con plantillas y conectividad a internet.', bestFor: 'Equipos de marketing, creadores de contenido.', reason: 'Permite escalar operaciones de contenido, logrando una producción sin precedentes.' },
                { id: 'midjourney', name: 'Midjourney', icon: '🖼️', category: 'Visual', description: 'Generador de texto a imagen de alta calidad para crear arte imaginativo y único.', bestFor: 'Artistas, diseñadores, ilustradores.', reason: 'Transforma ideas de texto en arte visualmente impresionante, sirviendo como un socio creativo.' },
                { id: 'synthesia', name: 'Synthesia', icon: '📹', category: 'Visual', description: 'Generador de video con avatares de IA realistas en más de 140 idiomas.', bestFor: 'Equipos de L&D, comunicación interna, ventas.', reason: 'Permite la producción de video escalable sin los costos y la complejidad tradicionales.' },
                { id: 'perplexity', name: 'Perplexity AI', icon: '🔍', category: 'Productividad', description: 'Motor de búsqueda conversacional que proporciona respuestas de alta calidad con fuentes citadas.', bestFor: 'Investigadores, analistas, estudiantes.', reason: 'Ofrece una búsqueda verificable, abordando las preocupaciones de "alucinación" de la IA.' },
                { id: 'fireflies', name: 'Fireflies.ai', icon: '🎙️', category: 'Productividad', description: 'Asistente de reuniones que graba, transcribe y resume conversaciones automáticamente.', bestFor: 'Equipos de ventas, gerentes de proyectos, consultores.', reason: 'Transforma las reuniones en activos de conocimiento procesables y buscables.' },
                { id: 'elevenlabs', name: 'ElevenLabs', icon: '🗣️', category: 'Visual', description: 'Generador de voz y clonación de voz ultrarrealista y expresiva en más de 30 idiomas.', bestFor: 'Creadores de contenido, productores de audiolibros.', reason: 'Permite experiencias de audio hiperpersonalizadas y emocionalmente resonantes.' },
            ];

            function switchTab(targetId) {
                contentSections.forEach(section => {
                    section.classList.toggle('active', section.id === `content-${targetId}`);
                });
                navButtons.forEach(button => {
                    button.classList.toggle('active', button.dataset.target === targetId);
                });
            }

            navButtons.forEach(button => {
                button.addEventListener('click', () => switchTab(button.dataset.target));
            });

            function renderTools(filter = 'all') {
                toolGrid.innerHTML = '';
                const filteredTools = filter === 'all' ? toolsData : toolsData.filter(t => t.category === filter);

                filteredTools.forEach(tool => {
                    const toolCard = document.createElement('button');
                    toolCard.className = 'tool-card card p-4 flex flex-col items-center justify-center text-center aspect-square';
                    toolCard.dataset.id = tool.id;
                    toolCard.innerHTML = `
                        <div class="text-4xl mb-2">${tool.icon}</div>
                        <h4 class="font-semibold text-sm">${tool.name}</h4>
                    `;
                    toolCard.addEventListener('click', () => {
                        renderToolDetails(tool.id);
                        document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
                        toolCard.classList.add('active');
                    });
                    toolGrid.appendChild(toolCard);
                });
            }

            function renderToolDetails(toolId) {
                const tool = toolsData.find(t => t.id === toolId);
                if (tool) {
                    toolDetails.innerHTML = `
                        <div class="w-full">
                            <div class="flex items-center mb-4">
                                <div class="text-5xl mr-4">${tool.icon}</div>
                                <h3 class="text-2xl font-bold text-gray-800">${tool.name}</h3>
                            </div>
                            <p class="text-gray-600 mb-4">${tool.description}</p>
                            <div class="text-sm space-y-3">
                                <p><strong class="text-gray-700">Ideal para:</strong> ${tool.bestFor}</p>
                                <p><strong class="text-gray-700">Por qué destaca:</strong> ${tool.reason}</p>
                            </div>
                        </div>
                    `;
                }
            }

            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const filter = button.dataset.filter;
                    renderTools(filter);
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                });
            });

            const createSalaryChart = () => {
                const ctx = document.getElementById('salaryChart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Salario Base (No-Tecnológico)', 'Salario con Habilidades de IA'],
                        datasets: [{
                            label: 'Salario Anual Promedio (USD)',
                            data: [64285, 82285],
                            backgroundColor: ['rgba(129, 140, 248, 0.6)', 'rgba(79, 70, 229, 0.6)'],
                            borderColor: ['rgba(129, 140, 248, 1)', 'rgba(79, 70, 229, 1)'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value / 1000 + 'k';
                                    }
                                }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                        }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            };

            const createDataReadinessChart = () => {
                const ctx = document.getElementById('dataReadinessChart').getContext('2d');
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Datos No Listos para IA', 'Datos Listos para IA'],
                        datasets: [{
                            data: [57, 43],
                            backgroundColor: ['rgba(251, 113, 133, 0.7)', 'rgba(79, 70, 229, 0.7)'],
                            borderColor: ['#f43f5e', '#4f46e5'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return `${context.label}: ${context.raw}%`;
                                    }
                                }
                            }
                        }
                    }
                });
            };

            switchTab('inicio');
            renderTools('all');
            document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
            createSalaryChart();
            createDataReadinessChart();
        });