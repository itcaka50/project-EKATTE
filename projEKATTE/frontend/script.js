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
    updatePageStats(data.results)
    updatePagination(data.stats.territorial_units);
}

function updateStats(cnt) {
    document.getElementById("countTU").textContent = cnt.territorial_units;
    document.getElementById("countTH").textContent = cnt.town_halls;
    document.getElementById("countM").textContent = cnt.municipalities;
    document.getElementById("countR").textContent = cnt.regions;
}

function updatePageStats(rows) {
    const rowsCount = rows.length;
    const startIndex = (currentPage - 1) * LIMIT + 1;
    const endIndex = startIndex + rowsCount - 1;

    document.getElementById("countTUPage").textContent = `${startIndex} - ${endIndex}`;

    let thCount = 0, mCount = 0, rCount = 0;
    rows.forEach(r => {
        if (r.town_hall) thCount++;
        if (r.municipality) mCount++;
        if (r.region) rCount++;
    });

    document.getElementById("countTHPage").textContent = thCount; 
    document.getElementById("countMPage").textContent = mCount;
    document.getElementById("countRPage").textContent = rCount;
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

    const maxButtons = 5;
    let startPage = Math.max(2, currentPage - Math.floor(maxButtons / 2));
    let endPage = startPage + maxButtons - 1;

    if (endPage >= pages) {
        endPage = pages - 1;
        startPage = Math.max(2, endPage - maxButtons + 1);
    }

    const firstBtn = document.createElement("button");
    firstBtn.textContent = "1";
    if (currentPage === 1) firstBtn.classList.add("active");
    firstBtn.addEventListener("click", () => {
        if (currentPage !== 1) {
            currentPage = 1;
            loadData();
        }
    });
    paginationContainer.appendChild(firstBtn);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        if (i === currentPage) 
            btn.classList.add("active");

        btn.addEventListener("click", () => {
            if (i !== currentPage) {
                currentPage = i;
                loadData();
            }
        });

        paginationContainer.appendChild(btn);
    }

    if (pages > 1) {
        const lastBtn = document.createElement("button");
        lastBtn.textContent = pages;
        if (currentPage === pages) lastBtn.classList.add("active");
        lastBtn.addEventListener("click", () => {
            if (currentPage !== pages) {
                currentPage = pages;
                loadData();
            }
        });
        paginationContainer.appendChild(lastBtn);
    }

}

