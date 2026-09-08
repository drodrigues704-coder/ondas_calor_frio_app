/******************************************************************************
 WEBAPP — Ondas de Calor e Frio
 m7_3_controls.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Gestão dos controlos da interface.

 Este módulo é responsável por:

    • Controlos HTML
    • Atualização do APP_STATE
    • Comunicação com o mapa
    • Comunicação com o backend
    • Sincronização da interface

******************************************************************************/

"use strict";

/*=============================================================================
    ELEMENTOS DA INTERFACE
=============================================================================*/

const controls = {

    //----------------------------------------------------------
    // Região
    //----------------------------------------------------------

    nuts:

        document.getElementById("nuts-select"),

    //----------------------------------------------------------
    // Evento
    //----------------------------------------------------------

    event:

        document.getElementById("event-select"),

    //----------------------------------------------------------
    // Variável
    //----------------------------------------------------------

    variable:

        document.getElementById("variable-select"),

    //----------------------------------------------------------
    // Estatística
    //----------------------------------------------------------

    statistic:

        document.getElementById("stat-select"),

    //----------------------------------------------------------
    // Ano
    //----------------------------------------------------------

    yearSlider:

        document.getElementById("year-slider"),

    yearValue:

        document.getElementById("year-value"),

    //----------------------------------------------------------
    // Metodologia
    //----------------------------------------------------------

    methodButtons:

        document.querySelectorAll("#method-toggle .segmented-option"),

    //----------------------------------------------------------
    // Download
    //----------------------------------------------------------

    download:

        document.getElementById("download-button")

};

/*=============================================================================
    VERIFICAÇÃO DOS ELEMENTOS
=============================================================================*/

function validateControls() {

    console.log("--------------------------------------");

    console.log("Verificando interface...");

    let valid = true;

    for (const [name, element] of Object.entries(controls)) {

        if (!element) {

            console.error(

                "Elemento não encontrado:",

                name

            );

            valid = false;

        }

    }

    if (valid) {

        console.log("Todos os controlos encontrados.");

    }

    console.log("--------------------------------------");

    return valid;

}

/*=============================================================================
    OBTÉM UM CONTROLO
=============================================================================*/

function getControl(name) {

    return controls[name];

}

/*=============================================================================
    ATIVA OU DESATIVA UM CONTROLO
=============================================================================*/

function enableControl(name, enabled = true) {

    const control = getControl(name);

    if (!control) {

        return;

    }

    control.disabled = !enabled;

}

/*=============================================================================
    PREENCHIMENTO DOS CONTROLOS
=============================================================================*/

/*
    Preenche a lista de variáveis.
*/

function populateVariables() {

    controls.variable.innerHTML = "";

    Object.entries(VARIAVEIS).forEach(

        ([id, info]) => {

            const option = document.createElement("option");

            option.value = id;

            option.textContent = info.label;

            controls.variable.appendChild(option);

        }

    );

}

/*
    Preenche a lista de estatísticas.
*/

function populateStatistics() {

    controls.statistic.innerHTML = "";

    ESTATISTICAS.forEach(

        (item) => {

            const option = document.createElement("option");

            option.value = item.id;

            option.textContent = item.label;

            controls.statistic.appendChild(option);

        }

    );

}

/*=============================================================================
    SINCRONIZA A INTERFACE COM O APP_STATE
=============================================================================*/

function updateControlsFromState() {

    controls.event.value = APP_STATE.evento;

    controls.variable.value = APP_STATE.variavel;

    controls.statistic.value = APP_STATE.estatistica;

    controls.yearSlider.value = APP_STATE.ano;

    controls.yearValue.textContent = APP_STATE.ano;

    controls.methodButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.method === APP_STATE.metodo);
    });

}

/*=============================================================================
    INICIALIZAÇÃO DOS CONTROLOS
=============================================================================*/


/*=============================================================================
    EVENTOS DOS CONTROLOS
=============================================================================*/

/*
    Alteração do tipo de evento
*/

function onEventChanged() {

    console.log("✓ onEventChanged() chamada");

    APP_STATE.evento = controls.event.value;

    console.log("Evento alterado para:", APP_STATE.evento);

    updateRaster();

}

/*
    Alteração da variável
*/

function onVariableChanged() {

    APP_STATE.variavel = controls.variable.value;

    console.log(

        "Variável:",

        APP_STATE.variavel

    );

    updateRaster();

}

/*
    Alteração da estatística
*/

