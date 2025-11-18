/* =========================
   Config TMDB
   ========================= */
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzOTgxNWVjZTI4ZjcyNWJlZGRmY2Y3OGE0YzRjZGU0ZiIsIm5iZiI6MTc2MDQ1NjUxNS4xNDcsInN1YiI6IjY4ZWU2ZjQzNDYzMzQ0Yjg0MTlkZjQ3MCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ejdXz4pm0dZn0OAVJvJ16R8SwNAa-MBkO_yttUiblLk';
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const TMDB_SIZE = 'w342'; // w185, w342, w500, original

async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_API}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      'Content-Type': 'application/json;charset=utf-8',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDB ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function tmdbSearchMovies(query, page = 1, lang = 'es-ES') {
  if (!query || !query.trim()) return { results: [] };
  return tmdbFetch('/search/movie', { query, page, language: lang, include_adult: false });
}

async function tmdbMovieDetails(id, lang = 'es-ES') {
  return tmdbFetch(`/movie/${id}`, { language: lang });
}

async function tmdbMovieCredits(id) {
  return tmdbFetch(`/movie/${id}/credits`);
}

// --- NUEVO PARTE 3: Función para obtener Keywords ---
async function tmdbMovieKeywords(id) {
  return tmdbFetch(`/movie/${id}/keywords`);
}

/* =========================
   Modelo + Persistencia
   ========================= */

const STORAGE_KEY = "mis_peliculas";
const STORAGE_KEYWORDS_KEY = "mis_keywords"; // NUEVO

const mis_peliculas_iniciales = [
  { titulo: "Superlópez", director: "Javier Ruiz Caldera", miniatura: "files/superlopez.png" },
  { titulo: "Jurassic Park", director: "Steven Spielberg", miniatura: "files/jurassicpark.png" },
  { titulo: "Interstellar", director: "Christopher Nolan", miniatura: "files/interstellar.png" }
];

let mis_peliculas = [];
let mis_keywords = []; // NUEVO: Lista personalizada de keywords

// Carga de películas
const loadPeliculas = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const savePeliculas = (peliculas) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(peliculas));
};

// --- NUEVO: Carga de Keywords ---
const loadKeywords = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYWORDS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const saveKeywords = (keywords) => {
  localStorage.setItem(STORAGE_KEYWORDS_KEY, JSON.stringify(keywords));
};

const seedIfEmpty = () => {
  const data = loadPeliculas();
  if (!data || data.length === 0) {
    savePeliculas(mis_peliculas_iniciales);
  }
  // Cargar keywords al inicio
  mis_keywords = loadKeywords();
};

/* =========================
   Utilidades
   ========================= */

const esc = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const yearFromDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  return Number.isNaN(y) ? "" : String(y);
};

const debounce = (fn, wait = 400) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

// --- NUEVO PARTE 3: Limpiador de Keywords ---
const cleanKeyword = (keyword) => {
  return keyword
    .replace(/[^a-zñáéíóú0-9 ]+/igm, "")  // Eliminar caracteres especiales
    .trim()                                // Eliminar espacios en blanco
    .toLowerCase();                        // Convertir a minúsculas
};

/* =========================
   Vistas (devuelven HTML)
   ========================= */

const indexView = (peliculas) => {
  if (!peliculas.length) {
    return `
      <div style="text-align:center">
        <p>No hay películas aún.</p>
        <div class="actions">
          <button class="new">Añadir</button>
          <button class="reset">Reset</button>
        </div>
      </div>
    `;
  }

  let view = peliculas
    .map((p, i) => {
      return `
        <article class="movie-card">
          <a href="#" class="show" data-my-id="${i}" title="Ver detalle">
            <img src="${esc(p.miniatura)}"
                 alt="${esc(p.titulo || "Sin título")}"
                 onerror="this.src='files/placeholder.png'"/>
          </a>
          <h3>${p.titulo ? esc(p.titulo) : "<em>Sin título</em>"}</h3>
          <p>${p.director ? esc(p.director) : "<em>Sin director</em>"}</p>
          <div class="actions">
            <button class="edit" data-my-id="${i}">Editar</button>
            <button class="delete" data-my-id="${i}">Borrar</button>
          </div>
        </article>
      `;
    })
    .join("");

  view += `
    <div class="actions" style="grid-column: 1/-1;">
      <button class="new">Añadir</button>
      <button class="reset">Reset</button>
    </div>
  `;
  return view;
};

