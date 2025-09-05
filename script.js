document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const sections = document.querySelectorAll('.latest-articles-section');

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.toLowerCase().trim();
        filterArticles(searchTerm);
    });

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filterArticles(searchTerm);
    });

    function filterArticles(searchTerm) {
        let totalVisibleArticles = 0;

        sections.forEach(section => {
            const articles = section.querySelectorAll('.article-card');
            let sectionHasVisibleArticles = false;

            articles.forEach(article => {
                const title = article.querySelector('h4').textContent.toLowerCase();
                const shouldBeVisible = title.includes(searchTerm);

                if (shouldBeVisible) {
                    article.style.display = 'flex';
                    sectionHasVisibleArticles = true;
                } else {
                    article.style.display = 'none';
                }
            });

            if (sectionHasVisibleArticles) {
                section.classList.remove('hidden');
                totalVisibleArticles += Array.from(articles).filter(a => a.style.display === 'flex').length;
            } else {
                section.classList.add('hidden');
            }
        });

        // Opcional: Mostrar un mensaje si no hay resultados
        const noResultsMessage = document.getElementById('no-results-message');
        if (totalVisibleArticles === 0 && searchTerm !== '') {
            if (!noResultsMessage) {
                const main = document.querySelector('main');
                const message = document.createElement('p');
                message.id = 'no-results-message';
                message.textContent = 'No se encontraron resultados para tu búsqueda.';
                message.style.textAlign = 'center';
                message.style.fontSize = '1.2em';
                message.style.marginTop = '2rem';
                main.appendChild(message);
            } else {
                noResultsMessage.style.display = 'block';
            }
        } else if (noResultsMessage) {
            noResultsMessage.style.display = 'none';
        }
    }
});
