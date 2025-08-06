document.addEventListener('DOMContentLoaded', async () => {
    const gistUrl = 'https://gist.githubusercontent.com/HarveyYasuo/9d3c5f517a39dd5164c966dd176c91b6/raw/e6700111544f4f151f888ce87330aa7ef40e9e4e/gamesog_data.json';

    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const errorTextEl = document.getElementById('error-text');
    const contentSections = document.querySelectorAll('.latest-articles-section');

    const categoryGridMap = {
        'juegos': 'juegos-grid',
        'emuladores': 'emuladores-grid',
        'celulares': 'celulares-grid',
        'programas': 'programas-grid',
        'ganaplus': 'ganaplus-grid'
    };

    const hideLoading = () => {
        if (loadingEl) loadingEl.style.display = 'none';
    };

    const showError = (message) => {
        if (errorTextEl) errorTextEl.textContent = message;
        if (errorEl) errorEl.classList.remove('hidden');
        contentSections.forEach(section => section.style.display = 'none');
    };

    // Ocultar secciones de contenido inicialmente
    contentSections.forEach(section => section.style.display = 'none');

    try {
        const response = await fetch(gistUrl);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        const data = await response.json();

        hideLoading();

        // Iterar sobre las categorías del JSON
        for (const categoryKey in data) {
            if (data.hasOwnProperty(categoryKey) && categoryGridMap[categoryKey]) {
                const gridId = categoryGridMap[categoryKey];
                const grid = document.getElementById(gridId);
                const items = data[categoryKey];

                if (grid && items.length > 0) {
                    const section = grid.closest('.latest-articles-section');
                    if (section) section.style.display = 'block'; // Mostrar la sección si tiene items

                    grid.innerHTML = ''; // Limpiar la grilla
                    items.forEach(item => {
                        const itemCard = document.createElement('article');
                        itemCard.className = 'article-card';
                        itemCard.innerHTML = `
                            <div class="card-image-container" style="background-image: url('${item.enlace_imagen}');">
                                 <span class="category-tag">${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}</span>
                            </div>
                            <h4>${item.titulo}</h4>
                            <p>Haz clic para descargar y obtener más información.</p>
                            <a href="${item.enlace_sitio || '#'}" target="_blank" class="download-link">Descargar</a>
                        `;
                        grid.appendChild(itemCard);
                    });
                }
            }
        }

    } catch (error) {
        hideLoading();
        showError(`Hubo un problema al obtener los datos. Asegúrate de que la URL del Gist es correcta y el Gist no está vacío. Error: ${error.message}`);
        console.error('Error al obtener los datos:', error);
    }
});