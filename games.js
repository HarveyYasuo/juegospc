// 2. Función para obtener y mostrar los datos de las tarjetas
async function fetchAndDisplayData() {
    const gistUrl = 'https://gist.githubusercontent.com/HarveyYasuo/9d3c5f517a39dd5164c966dd176c91b6/raw/e6700111544f4f151f888ce87330aa7ef40e9e4e/gamesog_data.json';
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const errorTextEl = document.getElementById('error-text');

    const categoryGridMap = {
        'celulares': 'celulares-grid',
        'juegos': 'juegos-grid',
        'emuladores': 'emuladores-grid',
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
        const dataArray = await response.json(); // El Gist contiene un Array

        // Recorrer el array de la exportación de phpMyAdmin
        dataArray.forEach(element => {
            // Buscamos los elementos que son tablas y tienen datos
            if (element.type === 'table' && element.name && Array.isArray(element.data)) {
                const categoryKey = element.name; // ej: "celulares"
                const items = element.data;

                // Verificamos si esta categoría es una de las que queremos mostrar
                if (categoryGridMap[categoryKey]) {
                    const gridId = categoryGridMap[categoryKey];
                    const grid = document.getElementById(gridId);

                    if (grid && items.length > 0) {
                        const section = grid.closest('.latest-articles-section');
                        if (section) section.classList.remove('hidden');

                        grid.innerHTML = ''; // Limpiar la rejilla
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
        });

    } catch (error) {
        errorTextEl.textContent = `Hubo un problema al procesar los datos. Error: ${error.message}`;
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
}

// 4. Lógica principal que se ejecuta al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Al eliminar el sistema de inicio de sesión, ya no es necesario verificar
    // si el usuario está autenticado. Se carga el contenido directamente.
    fetchAndDisplayData();
});