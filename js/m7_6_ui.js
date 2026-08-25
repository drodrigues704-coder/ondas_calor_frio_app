/******************************************************************************
 SNIPPET_START
 WEBAPP — Ondas de Calor e Frio
 m7_6_ui.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Gestão da interface gráfica (UI).

 Este módulo controla:
    • Mensagens de estado e feedback ao utilizador
    • Painel dinâmico de estatísticas territoriais
    • Legenda de classes do mapa base
    • Sincronização de labels do estado da aplicação
******************************************************************************/

"use strict";

/* ============================================================================
    ELEMENTOS DA INTERFACE (DOM)
============================================================================ */

const UI = {
    legend: document.getElementById("legend"),
    year: document.getElementById("year-value")
};

/* ============================================================================
    MENSAGENS DE ESTADO
============================================================================ */

/*
    Regista uma mensagem de estado/erro da aplicação. O painel de
    Estatísticas que antes mostrava isto visualmente foi removido; mantém-se
    só o registo em consola, útil para diagnóstico.
*/
function showMessage(message) {
    console.log("Estado da aplicação:", message);
}

/* ============================================================================
    SINCRONIZAÇÃO DE LABELS
============================================================================ */

/*
    Atualiza o elemento visual que exibe o ano selecionado na aplicação.
*/
function updateYearLabel() {
    if (!UI.year) return;
    UI.year.textContent = APP_STATE.ano || "-";
}

/* ============================================================================
    RENDERIZAÇÃO DA LEGENDA DO MAPA
============================================================================ */

/*
    Gera dinamicamente o HTML da legenda com base na palete do evento ativo,
    na variável selecionada e no intervalo real de valores do raster
    atualmente desenhado (rasterMinimum/rasterMaximum/rasterIsInteger,
    definidos em m7_4_raster.js — partilhados por estarem no âmbito
    global do documento).
*/
function updateLegend() {
    if (!UI.legend) return;

    const evento = (typeof getCurrentEvent === 'function') ? getCurrentEvent() : null;
    const variavel = (typeof getCurrentVariable === 'function') ? getCurrentVariable() : null;

    if (!evento) {
        UI.legend.innerHTML = "<p><small>A carregar legenda...</small></p>";
        return;
    }

    const titleText = evento.label || "Evento";
    const paletaBase = evento.palette || [];

    const unidade = variavel?.unidade ? ` (${variavel.unidade})` : "";

    const min = (typeof rasterMinimum === "number" && isFinite(rasterMinimum)) ? rasterMinimum : 0;
    const max = (typeof rasterMaximum === "number" && isFinite(rasterMaximum)) ? rasterMaximum : 1;
    const ehInteiro = (typeof rasterIsInteger === "boolean") ? rasterIsInteger : false;

    let html = `<h3>${titleText}</h3>`;

    if (variavel?.label) {
        html += `<p class="legend-subtitle">${variavel.label}${unidade}</p>`;
    }

    if (paletaBase.length > 0) {
        const n = calcularClasses(min, max, ehInteiro);
        const cores = sampleColors(paletaBase, n);

        // Barra de gradiente contínuo: cada classe ocupa uma fração igual
        // da largura (n classes de amplitude uniforme), com transição
        // direta entre cores (hard stop) — visualmente um gradiente, mas
        // continua a representar exatamente a mesma classificação discreta
        // usada para pintar o raster (calcularClasses()/sampleColors()).
        const stops = [];
        for (let i = 0; i < n; i++) {
            const inicio = (i / n) * 100;
            const fim = ((i + 1) / n) * 100;
            stops.push(`${cores[i]} ${inicio}%`, `${cores[i]} ${fim}%`);
        }
        const gradiente = `linear-gradient(to right, ${stops.join(", ")})`;

        html += `<div class="legend-gradient" style="background: ${gradiente};"></div>`;

        // Marcas nos limites das classes (min, cada fronteira, max).
        html += `<div class="legend-ticks">`;
        for (let i = 0; i <= n; i++) {
            const valor = min + (max - min) * (i / n);
            const rotulo = ehInteiro ? Math.round(valor) : valor.toFixed(1);
            html += `<span>${rotulo}</span>`;
        }
        html += `</div>`;
    } else {
        html += `<p><small>Nenhuma palete de cores definida.</small></p>`;
    }

    UI.legend.innerHTML = html;
}

/*
    Limpa a legenda visual.
*/
function clearLegend() {
    if (!UI.legend) return;
    UI.legend.innerHTML = "";
}

/*
    Mostra uma mensagem simples no lugar da legenda (ex.: antes de haver
    região selecionada, quando ainda não existe raster no mapa).
*/
function showLegendPlaceholder(mensagem) {
    if (!UI.legend) return;
    UI.legend.innerHTML = `<p><small>${mensagem}</small></p>`;
}

/* ============================================================================
    ORQUESTRAÇÃO DE ATUALIZAÇÃO DA INTERFACE
============================================================================ */

function refreshUI() {
    updateYearLabel();
    updateLegend();
}

function updateInterface() {
    updateYearLabel();
    updateLegend();
}

/* ============================================================================
    INICIALIZAÇÃO DO MÓDULO
============================================================================ */

function initializeUI() {
    console.log("Inicializando interface de utilizador...");
    updateYearLabel();
    updateLegend();

    showMessage("Aplicação inicializada com sucesso.");
    console.log("✔ UI estruturada e pronta.");
}

/* ============================================================================
    DIAGNÓSTICO / DEBUG
============================================================================ */

function printUIStatus() {
    console.log("====================================");
    console.log("Estado da Interface");
    console.log({
        evento: APP_STATE.evento,
        variavel: APP_STATE.variavel,
        estatistica: APP_STATE.estatistica,
        ano: APP_STATE.ano,
        nuts: APP_STATE.nuts,
        hasLegendPanel: UI.legend !== null
    });
    console.log("====================================");
}

/* ============================================================================
    EXPORTAÇÃO PARA O ESCOPO GLOBAL
============================================================================ */

window.initializeUI = initializeUI;
window.updateInterface = updateInterface;
window.refreshUI = refreshUI;
window.updateLegend = updateLegend;
window.showLegendPlaceholder = showLegendPlaceholder;
window.updateYearLabel = updateYearLabel;
window.showMessage = showMessage;
window.printUIStatus = printUIStatus;

/* ============================================================================
    MÓDULO CARREGADO
============================================================================ */

console.log("✔ m7_6_ui.js carregado.");
