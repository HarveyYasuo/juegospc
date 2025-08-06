// Función principal para obtener y mostrar los datos del Gist
async function fetchGistData() {
    // Reemplaza con la URL "raw" de tu Gist secreto
    const gistUrl = 'https://gist.githubusercontent.com/HarveyYasuo/9d3c5f517a39dd5164c966dd176c91b6/raw/e6700111544f4f151f888ce87330aa7ef40e9e4e/gamesog_data.json';

    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    const dataDisplayEl = document.getElementById('data-display');
    const errorEl = document.getElementById('error-message');
    const errorTextEl = document.getElementById('error-text');

    // Muestra el indicador de carga
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
        // Realiza la petición al Gist
        const response = await fetch(gistUrl);

        // Maneja si la respuesta no es exitosa
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        // Parsea la respuesta a JSON
        const jsonData = await response.json();

        // Muestra los datos en la página
        dataDisplayEl.textContent = JSON.stringify(jsonData, null, 2);
        contentEl.classList.remove('hidden');

    } catch (error) {
        // Muestra el mensaje de error en caso de fallo
        errorTextEl.textContent = `Hubo un problema al obtener los datos. Asegúrate de que la URL del Gist es correcta y el Gist no está vacío. Error: ${error.message}`;
        errorEl.classList.remove('hidden');
        console.error('Error al obtener los datos:', error);
    } finally {
        // Oculta el indicador de carga
        loadingEl.classList.add('hidden');
    }
}

// Ejecuta la función cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', fetchGistData);