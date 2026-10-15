/******************************************************************************
 SNIPPET_START
 WEBAPP — Ondas de Calor e Frio
 m7_4_raster.js

 Autor:
 Daniel Rodrigues

 Descrição
 ----------
 Gestão e renderização de dados raster (GeoTIFF / COG) no mapa Leaflet.
******************************************************************************/

"use strict";

/* =============================================================================
    VARIÁVEIS GLOBAIS DO MÓDULO
============================================================================= */

/*
    Raster atualmente carregado.
*/
let currentRaster = null;

/*
    Layer Leaflet atualmente desenhado.
*/
let currentRasterLayer = null;

/*
    Último URL carregado.
*/
let currentDatasetURL = null;

/*
    Evita carregamentos simultâneos.
*/
let rasterLoading = false;

/*
    Pedido recebido enquanto outro raster carregava (ex.: slider arrastado
    depressa). Em vez de ser descartado — o que deixava o mapa no ano
    anterior —, é repetido quando o carregamento atual termina.
*/
let refreshPendente = false;

/*
    Máscara de terra da seleção atual (georaster de numero_eventos), só
    carregada para variáveis com "Sem ondas" (ver carregarMascaraTerra).
*/
let currentMascaraTerra = null;

/*
    Código HTTP da última falha a descarregar um GeoTIFF (null se correu
    bem). Um 404 quer dizer que a camada não existe — ex.: OMM / Frio /
    intensidade_max / 2002, um ano sem eventos. Só há um carregamento de
    cada vez (rasterLoading), por isso este estado não é partilhado.
*/
let ultimoStatusRaster = null;

/* =============================================================================
    DIAGNÓSTICO
============================================================================= */

function printRasterState() {
    console.log("========================================");
    console.log("Estado do módulo Raster");
    console.log({
        currentDatasetURL,
        hasRaster: currentRaster !== null,
        hasLayer: currentRasterLayer !== null,
        mapReady: !!APP_STATE.map
    });
    console.log("========================================");
}

/* =============================================================================
    LIMPEZA DO RASTER ATUAL
============================================================================= */

/*
    Remove o layer Leaflet atualmente desenhado do grupo correto.
*/
function removeRasterLayer() {

    if (!APP_STATE.map) {
        console.warn("Mapa ainda não existe.");
        return;
    }

    // Se não existir nenhum raster desenhado, não há nada para remover
    if (!currentRasterLayer) {
        return;
    }

    // Remove do grupo de rasters, caso exista
    if (window.rasterGroup) {
        window.rasterGroup.removeLayer(currentRasterLayer);
    }
    // Caso contrário remove diretamente do mapa
    else if (APP_STATE.map.hasLayer(currentRasterLayer)) {
        APP_STATE.map.removeLayer(currentRasterLayer);
    }

    currentRasterLayer = null;
    APP_STATE.rasterLayer = null;
}

/*
    Remove completamente o raster do mapa e limpa as variáveis de controlo.
*/
function clearRaster() {
    removeRasterLayer();
    currentRaster = null;
    currentMascaraTerra = null;
    currentDatasetURL = null;
    APP_STATE.raster = null;
    APP_STATE.rasterLayer = null;
    printRasterState();
}

/* =============================================================================
    RESOLUÇÃO ESTÁTICA DO DATASET (sem backend)

    Esta versão do módulo (usada no deploy estático, GitHub Pages) resolve
    o caminho do COG diretamente por convenção de pastas, em vez de pedir
    ao backend FastAPI — que aqui não existe. Os ficheiros foram
    pré-gerados (incluindo os recortes por NUTS, que o backend antes fazia
    em tempo real) e publicados em data/cog[...]/, com exatamente esta
    estrutura de pastas.
============================================================================= */

/*
    Mapa "nome da NUTS" -> pasta segura (sem acentos/espaços), carregado
    uma vez a partir de data/nuts_slugs.json.
*/
let nutsSlugs = null;

async function loadNutsSlugs() {
    if (nutsSlugs) {
        return nutsSlugs;
    }
    try {
        const response = await fetch("data/nuts_slugs.json");
        nutsSlugs = await response.json();
        return nutsSlugs;
    }
    catch (error) {
        console.error("Erro ao carregar data/nuts_slugs.json:");
        console.error(error);
        nutsSlugs = {};
        return nutsSlugs;
    }
}

/*
    Constrói o caminho relativo (estático) do COG pretendido pela seleção
    atual. Devolve null se a NUTS ativa ainda não tiver slug conhecido.
*/
function buildDatasetURL(variavel = APP_STATE.variavel) {
    const anual = APP_STATE.estatistica === "ano";
    const periodo = anual ? String(APP_STATE.ano) : APP_STATE.estatistica;

    if (!APP_STATE.nuts) {
        return anual
            ? `data/cog/${APP_STATE.metodo}/${APP_STATE.evento}/${periodo}/${variavel}.tif`
            : `data/cog_clim/${APP_STATE.metodo}/${APP_STATE.evento}/${variavel}_${periodo}.tif`;
    }

    if (!nutsSlugs || !(APP_STATE.nuts in nutsSlugs)) {
        return null;
    }
    const slug = nutsSlugs[APP_STATE.nuts];

    return anual
        ? `data/cog_nuts/${slug}/${APP_STATE.metodo}/${APP_STATE.evento}/${periodo}/${variavel}.tif`
        : `data/cog_clim_nuts/${slug}/${APP_STATE.metodo}/${APP_STATE.evento}/${variavel}_${periodo}.tif`;
}