const editView = (i, pelicula) => {
  return `
    <h2>Editar Película</h2>
    <div class="field">
      <label for="titulo">Título</label>
      <input type="text" id="titulo" placeholder="Título" value="${esc(pelicula.titulo)}">
    </div>
    <div class="field">
      <label for="director">Director</label>
      <input type="text" id="director" placeholder="Director" value="${esc(pelicula.director)}">
    </div>
    <div class="field">
      <label for="miniatura">Miniatura</label>
      <input type="text" id="miniatura" placeholder="URL de la miniatura" value="${esc(pelicula.miniatura)}">
    </div>
    <div class="actions">
      <button class="update" data-my-id="${i}">Actualizar</button>
      <button class="index">Volver</button>
    </div>
  `;
};

const showView = (pelicula) => {
  return `
    <h2>${pelicula.titulo ? esc(pelicula.titulo) : "<em>Sin título</em>"}</h2>
    <div style="text-align:center">
      <img src="${esc(pelicula.miniatura)}"
           alt="${esc(pelicula.titulo || "Sin título")}"
           onerror="this.src='files/placeholder.png'"
           style="max-width:240px;border-radius:8px"/>
    </div>
    <p><strong>Director:</strong> ${pelicula.director ? esc(pelicula.director) : "<em>Sin director</em>"}</p>
    <div class="actions">
      <button class="index">Volver</button>
    </div>
  `;
};

const tmdbSearchView = () => {
  return `
    <div class="tmdb-search" role="search">
      <label for="tmdb-query" class="sr-only">Buscar en TMDB</label>
      <input id="tmdb-query" type="search" placeholder="Buscar en TMDB por título… (p.ej., Interstellar)" autocomplete="off" />
      <div class="tmdb-status" id="tmdb-status" aria-live="polite"></div>
      <div class="tmdb-results" id="tmdb-results" aria-label="Resultados de búsqueda"></div>
    </div>
  `;
};

const newView = () => {
  return `
    <h2>Crear Película</h2>
    <p class="muted" style="font-size:0.9rem">Busca en TMDB para autorrellenar o ver keywords.</p>
    ${tmdbSearchView()}
    <div class="field">
      <label for="titulo">Título</label>
      <input type="text" id="titulo" placeholder="Título">
    </div>
    <div class="field">
      <label for="director">Director</label>
      <input type="text" id="director" placeholder="Director">
    </div>
    <div class="field">
      <label for="miniatura">Miniatura</label>
      <input type="text" id="miniatura" placeholder="URL de la miniatura">
    </div>
    <div class="actions">
      <button class="create">Crear</button>
      <button class="index">Volver</button>
    </div>
  `;
};

