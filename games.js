// 1. Configuración e inicialización de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDXqLCRY6OgcXTXsAR-TvnC4bIICjDndsw",
    authDomain: "todo-en-uno-e79c7.firebaseapp.com",
    projectId: "todo-en-uno-e79c7",
    storageBucket: "todo-en-uno-e79c7.appspot.com",
    messagingSenderId: "122399269850",
    appId: "1:122399269850:web:210049a35cc9abff9fd6e3",
    databaseURL: "https://todo-en-uno-e79c7-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 2. Función para obtener y mostrar los datos de las tarjetas
async function fetchAndDisplayData() {
    const gistUrl = 'https://gist.githubusercontent.com/HarveyYasuo/9d3c5f517a39dd5164c966dd176c91b6/raw/e6700111544f4f151f888ce87330aa7ef40e9e4e/gamesog_data.json';
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const errorTextEl = document.getElementById('error-text');

    const categoryGridMap = {
        'juegos': 'juegos-grid',
        'emuladores': 'emuladores-grid',
        'celulares': 'celulares-grid',
        'programas': 'programas-grid',
        'ganaplus': 'ganaplus-grid'
    };

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(gistUrl);
        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        // --- INICIO: CÓDIGO DE DEPURACIÓN ---
        const debugOutput = document.getElementById('debug-output');
        const debugPre = document.getElementById('debug-pre');

        if (debugOutput && debugPre) {
            debugPre.textContent = JSON.stringify(data, null, 2);
            debugOutput.classList.remove('hidden');
        }
        // --- FIN: CÓDIGO DE DEPURACIÓN ---
    } catch (error) {
        errorTextEl.textContent = `Hubo un problema al obtener los datos. Error: ${error.message}`;
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
}

// 3. Función para actualizar la UI del perfil de usuario
function updateUserProfileUI(user) {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    navActions.innerHTML = ''; // Limpiar acciones anteriores

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

// 4. Lógica principal que se ejecuta al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            // Si el usuario está autenticado:
            // 1. Muestra su perfil
            updateUserProfileUI(user);
            // 2. Carga los datos de las tarjetas
            fetchAndDisplayData();
        } else {
            // Si no está autenticado, redirige al inicio
            window.location.href = 'index.html';
        }
    });
});