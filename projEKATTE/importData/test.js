const baseLink = "https://www.nsi.bg/nrnm/ekatte/";

const regions = "regions";
const municipalities = "municipalities";
const townHalls = "town-halls";
const territorialUnits = "territorial-units";

const linkFor = (data) => {
    return baseLink + data + "/json";
};

async function loadRegions() {
    let regionsLink = linkFor(regions);
    const regionsRes = await fetch(regionsLink);
    const regionsData = await regionsRes.json();
    const finalRegionsData = regionsData.map((x) => ({
        name: x.name,
        oblast: x.oblast,
    }));

    return finalRegionsData;
}

async function loadMunicipalities() {
    let municipalitiesLink = linkFor(municipalities);
    const municipalitiesRes = await fetch(municipalitiesLink);
    const municipalitiesData = await municipalitiesRes.json();
    const finalMunicipalitiesData = await municipalitiesData.map((x) => ({

    }));

    return municipalitiesData;
}

async function loadTownHalls() {
    const townHallsLink = linkFor(townHalls);
    const townHallsRes = await fetch(townHallsLink);
    const townHallsData = await townHallsRes.json();
    const finalTownHallsData = await townHallsData.filter(x => x.kmetstvo && x.kmetstvo.endsWith('-00'))
    .map((x) => ({
        name: x.name,
        oblast : x.kmetstvo,
    }));

    return finalTownHallsData;
}

async function loadTerritorialUnits() {
    let territorialUnitsLink = linkFor(territorialUnits);
    let territorialUnitsRes = await fetch(territorialUnitsLink);
    const territorialUnitsData = await territorialUnitsRes.json();
    const finalTU = await territorialUnitsData.filter(x => x.kmetstvo && x.kmetstvo.endsWith('-00') && x.obshtina.endsWith('00'))
    .map((x) => ({
        name : x.name,
        kmetstvo: x.kmetstvo,
        mun : x.obshtina
    }));
    
    return finalTU;
}

(async () => {
    let regions = await loadTerritorialUnits();
    console.log(regions);
})();