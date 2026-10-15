/******************************************************************************
 WEBAPP — Ondas de Calor e Frio
 m7_2_map.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Inicialização do mapa Leaflet.

 Este módulo é responsável por:

    • Criar o mapa
    • Definir a vista inicial
    • Adicionar o mapa base
    • Guardar a instância no APP_STATE

******************************************************************************/

"use strict";

/*=============================================================================
    VARIÁVEIS DO MÓDULO
=============================================================================*/

let baseLayer = null;

/*=============================================================================
    INICIALIZA O MAPA
=============================================================================*/

function initializeMap() {

    console.log("Inicializando mapa...");

    //---------------------------------------------------------
    // Criação do mapa Leaflet
    //---------------------------------------------------------

    APP_STATE.map = L.map("map", {
        zoomControl: true,
        attributionControl: true
    });

    //---------------------------------------------------------
    // >>> AQUI, MESMO AQUI <<<
    //---------------------------------------------------------

    const panes = APP_STATE.map.getPanes();

    panes.tilePane.style.zIndex = 200;
    panes.overlayPane.style.zIndex = 400;
    panes.shadowPane.style.zIndex = 500;
    panes.markerPane.style.zIndex = 600;
    panes.tooltipPane.style.zIndex = 650;
    panes.popupPane.style.zIndex = 700;

    // Pane dedicado aos limites administrativos (NUTS), acima do raster
    // (overlayPane, 400) para que o contorno fique sempre visível por cima.
    APP_STATE.map.createPane("boundaryPane");
    APP_STATE.map.getPane("boundaryPane").style.zIndex = 450;
    APP_STATE.map.getPane("boundaryPane").style.pointerEvents = "none";

    //---------------------------------------------------------
    // Vista inicial
    //---------------------------------------------------------

    APP_STATE.map.setView(
        CONFIG.INITIAL_CENTER,
        CONFIG.INITIAL_ZOOM
    );

    //---------------------------------------------------------
    // Camadas base (Escuro / Claro / Rua / Híbrido)
    //---------------------------------------------------------

    const streetLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    );

    // Basemap escuro (Esri World Dark Gray, gratuito, sem chave de API) —
    // basemap por defeito. Cinza-chumbo em vez de preto puro (tal como o
    // CARTO Dark Matter testado inicialmente) — menos agressivo, preferido
    // após comparação lado a lado das alternativas.
    const darkLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 16,
            attribution: "Tiles &copy; Esri — Source: Esri"
        }
    );

    // Basemap claro (Esri World Light Gray, gratuito, sem chave de API) —
    // par claro do basemap escuro acima. Substitui o CARTO Positron, que
    // em outubro de 2026 passou a exigir chave de API (todas as tiles
    // vinham com "API KEY REQUIRED").
    const lightLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 16,
            attribution: "Tiles &copy; Esri — Source: Esri"
        }
    );

    // Híbrido = imagem de satélite + camada de referência (fronteiras,
    // estradas, topónimos) sobreposta, tal como o "Hybrid" do Google/ArcGIS.
    // Substitui o antigo basemap "Satélite" (imagem pura), que era visualmente
    // quase indistinguível deste.
    const hybridLayer = L.layerGroup([
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 19,
                attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
            }
        ),
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 19
            }
        )
    ]);

    baseLayer = darkLayer;
    baseLayer.addTo(APP_STATE.map);

    L.control.layers(
        {
            "Escuro": darkLayer,
            "Claro": lightLayer,
            "Rua": streetLayer,
            "Híbrido": hybridLayer
        },
        null,
        { position: "topright", collapsed: true }
    ).addTo(APP_STATE.map);

    console.log("Mapa criado com sucesso.");
}


/*=============================================================================
    CAMADAS DO MAPA
=============================================================================*/

/*
    Grupo onde serão desenhados os rasters.

    Apenas existirá um raster visível de cada vez.
*/

const rasterGroup = L.layerGroup([], { pane: "overlayPane" });

/*
    Grupo para limites administrativos.

    (NUTS II, distritos, etc.)
*/

const boundaryGroup = L.layerGroup();

/*
    Grupo para marcadores.

    Será utilizado quando o utilizador clicar
    sobre o mapa.
*/

const markerGroup = L.layerGroup();

/*=============================================================================
    ADICIONA AS CAMADAS AO MAPA
=============================================================================*/

function initializeLayers() {

    console.log("Inicializando grupos de camadas...");

    rasterGroup.addTo(APP_STATE.map);

    boundaryGroup.addTo(APP_STATE.map);

    markerGroup.addTo(APP_STATE.map);

    console.log("Grupos de camadas criados.");

}