// --- NUEVO PARTE 3: Vista de Keywords de una película ---
const keywordsView = (movieTitle, keywords) => {
  let listHtml = '';
  if (keywords.length === 0) {
    listHtml = '<p>No se encontraron palabras clave para esta película.</p>';
  } else {
    listHtml = `
      <ul class="keyword-list">
        ${keywords.map(kw => `
          <li class="keyword-tag">
            <span>${esc(kw)}</span>
            <button class="add-keyword" data-keyword="${esc(kw)}" title="Añadir a mi lista">+</button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  return `
    <h2>Keywords de: ${esc(movieTitle)}</h2>
    ${listHtml}
    <div class="actions">
      <button class="new">Volver a buscar</button>
      <button class="my-keywords">Ver Mi Lista</button>
    </div>
  `;
};

// --- NUEVO PARTE 3: Vista de "Mis Keywords" ---
const myKeywordsView = (keywords) => {
  let listHtml = '';
  if (keywords.length === 0) {
    listHtml = '<p>Aún no has guardado ninguna palabra clave.</p>';
  } else {
    listHtml = `
      <ul class="keyword-list">
        ${keywords.map(kw => `
          <li class="keyword-tag">
            <span>${esc(kw)}</span>
            <button class="remove-keyword" data-keyword="${esc(kw)}" title="Eliminar de mi lista" style="background:#ff6b6b;color:#fff;">×</button>
          </li>
        `).join('')}
      </ul>
    `;
  }

  return `
    <h2>Mis Palabras Clave</h2>
    ${listHtml}
    <div class="actions">
      <button class="index">Volver al Inicio</button>
      <button class="new">Ir a Buscar Películas</button>
    </div>
  `;
};

/* =========================
   Controladores
   ========================= */

const render = (html, asList = false) => {
  const main = document.getElementById("main");
  if (asList) {
    main.classList.add("movie-list");
  } else {
    main.classList.remove("movie-list");
  }
  main.innerHTML = html;
};

const indexContr = () => {
  mis_peliculas = loadPeliculas();
  mis_keywords = loadKeywords(); // Asegurar carga
  render(indexView(mis_peliculas), true);
};

const showContr = (i) => {
  render(showView(mis_peliculas[i]));
};

const newContr = () => {
  render(newView());
  const q = document.getElementById('tmdb-query');
  const status = document.getElementById('tmdb-status');
  const results = document.getElementById('tmdb-results');

  const setStatus = (msg = '') => {
    status.textContent = msg;
    status.style.display = msg ? 'block' : 'none';
  };

  // Dibujar resultados con botones separados para "Seleccionar" y "Ver Keywords"
  const drawResults = (arr = []) => {
    if (!arr.length) {
      results.innerHTML = `<p class="tmdb-empty">No hay resultados.</p>`;
      return;
    }
    results.innerHTML = arr.map(m => {
      const title = m.title || m.name || 'Sin título';
      const year = yearFromDate(m.release_date);
      const poster = m.poster_path ? `${TMDB_IMG}/${TMDB_SIZE}${m.poster_path}` : 'files/placeholder.png';
      
      // Usamos un DIV wrapper (.tmdb-card) en lugar de BUTTON para separar acciones
      return `
        <div class="tmdb-card">
          <div class="tmdb-pick" data-id="${m.id}" style="cursor:pointer">
             <img src="${poster}" alt="${esc(title)}" onerror="this.src='files/placeholder.png'"/>
             <span class="tmdb-title">${esc(title)}${year ? ` <small>(${year})</small>` : ''}</span>
          </div>
          <div class="tmdb-card-actions">
             <button class="tmdb-pick" data-id="${m.id}">Seleccionar</button>
             <button class="keywords" data-id="${m.id}" data-title="${esc(title)}">Keywords</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const doSearch = debounce(async () => {
    const query = q.value.trim();
    if (!query) {
      results.innerHTML = '';
      setStatus('');
      return;
    }
    try {
      setStatus('Buscando…');
      const data = await tmdbSearchMovies(query);
      drawResults(data.results || []);
      setStatus(data.results?.length ? '' : 'Sin coincidencias.');
    } catch (e) {
      console.error(e);
      setStatus('Error al buscar en TMDB.');
    }
  }, 500);

  q.addEventListener('input', doSearch);

  // Event delegation para clicks en resultados
  results.addEventListener('click', async (ev) => {
    // 1. Botón Keywords (NUEVO PARTE 3)
    const btnKeywords = ev.target.closest('.keywords');
    if (btnKeywords) {
      const id = btnKeywords.dataset.id;
      const title = btnKeywords.dataset.title;
      keywordsContr(id, title); // Llamada al controlador de keywords
      return;
    }

    // 2. Botón/Click para Seleccionar (Rellenar formulario)
    const btnPick = ev.target.closest('.tmdb-pick');
    if (btnPick) {
      const id = btnPick.dataset.id;
      try {
        setStatus('Cargando detalles…');
        const [detail, credits] = await Promise.all([
          tmdbMovieDetails(id),
          tmdbMovieCredits(id)
        ]);

        const directorObj = (credits.crew || []).find(c => c.job === 'Director');
        const director = directorObj?.name || '';
        const title = detail.title || detail.name || '';
        const poster = detail.poster_path ? `${TMDB_IMG}/${TMDB_SIZE}${detail.poster_path}` : '';

        document.getElementById('titulo').value = title;
        document.getElementById('director').value = director;
        document.getElementById('miniatura').value = poster;

        setStatus('Formulario completado con el resultado seleccionado.');
        document.getElementById('titulo').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        console.error(e);
        setStatus('No se pudieron cargar los detalles.');
      }
    }
  });
};

// --- NUEVO PARTE 3: Controlador de Vista Keywords ---
const keywordsContr = async (movieId, movieTitle) => {
  try {
    const response = await tmdbMovieKeywords(movieId);
    const rawKeywords = response.keywords || [];
    
    // Procesar keywords (limpiar y normalizar)
    const processedKeywords = rawKeywords
      .map(k => cleanKeyword(k.name))
      .filter(k => k.length > 0); // Filtrar vacíos
    
    // Eliminar duplicados visuales si la API devuelve cosas similares
    const uniqueKeywords = [...new Set(processedKeywords)];

    render(keywordsView(movieTitle, uniqueKeywords));
  } catch (e) {
    console.error(e);
    alert("Error al obtener las keywords");
  }
};

// --- NUEVO PARTE 3: Controlador para añadir a mi lista ---
const addKeywordContr = (keyword) => {
  // Evitar duplicados en la lista personal
  if (!mis_keywords.includes(keyword)) {
    mis_keywords.push(keyword);
    saveKeywords(mis_keywords);
    alert(`"${keyword}" añadida a tu lista.`);
  } else {
    alert(`"${keyword}" ya está en tu lista.`);
  }
};

// --- NUEVO PARTE 3: Controlador de Vista "Mis Keywords" ---
const myKeywordsContr = () => {
  mis_keywords = loadKeywords();
  render(myKeywordsView(mis_keywords));
};

// --- NUEVO PARTE 3: Controlador para borrar de mi lista ---
const removeKeywordContr = (keyword) => {
  if (confirm(`¿Borrar "${keyword}" de tu lista?`)) {
    mis_keywords = mis_keywords.filter(k => k !== keyword);
    saveKeywords(mis_keywords);
    myKeywordsContr(); // Re-renderizar la vista actual
  }
};

const createContr = () => {
  const titulo = document.getElementById("titulo").value.trim();
  const director = document.getElementById("director").value.trim();
  const miniatura = document.getElementById("miniatura").value.trim();
  mis_peliculas.push({ titulo, director, miniatura });
  savePeliculas(mis_peliculas);
  indexContr();
};

const editContr = (i) => {
  render(editView(i, mis_peliculas[i]));
};

const updateContr = (i) => {
  mis_peliculas[i].titulo = document.getElementById("titulo").value.trim();
  mis_peliculas[i].director = document.getElementById("director").value.trim();
  mis_peliculas[i].miniatura = document.getElementById("miniatura").value.trim();
  savePeliculas(mis_peliculas);
  indexContr();
};

const deleteContr = (i) => {
  if (confirm("¿Seguro que quieres borrar esta película?")) {
    mis_peliculas.splice(i, 1);
    savePeliculas(mis_peliculas);
    indexContr();
  }
};

const resetContr = () => {
  if (confirm("¿Seguro que quieres reiniciar la lista de películas?")) {
    savePeliculas(mis_peliculas_iniciales);
    indexContr();
  }
};

/* =========================
   Router de eventos
   ========================= */

const matchEvent = (ev, sel) => ev.target.matches(sel);
const myId = (ev) => Number(ev.target.dataset.myId);

document.addEventListener("click", (ev) => {
  if      (matchEvent(ev, ".index"))          { ev.preventDefault(); indexContr(); }
  else if (matchEvent(ev, ".edit"))           { editContr(myId(ev)); }
  else if (matchEvent(ev, ".update"))         { updateContr(myId(ev)); }
  else if (matchEvent(ev, ".show"))           { ev.preventDefault(); showContr(myId(ev)); }
  else if (matchEvent(ev, ".new"))            { ev.preventDefault(); newContr(); }
  else if (matchEvent(ev, ".create"))         { createContr(); }
  else if (matchEvent(ev, ".delete"))         { deleteContr(myId(ev)); }
  else if (matchEvent(ev, ".reset"))          { ev.preventDefault(); resetContr(); }
  
  // --- NUEVOS EVENTOS PARTE 3 ---
  else if (matchEvent(ev, ".my-keywords"))    { ev.preventDefault(); myKeywordsContr(); }
  else if (matchEvent(ev, ".add-keyword"))    { 
    const kw = ev.target.dataset.keyword;
    addKeywordContr(kw);
  }
  else if (matchEvent(ev, ".remove-keyword")) { 
    const kw = ev.target.dataset.keyword;
    removeKeywordContr(kw); 
  }
  // Nota: .keywords se maneja dentro de newContr/EventListener del grid para tener acceso al contexto
});

/* =========================
   Inicialización
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  seedIfEmpty();
  indexContr();
});