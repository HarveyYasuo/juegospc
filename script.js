document.addEventListener('DOMContentLoaded', () => {
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
});