/* =========================================================
   GUIA DO FOR HONOR
   GLOBAL.JS

   Responsabilidades:
   - Intro cinematográfica da index
   - Créditos da abertura
   - Escudo crescendo
   - Entrada das espadas
   - Pulsações douradas
   - Revelação do wallpaper
   - Saída do brasão
   - Fade in dos botões
   - Entrada da placa
   - Ativação da aura dos botões

   Também controla:
   - Transição entre páginas
   - Cortina preta entre documentos
   - Handoff do escudo + espadas
   - Entrada das páginas internas
   - Recuperação pelo botão voltar do navegador
   ========================================================= */


(() => {

    "use strict";


    /* =====================================================
       CONFIGURAÇÕES
       ===================================================== */

    const TRANSITION_STORAGE_KEY =
        "fh-page-transition";


    /*
       Tempo em que os créditos permanecem
       totalmente visíveis.
    */

    const CREDIT_HOLD_TIME =
        1500;


    /*
       Pausa depois que o wallpaper aparece
       e antes do brasão começar a sair.
    */

    const WALLPAPER_PAUSE =
        500;


    /*
       Intervalo usado pelo stagger dos botões.

       global.css:

       item 1 = 0ms
       item 2 = 70ms
       item 3 = 140ms
       ...
    */

    const REVEAL_STAGGER_STEP =
        70;


    /*
       Segurança do handoff entre páginas.

       Se a informação ficar antiga demais,
       a transição é descartada.
    */

    const HANDOFF_MAX_AGE =
        15000;


    /*
       Preferência de acessibilidade.
    */

    const REDUCED_MOTION =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


    /* =====================================================
       ESTADO GLOBAL
       ===================================================== */

    let transitionRunning =
        false;


    /* =====================================================
       HELPERS
       ===================================================== */

    function sleep(ms) {

        return new Promise(
            resolve => {

                window.setTimeout(
                    resolve,
                    ms
                );

            }
        );

    }


    /*
       Espera dois frames.

       Isso garante que o navegador
       aplique um estado CSS antes
       de iniciar o próximo.
    */

    function nextFrame() {

        return new Promise(
            resolve => {

                requestAnimationFrame(
                    () => {

                        requestAnimationFrame(
                            resolve
                        );

                    }
                );

            }
        );

    }


    /*
       Converte:

       0.8s
       800ms

       para milissegundos.
    */

    function parseCssTime(
        value,
        fallback
    ) {

        if (!value) {
            return fallback;
        }


        const trimmed =
            value.trim();


        if (
            trimmed.endsWith("ms")
        ) {

            const number =
                parseFloat(
                    trimmed
                );


            return Number.isFinite(
                number
            )
                ? number
                : fallback;

        }


        if (
            trimmed.endsWith("s")
        ) {

            const number =
                parseFloat(
                    trimmed
                );


            return Number.isFinite(
                number
            )
                ? number * 1000
                : fallback;

        }


        const number =
            parseFloat(
                trimmed
            );


        return Number.isFinite(
            number
        )
            ? number
            : fallback;

    }


    /*
       Lê uma variável de tempo
       definida no CSS.
    */

    function cssTime(
        variableName,
        fallback
    ) {

        const styles =
            getComputedStyle(
                document.documentElement
            );


        const value =
            styles.getPropertyValue(
                variableName
            );


        return parseCssTime(
            value,
            fallback
        );

    }


    /*
       Força o navegador a aplicar
       imediatamente alterações CSS.

       É usado principalmente para
       reiniciar animações.
    */

    function forceReflow(
        element
    ) {

        if (!element) {
            return;
        }


        void element.offsetWidth;

    }


    /*
       Remove o estado temporário aplicado
       pelo script anti-flash do <head>.

       Centralizamos isso em uma função para
       garantir que a classe nunca fique presa.
    */

    function clearHandoffPending() {

        document.documentElement
            .classList.remove(
                "transition-handoff-pending"
            );

    }


    /* =====================================================
       ELEMENTOS DA PÁGINA
       ===================================================== */

    function getPageElements() {

        return {

            intro:
                document.querySelector(
                    ".intro"
                ),

            introCredit:
                document.querySelector(
                    ".intro-credit"
                ),

            transition:
                document.querySelector(
                    ".page-transition"
                ),

            menu:
                document.querySelector(
                    ".menu"
                ),

            plate:
                document.querySelector(
                    ".plate-wrap"
                ),

            footer:
                document.querySelector(
                    ".footer-note"
                ),

            contentReveal:
                document.querySelector(
                    ".content-reveal"
                )

        };

    }


    /* =====================================================
       TEMPO TOTAL DO FADE DOS BOTÕES
       ===================================================== */

    /*
       Calcula quanto tempo precisamos esperar
       até o último botão terminar o fade.

       Exemplo com 6 botões:

       fade = 650ms
       último stagger = 350ms

       total ≈ 1000ms
    */

    function getContentRevealDuration(
        container
    ) {

        const baseDuration =
            cssTime(
                "--content-reveal-duration",
                650
            );


        if (!container) {
            return baseDuration;
        }


        const items =
            container.querySelectorAll(
                ".reveal-item"
            );


        if (!items.length) {
            return baseDuration;
        }


        /*
           O global.css atualmente define
           stagger até o sexto item.
        */

        const staggerCount =
            Math.min(
                items.length - 1,
                5
            );


        return (
            baseDuration +
            staggerCount *
            REVEAL_STAGGER_STEP
        );

    }


    /* =====================================================
       RESET DO BRASÃO
       ===================================================== */

    function resetTransition(
        transition
    ) {

        if (!transition) {
            return;
        }


        transition.classList.remove(
            "is-active",
            "is-black",
            "is-darkening",
            "is-revealing-page",
            "is-shield-in",
            "is-swords-in",
            "is-pulse-1",
            "is-pulse-2",
            "is-pulse-4",
            "is-emblem-out",
            "is-handoff"
        );


        forceReflow(
            transition
        );

    }


    /* =====================================================
       PULSAÇÃO DOURADA
       ===================================================== */

    /*
       INTRO DA INDEX:
       2 pulsos.

       TRANSIÇÃO ENTRE PÁGINAS:
       1 pulso antes da troca
       +
       1 pulso depois da troca.
    */

    async function pulseEmblem(
        transition,
        pulseCount = 1
    ) {

        if (!transition) {
            return;
        }


        transition.classList.remove(
            "is-pulse-1",
            "is-pulse-2",
            "is-pulse-4"
        );


        forceReflow(
            transition
        );


        const normalizedPulseCount =
            pulseCount === 2
                ? 2
                : 1;


        const className =
            normalizedPulseCount === 2
                ? "is-pulse-2"
                : "is-pulse-1";


        transition.classList.add(
            className
        );


        if (
            REDUCED_MOTION
        ) {

            transition.classList.remove(
                className
            );

            return;

        }


        const pulseDuration =
            cssTime(
                "--transition-aura-pulse-duration",
                1200
            );


        await sleep(
            pulseDuration *
            normalizedPulseCount +
            50
        );


        transition.classList.remove(
            className
        );

    }


    /* =====================================================
       AURA DOS BOTÕES
       ===================================================== */

    function activateButtonAura() {

        const buttons =
            document.querySelectorAll(
                ".site-button"
            );


        buttons.forEach(
            button => {

                button.classList.add(
                    "button-aura-active"
                );

            }
        );

    }


    function deactivateButtonAura() {

        const buttons =
            document.querySelectorAll(
                ".site-button"
            );


        buttons.forEach(
            button => {

                button.classList.remove(
                    "button-aura-active"
                );

            }
        );

    }


    /* =====================================================
       REVELAÇÃO DO CONTEÚDO
       ===================================================== */

    /*
       Os botões já estão em seus lugares finais.

       Apenas fazemos:

       opacity 0 → 1
       translateY → 0
       scale → 1

       através do global.css.
    */

    async function revealContent(
        container
    ) {

        if (!container) {
            return;
        }


        container.classList.add(
            "is-visible"
        );


        if (
            REDUCED_MOTION
        ) {

            return;
        }


        await sleep(
            getContentRevealDuration(
                container
            )
        );

    }


    /* =====================================================
       ENTRADA DA PLACA
       ===================================================== */

    async function revealPlate(
        plate,
        isIndex = false
    ) {

        if (!plate) {
            return;
        }


        plate.classList.add(
            "is-visible"
        );


        if (
            REDUCED_MOTION
        ) {

            return;
        }


        const duration =
            isIndex
                ? cssTime(
                    "--index-plate-entry-duration",
                    1150
                )
                : cssTime(
                    "--secondary-entry-duration",
                    1150
                );


        await sleep(
            duration
        );

    }


    /* =====================================================
       INTRO DA INDEX
       ===================================================== */

    async function runIndexIntro() {

        const {
            intro,
            introCredit,
            transition,
            menu,
            plate,
            footer,
            contentReveal
        } =
            getPageElements();


        /*
           Se algum elemento essencial estiver
           faltando, mostramos a página direto.
        */

        if (
            !transition ||
            !menu
        ) {

            showIndexImmediately();

            return;

        }


        transitionRunning =
            true;


        deactivateButtonAura();


        /*
           Caso o usuário tenha redução de
           movimento ativada.
        */

        if (
            REDUCED_MOTION
        ) {

            showIndexImmediately();

            transitionRunning =
                false;

            return;

        }


        /*
           =====================================
           1 — TELA PRETA
           =====================================
        */

        transition.classList.add(
            "is-active"
        );


        await nextFrame();


        /*
           =====================================
           2 — CRÉDITOS FADE IN
           =====================================
        */

        if (
            introCredit
        ) {

            introCredit.classList.add(
                "is-visible"
            );


            await sleep(
                cssTime(
                    "--index-credit-fade-duration",
                    650
                )
            );


            /*
               Fica visível por aproximadamente
               1,5 segundo.
            */

            await sleep(
                CREDIT_HOLD_TIME
            );


            /*
               =================================
               3 — CRÉDITOS FADE OUT
               =================================
            */

            introCredit.classList.add(
                "is-fading-out"
            );


            await sleep(
                cssTime(
                    "--index-credit-fade-duration",
                    650
                )
            );


            introCredit.classList.add(
                "is-hidden"
            );

        }


        /*
           =====================================
           4 — ESCUDO CRESCE
           =====================================
        */

        transition.classList.add(
            "is-shield-in"
        );


        await sleep(
            cssTime(
                "--transition-shield-in-duration",
                780
            )
        );


        /*
           =====================================
           5 — ESPADAS DESCEM
           =====================================
        */

        transition.classList.add(
            "is-swords-in"
        );


        await sleep(
            cssTime(
                "--transition-swords-in-duration",
                820
            )
        );


        /*
           =====================================
           6 — 2 PULSOS DOURADOS
           =====================================
        */

        await pulseEmblem(
            transition,
            2
        );


        /*
           =====================================
           7 — REVELA O WALLPAPER
           =====================================
        */

        if (
            intro
        ) {

            intro.classList.add(
                "is-revealing"
            );


            await sleep(
                cssTime(
                    "--index-black-fade-duration",
                    850
                )
            );


            intro.classList.add(
                "is-finished"
            );

        }


        /*
           =====================================
           8 — PAUSA CURTA
           =====================================
        */

        await sleep(
            WALLPAPER_PAUSE
        );


        /*
           =====================================
           9 — BRASÃO SAI

           Escudo diminui.
           Espadas dão ré.
           =====================================
        */

        transition.classList.add(
            "is-emblem-out"
        );


        await sleep(
            cssTime(
                "--transition-emblem-out-duration",
                720
            )
        );


        /*
           O brasão terminou completamente.
        */

        resetTransition(
            transition
        );


        /*
           =====================================
           10 — BOTÕES FAZEM FADE IN
           =====================================
        */

        await revealContent(
            contentReveal || menu
        );


        /*
           =====================================
           11 — PLACA DESCE
           =====================================
        */

        await revealPlate(
            plate,
            true
        );


        /*
           =====================================
           12 — LIBERA OS BOTÕES
           =====================================
        */

        menu.classList.add(
            "is-ready"
        );


        /*
           =====================================
           13 — AURA DOS BOTÕES
           =====================================
        */

        activateButtonAura();


        /*
           =====================================
           14 — RODAPÉ APARECE
           =====================================
        */

        if (
            footer
        ) {

            footer.classList.add(
                "is-visible"
            );

        }


        transitionRunning =
            false;

    }


    /* =====================================================
       INDEX SEM INTRO
       ===================================================== */

    function showIndexImmediately() {

        const {
            intro,
            menu,
            plate,
            footer,
            transition,
            contentReveal
        } =
            getPageElements();


        clearHandoffPending();


        if (
            intro
        ) {

            intro.classList.add(
                "is-finished"
            );

        }


        if (
            transition
        ) {

            resetTransition(
                transition
            );

        }


        if (
            contentReveal
        ) {

            contentReveal.classList.add(
                "is-visible"
            );

        }


        if (
            menu
        ) {

            menu.classList.add(
                "is-ready"
            );

        }


        if (
            plate
        ) {

            plate.classList.add(
                "is-visible"
            );

        }


        if (
            footer
        ) {

            footer.classList.add(
                "is-visible"
            );

        }


        activateButtonAura();

    }


    /* =====================================================
       HANDOFF ENTRE PÁGINAS
       ===================================================== */

    /*
       Salva temporariamente qual página
       deverá receber a continuação da animação.
    */

    function savePageTransition(
        targetHref
    ) {

        try {

            const data = {

                target:
                    targetHref,

                createdAt:
                    Date.now()

            };


            sessionStorage.setItem(
                TRANSITION_STORAGE_KEY,
                JSON.stringify(
                    data
                )
            );

        } catch (error) {

            /*
               Se sessionStorage estiver bloqueado,
               a navegação continua funcionando.
            */

        }

    }


    /*
       Verifica se esta página realmente
       é o destino da transição anterior.
    */

    function consumePageTransition() {

        let raw = null;


        try {

            raw =
                sessionStorage.getItem(
                    TRANSITION_STORAGE_KEY
                );


            sessionStorage.removeItem(
                TRANSITION_STORAGE_KEY
            );

        } catch (error) {

            return false;

        }


        if (!raw) {
            return false;
        }


        try {

            const data =
                JSON.parse(
                    raw
                );


            if (
                !data ||
                !data.target ||
                !data.createdAt
            ) {

                return false;

            }


            const age =
                Date.now() -
                data.createdAt;


            if (
                age >
                HANDOFF_MAX_AGE
            ) {

                return false;

            }


            const target =
                new URL(
                    data.target,
                    window.location.href
                );


            return (

                target.origin ===
                    window.location.origin &&

                target.pathname ===
                    window.location.pathname &&

                target.search ===
                    window.location.search

            );

        } catch (error) {

            return false;

        }

    }


    /* =====================================================
       SAÍDA DE UMA PÁGINA
       ===================================================== */

    async function runPageDeparture(
        href
    ) {

        const transition =
            document.querySelector(
                ".page-transition"
            );


        /*
           Se esta página ainda não possuir
           o sistema visual de transição,
           navega normalmente.
        */

        if (!transition) {

            window.location.href =
                href;

            return;

        }


        if (
            transitionRunning
        ) {

            return;

        }


        transitionRunning =
            true;


        /*
           Para a pulsação dos botões
           durante a saída.
        */

        deactivateButtonAura();


        /*
           Garante que o brasão esteja
           em seu estado inicial.
        */

        resetTransition(
            transition
        );


        transition.classList.add(
            "is-active"
        );


        await nextFrame();


        /*
           =====================================
           1 — ESCUDO SURGE E CRESCE
           =====================================
        */

        transition.classList.add(
            "is-shield-in",
            "is-darkening"
        );


        if (
            !REDUCED_MOTION
        ) {

            await sleep(
                cssTime(
                    "--transition-shield-in-duration",
                    780
                )
            );

        }


        /*
           =====================================
           2 — ESPADAS DESCEM E FORMAM O X
           =====================================
        */

        transition.classList.add(
            "is-swords-in"
        );


        if (
            !REDUCED_MOTION
        ) {

            await sleep(
                cssTime(
                    "--transition-swords-in-duration",
                    820
                )
            );

        }


        /*
           =====================================
           3 — 1 PULSO

           Primeiro pulso da transição.
           =====================================
        */

        if (
            !REDUCED_MOTION
        ) {

            await pulseEmblem(
                transition,
                1
            );


            /*
               O pulso já é mais longo que o fade
               do backdrop, mas aguardamos também
               o tempo configurado do preto para
               garantir que a navegação nunca ocorra
               antes da cortina estar totalmente opaca.
            */

            const backdropDuration =
                cssTime(
                    "--transition-backdrop-duration",
                    900
                );


            await sleep(
                Math.max(
                    0,
                    backdropDuration -
                    cssTime(
                        "--transition-aura-pulse-duration",
                        1200
                    )
                )
            );

        }


        /*
           Diz à próxima página:

           "comece com o escudo grande
            e as espadas já cruzadas".
        */

        savePageTransition(
            href
        );


        /*
           =====================================
           4 — TROCA DE PÁGINA
           =====================================
        */

        window.location.href =
            href;

    }


    /* =====================================================
       CHEGADA EM UMA PÁGINA
       ===================================================== */

    async function runPageArrival() {

        const {
            transition,
            menu,
            plate,
            footer,
            contentReveal,
            intro
        } =
            getPageElements();


        /*
           Se a página ainda não tiver
           o brasão de transição,
           mostramos tudo normalmente.
        */

        if (!transition) {

            showNormalPage();

            return;

        }


        transitionRunning =
            true;


        deactivateButtonAura();


        const isIndex =
            document.body.dataset.page ===
            "index";


        /*
           Se voltarmos para a index através
           de outra página, não mostramos
           os créditos novamente.
        */

        if (
            intro
        ) {

            intro.classList.add(
                "is-finished"
            );

        }


        /*
           =====================================
           1 — BRASÃO JÁ NASCE MONTADO

           Sem animação de entrada.
           =====================================
        */

        transition.classList.add(
            "is-active",
            "is-handoff",
            "is-shield-in",
            "is-swords-in",
            "is-darkening"
        );


        await nextFrame();


        /*
           O CSS do <head> manteve a nova página
           preta desde o primeiro frame.

           Agora o próprio .page-transition,
           através de .is-darkening, assume a
           responsabilidade por manter o fundo preto.
        */

        clearHandoffPending();


        /*
           Retiramos o modo handoff.

           O brasão continua parado,
           porém as transições CSS voltam
           a funcionar.
        */

        transition.classList.remove(
            "is-handoff"
        );


        /*
           =====================================
           2 — 1 PULSO

           Segundo pulso da transição.
           =====================================
        */

        if (
            !REDUCED_MOTION
        ) {

            await pulseEmblem(
                transition,
                1
            );

        }


        /*
           =====================================
           3 — REVELA A NOVA PÁGINA
               + BRASÃO SAI

           O preto desaparece suavemente
           enquanto o escudo diminui e
           as espadas fazem o movimento inverso.
           =====================================
        */

        transition.classList.remove(
            "is-darkening"
        );

        transition.classList.add(
            "is-revealing-page",
            "is-emblem-out"
        );


        if (
            !REDUCED_MOTION
        ) {

            /*
               Esperamos tanto a saída do brasão
               quanto o fade do backdrop.

               Assim os botões nunca aparecem
               enquanto ainda existe preto
               cobrindo parcialmente a página.
            */

            const emblemOutDuration =
                cssTime(
                    "--transition-emblem-out-duration",
                    720
                );

            const backdropDuration =
                cssTime(
                    "--transition-backdrop-duration",
                    900
                );


            await sleep(
                Math.max(
                    emblemOutDuration,
                    backdropDuration
                )
            );

        }


        /*
           Brasão desapareceu completamente
           e o wallpaper já foi revelado.
        */

        resetTransition(
            transition
        );


        /*
           =====================================
           4 — BOTÕES / ÍCONES FAZEM FADE IN

           Agora index e páginas internas
           usam exatamente o mesmo padrão.
           =====================================
        */

        if (
            contentReveal
        ) {

            await revealContent(
                contentReveal
            );

        }


        /*
           =====================================
           5 — PLACA DESCE
           =====================================
        */

        await revealPlate(
            plate,
            isIndex
        );


        /*
           =====================================
           6 — LIBERA O MENU
           =====================================
        */

        if (
            menu
        ) {

            menu.classList.add(
                "is-ready"
            );

        }


        /*
           =====================================
           7 — AURA DOS BOTÕES
           =====================================
        */

        activateButtonAura();


        /*
           =====================================
           8 — RODAPÉ
           =====================================
        */

        if (
            footer
        ) {

            footer.classList.add(
                "is-visible"
            );

        }


        transitionRunning =
            false;

    }


    /* =====================================================
       PÁGINA INTERNA ABERTA DIRETAMENTE
       ===================================================== */

    /*
       Caso alguém abra diretamente:

       guia-do-heroi.html

       ou atualize a página pelo navegador,
       não executamos uma falsa transição.

       Apenas mostramos a interface.
    */

    function showNormalPage() {

        const {
            intro,
            transition,
            menu,
            plate,
            footer,
            contentReveal
        } =
            getPageElements();


        clearHandoffPending();


        if (
            intro
        ) {

            intro.classList.add(
                "is-finished"
            );

        }


        if (
            transition
        ) {

            resetTransition(
                transition
            );

        }


        if (
            contentReveal
        ) {

            contentReveal.classList.add(
                "is-visible"
            );

        }


        if (
            menu
        ) {

            menu.classList.add(
                "is-ready"
            );

        }


        if (
            plate
        ) {

            plate.classList.add(
                "is-visible"
            );

        }


        if (
            footer
        ) {

            footer.classList.add(
                "is-visible"
            );

        }


        activateButtonAura();

    }


    /* =====================================================
       LINKS INTERNOS
       ===================================================== */

    function setupPageLinks() {

        const links =
            document.querySelectorAll(
                "a.page-link"
            );


        links.forEach(
            link => {

                link.addEventListener(
                    "click",
                    event => {


                        /*
                           Ctrl / Cmd / Shift / Alt:

                           deixa o navegador executar
                           normalmente.
                        */

                        if (
                            event.ctrlKey ||
                            event.metaKey ||
                            event.shiftKey ||
                            event.altKey
                        ) {

                            return;

                        }


                        /*
                           Apenas clique principal.
                        */

                        if (
                            event.button !== 0
                        ) {

                            return;

                        }


                        /*
                           Downloads não usam animação.
                        */

                        if (
                            link.hasAttribute(
                                "download"
                            )
                        ) {

                            return;

                        }


                        /*
                           Nova aba também não.
                        */

                        if (
                            link.target ===
                            "_blank"
                        ) {

                            return;

                        }


                        const href =
                            link.getAttribute(
                                "href"
                            );


                        if (!href) {
                            return;
                        }


                        const url =
                            new URL(
                                href,
                                window.location.href
                            );


                        /*
                           Links externos não usam
                           nossa animação.
                        */

                        if (
                            url.origin !==
                            window.location.origin
                        ) {

                            return;

                        }


                        /*
                           Detecta o mesmo documento.
                        */

                        const sameDocument =

                            url.pathname ===
                                window.location.pathname &&

                            url.search ===
                                window.location.search;


                        /*
                           Âncora dentro da mesma página.

                           Exemplo:

                           #warden
                        */

                        if (
                            sameDocument &&
                            url.hash
                        ) {

                            return;

                        }


                        /*
                           Daqui para baixo nós
                           controlamos a navegação.
                        */

                        event.preventDefault();


                        if (
                            transitionRunning
                        ) {

                            return;

                        }


                        runPageDeparture(
                            url.href
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       BFCACHE / BOTÃO VOLTAR
       ===================================================== */

    /*
       Alguns navegadores guardam a página
       congelada na memória.

       Ao usar "voltar", poderíamos retornar
       com o brasão ainda parado na tela.

       Aqui garantimos que a página volte
       em estado normal.
    */

    function setupBackForwardCache() {

        window.addEventListener(
            "pageshow",
            event => {

                if (
                    !event.persisted
                ) {

                    return;

                }


                transitionRunning =
                    false;


                const isIndex =
                    document.body.dataset.page ===
                    "index";


                if (
                    isIndex
                ) {

                    showIndexImmediately();

                } else {

                    showNormalPage();

                }

            }
        );

    }


    /* =====================================================
       INICIALIZAÇÃO
       ===================================================== */

    async function init() {

        /*
           Ativa transições nos links
           que possuem .page-link.
        */

        setupPageLinks();


        /*
           Prepara comportamento do botão
           voltar do navegador.
        */

        setupBackForwardCache();


        /*
           Verifica PRIMEIRO se viemos
           através de uma transição.
        */

        const arrivedFromTransition =
            consumePageTransition();


        if (
            arrivedFromTransition
        ) {

            await runPageArrival();

            return;

        }


        /*
           =====================================
           INDEX ABERTA DIRETAMENTE

           Executa a intro completa.
           =====================================
        */

        if (
            document.body.dataset.page ===
            "index"
        ) {

            /*
               Espera fontes quando possível,
               para evitar pequenas mudanças
               no layout durante a abertura.
            */

            if (
                document.fonts &&
                document.fonts.ready
            ) {

                try {

                    await document.fonts.ready;

                } catch (error) {

                    /*
                       Falha de fonte não impede
                       a animação.
                    */

                }

            }


            await nextFrame();


            await runIndexIntro();


            return;

        }


        /*
           =====================================
           PÁGINA INTERNA ABERTA DIRETAMENTE
           =====================================
        */

        showNormalPage();

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();

    }

})();