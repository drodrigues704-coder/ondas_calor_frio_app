/******************************************************************************
 SNIPPET_START
 WEBAPP — Ondas de Calor e Frio
 m7_4_nuts.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Gestão dos limites administrativos NUTS II.

 Este módulo é responsável por:
      • Carregar o ficheiro GeoJSON das NUTS
      • Preencher o dropdown de seleção
      • Desenhar os limites no mapa
      • Gerir eventos de seleção
******************************************************************************/

"use strict";

/*=============================================================================
    VARIÁVEIS DO MÓDULO
=============================================================================*/

let nutsGeoJSON = null;
const nutsData = {};

/*=============================================================================
    CARREGA O GEOJSON DAS NUTS
=============================================================================*/

async function loadNUTSGeoJSON() {
    console.log("A carregar limites NUTS...");
    try {
        const response = await fetch("data/NUTS_II.geojson");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        nutsGeoJSON = await response.json();
        console.log("NUTS carregado com sucesso:", nutsGeoJSON.features.length, "regiões");
        return nutsGeoJSON;
    } catch (error) {
        console.error("Erro ao carregar NUTS:", error);
        return null;
    }
}

/*=============================================================================
    EXTRAI OS NOMES ÚNICOS DAS NUTS
=============================================================================*/

function extractNUTSNames() {
    if (!nutsGeoJSON) {
        return [];
    }

    const names = new Set();
    nutsGeoJSON.features.forEach((feature) => {
        const nuts2 = feature.properties.nuts2;
        if (nuts2) {
            names.add(nuts2);
            if (!nutsData[nuts2]) {
                nutsData[nuts2] = feature;
            }
        }
    });
    return Array.from(names).sort();
}

/*=============================================================================
    PREENCHE O DROPDOWN DE NUTS
=============================================================================*/

function populateNUTSSelect() {
    const select = document.getElementById("nuts-select");
    if (!select) {
        console.error("Elemento nuts-select não encontrado");
        return;
    }

    // Limpa as opções anteriores
    select.innerHTML = "";

    // Adiciona opção padrão
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecionar região...";
    select.appendChild(defaultOption);

    // Extrai nomes únicos e povoa o select
    const nutsNames = extractNUTSNames();
    nutsNames.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    console.log("Dropdown NUTS preenchido com", nutsNames.length, "regiões");
}

/*=============================================================================
    DESENHA O LIMITE DA NUTS SELECIONADA NO MAPA
=============================================================================*/

function drawNUTSBoundary(nutsName) {
    if (!APP_STATE.map) {
        return;
    }

    // Limpeza centralizada da camada anterior
    if (window.clearBoundary) {
        window.clearBoundary();
    } else if (APP_STATE.nutsLayer) {
        if (window.boundaryGroup) {
            window.boundaryGroup.removeLayer(APP_STATE.nutsLayer);
        } else {
            APP_STATE.map.removeLayer(APP_STATE.nutsLayer);
        }
        APP_STATE.nutsLayer = null;
    }

    // Se não houver região selecionada, interrompe após limpar
    if (!nutsName) {
        return;
    }

    const feature = nutsData[nutsName];
    if (!feature) {
        console.error("Região não encontrada:", nutsName);
        return;
    }

    // Cria o limite administrativo com "auréola" (casing): uma linha escura
    // mais grossa por baixo e uma linha clara mais fina por cima, técnica
    // cartográfica clássica para se manter legível sobre qualquer basemap
    // — incluindo o "Rua" (claro), onde uma linha só clara desapareceria.
    // pane "boundaryPane" (ver m7_2_map.js) garante que fica sempre acima
    // do raster. Cores neutras (não pertencem a nenhuma paleta de produto),
    // independentes do evento ativo.
    const casing = L.geoJSON(feature, {
        pane: "boundaryPane",
        style: {
            color: "#0b0f14",
            weight: 4.5,
            opacity: 0.85,
            fillOpacity: 0,
            dashArray: "6 3"
        }
    });
    const linha = L.geoJSON(feature, {
        pane: "boundaryPane",
        style: {
            color: "#e5e9f0",
            weight: 2,
            opacity: 0.95,
            fillOpacity: 0,
            dashArray: "6 3"
        }
    });
    APP_STATE.nutsLayer = L.featureGroup([casing, linha]);

    // Adiciona ao grupo correto do m7_2_map.js ou diretamente ao mapa
    if (window.boundaryGroup) {
        window.boundaryGroup.addLayer(APP_STATE.nutsLayer);
    } else {
        APP_STATE.nutsLayer.addTo(APP_STATE.map);
    }

    // Ajusta o foco do mapa (zoom) aos limites da região
    const bounds = APP_STATE.nutsLayer.getBounds();
    APP_STATE.map.fitBounds(bounds, {
        padding: [50, 50]
    });

    console.log("Limite da região", nutsName, "desenhado no mapa");
}

/*=============================================================================
    MANIPULADOR DO EVENTO DE SELEÇÃO (INTEGRADO COM APP_STATE)
=============================================================================*/

function onNUTSSelected(event) {
    const nutsName = event.target.value;

    // Atualiza o estado global da aplicação
    APP_STATE.nuts = nutsName || null;
    console.log("NUTS alterada no estado:", APP_STATE.nuts);

    // Atualiza o mapa com o novo limite ou limpa se for vazio
    drawNUTSBoundary(APP_STATE.nuts);
}

/*=============================================================================
    INICIALIZA O MÓDULO
=============================================================================*/

async function initializeNUTS() {
    console.log("--------------------------------------");
    console.log("Inicializando NUTS...");

    const ok = await loadNUTSGeoJSON();
    if (!ok) {
        console.error("Não foi possível carregar as NUTS.");
        console.log("--------------------------------------");
        return false;
    }

    // Preenche o dropdown UI
    populateNUTSSelect();

    console.log("NUTS inicializado com sucesso.");
    console.log("--------------------------------------");
    return true;
}

/*=============================================================================
    EXPORTAÇÃO GLOBAL
=============================================================================*/

window.initializeNUTS = initializeNUTS;
window.drawNUTSBoundary = drawNUTSBoundary;
window.onNutsChanged = onNUTSSelected; // Mapeia para a chamada do m7_3_controls.js

