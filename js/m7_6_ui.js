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
    • Faixas do ano, atrás do slider
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
    ESTADOS DE CARREGAMENTO, VAZIO E ERRO (MAPA E GRÁFICOS)
============================================================================ */

/*
    Abaixo disto o aviso de carregamento não chega a aparecer: evita que
    pisque nas respostas rápidas.
*/
const ATRASO_AVISO_CARREGAR_MS = 200;

const temporizadoresEstado = new Map();

function escreverEstado(alvo, tipo, mensagem, aoTentarDeNovo) {
    alvo.replaceChildren();

    if (!tipo) {
        delete alvo.dataset.estado;
        return;
    }

    alvo.dataset.estado = tipo;

    const caixa = document.createElement("div");
    caixa.className = "estado-caixa";

    const texto = document.createElement("span");
    texto.textContent = mensagem;
    caixa.append(texto);

    if (aoTentarDeNovo) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "estado-acao";
        botao.textContent = "Tentar de novo";
        botao.addEventListener("click", () => aoTentarDeNovo());
        caixa.append(botao);
    }

    alvo.append(caixa);
}

/*
    Mostra um estado em #map-status ou em .chart-status. tipo: "carregar",
    "vazio", "erro", ou null para limpar. Um estado novo substitui sempre o
    anterior, incluindo um aviso de carregamento ainda por aparecer.
*/
function definirEstado(alvoId, tipo, mensagem, aoTentarDeNovo) {
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;

    clearTimeout(temporizadoresEstado.get(alvoId));

    if (tipo !== "carregar") {
        escreverEstado(alvo, tipo, mensagem, aoTentarDeNovo);
        return;
    }

    // Um erro ou indicação anterior já não se aplica durante o carregamento.
    if (alvo.dataset.estado !== "carregar") {
        escreverEstado(alvo, null);
    }

    temporizadoresEstado.set(
        alvoId,
        setTimeout(() => escreverEstado(alvo, tipo, mensagem), ATRASO_AVISO_CARREGAR_MS)
    );
}

/* ============================================================================
    FAIXAS DO ANO (MÉDIA DA REGIÃO EM CADA ANO, ATRÁS DO SLIDER)
============================================================================ */

const FORMATO_VALOR_FAIXAS = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

/*
    Pinta uma faixa por ano com a palete do evento, na escala mínimo–máximo da
    própria série (por isso a nota indica sempre esse intervalo). Um ano sem
    valor fica na cor "Sem ondas" nas variáveis onde isso tem esse significado;
    nas outras fica sem cor. Sem nenhum valor, as faixas ficam vazias.
*/
function atualizarFaixasAno(valores) {
    const faixas = document.getElementById("year-stripes");
    const nota = document.getElementById("year-stripes-note");
    if (!faixas || !nota) return;

    faixas.classList.remove("a-carregar");
    nota.classList.remove("a-carregar");

    const validos = valores.filter((valor) => Number.isFinite(valor));
    if (validos.length === 0) {
        faixas.replaceChildren();
        nota.textContent = "";
        return;
    }

    const variavel = getCurrentVariable();
    const paleta = getCurrentPalette();
    const min = Math.min(...validos);
    const max = Math.max(...validos);
    const amplitude = max - min;

    faixas.style.setProperty("--n-anos", valores.length);
    faixas.replaceChildren(...valores.map((valor) => {
        const faixa = document.createElement("span");
        if (Number.isFinite(valor)) {
            const posicao = amplitude > 0 ? (valor - min) / amplitude : 0;
            faixa.style.background = paleta[Math.round(posicao * (paleta.length - 1))];
        } else if (variavel?.semOndasSemValor) {
            faixa.style.background = CONFIG.COR_SEM_ONDAS;
        }
        return faixa;
    }));

    const territorio = APP_STATE.nuts ? "da região" : "do país";
    const unidade = variavel?.unidade ? ` ${variavel.unidade}` : "";
    const semOndas = variavel?.semOndasSemValor && validos.length < valores.length
        ? " Cinzento-esverdeado: sem ondas."
        : "";
    nota.textContent = `Cada faixa é um ano: média ${territorio}, de `
        + `${FORMATO_VALOR_FAIXAS.format(min)} a ${FORMATO_VALOR_FAIXAS.format(max)}${unidade}.${semOndas}`;
}

