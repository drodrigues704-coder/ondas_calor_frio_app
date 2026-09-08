/******************************************************************************
 SNIPPET_START
 WEBAPP — Ondas de Calor e Frio
 m7_5_charts.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Gestão dos gráficos da aplicação utilizando a biblioteca Chart.js.

 Este módulo é responsável por:
    • Gráfico temporal regional
    • Gráfico temporal do ponto selecionado
    • Atualização din mica dos gráficos
    • Destruição e recriação segura quando necessário
******************************************************************************/

"use strict";

/* ============================================================================
    VARIÁVEIS GLOBAIS DO MÓDULO
============================================================================ */

let regionalChart = null;
let pointChart = null;

/* ============================================================================
    CORES DOS GRÁFICOS (POR EVENTO)
============================================================================ */

const CHART_COLORS = {
    Heat: {
        border: "#d73027",
        background: "rgba(215,48,39,0.15)"
    },
    Cold: {
        border: "#4575b4",
        background: "rgba(69,117,180,0.15)"
    }
};

/*
    Defaults globais do Chart.js para o tema escuro da aplicação — texto
    (eixos, legenda, título) e linhas de grelha claras, para se lerem sobre
    o painel escuro (ver #regional-chart/#point-chart em style.css).
    Aplicados uma única vez, antes de qualquer gráfico ser criado.
*/
if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#8b95a5";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
}

/* ============================================================================
    FUNÇÕES AUXILIARES E CONTEXTOS
============================================================================ */

/*
    Obtém a cor correspondente ao tipo de evento ativo.
*/
function getChartColor() {
    return CHART_COLORS[APP_STATE.evento] || CHART_COLORS.Heat;
}

/*
    Obtém a unidade de medida atual de forma segura.
*/
function getActiveUnit() {
    if (typeof getCurrentVariable === 'function') {
        const variable = getCurrentVariable();
        if (variable && variable.unidade) {
            return variable.unidade;
        }
    }
    return "Valor";
}

/*
    Obtém o contexto 2D do Canvas regional.
*/
function getRegionalContext() {
    const canvas = document.getElementById("regional-chart");
    if (!canvas) {
        console.warn("Canvas regional inexistente.");
        return null;
    }
    return canvas.getContext("2d");
}

/*
    Obtém o contexto 2D do Canvas do ponto selecionado.
*/
function getPointContext() {
    const canvas = document.getElementById("point-chart");
    if (!canvas) {
        console.warn("Canvas do ponto inexistente.");
        return null;
    }
    return canvas.getContext("2d");
}

/* ============================================================================
    DESTRUIÇÃO DE GRÁFICOS (GESTÃO DE MEMÓRIA)
============================================================================ */

function destroyRegionalChart() {
    if (regionalChart) {
        regionalChart.destroy();
        regionalChart = null;
    }
}

function destroyPointChart() {
    if (pointChart) {
        pointChart.destroy();
        pointChart = null;
    }
}

function clearCharts() {
    destroyRegionalChart();
    destroyPointChart();
}

function resetCharts() {
    clearCharts();
}

/* ============================================================================
    CRIAÇÃO DOS GRÁFICOS (CHART.JS)
============================================================================ */

/*
    Cria de raiz o gráfico temporal regional.
*/
function createRegionalChart(labels, values) {
    destroyRegionalChart();

    const ctx = getRegionalContext();
    if (!ctx) return;

    if (typeof Chart === 'undefined') {
        console.error("A biblioteca Chart.js não está carregada globalmente.");
        return;
    }

    const colors = getChartColor();
    const unitText = getActiveUnit();

    regionalChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Série Temporal Regional",
                    data: values,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#c5cbd6" }
                },
                title: {
                    display: true,
                    text: "Evolução Temporal Regional",
                    color: "#c5cbd6"
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Ano",
                        color: "#8b95a5"
                    },
                    ticks: { color: "#8b95a5" },
                    grid: { color: "rgba(255, 255, 255, 0.08)" }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: unitText,
                        color: "#8b95a5"
                    },
                    ticks: { color: "#8b95a5" },
                    grid: { color: "rgba(255, 255, 255, 0.08)" }
                }
            }
        }
    });
}

/*
    Cria de raiz o gráfico temporal do ponto geográfico selecionado.
*/
function createPointChart(labels, values) {
    destroyPointChart();

    const ctx = getPointContext();
    if (!ctx) return;

    if (typeof Chart === 'undefined') {
        console.error("A biblioteca Chart.js não está carregada globalmente.");
        return;
    }

    const colors = getChartColor();
    const unitText = getActiveUnit();

    pointChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Série Temporal do Ponto",
                    data: values,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#c5cbd6" }
                },
                title: {
                    display: true,
                    text: "Evolução Temporal do Ponto",
                    color: "#c5cbd6"
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Ano",
                        color: "#8b95a5"
                    },
                    ticks: { color: "#8b95a5" },
                    grid: { color: "rgba(255, 255, 255, 0.08)" }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: unitText,
                        color: "#8b95a5"
                    },
                    ticks: { color: "#8b95a5" },
                    grid: { color: "rgba(255, 255, 255, 0.08)" }
                }
            }
        }
    });
}

