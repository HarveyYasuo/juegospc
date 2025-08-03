// Configuración de Firebase (sin imports)
const firebaseConfig = {
    apiKey: "AIzaSyDXqLCRY6OgcXTXsAR-TvnC4bIICjDndsw",
    authDomain: "todo-en-uno-e79c7.firebaseapp.com",
    projectId: "todo-en-uno-e79c7",
    storageBucket: "todo-en-uno-e79c7.appspot.com",
    messagingSenderId: "122399269850",
    appId: "1:122399269850:web:210049a35cc9abff9fd6e3",
    databaseURL: "https://todo-en-uno-e79c7-default-rtdb.firebaseio.com/"
};

// Inicializar Firebase usando el objeto global
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db = firebase.database();

document.addEventListener('DOMContentLoaded', () => {
    const navActions = document.querySelector('.nav-actions');

    // --- LÓGICA REUTILIZABLE PARA CARGAR CATEGORÍAS ---
    const setupCategory = (categoryName, gridId) => {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        let state = {
            currentPage: 1,
            isLoading: false,
            allItemsLoaded: false
        };

        const loadItems = async () => {
            if (state.isLoading || state.allItemsLoaded) return;
            state.isLoading = true;

            try {
                const API_BASE_URL = "https://unbiased-tough-mayfly.ngrok-free.app/";
                let url = `${API_BASE_URL}get_items.php?category=${categoryName}&limit=12&page=${state.currentPage}`;
                const response = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                if (!response.ok) throw new Error(`Error de red: ${response.status}`);
                const items = await response.json();

                if (items.length === 0) {
                    state.allItemsLoaded = true;
                    if (state.currentPage === 1) {
                        grid.innerHTML = `<p>No se encontraron elementos en ${categoryName}.</p>`;
                    }
                    return;
                }

                items.forEach(item => {
                    const itemCard = document.createElement('article');
                    itemCard.className = 'article-card';
                    itemCard.innerHTML = `
                        <div class="card-image-container" style="background-image: url('${item.enlace_imagen}');">
                             <span class="category-tag">${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}</span>
                        </div>
                        <h4>${item.titulo}</h4>
                        <p>Haz clic para descargar y obtener más información.</p>
                        <a href="${item.enlace_sitio || '#'}" target="_blank" class="download-link">Descargar</a>
                    `;
                    grid.appendChild(itemCard);
                });
                state.currentPage++;
            } catch (error) {
                console.error(`Error al cargar ${categoryName}:`, error);
            } finally {
                state.isLoading = false;
            }
        };

        grid.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = grid;
            if (scrollTop + clientHeight >= scrollHeight - 50 && !state.isLoading) {
                loadItems();
            }
        });

        loadItems();
    };

    // --- INICIALIZAR TODAS LAS CATEGORÍAS DE JUEGOS ---
    setupCategory('juegos', 'games-grid');
    setupCategory('emuladores', 'emulators-grid');
    setupCategory('celulares', 'phones-grid');
    setupCategory('programas', 'programs-grid');
    setupCategory('ganaplus', 'ganaplus-grid');

    // --- LÓGICA DE AUTENTICACIÓN Y REDIRECCIÓN ---
    function updateUserProfileUI(user) {
        if (!navActions) return;
        const existingActions = navActions.querySelectorAll('.auth-action');
        existingActions.forEach(action => action.remove());

        if (user) {
            const profileContainer = document.createElement('a');
            profileContainer.href = "#";
            profileContainer.className = 'nav-icon profile-icon auth-action';
            profileContainer.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName}" title="${user.displayName}">`;

            const signOutBtn = document.createElement('a');
            signOutBtn.href = "#";
            signOutBtn.className = 'nav-icon auth-action';
            signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            signOutBtn.title = 'Cerrar Sesión';
            signOutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.signOut();
            });

            navActions.appendChild(profileContainer);
            navActions.appendChild(signOutBtn);
        }
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            updateUserProfileUI(user);
        } else {
            // Si el usuario no está logueado en esta página, lo redirige al index.
            window.location.href = 'index.html';
        }
    });
});