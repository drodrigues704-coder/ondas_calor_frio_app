console.log("CONFIG A SER EXECUTADO");

"use strict";

/* =============================================================================
   WEBAPP — Ondas de Calor e Frio
   m7_1_config.js

   Configuração global da aplicação.
   Este módulo apenas define constantes e o estado global.
============================================================================= */

/* =============================================================================
   CONFIGURAÇÃO GERAL
============================================================================= */

const CONFIG = Object.freeze({

    //----------------------------------------------------------------------
    // Backend
    //----------------------------------------------------------------------

    API_BASE: window.location.origin,

    //----------------------------------------------------------------------
    // Intervalo temporal
    //----------------------------------------------------------------------

    START_YEAR: 2001,
    END_YEAR: 2025,

    //----------------------------------------------------------------------
    // Sistema de referência
    //----------------------------------------------------------------------

    CRS: "EPSG:3857",

    //----------------------------------------------------------------------
    // Resolução dos rasters CERRA
    //----------------------------------------------------------------------

    PIXEL_SIZE: 5500,

    //----------------------------------------------------------------------
    // Stretch por defeito
    //----------------------------------------------------------------------

    STRETCH_MIN: 2,
    STRETCH_MAX: 98,

    //----------------------------------------------------------------------
    // Mapa
    //----------------------------------------------------------------------

    INITIAL_ZOOM: 7,

    INITIAL_CENTER: [
        39.55,
        -8.15
    ]

});

/* =============================================================================
   ENDPOINTS DA API
============================================================================= */

const API = Object.freeze({

    STATUS: `${CONFIG.API_BASE}/status`,

    HEALTH: `${CONFIG.API_BASE}/health`,

    CATALOG: `${CONFIG.API_BASE}/catalog/summary`,

    DATASETS: `${CONFIG.API_BASE}/api/datasets`,

    STATS: `${CONFIG.API_BASE}/api/stats`,

    DOWNLOAD: `${CONFIG.API_BASE}/api/download`

});

/* =============================================================================
   ESTADO GLOBAL
============================================================================= */

const APP_STATE = {

    //----------------------------------------------------------------------
    // Seleção atual
    //----------------------------------------------------------------------

    nuts: null,

    evento: "Heat",

    variavel: "numero_eventos",

    estatistica: "ano",

    ano: CONFIG.START_YEAR,

    metodo: "OMM",

    opacidade: 0.55,

    //----------------------------------------------------------------------
    // Objetos do mapa
    //----------------------------------------------------------------------

    map: null,

    raster: null,

    rasterLayer: null,

    nutsLayer: null,

    pointMarker: null,

    //----------------------------------------------------------------------
    // Gráficos
    //----------------------------------------------------------------------

    regionalChart: null,

    pointChart: null

};

/* =============================================================================
   EVENTOS
============================================================================= */

const EVENTOS = Object.freeze({

    Heat: Object.freeze({

        id: "Heat",

        label: "Ondas de Calor",

        descricao:
            "Períodos consecutivos com temperatura máxima acima do limiar climatológico.",

        palette: [

            "#ffffcc",
            "#ffeda0",
            "#fed976",
            "#feb24c",
            "#fd8d3c",
            "#fc4e2a",
            "#e31a1c",
            "#b10026"

        ]

    }),

    Cold: Object.freeze({

        id: "Cold",

        label: "Ondas de Frio",

        descricao:
            "Períodos consecutivos com temperatura mínima abaixo do limiar climatológico.",

        palette: [

            "#f7fcff",
            "#e0ecf4",
            "#bfd3e6",
            "#9ebcda",
            "#8c96c6",
            "#8c6bb1",
            "#88419d",
            "#6e016b"

        ]

    })

});

/* =============================================================================
   METODOLOGIAS
============================================================================= */

const METODOLOGIAS = Object.freeze({

    OMM: Object.freeze({

        id: "OMM",

        label: "OMM",

        descricao:
            "Deteção baseada em limiares fixos definidos pela metodologia da Organização Meteorológica Mundial."

    }),

    Percentis: Object.freeze({

        id: "Percentis",

        label: "Percentis",

        descricao:
            "Deteção baseada em limiares por percentil (P90 calor / P10 frio) da climatologia local."

    })

});

/* =============================================================================
   VARIÁVEIS
============================================================================= */

const VARIAVEIS = Object.freeze({

    numero_eventos: Object.freeze({

        id: "numero_eventos",

        label: "N.º de Eventos",

        unidade: "eventos"

    }),

    dias_evento: Object.freeze({

        id: "dias_evento",

        label: "Dias em Evento",

        unidade: "dias"

    }),

    duracao_max: Object.freeze({

        id: "duracao_max",

        label: "Duração Máxima",

        unidade: "dias"

    }),

    intensidade_max: Object.freeze({

        id: "intensidade_max",

        label: "Intensidade Máxima",

        unidade: "°C"

    }),

    intensidade_total: Object.freeze({

        id: "intensidade_total",

        label: "Intensidade Total",

        unidade: "°C"

    })

});

/* =============================================================================
   ESTATÍSTICAS
============================================================================= */