/*=============================================================================
    LIMPA O LIMITE DA REGIÃO
=============================================================================*/

function clearBoundary() {

    if (APP_STATE.nutsLayer) {

        boundaryGroup.removeLayer(

            APP_STATE.nutsLayer

        );

        APP_STATE.nutsLayer = null;

    }

}

/*=============================================================================
    LIMPA O MARCADOR
=============================================================================*/

function clearMarker() {

    if (APP_STATE.pointMarker) {

        markerGroup.removeLayer(

            APP_STATE.pointMarker

        );

        APP_STATE.pointMarker = null;

    }

}

/*=============================================================================
    MOSTRA O MARCADOR DO PONTO CLICADO
=============================================================================*/

/*
    Coloca (ou move) um marcador no ponto clicado pelo utilizador,
    usado como referência visual para a Série Temporal do Ponto.
*/
function showPointMarker(latlng) {

    clearMarker();

    APP_STATE.pointMarker = L.marker(latlng);

    markerGroup.addLayer(APP_STATE.pointMarker);

}

/*=============================================================================
    LIMPEZA TOTAL DO MAPA
=============================================================================*/

function clearMap() {

    clearRaster();

    clearBoundary();

    clearMarker();

}

/*=============================================================================
    AJUSTA O MAPA AO RASTER
=============================================================================*/

/*
    Faz zoom automático ao raster carregado.
*/

function zoomToRaster(layer) {

    if (!layer) {

        return;

    }

    try {

        APP_STATE.map.fitBounds(

            layer.getBounds(),

            {

                padding: [20, 20]

            }

        );

    }

    catch (error) {

        console.error(

            "Erro ao ajustar zoom ao raster:",

            error

        );

    }

}

/*=============================================================================
    AJUSTA O MAPA À REGIÃO
=============================================================================*/

/*
    Faz zoom à região atualmente selecionada.
*/

function zoomToBoundary() {

    if (!APP_STATE.nutsLayer) {

        return;

    }

    APP_STATE.map.fitBounds(

        APP_STATE.nutsLayer.getBounds(),

        {

            padding: [20, 20]

        }

    );

}

/*=============================================================================
    VOLTAR À VISTA INICIAL
=============================================================================*/

function resetMapView() {

    APP_STATE.map.setView(

        CONFIG.INITIAL_CENTER,

        CONFIG.INITIAL_ZOOM

    );

}

/*=============================================================================
    OBTÉM A EXTENSÃO DO MAPA
=============================================================================*/

function getCurrentBounds() {

    return APP_STATE.map.getBounds();

}

/*=============================================================================
    OBTÉM O CENTRO DO MAPA
=============================================================================*/

function getCurrentCenter() {

    return APP_STATE.map.getCenter();

}

/*=============================================================================
    OBTÉM O NÍVEL DE ZOOM
=============================================================================*/

function getCurrentZoom() {

    return APP_STATE.map.getZoom();

}

/*=============================================================================
    EVENTOS DO MAPA
=============================================================================*/

/*
    Regista os eventos principais do Leaflet.
*/

function registerMapEvents() {

    console.log("A registar eventos do mapa...");

    //---------------------------------------------------------
    // Clique no mapa
    //---------------------------------------------------------

    APP_STATE.map.on(

        "click",

        function (event) {

            console.log(

                "Clique:",

                event.latlng.lat,

                event.latlng.lng

            );

            if (typeof handleMapPointClick === "function") {
                handleMapPointClick(event.latlng);
            }

        }

    );

    //---------------------------------------------------------
    // Fim de zoom
    //---------------------------------------------------------

    APP_STATE.map.on(

        "zoomend",

        function () {

            console.log(

                "Zoom:",

                APP_STATE.map.getZoom()

            );

        }

    );

}

/*=============================================================================
    INICIALIZA TODO O MAPA
=============================================================================*/

/*
    Função principal deste módulo.

    Será chamada pelo m7_7_main.js
*/

function initializeLeafletMap() {

    console.log("--------------------------------------");

    console.log("Inicialização do módulo MAP");

    initializeMap();

    initializeLayers();

    registerMapEvents();

    clearLegend();

    console.log("Módulo MAP inicializado.");

    console.log("--------------------------------------");

}

/*=============================================================================
    EXPORTAÇÃO GLOBAL

    "const" no topo de um script clássico não fica acessível como
    window.algo (ao contrário de "function"/"var") — por isso os outros
    módulos, que verificam window.rasterGroup / window.boundaryGroup,
    nunca os encontravam e caíam sempre no caminho alternativo.
=============================================================================*/

window.rasterGroup = rasterGroup;

window.boundaryGroup = boundaryGroup;

window.markerGroup = markerGroup;