/* ============================================================================
    ATUALIZAÇÃO DINÂMICA DOS GRÁFICOS
============================================================================ */

function updateRegionalChart(labels, values) {
    if (!regionalChart) {
        createRegionalChart(labels, values);
        return;
    }

    const colors = getChartColor();
    regionalChart.data.labels = labels;
    regionalChart.data.datasets[0].data = values;
    regionalChart.data.datasets[0].borderColor = colors.border;
    regionalChart.data.datasets[0].backgroundColor = colors.background;
    regionalChart.options.scales.y.title.text = getActiveUnit();
    regionalChart.update();
}

function updatePointChart(labels, values) {
    if (!pointChart) {
        createPointChart(labels, values);
        return;
    }

    const colors = getChartColor();
    pointChart.data.labels = labels;
    pointChart.data.datasets[0].data = values;
    pointChart.data.datasets[0].borderColor = colors.border;
    pointChart.data.datasets[0].backgroundColor = colors.background;
    pointChart.options.scales.y.title.text = getActiveUnit();
    pointChart.update();
}

/* ============================================================================
    DADOS DE TESTE (MOCK DATA)
============================================================================ */

function createMockYears() {
    const years = [];
    const startYear = (typeof CONFIG !== 'undefined' && CONFIG.START_YEAR) ? CONFIG.START_YEAR : 2000;
    const endYear = (typeof CONFIG !== 'undefined' && CONFIG.END_YEAR) ? CONFIG.END_YEAR : 2026;

    for (let year = startYear; year <= endYear; year++) {
        years.push(year);
    }
    return years;
}

function createMockSeries(min = 0, max = 10) {
    const values = [];
    const startYear = (typeof CONFIG !== 'undefined' && CONFIG.START_YEAR) ? CONFIG.START_YEAR : 2000;
    const endYear = (typeof CONFIG !== 'undefined' && CONFIG.END_YEAR) ? CONFIG.END_YEAR : 2026;

    for (let year = startYear; year <= endYear; year++) {
        values.push(
            Number((Math.random() * (max - min) + min).toFixed(2))
        );
    }
    return values;
}

function loadMockCharts() {
    const years = createMockYears();
    updateRegionalChart(years, createMockSeries(0, 8));
    updatePointChart(years, createMockSeries(0, 15));
    console.log("✔ Gráficos de teste carregados com sucesso.");
}

/* ============================================================================
    INICIALIZAÇÃO E EVENTOS DA JANELA
============================================================================ */

function initializeCharts() {
    console.log("Inicializando módulo de gráficos...");
    resetCharts();
}

/*
    Redimensiona os gráficos existentes aos novos limites do canvas.
    Partilhada pelos listeners "resize" e "orientationchange" abaixo —
    ambos precisam exatamente do mesmo ajuste, só o gatilho é diferente.
*/
function handleChartsViewportChange() {
    if (regionalChart) regionalChart.resize();
    if (pointChart) pointChart.resize();
}

window.addEventListener("resize", handleChartsViewportChange);

// Em telemóveis, "orientationchange" dispara antes de o browser
// terminar o reflow do layout — ler as dimensões do canvas de imediato
// dava por vezes o tamanho da orientação anterior. O pequeno atraso
// garante que o Chart.js já vê as dimensões finais.
window.addEventListener("orientationchange", () => {
    setTimeout(handleChartsViewportChange, 200);
});

/* ============================================================================
    DIAGNÓSTICO / DEBUG
============================================================================ */

function printChartsStatus() {
    console.log("====================================");
    console.log("Estado dos gráficos");
    console.log({
        regionalChart: regionalChart !== null,
        pointChart: pointChart !== null,
        evento: APP_STATE.evento,
        variavel: APP_STATE.variavel,
        estatistica: APP_STATE.estatistica,
        ano: APP_STATE.ano
    });
    console.log("====================================");
}

/* ============================================================================
    EXPORTAÇÃO PARA O ESCOPO GLOBAL
============================================================================ */

window.initializeCharts = initializeCharts;
window.updateRegionalChart = updateRegionalChart;
window.updatePointChart = updatePointChart;
window.clearCharts = clearCharts;
window.resetCharts = resetCharts;
window.loadMockCharts = loadMockCharts;
window.printChartsStatus = printChartsStatus;
window.handleChartsViewportChange = handleChartsViewportChange;

/* ============================================================================
    MÓDULO CARREGADO
============================================================================ */

console.log("✔ m7_5_charts.js carregado.");