function onStatisticChanged() {

    APP_STATE.estatistica = controls.statistic.value;

    console.log(

        "Estatística:",

        APP_STATE.estatistica

    );

    updateYearSliderState();

    updateRaster();

}

/*=============================================================================
    REGISTO DOS EVENTOS
=============================================================================*/

function registerControlEvents() {

    console.log("A registar eventos dos controlos...");

    //----------------------------------------------------------
    // Evento
    //----------------------------------------------------------

    controls.event.addEventListener(

        "change",

        onEventChanged

    );

    //----------------------------------------------------------
    // Variável
    //----------------------------------------------------------

    controls.variable.addEventListener(

        "change",

        onVariableChanged

    );

    //----------------------------------------------------------
    // Estatística
    //----------------------------------------------------------

    controls.statistic.addEventListener(

        "change",

        onStatisticChanged

    );

    console.log("Eventos registados.");

}

/*=============================================================================
    ALTERAÇÃO DO ANO
=============================================================================*/

/*
    Atualiza o ano atualmente selecionado.
*/

function onYearChanged() {

    APP_STATE.ano = Number(

        controls.yearSlider.value

    );

    controls.yearValue.textContent = APP_STATE.ano;

    console.log(

        "Ano:",

        APP_STATE.ano

    );

    updateRaster();

}

/*=============================================================================
    ALTERAÇÃO DA METODOLOGIA (OMM / PERCENTIS)
=============================================================================*/

function onMethodChanged(metodo) {

    APP_STATE.metodo = metodo;

    controls.methodButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.method === metodo);
    });

    console.log("Metodologia:", APP_STATE.metodo);

    updateRaster();

}

/*=============================================================================
    ALTERAÇÃO DA REGIÃO
=============================================================================*/

/*
    Atualiza a região NUTS II atualmente selecionada.
*/

async function onNutsChanged() {

    APP_STATE.nuts = controls.nuts.value;

    console.log(

        "Região:",

        APP_STATE.nuts

    );

    drawNUTSBoundary(APP_STATE.nuts);

    await updateRaster();

}

/*=============================================================================
    ATIVA / DESATIVA O SLIDER
=============================================================================*/

/*
    O slider apenas faz sentido quando a estatística
    corresponde a um ano específico.
*/

function updateYearSliderState() {

    const annualMode =

        APP_STATE.estatistica === "ano";

    enableControl(

        "yearSlider",

        annualMode

    );

    if (!annualMode) {

        controls.yearValue.textContent =

            APP_STATE.estatistica;

    }

    else {

        controls.yearValue.textContent =

            APP_STATE.ano;

    }

}

/*=============================================================================
    REGISTA OS RESTANTES EVENTOS
=============================================================================*/

/*
    Complementa o registo iniciado na Parte 3.
*/

function registerAdditionalControlEvents() {

    //----------------------------------------------------------
    // Slider do ano
    //----------------------------------------------------------

    controls.yearSlider.addEventListener(

        "input",

        onYearChanged

    );

    //----------------------------------------------------------
    // Região NUTS II
    //----------------------------------------------------------

    controls.nuts.addEventListener(

        "change",

        onNutsChanged

    );

}

/*=============================================================================
    ATUALIZA TODOS OS CONTROLOS
=============================================================================*/

/*
    Sincroniza a interface com o estado atual da aplicação.
*/

function refreshControls() {

    updateControlsFromState();

    updateYearSliderState();

}

/*=============================================================================
    REINICIALIZA A INTERFACE
=============================================================================*/

/*
    Repõe os valores por defeito.
*/

function resetControls() {

    APP_STATE.evento = "Heat";

    APP_STATE.variavel = "numero_eventos";

    APP_STATE.estatistica = "ano";

    APP_STATE.ano = CONFIG.START_YEAR;

    APP_STATE.nuts = null;

    APP_STATE.metodo = "OMM";

    APP_STATE.opacidade = 0.55;

    refreshControls();

    console.log("Controlos reinicializados.");

}

/*=============================================================================
    OBTÉM O ESTADO ATUAL DOS CONTROLOS
=============================================================================*/

/*
    Função útil para debug.
*/

function getControlState() {

    return {

        evento: APP_STATE.evento,

        variavel: APP_STATE.variavel,

        estatistica: APP_STATE.estatistica,

        ano: APP_STATE.ano,

        nuts: APP_STATE.nuts

    };

}

/*=============================================================================
    DEBUG
=============================================================================*/

