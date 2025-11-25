const LIMIT = 25;
let currentPage = 1;
let currentQuery = "";

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const paginationContainer = document.getElementById("pagination");

searchBtn.addEventListener("click", () => startSearch());
searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") startSearch();
});

document.addEventListener("DOMContentLoaded", () => {
    currentQuery = "";
    loadData();
});

function startSearch() {
    currentPage = 1;
    currentQuery = searchInput.value.trim();
    loadData();
}

async function loadData() {
    const offset = (currentPage - 1) * LIMIT;

    const res = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&limit=${LIMIT}&offset=${offset}`);
    const data = await res.json();

    updateStats(data.stats);
    updateTable(data.total, data.results);
    updatePagination(data.stats.territorial_units);
}

function updateStats(cnt) {
    document.getElementById("countTU").textContent = cnt.territorial_units;
    document.getElementById("all").textContent = cnt.territorial_units;
    document.getElementById("countTH").textContent = cnt.town_halls;
    document.getElementById("countM").textContent = cnt.municipalities;
    document.getElementById("countR").textContent = cnt.regions;
}

function updateTable(total, rows) {
    document.getElementById("resultsCount").textContent = total;

    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">Няма резултати</td></tr>`;
        return;
    }

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.ekatte}</td>
            <td>${r.name}</td>
            <td>${r.town_hall ?? ""}</td>
            <td>${r.municipality}</td>
            <td>${r.region}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePagination(total) {
    const pages = Math.ceil(total / LIMIT);
    paginationContainer.innerHTML = "";

    if (pages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "«";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            loadData();
        }
    });
    paginationContainer.appendChild(prevBtn);

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(pages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === currentPage) btn.classList.add("active");

        btn.addEventListener("click", () => {
            if (i !== currentPage) {
                currentPage = i;
                loadData();
            }
        });

        paginationContainer.appendChild(btn);
    }

    const lastBtn = document.createElement("button");
    lastBtn.textContent = pages;
    lastBtn.disabled = currentPage === total;
    lastBtn.addEventListener("click", () => {
        if (currentPage !== pages) {
            currentPage = pages;
            loadData(); 
        }
    });
    paginationContainer.appendChild(lastBtn);``

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "»";
    nextBtn.disabled = currentPage === pages;
    nextBtn.addEventListener("click", () => {
        if (currentPage < pages) {
            currentPage++;
            loadData();
        }
    });
    paginationContainer.appendChild(nextBtn);
}
