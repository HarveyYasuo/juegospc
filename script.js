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
    const searchContainer = document.querySelector('.search-container');
    const searchIcon = document.getElementById('search-icon');
    const searchInput = document.getElementById('search-input');
    const subscribeForm = document.querySelector('.subscribe-form');
    let debounceTimer;

    // --- LÓGICA DE BÚSQUEDA (Actualmente sin funcionalidad visible, pero preparada) ---
    searchIcon.addEventListener('click', (e) => {
        e.preventDefault();
        searchContainer.classList.toggle('active');
        if (searchContainer.classList.contains('active')) {
            searchInput.focus();
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = searchInput.value.trim();
            // Aquí se podría implementar una búsqueda que filtre los artículos estáticos
            console.log("Buscando:", searchTerm);
        }, 500);
    });

    // --- LÓGICA DEL FORMULARIO DE SUSCRIPCIÓN ---
    if (subscribeForm) {
        subscribeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = subscribeForm.querySelector('input[type="email"]');
            const email = emailInput.value.trim();

            if (email) {
                alert(`¡Gracias por suscribirte con ${email}!`);
                emailInput.value = '';
            } else {
                alert('Por favor, introduce un correo electrónico válido.');
            }
        });
    }

    // --- LÓGICA DE AUTENTICACIÓN Y REDIRECCIÓN ---
    function updateUserProfileUI(user) {
        if (!navActions) return;
        const existingActions = navActions.querySelectorAll('.auth-action');
        existingActions.forEach(action => action.remove());

        if (user) {
            // Si el usuario está logueado, lo redirigimos a la página de juegos.
            window.location.href = 'games.html';
        } else {
            const signInBtn = document.createElement('button');
            signInBtn.textContent = 'Iniciar Sesión';
            signInBtn.className = 'login-button auth-action';
            signInBtn.addEventListener('click', () => {
                auth.signInWithPopup(provider).catch(error => console.error("Error al iniciar sesión:", error));
            });
            navActions.appendChild(signInBtn);
        }
    }

    auth.onAuthStateChanged(user => {
        updateUserProfileUI(user);
    });
});