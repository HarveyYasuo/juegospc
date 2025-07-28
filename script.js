document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    const searchInput = startMenu.querySelector('input[type="text"]');
    const clockElement = document.getElementById('clock');
    const explorerIcon = document.getElementById('explorer-icon');
    const youtubeIcon = document.getElementById('youtube-icon');
    const appsGrid = document.querySelector('.apps-grid');
    const pinnedApps = document.querySelector('.pinned-apps');
    const audioVisualizer = document.getElementById('audio-visualizer');
    const settingsBtn = document.getElementById('settings-btn');
    const taskViewBtn = document.getElementById('task-view-btn'); // Nuevo
    const taskView = document.getElementById('task-view'); // Nuevo
    const taskViewGrid = document.querySelector('.task-view-grid'); // Nuevo

    let currentPage = 1;
    let isLoading = false;
    let currentSearchTerm = '';
    let debounceTimer;
    let allItemsLoaded = false; // Flag para la nueva vista

    // --- Contenido de las páginas estáticas ---
    let aboutContent = '', termsContent = '', privacyContent = '';
    async function loadStaticPages() {
        try {
            const [aboutRes, termsRes, privacyRes] = await Promise.all([
                fetch('about.html'), fetch('terms.html'), fetch('privacy.html')
            ]);
            aboutContent = await aboutRes.text();
            termsContent = await termsRes.text();
            privacyContent = await privacyRes.text();
        } catch (error) { console.error("Error al cargar las páginas estáticas:", error); }
    }
    loadStaticPages();

    // --- Carga de Items para el Menú de Inicio (Paginado) ---
    async function loadGames(searchTerm = '') {
        if (isLoading) return;
        isLoading = true;
        if (currentSearchTerm !== searchTerm) {
            appsGrid.innerHTML = '';
            currentPage = 1;
            currentSearchTerm = searchTerm;
            pinnedApps.scrollTop = 0;
        }
        try {
            const API_BASE_URL = "https://unbiased-tough-mayfly.ngrok-free.app/";
            let url = `${API_BASE_URL}get_items.php?category=juegos&limit=12&page=${currentPage}`;
            if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
            const response = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
            if (!response.ok) throw new Error(`Error de red: ${response.status}`);
            const games = await response.json();
            if (games.length === 0) {
                if (currentPage === 1) appsGrid.innerHTML = '<p style="color: white;">No se encontraron resultados.</p>';
                isLoading = false;
                return;
            }
            games.forEach(game => {
                const gameCard = document.createElement('div');
                gameCard.className = 'game-card';
                gameCard.style.backgroundImage = `url('${game.enlace_imagen}')`;
                const downloadUrl = game.enlace_sitio || '#';
                gameCard.innerHTML = `<div class="game-card-content"><h4 class="game-card-title">${game.titulo}</h4><button class="play-button" data-url="${downloadUrl}">Descargar</button></div>`;
                appsGrid.appendChild(gameCard);
            });
            currentPage++;
        } catch (error) {
            console.error('Error al cargar los juegos:', error);
            if (currentPage === 1) appsGrid.innerHTML = '<p style="color: white;">No se pudieron cargar los juegos.</p>';
        } finally {
            isLoading = false;
        }
    }

    // --- Carga de TODOS los Items para la Vista de Tareas ---
    async function loadAllItems() {
        if (allItemsLoaded) return;
        try {
            const API_BASE_URL = "https://unbiased-tough-mayfly.ngrok-free.app/";
            // Pedimos todos los items de todas las categorías sin límite
            const response = await fetch(`${API_BASE_URL}get_items.php?category=all&limit=none`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (!response.ok) throw new Error(`Error de red: ${response.status}`);
            const items = await response.json();
            
            taskViewGrid.innerHTML = ''; // Limpiar por si acaso
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'task-view-item';
                itemEl.style.backgroundImage = `url('${item.enlace_imagen}')`;

                // Asignar clases de tamaño aleatoriamente para el efecto mosaico
                const rand = Math.random();
                if (rand < 0.1) itemEl.classList.add('large');
                else if (rand < 0.2) itemEl.classList.add('wide');

                itemEl.innerHTML = `
                    <div class="task-view-item-content">
                        <h4>${item.titulo}</h4>
                        <p>${item.category}</p>
                    </div>
                `;
                taskViewGrid.appendChild(itemEl);
            });
            allItemsLoaded = true;
        } catch (error) {
            console.error('Error al cargar todos los items:', error);
            taskViewGrid.innerHTML = '<p style="color: white;">No se pudo cargar el contenido.</p>';
        }
    }

    // --- Lógica de Búsqueda con Debounce ---
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = searchInput.value.trim();
            loadGames(searchTerm);
        }, 300);
    });

    // --- Scroll Infinito (Menú de Inicio) ---
    pinnedApps.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = pinnedApps;
        if (scrollTop + clientHeight >= scrollHeight - 20 && !isLoading) {
            loadGames(currentSearchTerm);
        }
    });

    // --- Event Listeners ---
    appsGrid.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('play-button')) {
            const url = e.target.dataset.url;
            if (url && url !== '#') window.open(url, '_blank');
            else alert('No hay una URL de descarga disponible para este juego.');
        }
    });

    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        taskView.classList.add('hidden'); // Ocultar la otra vista si está abierta
        startMenu.classList.toggle('hidden');
        if (!startMenu.classList.contains('hidden') && currentPage === 1) {
            loadGames();
        }
    });

    taskViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.add('hidden'); // Ocultar la otra vista si está abierta
        taskView.classList.toggle('hidden');
        if (!taskView.classList.contains('hidden') && !allItemsLoaded) {
            loadAllItems();
        }
    });

    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && !startMenu.classList.contains('hidden')) {
            startMenu.classList.add('hidden');
        }
        if (!taskView.contains(e.target) && !taskView.classList.contains('hidden')) {
            taskView.classList.add('hidden');
        }
    });

    // --- Reloj en Tiempo Real ---
    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = ((hours + 11) % 12 + 1);
        clockElement.textContent = `${formattedHours}:${minutes} ${ampm}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Lógica de las Ventanas ---
    let activeWindow = null, offsetX, offsetY;
    function createWindow(id, title, content, options = {}) {
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        if (options.isModal) windowEl.classList.add('modal-window');
        windowEl.id = `window-${id}`;
        windowEl.style.left = options.left || `${Math.random() * 200 + 50}px`;
        windowEl.style.top = options.top || `${Math.random() * 100 + 50}px`;
        if (options.width) windowEl.style.width = options.width;
        if (options.height) windowEl.style.height = options.height;
        windowEl.innerHTML = `<div class="window-header"><span class="window-title">${title}</span><div class="window-controls">${options.isModal ? '' : '<button class="minimize-btn">-</button><button class="maximize-btn">□</button>'}<button class="close-btn">×</button></div></div><div class="window-body">${content}</div>${options.footer || ''}`;
        desktop.appendChild(windowEl);
        const closeBtn = windowEl.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            desktop.removeChild(windowEl);
            if (id === 'youtube') audioVisualizer.classList.add('hidden');
        });
        const header = windowEl.querySelector('.window-header');
        header.addEventListener('mousedown', (e) => {
            activeWindow = windowEl;
            offsetX = e.clientX - activeWindow.offsetLeft;
            offsetY = e.clientY - activeWindow.offsetTop;
            document.querySelectorAll('.window').forEach(w => w.style.zIndex = '10');
            activeWindow.style.zIndex = '20';
        });
    }
    document.addEventListener('mousemove', (e) => {
        if (activeWindow) {
            activeWindow.style.left = `${e.clientX - offsetX}px`;
            activeWindow.style.top = `${e.clientY - offsetY}px`;
        }
    });
    document.addEventListener('mouseup', () => { activeWindow = null; });

    explorerIcon.addEventListener('click', () => createWindow('explorer', 'Explorador de Archivos', '<p>Contenido del explorador...</p>'));
    youtubeIcon.addEventListener('dblclick', () => {
        if (document.getElementById('window-youtube')) return;
        const youtubeContent = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        createWindow('youtube', 'YouTube', youtubeContent);
        audioVisualizer.classList.remove('hidden');
    });

    settingsBtn.addEventListener('click', () => {
        if (document.getElementById('window-about-main')) return;
        const aboutWindowContent = `<div class="about-content"><div class="about-header"><i class="fab fa-windows"></i><h2>GamesOG</h2></div><p>Versión 1.0 (Compilación SO 2024.07)</p><p>© Harvey & OptiProjects. Todos los derechos reservados.</p><p>El sistema operativo GamesOG y su interfaz de usuario están protegidos por las leyes de marca comercial y otros derechos de propiedad intelectual.</p><p>La licencia de este producto se concede de acuerdo con los <a href="#" id="terms-link">Términos de Servicio</a> y la <a href="#" id="privacy-link">Política de Privacidad</a>.</p><p>Licencia para: harveyrivas66@gmail.com</p></div>`;
        const aboutWindowFooter = `<div class="window-footer"><button class="accept-btn">Aceptar</button></div>`;
        createWindow('about-main', 'Acerca de GamesOG', aboutWindowContent, { isModal: true, footer: aboutWindowFooter, width: '500px', height: 'auto' });
        const aboutWindow = document.getElementById('window-about-main');
        aboutWindow.querySelector('.accept-btn').addEventListener('click', () => desktop.removeChild(aboutWindow));
        aboutWindow.querySelector('#terms-link').addEventListener('click', (e) => {
            e.preventDefault();
            createWindow('terms', 'Térmimos de Servicio', termsContent, { width: '800px', height: '600px' });
        });
        aboutWindow.querySelector('#privacy-link').addEventListener('click', (e) => {
            e.preventDefault();
            createWindow('privacy', 'Política de Privacidad', privacyContent, { width: '800px', height: '600px' });
        });
    });
});