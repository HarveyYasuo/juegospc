// --- Firebase y Autenticación ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onDisconnect, onValue, serverTimestamp, push, onChildAdded, get, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDXqLCRY6OgcXTXsAR-TvnC4bIICjDndsw",
    authDomain: "todo-en-uno-e79c7.firebaseapp.com",
    projectId: "todo-en-uno-e79c7",
    storageBucket: "todo-en-uno-e79c7.appspot.com",
    messagingSenderId: "122399269850",
    appId: "1:122399269850:web:210049a35cc9abff9fd6e3",
    databaseURL: "https://todo-en-uno-e79c7-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');

    // Cargar fondo de pantalla guardado al iniciar
    const savedWallpaper = localStorage.getItem('desktopWallpaper');
    if (savedWallpaper) {
        desktop.style.backgroundImage = `url('${savedWallpaper}')`;
    }
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    const searchInput = startMenu.querySelector('input[type="text"]');
    const clockElement = document.getElementById('clock');
    const chatIcon = document.getElementById('chat-icon');
    const youtubeIcon = document.getElementById('youtube-icon');
    const appsGrid = document.querySelector('.apps-grid');
    const pinnedApps = document.querySelector('.pinned-apps');
    const audioVisualizer = document.getElementById('audio-visualizer');
    const settingsBtn = document.getElementById('settings-btn');
    const taskViewBtn = document.getElementById('task-view-btn'); // Nuevo
    const taskView = document.getElementById('task-view'); // Nuevo
    const taskViewGrid = document.querySelector('.task-view-grid'); // Nuevo
    const userProfileContainer = document.getElementById('user-profile-container');
    const onlineUsersCount = document.getElementById('online-users-count');

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

    chatIcon.addEventListener('click', () => {
        if (document.getElementById('window-chat')) return; // No abrir si ya existe

        const chatContent = `
            <div class="chat-messages" id="chat-messages-area"></div>
            <div class="chat-input-container">
                <input type="text" id="chat-message-input" placeholder="Escribe un mensaje...">
                <button id="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        createWindow('chat', 'Chat General', chatContent, { width: '400px', height: '600px' });

        const sendBtn = document.getElementById('chat-send-btn');
        const messageInput = document.getElementById('chat-message-input');
        const messagesArea = document.getElementById('chat-messages-area');
        const messagesRef = ref(db, 'messages');

        const sendMessage = () => {
            const user = auth.currentUser;
            if (!user) {
                alert('Debes iniciar sesión para enviar mensajes.');
                return;
            }
            const messageText = messageInput.value.trim();
            if (messageText) {
                push(messagesRef, {
                    text: messageText,
                    timestamp: serverTimestamp(),
                    uid: user.uid,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                });
                messageInput.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        onChildAdded(messagesRef, (snapshot) => {
            const msg = snapshot.val();
            if (!msg || !msg.uid) return; // Ignorar mensajes inválidos o sin UID
            const messageEl = document.createElement('div');
            messageEl.classList.add('chat-message');
            
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === msg.uid) {
                messageEl.classList.add('sent');
            } else {
                messageEl.classList.add('received');
                // Notificar solo si la ventana de chat no está activa o el mensaje es de otro usuario
                if (document.getElementById('window-chat')) {
                    showNotification(`Nuevo mensaje de ${msg.displayName}`);
                }
            }

            messageEl.innerHTML = `
                <img src="${msg.photoURL || 'favicon.png'}" alt="${msg.displayName}" class="chat-avatar" data-uid="${msg.uid}" style="cursor: pointer;">
                <div class="message-content">
                    <div class="message-sender" data-uid="${msg.uid}" style="cursor: pointer;">${msg.displayName}</div>
                    <div class="message-text">${msg.text}</div>
                </div>
            `;
            messagesArea.appendChild(messageEl);

            // Añadir listeners para abrir el perfil (solo si no es un invitado)
            if (!msg.uid.startsWith('guest_')) {
                messageEl.querySelector('.chat-avatar').addEventListener('click', (e) => openProfileWindow(e.target.dataset.uid));
                messageEl.querySelector('.message-sender').addEventListener('click', (e) => openProfileWindow(e.target.dataset.uid));
            }

            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
    });

    youtubeIcon.addEventListener('dblclick', () => {
        if (document.getElementById('window-youtube')) return;
        const youtubeContent = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        createWindow('youtube', 'YouTube', youtubeContent);
        audioVisualizer.classList.remove('hidden');
    });

    settingsBtn.addEventListener('click', () => {
        openSettingsWindow();
    });

    // --- Lógica de Autenticación y Presencia de Firebase ---
    
    function updateUserProfileUI(user) {
        userProfileContainer.innerHTML = ''; // Limpiar el contenedor

        if (user) {
            // Usuario ha iniciado sesión
            const profilePic = document.createElement('img');
            profilePic.src = user.photoURL || 'favicon.png'; // Usa la foto de Google o un avatar por defecto
            profilePic.alt = user.displayName;
            profilePic.style.width = '24px';
            profilePic.style.height = '24px';
            profilePic.style.borderRadius = '50%';
            profilePic.style.marginRight = '8px';

            const userName = document.createElement('span');
            userName.textContent = user.displayName;

            const signOutBtn = document.createElement('button');
            signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            signOutBtn.title = 'Cerrar Sesión';
            signOutBtn.style.background = 'none';
            signOutBtn.style.border = 'none';
            signOutBtn.style.color = 'white';
            signOutBtn.style.cursor = 'pointer';
            signOutBtn.style.marginLeft = '15px';

            signOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userStatusRef = ref(db, '/status/' + user.uid);
                set(userStatusRef, { isOnline: false, last_changed: serverTimestamp() });
                signOut(auth);
            });

            userProfileContainer.appendChild(profilePic);
            userProfileContainer.appendChild(userName);
            userProfileContainer.appendChild(signOutBtn);
            userProfileContainer.style.cursor = 'pointer';
            userProfileContainer.addEventListener('click', () => openProfileWindow(user.uid));

        } else {
            // Usuario no ha iniciado sesión
            const signInBtn = document.createElement('button');
            signInBtn.textContent = 'Iniciar Sesión con Google';
            signInBtn.style.background = '#4285F4';
            signInBtn.style.color = 'white';
            signInBtn.style.border = 'none';
            signInBtn.style.padding = '8px 12px';
            signInBtn.style.borderRadius = '4px';
            signInBtn.style.cursor = 'pointer';

            signInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                signInWithPopup(auth, provider).catch(error => {
                    console.error("Error al iniciar sesión:", error);
                });
            });
            
            const defaultIcon = document.createElement('i');
            defaultIcon.className = 'fas fa-user-circle';
            const defaultText = document.createElement('span');
            defaultText.textContent = 'Invitado';

            userProfileContainer.appendChild(defaultIcon);
            userProfileContainer.appendChild(defaultText);
            userProfileContainer.appendChild(signInBtn);
        }
    }

    let currentPresenceId = null; // Variable para rastrear el ID de presencia actual

    function getOrCreateGuestId() {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            localStorage.setItem('guestId', guestId);
        }
        return guestId;
    }

    function setupPresence(userId, userInfo = {}) {
        const userStatusRef = ref(db, '/status/' + userId);
        const isGuest = userId.startsWith('guest_');

        const presenceInfo = {
            isOnline: true,
            last_changed: serverTimestamp(),
            displayName: isGuest ? 'Invitado' : userInfo.displayName,
            photoURL: isGuest ? 'favicon.png' : userInfo.photoURL
        };

        onDisconnect(userStatusRef).set({ isOnline: false, last_changed: serverTimestamp() }).then(() => {
            set(userStatusRef, presenceInfo);
            currentPresenceId = userId;
            console.log('Presence setup for:', userId);
        });
    }
    
    function clearPresence(userId) {
        if (!userId) return;
        console.log('Clearing presence for:', userId);
        const userStatusRef = ref(db, '/status/' + userId);
        set(userStatusRef, null); // Elimina el nodo para limpiar la presencia anterior
    }

    onAuthStateChanged(auth, user => {
        console.log('Auth state changed. User:', user);
        updateUserProfileUI(user);

        // Limpia la presencia anterior (invitado o usuario) antes de establecer una nueva.
        clearPresence(currentPresenceId);

        if (user) {
            // Usuario ha iniciado sesión
            localStorage.removeItem('guestId'); // Ya no se necesita el ID de invitado
            const userInfo = { displayName: user.displayName, photoURL: user.photoURL };
            setupPresence(user.uid, userInfo);

            // Crear perfil si no existe y notificar bienvenida
            const profileRef = ref(db, `profiles/${user.uid}`);
            onValue(profileRef, (snapshot) => {
                if (!snapshot.exists()) {
                    set(profileRef, {
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        bio: '¡Hola! Soy nuevo en GamesOG.',
                        favoriteGames: {}
                    });
                    showNotification(`¡Bienvenido, ${user.displayName}!`, 'success');
                }
            }, { onlyOnce: true }); // Solo se ejecuta una vez

        } else {
            // Usuario es invitado o ha cerrado sesión
            const guestId = getOrCreateGuestId();
            setupPresence(guestId, { displayName: 'Invitado', photoURL: 'favicon.png' });
        }
    });

    // Escuchar para actualizar el contador de usuarios en línea
    const statusRef = ref(db, 'status');
    onValue(statusRef, (snapshot) => {
        console.log('Status node changed. Snapshot exists:', snapshot.exists());
        if (snapshot.exists()) {
            const allUsers = snapshot.val();
            console.log('All users data:', allUsers);
            const onlineCount = Object.values(allUsers).filter(u => u && u.isOnline).length;
            console.log('Calculated online count:', onlineCount);
            onlineUsersCount.textContent = onlineCount;
        } else {
            onlineUsersCount.textContent = '0';
        }
    });
    // --- Lógica de Perfil de Usuario ---
    async function openProfileWindow(userId) {
        if (!userId || userId.startsWith('guest_')) return;
        const windowId = `window-profile-${userId}`;
        if (document.getElementById(windowId)) return;

        try {
            const profileRef = ref(db, `profiles/${userId}`);
            const snapshot = await get(profileRef);
            if (!snapshot.exists()) {
                console.error("No se encontró el perfil para el usuario:", userId);
                return;
            }
            const profileData = snapshot.val();
            const currentUser = auth.currentUser;
            const isOwnProfile = currentUser && currentUser.uid === userId;

            // 1. Crear el contenido base de la ventana
            const profileContent = `
                <div class="profile-window-body" id="profile-body-${userId}">
                    <div class="profile-header">
                        <img src="${profileData.photoURL || 'favicon.png'}" alt="Avatar" class="profile-avatar">
                        <h2 class="profile-display-name">${profileData.displayName}</h2>
                    </div>
                    <div class="profile-section profile-bio">
                        <h3>Biografía</h3>
                        <div id="bio-content-${userId}"></div>
                    </div>
                    <div class="profile-section">
                        <h3>Juegos Favoritos</h3>
                        <div class="profile-games-grid" id="games-grid-${userId}">
                            <p>Próximamente...</p>
                        </div>
                    </div>
                    <div class="profile-footer" id="profile-footer-${userId}"></div>
                </div>`;

            // 2. Crear la ventana
            createWindow(`profile-${userId}`, `Perfil de ${profileData.displayName}`, profileContent, { width: '500px', height: '600px' });

            // 3. Poblar el contenido dinámico y añadir listeners
            const bioContentDiv = document.getElementById(`bio-content-${userId}`);
            const bioP = document.createElement('p');
            bioP.innerHTML = profileData.bio.replace(/\n/g, '<br>');
            bioContentDiv.appendChild(bioP);

            if (isOwnProfile) {
                const footer = document.getElementById(`profile-footer-${userId}`);
                const editBtn = document.createElement('button');
                editBtn.className = 'profile-edit-btn';
                editBtn.textContent = 'Editar Perfil';
                footer.appendChild(editBtn);

                editBtn.addEventListener('click', () => {
                    if (editBtn.textContent === 'Editar Perfil') {
                        editBtn.textContent = 'Guardar Cambios';
                        bioContentDiv.innerHTML = ''; // Limpiar
                        const bioTextarea = document.createElement('textarea');
                        bioTextarea.id = `bio-textarea-${userId}`;
                        bioTextarea.value = profileData.bio;
                        bioContentDiv.appendChild(bioTextarea);
                    } else {
                        editBtn.textContent = 'Editar Perfil';
                        const newBio = document.getElementById(`bio-textarea-${userId}`).value;
                        
                        update(profileRef, { bio: newBio });
                        
                        profileData.bio = newBio;
                        bioContentDiv.innerHTML = ''; // Limpiar
                        const newBioP = document.createElement('p');
                        newBioP.innerHTML = newBio.replace(/\n/g, '<br>');
                        bioContentDiv.appendChild(newBioP);
                        showNotification('Perfil actualizado con éxito.', 'success');
                    }
                });
            }
        } catch (error) {
            console.error("Error al abrir la ventana de perfil:", error);
        }
    }
    // --- Lógica de Configuración ---
    function openSettingsWindow() {
        const windowId = 'window-settings';
        if (document.getElementById(windowId)) return;

        // 1. Crear el contenido HTML de la ventana con un contenedor vacío
        const settingsContent = `
            <div class="settings-window-body">
                <div class="settings-section">
                    <h3>Fondo de Escritorio</h3>
                    <div class="wallpaper-grid" id="wallpaper-grid-container"></div>
                </div>
            </div>
        `;

        // 2. Crear la ventana
        createWindow('settings', 'Configuración', settingsContent, { width: '600px', height: '400px' });

        // 3. Obtener el contenedor ahora que existe en el DOM
        const gridContainer = document.getElementById('wallpaper-grid-container');
        if (!gridContainer) {
            console.error("No se pudo encontrar el contenedor de la galería de fondos.");
            return;
        }

        const wallpapers = [
            'https://get.wallhere.com/photo/Windows-11-Microsoft-minimalism-logo-simple-background-blue-background-light-blue-operating-system-2073323.jpg',
            'https://w.forfun.com/fetch/e2/e2550198837517b6752205b24938c349.jpeg',
            'https://w0.peakpx.com/wallpaper/379/905/HD-wallpaper-windows-11-dark-mode-windows-11-dark-theme.jpg',
            'https://cdn.wallpapersafari.com/4/84/A3Bq5c.jpg',
            'https://i.redd.it/p8j6i9z2b2h71.png',
            'https://wallpapercave.com/wp/wp10809353.jpg'
        ];
        const currentWallpaper = localStorage.getItem('desktopWallpaper') || wallpapers[0];

        // 4. Crear y añadir cada miniatura mediante programación
        wallpapers.forEach(url => {
            const thumb = document.createElement('div');
            thumb.className = 'wallpaper-thumbnail';
            if (url === currentWallpaper) {
                thumb.classList.add('selected');
            }
            thumb.style.backgroundImage = `url('${url}')`;
            thumb.dataset.url = url;

            thumb.addEventListener('click', () => {
                const newWallpaperUrl = thumb.dataset.url;
                
                // Aplicar el nuevo fondo
                desktop.style.backgroundImage = `url('${newWallpaperUrl}')`;
                
                // Guardar en localStorage
                localStorage.setItem('desktopWallpaper', newWallpaperUrl);

                // Actualizar la clase 'selected' en la galería
                const currentSelected = gridContainer.querySelector('.selected');
                if (currentSelected) {
                    currentSelected.classList.remove('selected');
                }
                thumb.classList.add('selected');
            });

            gridContainer.appendChild(thumb);
        });
    }
    // --- Lógica de Notificaciones ---
    function showNotification(message, type = 'info') { // type puede ser 'info', 'success', 'error'
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // La animación de salida se encarga de la opacidad, pero la eliminamos del DOM después
        setTimeout(() => {
            notification.remove();
        }, 5000); // 5 segundos
    }
});