/*
    Na intensidade máxima, uma célula sem valor pode ser terra sem ondas
    OU fora de terra (mar, Espanha, água excluída no pipeline). O
    numero_eventos da mesma seleção (ano/estatística e região) distingue
    os dois: só é NaN fora de terra. Devolve o georaster, ou null se
    falhar — nesse caso não se desenha a cor "Sem ondas".
*/
async function carregarMascaraTerra() {
    const path = buildDatasetURL("numero_eventos");
    if (!path) {
        return null;
    }

    try {
        const response = await fetch(path);
        if (!response.ok) {
            return null;
        }
        return await parseGeoraster(await response.arrayBuffer());
    }
    catch (erro) {
        console.warn("Máscara de terra não carregada:", erro);
        return null;
    }
}

/* =============================================================================
    OBTÉM O URL DO COG
============================================================================= */

/*
    Resolve o caminho do GeoTIFF pretendido pela seleção atual. Função
    pura (não mexe em "currentDatasetURL") — quem chama decide se/quando
    esse estado deve ser atualizado. É crítico manter assim: refreshRaster()
    precisa de comparar o caminho novo contra o "currentDatasetURL" antigo
    para saber se algo mudou; se esta função escrevesse em
    "currentDatasetURL" antes dessa comparação, a comparação ficaria
    sempre "igual a si próprio" e o raster deixaria de ser redesenhado
    sempre que o utilizador mudasse variável/ano/evento/metodologia
    mantendo a mesma região (foi exatamente este bug que aconteceu aqui).
*/
async function getCurrentDatasetURL() {
    await loadNutsSlugs();

    const path = buildDatasetURL();
    if (!path) {
        console.warn("Não foi possível resolver o caminho do dataset (slug da NUTS em falta).");
        return null;
    }

    console.log("GeoTIFF:");
    console.log(path);

    return path;
}

/* =============================================================================
    LEITURA DO GEOTIFF
============================================================================= */

/*
    Carrega o GeoTIFF atualmente selecionado (comportamento padrão).
*/
async function loadRaster() {
    console.log("==================================================");
    console.log("loadRaster()");
    console.log("Estado atual:");
    console.log(APP_STATE);

    const rasterURL = await getCurrentDatasetURL();
    if (!rasterURL) {
        console.warn("Nenhum URL disponível.");
        return null;
    }

    return await loadRasterComURL(rasterURL);
}