function printControlsState() {

    console.log("--------------------------------------");

    console.log("Estado dos controlos");

    console.table(

        getControlState()

    );

    console.log("--------------------------------------");

}

/* ============================================================================
   POPULATE EVENT SELECT
============================================================================ */

function populateEventSelect() {

    controls.event.innerHTML = "";

    const events = [
        { value: "Heat", label: "Ondas de Calor" },
        { value: "Cold", label: "Ondas de Frio" }
    ];

    events.forEach((event) => {

        const option = document.createElement("option");

        option.value = event.value;

        option.textContent = event.label;

        controls.event.appendChild(option);

    });

}

/* ============================================================================
   POPULATE VARIABLE SELECT
============================================================================ */

function populateVariableSelect() {

    controls.variable.innerHTML = "";

    populateVariables();

}

/* ============================================================================
   POPULATE STATISTIC SELECT
============================================================================ */

function populateStatisticSelect() {

    controls.statistic.innerHTML = "";

    populateStatistics();

}

/* ============================================================================
   INITIALIZE YEAR SLIDER
============================================================================ */

function initializeYearSlider() {

    if (!controls.yearSlider) {

        return;

    }

    controls.yearSlider.addEventListener("input", onYearChanged);

}

/* ============================================================================
   BOTÃO DE DOWNLOAD
============================================================================ */

/*
    Descarrega o GeoTIFF do raster atualmente representado no mapa.
    "currentDatasetURL" (m7_4_raster.js) é o URL do último raster
    efetivamente carregado — o mesmo que está a ser desenhado.
*/
function onDownloadClicked() {

    if (typeof currentDatasetURL === "undefined" || !currentDatasetURL) {
        console.warn("Não há nenhum raster carregado para descarregar.");
        if (typeof showMessage === "function") {
            showMessage("Seleciona uma região e um indicador antes de descarregar.");
        }
        return;
    }

    console.log("A descarregar:", currentDatasetURL);
    window.location.href = currentDatasetURL;

}

/* ============================================================================
    ATTACH CONTROL EVENTS (CORRIGIDO)
============================================================================ */

function attachControlEvents() {

    console.log("A registar eventos dos controlos...");

    //----------------------------------------------------------
    // Dropdowns Principais
    //----------------------------------------------------------

    controls.event.addEventListener(
        "change",
        onEventChanged
    );

    controls.variable.addEventListener(
        "change",
        onVariableChanged
    );

    controls.statistic.addEventListener(
        "change",
        onStatisticChanged
    );

    //----------------------------------------------------------
    // Slider e Região NUTS
    //----------------------------------------------------------

    controls.yearSlider.addEventListener(
        "input",
        onYearChanged
    );

    controls.nuts.addEventListener(
        "change",
        onNutsChanged
    );

    //----------------------------------------------------------
    // Metodologia (OMM / Percentis)
    //----------------------------------------------------------

    controls.methodButtons.forEach((btn) => {
        btn.addEventListener("click", () => onMethodChanged(btn.dataset.method));
    });

    //----------------------------------------------------------
    // Botão Download — desativado (app só de visualização, por pedido).
    // Comentado, não apagado: o botão em index.html também está comentado,
    // por isso "controls.download" já é null e este bloco nunca corria de
    // qualquer forma — mantido comentado aqui só para tornar a decisão
    // explícita, em vez de depender implicitamente do elemento em falta.
    //----------------------------------------------------------

    // if (controls.download) {
    //     controls.download.addEventListener(
    //         "click",
    //         onDownloadClicked
    //     );
    // }

    updateYearSliderState();

    console.log("Eventos registados sem duplicações.");

}

/* ============================================================================
    INICIALIZAÇÃO DOS CONTROLOS (CORRIGIDO)
============================================================================= */

/*
    Inicializa todos os elementos da interface.
*/

function initializeControls() {

    console.log("Inicializar controlos...");

    //----------------------------------------------------------
    // Preenchimento dos Dropdowns
    //----------------------------------------------------------

    populateEventSelect();

    populateVariableSelect();

    populateStatisticSelect();

    updateControlsFromState();

    updateYearSliderState();

    //----------------------------------------------------------
    // Registo Único de Eventos
    //----------------------------------------------------------

    attachControlEvents();

    console.log("✔ Controlos inicializados.");

}

/* ============================================================================
    EXPORTAÇÃO GLOBAL
============================================================================ */

window.initializeControls = initializeControls;