const ESTATISTICAS = Object.freeze([

    Object.freeze({

        id: "ano",

        label: "Ano específico"

    }),

    Object.freeze({

        id: "media",

        label: "Média"

    }),

    Object.freeze({

        id: "mediana",

        label: "Mediana"

    }),

    Object.freeze({

        id: "max",

        label: "Máximo"

    })

]);

/* =============================================================================
   CLASSIFICAÇÃO DE CORES
   (partilhada entre a pintura do raster em m7_4_raster.js e a legenda em
   m7_6_ui.js, para que ambas mostrem exatamente a mesma classificação)
============================================================================= */

/*
    Amostra "n" cores ao longo de uma palete maior, preservando a
    progressão de cores original (primeira e última cor mantidas).
*/
function sampleColors(palette, n) {
    if (n <= 1) {
        return [palette[palette.length - 1]];
    }

    const amostra = [];

    for (let i = 0; i < n; i++) {
        const indice = Math.round((i / (n - 1)) * (palette.length - 1));
        amostra.push(palette[indice]);
    }

    return amostra;
}

/*
    Decide quantas classes fazem sentido para o intervalo de valores
    atual, em vez de usar sempre o número fixo de cores da palete-base:

    - Variáveis inteiras com poucos valores distintos (ex. número de
      eventos entre 0 e 2) mostram uma classe por valor.
    - Restantes casos usam um número moderado de classes contínuas.
*/
function calcularClasses(min, max, ehInteiro) {
    const amplitude = max - min;

    if (ehInteiro && amplitude <= 10) {
        return Math.max(1, Math.round(amplitude) + 1);
    }

    return Math.min(6, Math.max(3, Math.round(amplitude) + 1));
}

/* =============================================================================
   FUNÇÕES AUXILIARES
============================================================================= */

/*
    Indica se a aplicação está em modo anual.
*/
function isAnnualMode() {

    return APP_STATE.estatistica === "ano";

}

/*
    Período atualmente selecionado.

    Se estivermos em modo anual devolve o ano.
    Caso contrário devolve a estatística (media, mediana, max).
*/
function getCurrentPeriod() {

    return isAnnualMode()

        ? String(APP_STATE.ano)

        : APP_STATE.estatistica;

}

/*
    Nome lógico do dataset.
*/
function getDatasetKey() {

    return isAnnualMode()

        ? `${APP_STATE.variavel}_${APP_STATE.ano}`

        : `${APP_STATE.variavel}_${APP_STATE.estatistica}`;

}

/*
    Alias para compatibilidade com módulos antigos.
*/
function getDatasetName() {

    return getDatasetKey();

}

/*
    Evento atualmente selecionado.
*/
function getCurrentEvent() {

    return EVENTOS[APP_STATE.evento] ?? null;

}

/*
    Metodologia atualmente selecionada (OMM ou Percentis).
*/
function getCurrentMethod() {

    return METODOLOGIAS[APP_STATE.metodo] ?? METODOLOGIAS.OMM;

}

/*
    Variável atualmente selecionada.
*/
function getCurrentVariable() {

    return VARIAVEIS[APP_STATE.variavel] ?? null;

}

/*
    Estatística atualmente selecionada.
*/
function getCurrentStatistic() {

    return APP_STATE.estatistica;

}

/*
    Ano atualmente selecionado.
*/
function getCurrentYear() {

    return APP_STATE.ano;

}

/*
    Devolve uma cópia do estado atual.

    Evita que outros módulos modifiquem APP_STATE
    inadvertidamente.
*/
function getApplicationState() {

    return structuredClone(APP_STATE);

}

/*
    Informação de diagnóstico.
*/
function printCurrentState() {

    console.log("========================================");

    console.log("APP_STATE");

    console.table({

        evento: APP_STATE.evento,

        variavel: APP_STATE.variavel,

        estatistica: APP_STATE.estatistica,

        periodo: getCurrentPeriod(),

        ano: APP_STATE.ano,

        nuts: APP_STATE.nuts

    });

    console.log("Dataset:", getDatasetName());

    console.log("========================================");

}

printCurrentState();

/* =============================================================================
   EXPORTAÇÃO GLOBAL
============================================================================= */

/*
    Configuração global
*/

window.CONFIG = CONFIG;

/*
    Endpoints da API
*/

window.API = API;

/*
    Estado global
*/

window.APP_STATE = APP_STATE;

/*
    Catálogos
*/

window.EVENTOS = EVENTOS;

window.METODOLOGIAS = METODOLOGIAS;

window.VARIAVEIS = VARIAVEIS;

window.ESTATISTICAS = ESTATISTICAS;

/*
    Funções auxiliares
*/

window.sampleColors = sampleColors;

window.calcularClasses = calcularClasses;

window.isAnnualMode = isAnnualMode;

window.getCurrentPeriod = getCurrentPeriod;

window.getDatasetKey = getDatasetKey;

window.getDatasetName = getDatasetName;

window.getCurrentEvent = getCurrentEvent;

window.getCurrentMethod = getCurrentMethod;

window.getCurrentVariable = getCurrentVariable;

window.getCurrentStatistic = getCurrentStatistic;

window.getCurrentYear = getCurrentYear;

window.getApplicationState = getApplicationState;

window.printCurrentState = printCurrentState;

/* =============================================================================
   MÓDULO CARREGADO
============================================================================= */

console.log("✔ m7_1_config.js carregado.");