/* As faixas atuais são de outra seleção até chegar a nova série. */
function marcarFaixasACarregar() {
    document.getElementById("year-stripes")?.classList.add("a-carregar");
    document.getElementById("year-stripes-note")?.classList.add("a-carregar");
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

    const semValores = (typeof rasterTemValores === "boolean") && !rasterTemValores;

    if (semValores && variavel?.semOndasSemValor) {
        // Região sem nenhuma onda neste período: só a cor neutra.
        html += `<div class="legend-sem-ondas"><span style="background: ${CONFIG.COR_SEM_ONDAS};"></span>Sem ondas em toda a região</div>`;
    } else if (paletaBase.length > 0) {
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

        if (classePorValor(min, max, ehInteiro)) {
            // Uma classe por valor inteiro: o valor ao centro de cada cor.
            html += `<div class="legend-ticks centrados">`;
            for (let i = 0; i < n; i++) {
                html += `<span>${Math.round(min) + i}</span>`;
            }
        } else {
            // Marcas nos limites das classes (min, cada fronteira, max).
            html += `<div class="legend-ticks">`;
            for (const valor of calcularLimites(min, max, ehInteiro)) {
                html += `<span>${ehInteiro ? Math.round(valor) : valor.toFixed(1)}</span>`;
            }
        }
        html += `</div>`;

        if (variavel?.semOndasSemValor) {
            html += `<div class="legend-sem-ondas"><span style="background: ${CONFIG.COR_SEM_ONDAS};"></span>Sem ondas</div>`;
        }
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
    COLAPSO DA LEGENDA (ECRÃS PEQUENOS)

    Em ecrãs pequenos a legenda fica sobreposta ao mapa (ver #legend em
    style.css) e não pode ficar sempre visível a tapá-lo. O botão
    #legend-toggle (index.html) só é visível a partir do breakpoint
    onde isto se aplica (@media max-width: 768px, style.css) — em ecrã
    largo esta função nunca é acionada e a legenda mantém-se como
    sempre esteve.
============================================================================ */

/*
    Alterna a visibilidade da legenda, através da classe "collapsed"
    (só tem efeito visual dentro do breakpoint mobile — ver style.css).
*/
function toggleLegend() {
    if (!UI.legend) return;

    const colapsada = UI.legend.classList.toggle("collapsed");

    const botao = document.getElementById("legend-toggle");
    if (botao) {
        botao.setAttribute("aria-expanded", String(!colapsada));
    }
}

/*
    Liga o botão de colapso da legenda. Arranca já colapsada em ecrãs
    pequenos, para a legenda não tapar o mapa assim que a app carrega;
    em ecrã largo o botão está oculto (CSS) e isto não tem qualquer
    efeito visível.
*/
function initializeLegendToggle() {
    const botao = document.getElementById("legend-toggle");
    if (!botao || !UI.legend) return;

    if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
        UI.legend.classList.add("collapsed");
        botao.setAttribute("aria-expanded", "false");
    }

    botao.addEventListener("click", toggleLegend);
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
    initializeLegendToggle();

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
window.definirEstado = definirEstado;
window.atualizarFaixasAno = atualizarFaixasAno;
window.marcarFaixasACarregar = marcarFaixasACarregar;
window.toggleLegend = toggleLegend;
window.initializeLegendToggle = initializeLegendToggle;
window.updateYearLabel = updateYearLabel;
window.showMessage = showMessage;
window.printUIStatus = printUIStatus;

/* ============================================================================
    MÓDULO CARREGADO
============================================================================ */

console.log("✔ m7_6_ui.js carregado.");
