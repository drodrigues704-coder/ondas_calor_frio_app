/******************************************************************************
 SNIPPET_START
 WEBAPP — Ondas de Calor e Frio
 m7_7_main.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Módulo principal da aplicação (Orquestrador Global).

 Responsabilidades
    • Inicializar a aplicação garantindo a ordem correta de dependências
    • Coordenar o ciclo de vida e estados entre módulos
    • Efetuar o primeiro carregamento de dados geográficos e climáticos
    • Proteger a execução contra falhas de rede ou ficheiros em falta
******************************************************************************/

"use strict";

/* ============================================================================
    ESTADO DA APLICAÇÃO
============================================================================ */

let applicationStarted = false;

/* ============================================================================
    VERIFICA SE TODOS OS MÓDULOS CRÍTICOS EXISTEM
============================================================================ */

function checkModules() {
    const modules = [
        "initializeMap",
        "initializeNUTS",
        "initializeControls",
        "initializeCharts",
        "initializeUI"
    ];

    let ok = true;

    modules.forEach(module => {
        if (typeof window[module] !== "function") {
            console.error(`❌ Módulo ou função em falta no escopo global: ${module}`);
            ok = false;
        }
    });

    return ok;
}

/* ============================================================================
    INFORMAÇÃO DE DIAGNÓSTICO
============================================================================ */

function printApplicationInfo() {
    console.log("=======================================");
    console.log("WEBAPP — Ondas de Calor e Frio");
    console.log("Versão: 1.0");
    console.log("Autor: Daniel Rodrigues");
    console.log("=======================================");
}

/* ============================================================================
    ARRANQUE E ORQUESTRAÇÃO SEQUENCIAL
============================================================================ */

async function startApplication() {
    if (applicationStarted) {
        console.warn("A aplicação já foi iniciada anteriormente.");
        return false;
    }

    printApplicationInfo();
    console.log("A verificar integridade dos módulos...");

    if (!checkModules()) {
        console.error("Falta de dependências. Não foi possível iniciar a aplicação.");
        return false;
    }

    try {
        console.log("A inicializar mapa base...");
        if (typeof window.initializeMap === "function") window.initializeMap();

        // Monta os grupos de camadas (rasterGroup/boundaryGroup/markerGroup) no
        // mapa. Sem isto, os grupos existem como objetos JS mas nunca são
        // adicionados ao Leaflet, e nada colocado neles fica visível.
        if (typeof window.initializeLayers === "function") window.initializeLayers();

        // Regista os eventos do mapa (clique -> série temporal do ponto, etc.).
        // Sem isto o clique no mapa nunca dispara nada.
        if (typeof window.registerMapEvents === "function") window.registerMapEvents();

        console.log("A carregar e inicializar limites NUTS...");
        if (typeof window.initializeNUTS === "function") {
            await window.initializeNUTS();
        }

        console.log("A configurar controlos e listeners de eventos...");
        if (typeof window.initializeControls === "function") window.initializeControls();

        console.log("A estruturar contentores de gráficos...");
        if (typeof window.initializeCharts === "function") window.initializeCharts();

        console.log("A renderizar elementos da interface...");
        if (typeof window.initializeUI === "function") window.initializeUI();

        // Bloqueia re-inicializações indesejadas após sucesso absoluto
        applicationStarted = true;
        console.log("✔ Todos os módulos estruturais foram inicializados.");
        return true;
    } catch (error) {
        console.error("❌ Erro crítico durante a sequência de inicialização:", error);
        if (typeof window.showMessage === "function") {
            window.showMessage("Erro fatal ao inicializar os módulos da aplicação.");
        }
        return false;
    }
}

/* ============================================================================
    CARREGAMENTO DE DADOS INICIAIS
============================================================================ */

async function loadInitialData() {
    console.log("A carregar dados climáticos e geográficos iniciais...");

    try {
        // Atualiza os componentes visuais base da UI
        if (typeof window.updateInterface === "function") window.updateInterface();
        if (typeof window.updateYearLabel === "function") window.updateYearLabel();

        // Dispara o pedido assíncrono do primeiro Raster do modelo. Também
        // carrega a Série Temporal Regional com dados reais (ver
        // updateRaster() em m7_4_raster.js); a Série Temporal do Ponto só
        // é preenchida depois de um clique no mapa.
        if (typeof window.updateRaster === "function") {
            console.log("A renderizar camada raster inicial (Continente)...");
            await window.updateRaster();
        }

        if (typeof window.showMessage === "function") {
            window.showMessage("Aplicação pronta a ser utilizada.");
        }
        console.log("✔ Dados iniciais e camadas carregados com sucesso.");
    }
    catch (error) {
        console.error("❌ Erro ao carregar os dados climáticos iniciais:", error);
        if (typeof window.showMessage === "function") {
            window.showMessage("Aviso: Falha ao obter os dados climáticos do servidor.");
        }
    }
}

/* ============================================================================
    INICIALIZAÇÃO COMPLETA DA WEBAPP
============================================================================ */

async function initializeApplication() {
    const success = await startApplication();
    if (success) {
        await loadInitialData();
    }
}

/* ============================================================================
    ATUALIZAÇÃO E SINCRONIZAÇÃO GLOBAL
============================================================================ */

async function refreshApplication() {
    console.log("A atualizar o estado global da aplicação...");

    try {
        if (typeof window.updateInterface === "function") {
            window.updateInterface();
        }
        console.log("✔ Interface global sincronizada.");
    }
    catch (error) {
        console.error("Erro ao sincronizar a interface:", error);
    }
}

/*
    Força o recarregamento completo da vista atual da aplicação
*/
async function reloadCurrentView() {
    console.log("A recarregar vista atual...");
    try {
        await refreshApplication();
    }
    catch (error) {
        console.error("Erro ao recarregar a vista:", error);
    }
}

/* ============================================================================
    GATILHO DE ENTRADA (DOM READY)
============================================================================ */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async () => {
        console.log("DOM carregado via evento.");
        await initializeApplication();
    });
} else {
    // Caso o script carregue em modo defer/async e o DOM já esteja inteiramente processado
    console.log("DOM já se encontrava pronto.");
    initializeApplication();
}

/* ============================================================================
    EVENTOS DE CICLO DE VIDA (ENCERRAMENTO)
============================================================================ */

window.addEventListener("beforeunload", () => {
    console.log("A encerrar sessão na WebApp de Ondas de Calor e Frio...");
});

/* ============================================================================
    DIAGNÓSTICO EM CONSOLA
============================================================================ */

function printApplicationStatus() {
    const stateExists = typeof APP_STATE !== "undefined";
    console.log("=======================================");
    console.log("Diagnóstico de Estado Ativo");
    console.log({
        applicationStarted,
        evento: stateExists ? APP_STATE.evento : "Indefinido",
        variavel: stateExists ? APP_STATE.variavel : "Indefinido",
        estatistica: stateExists ? APP_STATE.estatistica : "Indefinido",
        ano: stateExists ? APP_STATE.ano : "Indefinido",
        nuts: stateExists ? APP_STATE.nuts : "Indefinido"
    });
    console.log("=======================================");
}

/* ============================================================================
    EXPORTAÇÃO PARA O ESCOPO GLOBAL (window)
============================================================================ */

window.startApplication = startApplication;
window.initializeApplication = initializeApplication;
window.refreshApplication = refreshApplication;
window.reloadCurrentView = reloadCurrentView;
window.printApplicationStatus = printApplicationStatus;

/* ============================================================================
    MÓDULO CARREGADO
============================================================================ */

console.log("✔ m7_7_main.js carregado e ativo.");