/*
    Função auxiliar otimizada que faz o download e o parsing do GeoTIFF.
*/
async function loadRasterComURL(rasterURL) {
    console.log("==================================================");
    console.log("loadRasterComURL()");
    console.log("Download do GeoTIFF:");
    console.log(rasterURL);

    ultimoStatusRaster = null;

    try {
        const response = await fetch(rasterURL);
        if (!response.ok) {
            ultimoStatusRaster = response.status;
            throw new Error(`Erro HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(
            "GeoTIFF descarregado:",
            arrayBuffer.byteLength,
            "bytes"
        );

        const georaster = await parseGeoraster(arrayBuffer);
        if (!georaster) {
            throw new Error("parseGeoraster() devolveu null.");
        }

        currentRaster = georaster;
        APP_STATE.raster = georaster;

        console.log("Primeira linha:");
        console.log(georaster.values[0][0]);

        const valores = Array.from(georaster.values[0]).flatMap(row => Array.from(row));

        console.log("Número de pixels > 0:",
            valores.filter(v => v > 0).length);

        console.log("Número total:",
            valores.length);

        console.log("Valores únicos:");
        console.log([...new Set(valores)].sort((a, b) => a - b));

        console.log("GeoRaster carregado:");
        console.log({
            projection: georaster.projection,
            width: georaster.width,
            height: georaster.height,
            xmin: georaster.xmin,
            xmax: georaster.xmax,
            ymin: georaster.ymin,
            ymax: georaster.ymax,
            mins: georaster.mins,
            maxs: georaster.maxs,
            noDataValue: georaster.noDataValue
        });

        return georaster;
    }
    catch (error) {
        console.error("Erro ao carregar o GeoTIFF com URL:");
        console.error(error);
        currentRaster = null;
        APP_STATE.raster = null;
        return null;
    }
}

/* =============================================================================
    REAMOSTRAGEM (SUAVIZAÇÃO VISUAL DA GRELHA)
============================================================================= */

/*
    Fator de reamostragem: cada célula nativa (~5.5 km, resolução CERRA)
    é subdividida em RESAMPLE_FACTOR × RESAMPLE_FACTOR células antes de
    calcular as isobandas, só para desenho — os dados servidos (download,
    séries temporais, estatísticas) continuam a vir sempre da grelha
    nativa, sem qualquer alteração.
*/
const RESAMPLE_FACTOR = 4;

/*
    Kernel de convolução cúbica (Catmull-Rom, a = -0.5) — o mesmo usado
    pelo GDAL no resampling "cubic" para superfícies contínuas (é o
    método recomendado para variáveis como temperatura/duração/
    intensidade, ao contrário do "nearest", próprio de dados categóricos).
*/
function kernelCubico(x) {
    const a = -0.5;
    x = Math.abs(x);
    if (x <= 1) {
        return (a + 2) * x ** 3 - (a + 3) * x ** 2 + 1;
    }
    if (x < 2) {
        return a * x ** 3 - 5 * a * x ** 2 + 8 * a * x - 4 * a;
    }
    return 0;
}

/*
    Reamostra a banda nativa para uma grelha "factor" vezes mais fina,
    por interpolação bicúbica, só para efeitos de desenho (ver
    RESAMPLE_FACTOR acima).

    Células NoData são ignoradas e os pesos renormalizados só pelos
    vizinhos válidos (em vez de rejeitar a célula fina sempre que há um
    vizinho NoData) — isto evita "encolher" artificialmente a área de
    dados perto de bordas/recortes NUTS. Como o kernel usa vizinhos até
    2 células nativas de distância, isto também significa que dados
    válidos podem "vazar" visualmente até ~2 células nativas (~11 km,
    à resolução CERRA) para lá do limite real de dados/recorte NUTS —
    aceitável para uma suavização puramente visual, documentada como
    tal no painel "Sobre a aplicação", mas não seria aceitável se estes
    valores fossem alguma vez servidos como dados (não são: download e
    séries temporais usam sempre a grelha nativa). O valor interpolado
    é sempre limitado ao intervalo [min, max] original como proteção
    adicional (o clamp dos pesos a não-negativos, abaixo, já torna isto
    matematicamente redundante na prática, mas mantém-se como defesa
    extra e barata).
*/
function reamostrarBicubica(banda, largura, altura, factor, min, max) {
    const novaLargura = largura * factor;
    const novaAltura = altura * factor;
    const nova = [];

    for (let r = 0; r < novaAltura; r++) {
        const linha = new Array(novaLargura);
        const rowF = (r + 0.5) / factor - 0.5;
        const row0 = Math.floor(rowF);
        const dy = rowF - row0;

        for (let c = 0; c < novaLargura; c++) {
            const colF = (c + 0.5) / factor - 0.5;
            const col0 = Math.floor(colF);
            const dx = colF - col0;

            let soma = 0;
            let somaPesos = 0;

            for (let m = -1; m <= 2; m++) {
                const rr = row0 + m;
                if (rr < 0 || rr >= altura) continue;
                const wy = kernelCubico(m - dy);

                for (let n = -1; n <= 2; n++) {
                    const cc = col0 + n;
                    if (cc < 0 || cc >= largura) continue;

                    const valor = banda[rr][cc];
                    if (valor === null || valor === undefined || isNaN(valor)) continue;

                    // Pesos negativos (lóbulos do kernel cúbico, normais
                    // para "sharpening") são cortados a zero: com vizinhança
                    // incompleta (litoral, ilhas, bordas de recorte NUTS),
                    // pesos negativos podiam cancelar-se com os positivos e
                    // produzir um valor muito fora da vizinhança real — um
                    // "pop" de cor extrema (mín/máx da legenda) sem
                    // correspondência aos dados. Sem pesos negativos, o
                    // resultado é sempre uma média ponderada dos vizinhos
                    // válidos (combinação convexa), logo sempre dentro do
                    // intervalo real desses vizinhos.
                    const w = Math.max(0, wy * kernelCubico(n - dx));
                    soma += valor * w;
                    somaPesos += w;
                }
            }

            linha[c] = somaPesos === 0
                ? null
                : Math.max(min, Math.min(max, soma / somaPesos));
        }

        nova.push(linha);
    }

    return { banda: nova, largura: novaLargura, altura: novaAltura };
}

/* =============================================================================
    LIMITE DA REGIÃO (para recortar as isobandas — ver drawRaster())
============================================================================= */

/*
    Cache do polígono da última NUTS pedida, já reprojetado para
    EPSG:3857 (metros) — evita reprojetar a cada redesenho quando só a
    variável/ano/metodologia muda, não a região.
*/
let nutsMercatorCache = { nome: null, poligono: null };

/*
    Devolve o polígono (GeoJSON, EPSG:3857) da região pedida, ou null se
    a região não existir/ainda não estiver carregada (ex.: NUTS_II.geojson
    a meio do fetch). Usa turf.toMercator() — os dados de origem
    (NUTS_II.geojson) estão em WGS84, tal como todo o GeoJSON.
*/
function getNutsBoundaryMercator(nutsName) {
    // Não reutiliza um resultado "null" em cache — só o hit positivo, para
    // não prender permanentemente uma falha temporária (ex.: pedido antes
    // do NUTS_II.geojson estar carregado).
    if (nutsMercatorCache.nome === nutsName && nutsMercatorCache.poligono !== null) {
        return nutsMercatorCache.poligono;
    }

    const feature = (typeof getNutsFeature === "function") ? getNutsFeature(nutsName) : null;
    const poligono = feature ? turf.toMercator(feature) : null;

    nutsMercatorCache = { nome: nutsName, poligono };
    return poligono;
}

/* =============================================================================
    ESTRUTURA DAS ISOBANDAS (antes do recorte à região)
============================================================================= */

/*
    O turf.isobands() devolve cada banda como uma lista de anéis que só
    está certa com a regra "evenodd" (a que o canvas do Leaflet usa): anéis
    dentro de anéis, sem distinguir exterior de buraco. O turf.intersect()
    assume polígonos bem formados (1.º anel exterior, restantes buracos) e,
    com estes anéis, deitava fora pedaços de área — eram os "buracos sem
    dados" que apareciam no mapa, em qualquer região.

    Os anéis de uma banda nunca se cruzam, só se encaixam, por isso a
    profundidade de cada anel (quantos anéis o contêm) define o seu papel:
    par → exterior, ímpar → buraco do anel que o contém diretamente.
*/
function estruturarAneis(feature) {
    const g = feature.geometry;
    if (!g) return null;

    const aneis = (g.type === "Polygon" ? g.coordinates
        : g.type === "MultiPolygon" ? g.coordinates.flat()
        : []).filter((anel) => anel.length >= 4);
    if (!aneis.length) return null;

    const caixas = aneis.map((anel) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of anel) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
        return [x0, y0, x1, y1];
    });

    const areas = aneis.map((anel) => {
        let soma = 0;
        for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
            soma += (anel[j][0] + anel[i][0]) * (anel[j][1] - anel[i][1]);
        }
        return Math.abs(soma / 2);
    });

    const pontoNoAnel = (x, y, anel) => {
        let dentro = false;
        for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
            const [xi, yi] = anel[i];
            const [xj, yj] = anel[j];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                dentro = !dentro;
            }
        }
        return dentro;
    };

    // O anel i está dentro do anel j? Decide pela maioria de alguns
    // vértices, para não falhar quando dois anéis se tocam num ponto de sela.
    const contido = (i, j) => {
        const [a0, b0, a1, b1] = caixas[i];
        const [c0, d0, c1, d1] = caixas[j];
        if (a0 < c0 || b0 < d0 || a1 > c1 || b1 > d1 || areas[i] >= areas[j]) return false;

        const anel = aneis[i];
        const passo = Math.max(1, Math.floor(anel.length / 5));
        let sim = 0, total = 0;
        for (let k = 0; k < anel.length - 1; k += passo) {
            total++;
            if (pontoNoAnel(anel[k][0], anel[k][1], aneis[j])) sim++;
        }
        return sim * 2 > total;
    };

    const contentores = aneis.map((_, i) =>
        aneis.map((_, j) => j).filter((j) => j !== i && contido(i, j))
    );
    const profundidade = contentores.map((lista) => lista.length);

    const poligonos = new Map();
    aneis.forEach((anel, i) => {
        if (profundidade[i] % 2 === 0) poligonos.set(i, [anel]);
    });
    aneis.forEach((anel, i) => {
        if (profundidade[i] % 2 === 0) return;
        const pai = contentores[i]
            .filter((j) => profundidade[j] === profundidade[i] - 1)
            .sort((a, b) => areas[a] - areas[b])[0];
        if (pai !== undefined) {
            poligonos.get(pai).push(anel);
        } else {
            console.warn("estruturarAneis(): buraco sem anel exterior — descartado.");
        }
    });

    return turf.multiPolygon([...poligonos.values()], feature.properties);
}

/* =============================================================================
    CRIAÇÃO DO LAYER LEAFLET
============================================================================= */

/*
    Desenha o raster atualmente carregado.
*/
async function drawRaster() {
    if (!APP_STATE.map) {
        console.error("O mapa ainda não foi inicializado.");
        return;
    }

    if (!currentRaster) {
        console.warn("Nenhum raster carregado.");
        return;
    }

    console.log("========================================");
    console.log("drawRaster()");
    console.log(currentRaster);

    // Remove o layer anterior de forma segura
    removeRasterLayer();

    // Atualiza o stretch
    updateRasterStretch();

    // Cria o layer
    //
    // NOTA: não pintamos pixel a pixel num canvas nem usamos GeoRasterLayer
    // (que pinta sempre um retângulo sólido por amostra, sem suavização
    // real). Em vez disso calculamos isobandas — polígonos vetoriais
    // preenchidos entre isolinhas consecutivas, uma por classe — usando
    // turf.isobands() (marching squares) sobre a grelha nativa reamostrada
    // por interpolação bicúbica (ver REAMOSTRAGEM acima; só a imagem fica
    // mais suave, os dados servidos mantêm-se a resolução nativa CERRA).
    // O resultado desenha-se com L.geoJSON, mas a classificação e a
    // paleta usadas são exatamente as mesmas da legenda (calcularClasses()/
    // sampleColors(), partilhadas com m7_6_ui.js).
    try {

        const largura = currentRaster.width;
        const altura = currentRaster.height;

        const pixelWidth = (currentRaster.xmax - currentRaster.xmin) / largura;
        const pixelHeight = (currentRaster.ymax - currentRaster.ymin) / altura;

        const palette = getCurrentPalette();
        const n = calcularClasses(rasterMinimum, rasterMaximum, rasterIsInteger);
        const cores = sampleColors(palette, n);

        // n classes ⇒ n+1 limiares (breaks), os mesmos da legenda.
        const breaks = calcularLimites(rasterMinimum, rasterMaximum, rasterIsInteger);

        const limiteRegiao = getNutsBoundaryMercator(APP_STATE.nuts);

        // Na intensidade máxima, as células de terra sem valor são as que
        // não tiveram ondas: ganham uma banda própria, na cor neutra
        // CONFIG.COR_SEM_ONDAS. A máscara de terra (mesma grelha) separa-as
        // das células fora de terra, que continuam sem cor.
        const mascara = currentMascaraTerra;
        const mostrarSemOndas = !!getCurrentVariable()?.semOndasSemValor
            && !!limiteRegiao
            && !!mascara
            && mascara.width === largura
            && mascara.height === altura;

        const fina = reamostrarBicubica(
            currentRaster.values[0],
            largura,
            altura,
            RESAMPLE_FACTOR,
            rasterMinimum,
            rasterMaximum
        );
        const novoPixelWidth = pixelWidth / RESAMPLE_FACTOR;
        const novoPixelHeight = pixelHeight / RESAMPLE_FACTOR;

        // Sentinela para células NoData: um valor bem abaixo do limiar mais
        // baixo, para que nunca caiam dentro de nenhuma banda — a marching
        // squares desenha então a fronteira exatamente onde os dados
        // válidos terminam (ex.: recorte pela NUTS). Pode gerar uma
        // transição ligeiramente suavizada de ~1 célula fina na fronteira.
        const amplitude = Math.max(1, Math.abs(rasterMaximum - rasterMinimum));
        const sentinelaNoData = rasterMinimum - amplitude;

        const pontos = [];
        for (let linha = 0; linha < fina.altura; linha++) {
            for (let coluna = 0; coluna < fina.largura; coluna++) {
                let valor = fina.banda[linha][coluna];
                if (valor === null || valor === undefined || isNaN(valor)) {
                    valor = sentinelaNoData;
                }
                const x = currentRaster.xmin + (coluna + 0.5) * novoPixelWidth;
                const y = currentRaster.ymax - (linha + 0.5) * novoPixelHeight;
                pontos.push(turf.point([x, y], { valor }));
            }
        }

        const grelha = turf.featureCollection(pontos);
        const isobandas = turf.isobands(grelha, breaks, { zProperty: "valor" });

        // Associa a cor da classe a cada polígono gerado, pela ordem dos
        // limiares (o turf devolve as bandas pela mesma ordem de "breaks").
        isobandas.features.forEach((feature, indice) => {
            feature.properties = feature.properties || {};
            feature.properties.corIndice = Math.min(indice, cores.length - 1);
        });

        // "Sem ondas": área de terra sem valor, numa passagem própria e
        // desenhada por baixo das classes (corIndice -1). Calculada à parte
        // — e não como uma banda abaixo do 1.º limiar — para a transição
        // dados → água não atravessar a cor neutra (contorno à volta dos
        // estuários). Campo 1 = terra sem valor, 0 = resto; a máscara de
        // terra é reamostrada como os dados e cortada a 0.5, para o limite
        // terra/água ficar suave em vez de em blocos 4×4.
        if (mostrarSemOndas) {
            const terraFina = reamostrarBicubica(
                mascara.values[0].map((l) => Array.from(l, (v) => (Number.isFinite(v) ? 1 : 0))),
                largura,
                altura,
                RESAMPLE_FACTOR,
                0,
                1
            ).banda;

            const pontosSemOndas = [];
            for (let linha = 0; linha < fina.altura; linha++) {
                for (let coluna = 0; coluna < fina.largura; coluna++) {
                    const valor = fina.banda[linha][coluna];
                    const semValor = valor === null || valor === undefined || isNaN(valor);
                    pontosSemOndas.push(turf.point(
                        [
                            currentRaster.xmin + (coluna + 0.5) * novoPixelWidth,
                            currentRaster.ymax - (linha + 0.5) * novoPixelHeight
                        ],
                        { valor: (semValor && terraFina[linha][coluna] >= 0.5) ? 1 : 0 }
                    ));
                }
            }

            const semOndas = turf.isobands(
                turf.featureCollection(pontosSemOndas),
                [0.5, 1.5],
                { zProperty: "valor" }
            );
            semOndas.features.forEach((feature) => {
                feature.properties = { corIndice: -1 };
            });
            isobandas.features.unshift(...semOndas.features);
        }

        // Recorta cada isobanda ao limite EXATO da região (vetor↔vetor),
        // em vez de confiar no recorte que os ficheiros pré-gerados já
        // têm — esse segue a grelha CERRA (~5.5 km, em "escada") e a
        // reamostragem bicúbica ainda alarga isso mais um pouco perto das
        // bordas (ver sentinela de NoData acima). Sem este passo, as
        // isobandas podiam ultrapassar visivelmente a fronteira real da
        // NUTS. Mesma técnica validada noutro projeto (SPI_SPEI, com
        // geopandas.clip em vez de turf.intersect).
        if (limiteRegiao) {
            isobandas.features = isobandas.features
                .map((feature) => {
                    let recortada;
                    try {
                        const estruturada = estruturarAneis(feature);
                        if (!estruturada) return null;
                        recortada = turf.intersect(estruturada, limiteRegiao);
                    } catch (erro) {
                        console.warn("Falha ao recortar isobanda à região; mantida sem recorte:", erro);
                        // A banda "sem ondas" sem recorte pintaria todo o
                        // retângulo do raster — nesse caso descarta-se.
                        return feature.properties.corIndice < 0 ? null : feature;
                    }
                    if (!recortada) return null; // sem sobreposição nessa classe
                    recortada.properties = feature.properties;
                    return recortada;
                })
                .filter((feature) => feature !== null);
        }

        // xmin/xmax/ymin/ymax (e portanto os pontos da grelha) vêm em
        // EPSG:3857 (metros) — o mesmo CRS do próprio Leaflet, por isso
        // convertemos diretamente com L.CRS.EPSG3857.unproject(), sem
        // precisar de nenhuma biblioteca de reprojeção adicional.
        const coordsToLatLng = (coord) => L.CRS.EPSG3857.unproject(L.point(coord[0], coord[1]));

        const fillOpacity = Math.max(0, Math.min(1, APP_STATE.opacidade));

        currentRasterLayer = L.geoJSON(isobandas, {
            pane: "overlayPane",     // ← OBRIGATÓRIO
            interactive: false,
            renderer: L.canvas({ pane: "overlayPane" }),
            coordsToLatLng: coordsToLatLng,
            style: (feature) => {
                const indice = feature.properties.corIndice;
                const cor = indice < 0 ? CONFIG.COR_SEM_ONDAS : cores[indice];
                return {
                    fillColor: cor,
                    fillOpacity: fillOpacity,
                    color: cor,
                    weight: 1,
                    opacity: fillOpacity
                };
            }
        });

        console.log("===== METADADOS DO RASTER =====");
        console.log("xmin:", currentRaster.xmin);
        console.log("xmax:", currentRaster.xmax);
        console.log("ymin:", currentRaster.ymin);
        console.log("ymax:", currentRaster.ymax);
        console.log("width nativo:", largura, "| reamostrado:", fina.largura);
        console.log("height nativo:", altura, "| reamostrado:", fina.altura);
        console.log("Nº de isobandas:", isobandas.features.length);

    }
    catch (error) {
        console.error("Erro ao criar o raster (isobandas/GeoJSON):");
        console.error(error);
        return;
    }

    // Adiciona ao rasterGroup se existir, senão adiciona ao mapa diretamente
    try {

        if (window.rasterGroup) {

            window.rasterGroup.addLayer(currentRasterLayer);

        } else {

            currentRasterLayer.addTo(APP_STATE.map);

            console.log(
                "Layer adicionada ao mapa?",
                APP_STATE.map.hasLayer(currentRasterLayer)
            );

        }

        APP_STATE.rasterLayer = currentRasterLayer;

    }
    catch (error) {

        console.error("Erro ao adicionar layer ao rasterGroup:");
        console.error(error);

        console.log(
            "Layer adicionado?",
            APP_STATE.map.hasLayer(currentRasterLayer)
        );

        console.log("Bounds do layer:", currentRasterLayer.getBounds());
        console.log("Bounds do mapa:", APP_STATE.map.getBounds());

        return;

    }

    // Bounds e enquadramento inteligente (só refoca no raster se não houver NUTS ativa)
    if (!APP_STATE.nuts) {
        try {
            const bounds = currentRasterLayer.getBounds();
            console.log("A focar nos limites do raster completo...");
            APP_STATE.map.fitBounds(bounds);
        }
        catch (error) {
            console.warn("Não foi possível calcular os bounds.");
            console.error(error);
        }
    } else {
        console.log("Foco territorial sob controlo da NUTS ativa. Ignorado o ajuste do mapa pelo raster.");
    }

    console.log("✔ Raster desenhado.");
}

/* =============================================================================
   ATUALIZAÇÃO DO RASTER
============================================================================= */

/* Guardamos a última NUTS que foi realmente desenhada para saber se mudou */
let lastLoadedNuts = null;

/*
    Devolve "em_falta" (404: não existe camada para a seleção atual),
    "erro" (outra falha a carregar), "obsoleto" (pedido adiado porque
    outro raster está a carregar) ou null nos restantes casos.
*/
async function refreshRaster() {
    if (rasterLoading) {
        console.warn("Já existe um raster a carregar — pedido adiado.");
        refreshPendente = true;
        return "obsoleto";
    }

    const novoDatasetURL = await getCurrentDatasetURL();
    if (!novoDatasetURL) {
        console.warn("Não foi possível resolver o caminho do dataset.");
        return;
    }

    const layerAtivoNoGrupo = currentRasterLayer && window.rasterGroup && window.rasterGroup.hasLayer(currentRasterLayer);

    // NOVA VALIDAÇÃO: Só ignoramos o download se o URL for igual, o layer estiver ativo,
    // E se a NUTS selecionada for exatamente a mesma que desenhámos da última vez!
    if (currentDatasetURL === novoDatasetURL && currentRaster !== null && layerAtivoNoGrupo && lastLoadedNuts === APP_STATE.nuts) {
        console.log("========================================");
        console.log("▲ Raster já atualizado e visível no mapa. Ignorando download.");
        console.log("========================================");

        if (!APP_STATE.nuts && currentRasterLayer && APP_STATE.map) {
            try {
                const bounds = currentRasterLayer.getBounds();
                APP_STATE.map.fitBounds(bounds);
                console.log("Refocado nos limites do raster existente.");
            } catch (e) {
                console.warn("Não foi possível refocar nos limites do raster.");
            }
        }
        return;
    }

    rasterLoading = true;
    const t0 = performance.now();

    console.log("========================================");
    console.log("refreshRaster() -> Novo dataset, nova NUTS ou renderização necessária!");

    try {
        removeRasterLayer();
        currentDatasetURL = novoDatasetURL;

        // Atualiza a NUTS que estamos prestes a carregar
        lastLoadedNuts = APP_STATE.nuts;

        // Se a NUTS mudou ou o URL mudou, forçamos um novo carregamento do ficheiro
        let georaster = null;
        georaster = await loadRasterComURL(novoDatasetURL);

        if (!georaster) {
            console.warn("O raster não foi carregado.");
            // Sem isto a legenda e o estado continuavam no ano anterior
            // com o slider já no ano sem dados.
            clearRaster();
            lastLoadedNuts = null;
            return ultimoStatusRaster === 404 ? "em_falta" : "erro";
        }

        currentMascaraTerra = getCurrentVariable()?.semOndasSemValor
            ? await carregarMascaraTerra()
            : null;

        await drawRaster();
        const elapsed = (performance.now() - t0).toFixed(1);
        console.log(`✔ Raster atualizado (${elapsed} ms)`);
    }
    catch (error) {
        console.error("Erro durante refreshRaster():");
        console.error(error);
        currentDatasetURL = null;
        lastLoadedNuts = null;
    }
    finally {
        rasterLoading = false;

        if (refreshPendente) {
            refreshPendente = false;
            updateRaster();
        }
    }
}

/*
   Atualiza completamente o mapa.
*/
async function updateRaster() {
    console.log("========================================");
    console.log("updateRaster()");

    if (typeof printCurrentState === 'function') {
        printCurrentState();
    }

    // Só mostramos o raster depois de o utilizador escolher uma região —
    // a app arranca só com o mapa base, para o utilizador escolher a
    // região antes de ver dados sobrepostos.
    if (!APP_STATE.nuts) {
        clearRaster();
        if (typeof showLegendPlaceholder === 'function') {
            showLegendPlaceholder("Seleciona uma região (NUTS II) para visualizar o raster.");
        }
        await refreshRegionalTimeSeries();
        await refreshPointTimeSeries();
        return;
    }

    const falha = await refreshRaster();

    if (falha === "em_falta") {
        showLegendPlaceholder("Não existe camada para esta seleção (por exemplo, um ano sem eventos).");
    }
    else if (falha === "erro") {
        showLegendPlaceholder("Não foi possível carregar os dados.");
    }
    // "obsoleto": a legenda fica a cargo do pedido da seleção atual
    else if (falha !== "obsoleto") {
        updateLegend();
    }

    // Mantém as duas Séries Temporais (regional e do ponto) sempre
    // coerentes com o evento/variável/metodologia/região atuais.
    await refreshRegionalTimeSeries();
    await refreshPointTimeSeries();
}

/* =============================================================================
    STRETCH DA IMAGEM
============================================================================= */

let rasterMinimum = 0;
let rasterMaximum = 1;

/*
    Indica se os valores válidos do raster atual são todos inteiros
    (típico de variáveis de contagem, ex. número de eventos). Usado pela
    legenda (m7_6_ui.js) para decidir quantas classes fazem sentido.
*/
let rasterIsInteger = false;

/*
    Indica se o raster atual tem pelo menos uma célula com valor. Usado
    pela legenda: sem valores, na intensidade máxima, é tudo "Sem ondas".
*/
let rasterTemValores = true;

function updateRasterStretch() {
    if (!currentRaster) {
        return;
    }

    rasterMinimum = currentRaster.mins?.[0];
    rasterMaximum = currentRaster.maxs?.[0];
    rasterIsInteger = valoresSaoTodosInteiros(currentRaster.values?.[0]);

    rasterTemValores = Number.isFinite(rasterMinimum) && Number.isFinite(rasterMaximum);

    if (!rasterTemValores) {
        // Nenhuma célula com valor (ex.: intensidade máxima numa região
        // sem ondas nesse ano) — a legenda mostra só "Sem ondas".
        console.warn("Raster sem valores. A utilizar 0-1.");
        rasterMinimum = 0;
        rasterMaximum = 1;
    }
    else if (rasterMinimum === rasterMaximum && !rasterIsInteger) {
        // Valor único contínuo (ex.: uma só célula com ondas): um
        // intervalo à volta dele, em vez de 0–1 sem relação com o valor.
        // Um valor único inteiro fica como está: uma classe só.
        rasterMinimum -= 0.5;
        rasterMaximum += 0.5;
    }

    console.log("Stretch:");
    console.log({
        min: rasterMinimum,
        max: rasterMaximum,
        inteiro: rasterIsInteger
    });
}

/*
    Percorre a banda do raster e confirma se todos os valores válidos
    (não-NaN) são inteiros.
*/
function valoresSaoTodosInteiros(banda) {
    if (!banda) {
        return false;
    }

    for (const linha of banda) {
        for (const valor of linha) {
            if (Number.isFinite(valor) && !Number.isInteger(valor)) {
                return false;
            }
        }
    }

    return true;
}

/* =============================================================================
    CORES
============================================================================= */

function getCurrentPalette() {
    if (typeof getCurrentEvent === 'function') {
        const ev = getCurrentEvent();
        if (ev && ev.palette) return ev.palette;
    }
    // Palete de recurso caso não esteja carregada
    return ["#ffffff", "#000000"];
}

/* =============================================================================
    SÉRIE TEMPORAL DO PONTO (clique no mapa)
============================================================================= */

/*
    Último ponto clicado pelo utilizador (null enquanto não houver clique).
    Guardado para se poder atualizar a Série Temporal do Ponto sempre que
    o evento/variável/metodologia mudam, sem exigir um novo clique.
*/
let pontoSelecionado = null;

/*
    Cache de georasters anuais já descarregados para a série do ponto,
    chave "{metodo}|{evento}|{variavel}|{ano}" -> georaster — evita
    descarregar o mesmo ficheiro outra vez ao clicar repetidamente com a
    mesma seleção ativa.
*/
const pixelSeriesCache = {};

/*
    Identifica o último pedido de série do ponto (seleção + ponto), para
    ignorar a resposta de um pedido que entretanto foi substituído.
*/
let seriePontoPedido = null;

/*
    Devolve a lista de anos configurados (CONFIG.START_YEAR..END_YEAR).
*/
function anosDisponiveis() {
    const anos = [];
    for (let ano = CONFIG.START_YEAR; ano <= CONFIG.END_YEAR; ano++) {
        anos.push(ano);
    }
    return anos;
}

/*
    Lê o valor de um pixel a partir de um georaster já descarregado, dadas
    coordenadas lat/lng (EPSG:4326). Devolve null se estiver fora da
    extensão do raster ou for NoData — mesma convenção de linha/coluna
    usada em drawRaster() (linha 0 = topo/ymax).
*/
function amostrarPixel(georaster, lat, lng) {
    const ponto3857 = L.CRS.EPSG3857.project(L.latLng(lat, lng));
    const pixelWidth = (georaster.xmax - georaster.xmin) / georaster.width;
    const pixelHeight = (georaster.ymax - georaster.ymin) / georaster.height;

    const col = Math.floor((ponto3857.x - georaster.xmin) / pixelWidth);
    const row = Math.floor((georaster.ymax - ponto3857.y) / pixelHeight);

    if (row < 0 || col < 0 || row >= georaster.height || col >= georaster.width) {
        return null;
    }

    const valor = georaster.values[0][row][col];
    return (valor === null || valor === undefined || isNaN(valor)) ? null : valor;
}

/*
    Calcula a série temporal do ponto (lat, lng) para todos os anos
    disponíveis, lendo o pixel de cada COG anual (país inteiro — a série
    do ponto nunca dependeu do recorte NUTS, só da localização exata) e
    atualiza o gráfico "Série Temporal do Ponto". Substitui o pedido ao
    backend (que aqui não existe) por leitura direta dos ficheiros
    estáticos já usados para desenhar o mapa.
*/
async function updatePointTimeSeries(lat, lng) {
    console.log("========================================");
    console.log("Série temporal do ponto:", lat, lng);

    const metodo = APP_STATE.metodo;
    const evento = APP_STATE.evento;
    const variavel = APP_STATE.variavel;
    const anos = anosDisponiveis();

    const pedido = `${metodo}|${evento}|${variavel}|${lat}|${lng}`;
    seriePontoPedido = pedido;

    try {
        const valores = await Promise.all(anos.map(async (ano) => {
            const chave = `${metodo}|${evento}|${variavel}|${ano}`;

            // null em cache = ano sem camada (404), não voltar a pedir
            if (chave in pixelSeriesCache && pixelSeriesCache[chave] === null) {
                return null;
            }
            let georaster = pixelSeriesCache[chave];

            if (!georaster) {
                const path = `data/cog/${metodo}/${evento}/${ano}/${variavel}.tif`;
                try {
                    const response = await fetch(path);
                    if (!response.ok) {
                        if (response.status === 404) {
                            pixelSeriesCache[chave] = null;
                        }
                        return null;
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    georaster = await parseGeoraster(arrayBuffer);
                    pixelSeriesCache[chave] = georaster;
                }
                catch (error) {
                    console.warn("Falha ao carregar", path, error);
                    return null;
                }
            }

            return amostrarPixel(georaster, lat, lng);
        }));

        console.log("Série temporal do ponto:", valores);

        // Entretanto foi pedida outra série (outro ponto ou seleção): o
        // Promise.all antigo pode terminar depois do novo — ignorar.
        if (seriePontoPedido !== pedido) {
            return;
        }

        if (typeof updatePointChart === "function") {
            updatePointChart(anos, valores);
        }
    }
    catch (error) {
        console.error("Erro ao calcular série temporal do ponto:");
        console.error(error);
    }
}

/*
    Chamado quando o utilizador clica no mapa (ver m7_2_map.js): marca o
    ponto clicado e atualiza a Série Temporal do Ponto com os valores
    desse local ao longo dos anos disponíveis.
*/
async function handleMapPointClick(latlng) {
    pontoSelecionado = { lat: latlng.lat, lng: latlng.lng };

    if (typeof showPointMarker === "function") {
        showPointMarker(latlng);
    }

    await updatePointTimeSeries(latlng.lat, latlng.lng);
}

/*
    Reatualiza a Série Temporal do Ponto com o último ponto clicado,
    caso exista, usando o evento/variável/metodologia atuais. Chamado
    sempre que a seleção muda, para o gráfico nunca ficar desatualizado.
*/
async function refreshPointTimeSeries() {
    if (!pontoSelecionado) {
        return;
    }

    await updatePointTimeSeries(pontoSelecionado.lat, pontoSelecionado.lng);
}

/* =============================================================================
    SÉRIE TEMPORAL REGIONAL (média do país/região selecionada)
============================================================================= */

/*
    Tabela pré-calculada (média por ano, para todas as combinações
    metodologia/evento/variável/região) — substitui o cálculo em tempo
    real que o backend fazia (recorte + média), aqui feito uma única vez
    na preparação do deploy. Carregada uma vez a partir de
    data/stats_series.json e mantida em cache.
*/
/*
    Converte a série devolvida pela API nos eixos do gráfico, com todos os
    anos de CONFIG.START_YEAR a CONFIG.END_YEAR. A tabela pré-calculada só tem os anos
    que existem no catálogo; um ano sem camada (ex.: OMM / Frio /
    intensidade_max / 2002, um ano sem eventos) fica a null, para o gráfico
    mostrar uma falha em vez de ligar os anos vizinhos — nunca 0, porque a
    intensidade de um ano sem eventos não existe.
*/
function serieParaGrafico(serie) {
    const valorPorAno = new Map(serie.map((item) => [item.ano, item.value]));
    const labels = [];
    const valores = [];

    for (let ano = CONFIG.START_YEAR; ano <= CONFIG.END_YEAR; ano++) {
        labels.push(ano);
        valores.push(valorPorAno.has(ano) ? valorPorAno.get(ano) : null);
    }

    return { labels, valores };
}

let statsSeriesTable = null;

async function loadStatsSeriesTable() {
    if (statsSeriesTable) {
        return statsSeriesTable;
    }
    const response = await fetch("data/stats_series.json");
    statsSeriesTable = await response.json();
    return statsSeriesTable;
}

/*
    Atualiza o gráfico "Série Temporal Regional" a partir da tabela
    pré-calculada, respeitando a região NUTS ativa (chave "" = país
    inteiro, tal como gerado em build_static_deploy.py).
*/
async function refreshRegionalTimeSeries() {
    console.log("========================================");
    console.log("Série temporal regional (tabela pré-calculada)");

    try {
        const tabela = await loadStatsSeriesTable();
        const chave = `${APP_STATE.metodo}|${APP_STATE.evento}|${APP_STATE.variavel}|${APP_STATE.nuts || ""}`;
        const serie = tabela[chave];

        if (!serie) {
            console.warn("Sem série pré-calculada para:", chave);
            return;
        }

        console.log("Série temporal regional:", serie);

        const { labels, valores } = serieParaGrafico(serie);

        if (typeof updateRegionalChart === "function") {
            updateRegionalChart(labels, valores);
        }
    }
    catch (error) {
        console.error("Erro ao obter série temporal regional:");
        console.error(error);
    }
}

/* =============================================================================
    EXPORTAÇÃO GLOBAL
============================================================================= */

window.handleMapPointClick = handleMapPointClick;
window.updatePointTimeSeries = updatePointTimeSeries;
window.refreshPointTimeSeries = refreshPointTimeSeries;
window.refreshRegionalTimeSeries = refreshRegionalTimeSeries;
window.clearRaster = clearRaster;
window.removeRasterLayer = removeRasterLayer;
window.loadRaster = loadRaster;
window.loadRasterComURL = loadRasterComURL;
window.drawRaster = drawRaster;
window.refreshRaster = refreshRaster;
window.updateRaster = updateRaster;
window.printRasterState = printRasterState;

/* =============================================================================
    MÓDULO CARREGADO
============================================================================= */

console.log("✔ m7_4_raster.js carregado.");
