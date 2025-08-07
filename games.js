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

    // Mostrar 'Cargando...' y asegurarse de que el error esté oculto
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const response = await fetch(gistUrl);
        if (!response.ok) {
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        // Procesar los datos y construir las tarjetas
        for (const categoryKey in data) {
            if (data.hasOwnProperty(categoryKey) && categoryGridMap[categoryKey]) {
                const gridId = categoryGridMap[categoryKey];
                const grid = document.getElementById(gridId);
                const items = data[categoryKey];

                if (grid && items.length > 0) {
                    const section = grid.closest('.latest-articles-section');
                    if (section) {
                        section.classList.remove('hidden');
                    }

                    grid.innerHTML = ''; // Limpiar para evitar duplicados
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
        // Si algo falla, mostrar el mensaje de error
        errorTextEl.textContent = `Hubo un problema al obtener los datos. Error: ${error.message}`;
        errorEl.classList.remove('hidden');
        console.error('Error al obtener los datos:', error);
    } finally {
        // Ocultar 'Cargando...' sin importar si hubo éxito o error
        loadingEl.classList.add('hidden');
    }
}

// Ejecutar la función cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', fetchAndDisplayData);