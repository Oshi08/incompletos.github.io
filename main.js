document.addEventListener('DOMContentLoaded', () => {
    const topnav = document.querySelector('nav.topnav');
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const strip = document.querySelector('.chapters-strip');
    const viewport = document.querySelector('.chapters-viewport');
    const seasonSelect = document.querySelector('.season-selector');
    const cards = Array.from(document.querySelectorAll('.chapter-card'));

    if (!strip || !viewport || cards.length === 0) return;

    const CLOSED_WIDTH = 276;
    const CARD_HEIGHT = 636;
    const GAP = 35;
    const DESC_WIDTH = 393;
    const DEFAULT_RATIO = 16 / 9;
    const HOVER_DELAY_MS = 800;

    let activeCard = null;
    const hoverTimers = new Map();
    let mobileModal = null;
    let mobileScrollTimer = null;

    const closeNavMenu = () => {
        if (!topnav) return;
        topnav.classList.remove('is-open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    };

    if (topnav && navToggle && navLinks) {
        navToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = topnav.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        navLinks.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => closeNavMenu());
        });

        document.addEventListener('click', (event) => {
            if (window.matchMedia('(max-width: 900px)').matches && !topnav.contains(event.target)) {
                closeNavMenu();
            }
        });
    }

    const seasons = {
        1: [
            {
                label: 'CAPITULO 01',
                title: 'Capitulo 01',
                desc: 'Un episodio intimo sobre la perdida y el peso de lo que no se dice.',
                poster: 'img/Captura.PNG',
                src: 'img/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 02',
                title: 'Capitulo 02',
                desc: 'Un estallido de luz que transforma lo cotidiano en celebracion.',
                poster: 'img/Captura2.PNG',
                src: 'img/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 03',
                title: 'Capitulo 03',
                desc: 'La energia que rompe el silencio y obliga a tomar posicion.',
                poster: 'img/Captura.PNG',
                src: 'img/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 04',
                title: 'Capitulo 04',
                desc: 'Un recorrido por la incertidumbre y el impulso de protegerse.',
                poster: 'img/Captura2.PNG',
                src: 'img/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 05',
                title: 'Capitulo 05',
                desc: 'El limite entre lo tolerable y lo que necesitamos apartar.',
                poster: 'img/Captura.PNG',
                src: 'img/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            }
        ],
        2: [
            {
                label: 'CAPITULO 06',
                title: 'Capitulo 06',
                desc: 'Una pausa que ordena el ruido y devuelve el control.',
                poster: 'img/Captura2.PNG',
                src: 'img/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 07',
                title: 'Capitulo 07',
                desc: 'El impulso que acelera el corazon y borra los limites.',
                poster: 'img/Captura.PNG',
                src: 'img/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 08',
                title: 'Capitulo 08',
                desc: 'La sombra que aparece cuando el recuerdo se vuelve espejo.',
                poster: 'img/Captura2.PNG',
                src: 'img/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 09',
                title: 'Capitulo 09',
                desc: 'Una grieta de luz que abre camino en la oscuridad.',
                poster: 'img/Captura.PNG',
                src: 'img/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPITULO 10',
                title: 'Capitulo 10',
                desc: 'El silencio absoluto donde todo se reinicia.',
                poster: 'img/Captura2.PNG',
                src: 'img/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            }
        ]
    };

    const ensureShell = (card) => {
        const media = card.querySelector('.chapter-media');
        const info = card.querySelector('.chapter-info');
        if (!media || !info) return;

        let shell = card.querySelector('.chapter-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'chapter-shell';
            card.insertBefore(shell, card.firstChild);
        }

        if (media.parentElement !== shell) shell.appendChild(media);
        if (info.parentElement !== shell) shell.appendChild(info);

        const closeButton = card.querySelector('.chapter-close');
        if (closeButton && closeButton.parentElement !== info) {
            info.appendChild(closeButton);
        }
    };

    cards.forEach((card) => ensureShell(card));

    const getRatio = (card) => {
        const video = card.querySelector('video');
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
            return video.videoWidth / video.videoHeight;
        }
        return DEFAULT_RATIO;
    };

    const isMobileLayout = () => window.matchMedia('(max-width: 900px)').matches;

    const enterFullscreenIfMobile = (video) => {
        if (!video || !isMobileLayout()) return;
        try {
            if (typeof video.requestFullscreen === 'function') {
                video.requestFullscreen().catch(() => {});
                return;
            }
            if (typeof video.webkitRequestFullscreen === 'function') {
                video.webkitRequestFullscreen();
                return;
            }
            if (typeof video.webkitEnterFullscreen === 'function') {
                video.webkitEnterFullscreen();
            }
        } catch (_) {}
    };

    const exitFullscreenSafe = () => {
        try {
            if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                document.exitFullscreen().catch(() => {});
                return;
            }
            if (typeof document.webkitExitFullscreen === 'function') {
                document.webkitExitFullscreen();
            }
        } catch (_) {}
    };

    const setStripShift = (valuePx) => {
        strip.style.setProperty('--strip-shift', `${Math.round(valuePx)}px`);
    };

    const getShiftBounds = (trackWidth) => {
        const viewportWidth = viewport.clientWidth;
        if (trackWidth <= viewportWidth) {
            const centered = (viewportWidth - trackWidth) / 2;
            return { min: centered, max: centered };
        }
        return { min: viewportWidth - trackWidth, max: 0 };
    };

    const clampShift = (value, trackWidth) => {
        const { min, max } = getShiftBounds(trackWidth);
        return Math.min(max, Math.max(min, value));
    };

    const centerClosedTrack = () => {
        if (isMobileLayout()) {
            setStripShift(0);
            return;
        }
        const closedTrackWidth = (cards.length * CLOSED_WIDTH) + ((cards.length - 1) * GAP);
        const centered = (viewport.clientWidth - closedTrackWidth) / 2;
        setStripShift(clampShift(centered, closedTrackWidth));
    };

    const setCardSizes = (card, expandedWidth, mediaWidth) => {
        card.style.setProperty('--expanded-width', `${Math.round(expandedWidth)}px`);
        card.style.setProperty('--media-width', `${Math.round(mediaWidth)}px`);
    };

    const resetVideo = (video, shouldLoad = false) => {
        if (!video) return;
        video.pause();
        video.controls = false;
        video.muted = true;
        video.loop = false;
        if (shouldLoad) video.load();
    };

    const stopPreview = (card) => {
        const timer = hoverTimers.get(card);
        if (timer) {
            clearTimeout(timer);
            hoverTimers.delete(card);
        }

        if (!card.classList.contains('is-previewing')) return;

        card.classList.remove('is-previewing');
        if (card.classList.contains('is-media')) return;

        const video = card.querySelector('video');
        resetVideo(video, false);
    };

    const clearAllPreview = () => {
        cards.forEach((card) => stopPreview(card));
    };

    const closeMobileModal = () => {
        if (!mobileModal) return;
        exitFullscreenSafe();
        const videos = mobileModal.querySelectorAll('video');
        videos.forEach((video) => resetVideo(video, false));
        mobileModal.remove();
        mobileModal = null;
        document.body.classList.remove('chapter-modal-open');
    };

    const updateMobilePreviewFromViewport = () => {
        if (!isMobileLayout() || mobileModal) return;

        const viewportRect = viewport.getBoundingClientRect();
        const viewportCenter = viewportRect.left + (viewportRect.width / 2);
        let closestCard = null;
        let closestDistance = Infinity;

        cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const cardCenter = rect.left + (rect.width / 2);
            const distance = Math.abs(cardCenter - viewportCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestCard = card;
            }
        });

        cards.forEach((card) => {
            if (card !== closestCard) stopPreview(card);
        });

        if (closestCard && !closestCard.classList.contains('is-previewing')) {
            startPreview(closestCard);
        }
    };

    const openMobileModal = (sourceCard) => {
        closeMobileModal();

        const modal = document.createElement('div');
        modal.className = 'chapter-modal';

        const modalCard = sourceCard.cloneNode(true);
        modalCard.classList.remove('is-previewing', 'is-media');
        modalCard.classList.add('is-active', 'mobile-modal-card');
        modalCard.setAttribute('aria-expanded', 'true');
        setCardSizes(modalCard, CLOSED_WIDTH, CLOSED_WIDTH);

        const modalClose = modalCard.querySelector('.chapter-close');
        const modalPlay = modalCard.querySelector('.chapter-play-btn');
        const modalVideo = modalCard.querySelector('video');

        if (modalClose) {
            modalClose.addEventListener('click', (event) => {
                event.stopPropagation();
                closeMobileModal();
            });
        }

        if (modalPlay && modalVideo) {
            modalPlay.addEventListener('click', (event) => {
                event.stopPropagation();
                modalCard.classList.add('is-media');
                enterFullscreenIfMobile(modalVideo);
                modalVideo.muted = false;
                modalVideo.controls = true;
                modalVideo.loop = false;
                const promise = modalVideo.play();
                if (promise && typeof promise.catch === 'function') promise.catch(() => {});
            });
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeMobileModal();
        });

        modal.appendChild(modalCard);
        document.body.appendChild(modal);
        document.body.classList.add('chapter-modal-open');
        mobileModal = modal;
    };

    const centerActiveCard = (activeIndex, expandedWidth) => {
        if (isMobileLayout()) {
            setStripShift(0);
            const card = cards[activeIndex];
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            return;
        }
        const viewportCenterX = viewport.clientWidth / 2;
        const activeLeft = activeIndex * (CLOSED_WIDTH + GAP);
        const activeCenterX = activeLeft + (expandedWidth / 2);
        const trackWidth = expandedWidth + ((cards.length - 1) * CLOSED_WIDTH) + ((cards.length - 1) * GAP);
        const targetShift = viewportCenterX - activeCenterX;
        setStripShift(clampShift(targetShift, trackWidth));
    };

    const runStagger = () => {
        strip.classList.remove('stagger-in');
        void strip.offsetWidth;
        strip.classList.add('stagger-in');
    };

    const placeGrid = () => {
        cards.forEach((card) => {
            card.classList.remove('is-active', 'is-media', 'is-previewing');
            card.setAttribute('aria-expanded', 'false');
            setCardSizes(card, CLOSED_WIDTH, CLOSED_WIDTH);
            const video = card.querySelector('video');
            resetVideo(video, false);
        });

        centerClosedTrack();
        activeCard = null;
    };

    const deactivate = () => {
        closeMobileModal();
        clearAllPreview();
        placeGrid();
    };

    const activate = (card) => {
        const activeIndex = cards.indexOf(card);
        if (activeIndex < 0) return;

        clearAllPreview();

        if (activeCard && activeCard !== card) {
            const prevVideo = activeCard.querySelector('video');
            resetVideo(prevVideo, false);
        }

        cards.forEach((item) => {
            item.classList.remove('is-active', 'is-media', 'is-previewing');
            item.setAttribute('aria-expanded', 'false');
            setCardSizes(item, CLOSED_WIDTH, CLOSED_WIDTH);
        });

        const ratio = getRatio(card);
        const maxExpanded = viewport.clientWidth;
        const preferredMediaWidth = Math.round(CARD_HEIGHT * ratio);
        const maxMediaWidth = Math.max(CLOSED_WIDTH, maxExpanded - DESC_WIDTH);
        const mediaWidth = Math.min(Math.max(CLOSED_WIDTH, preferredMediaWidth), maxMediaWidth);
        const expandedWidth = mediaWidth + DESC_WIDTH;

        setCardSizes(card, expandedWidth, mediaWidth);
        card.classList.add('is-active');
        card.setAttribute('aria-expanded', 'true');

        centerActiveCard(activeIndex, expandedWidth);

        activeCard = card;
    };

    const startPreview = (card) => {
        if (activeCard) return;
        const video = card.querySelector('video');
        if (!video) return;

        card.classList.add('is-previewing');
        video.muted = true;
        video.loop = true;
        video.controls = false;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    };

    const enableMedia = (card) => {
        if (!card.classList.contains('is-active')) return;
        if (card.classList.contains('is-media')) return;

        const video = card.querySelector('video');
        if (!video) return;

        card.classList.remove('is-previewing');
        card.classList.add('is-media');
        video.muted = false;
        video.controls = true;
        video.loop = false;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    };

    const applySeason = (key) => {
        const data = seasons[key];
        if (!data) return;

        deactivate();

        cards.forEach((card, index) => {
            const item = data[index];
            if (!item) return;

            const label = card.querySelector('.chapter-label');
            const title = card.querySelector('.chapter-title');
            const desc = card.querySelector('.chapter-desc');
            const thumb = card.querySelector('.chapter-thumb');
            const video = card.querySelector('video');
            const source = video ? video.querySelector('source') : null;

            if (label) label.textContent = item.label;
            if (title) title.textContent = item.title;
            if (desc) desc.textContent = item.desc;
            if (thumb) {
                thumb.setAttribute('src', item.poster);
                thumb.setAttribute('alt', `Miniatura ${item.title}`);
            }
            if (video) video.setAttribute('poster', item.poster);
            if (source && video) {
                source.setAttribute('src', item.src);
                source.setAttribute('type', item.type);
                video.load();
            }
        });

        placeGrid();
        runStagger();
    };

    cards.forEach((card) => {
        const closeButton = card.querySelector('.chapter-close');
        const playButton = card.querySelector('.chapter-play-btn');

        card.addEventListener('mouseenter', () => {
            if (activeCard) return;
            stopPreview(card);
            const timer = setTimeout(() => startPreview(card), HOVER_DELAY_MS);
            hoverTimers.set(card, timer);
        });

        card.addEventListener('mouseleave', () => {
            if (card.classList.contains('is-active')) return;
            stopPreview(card);
        });

        card.addEventListener('click', (event) => {
            if (closeButton && closeButton.contains(event.target)) return;
            if (playButton && playButton.contains(event.target)) return;

            if (isMobileLayout()) {
                openMobileModal(card);
                return;
            }

            if (!card.classList.contains('is-active')) {
                activate(card);
                return;
            }

            enableMedia(card);
        });

        if (closeButton) {
            closeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                deactivate();
            });
        }

        if (playButton) {
            playButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!card.classList.contains('is-active')) {
                    activate(card);
                    return;
                }
                enableMedia(card);
            });
        }

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (isMobileLayout()) {
                    openMobileModal(card);
                    return;
                }
                if (!card.classList.contains('is-active')) {
                    activate(card);
                    return;
                }
                enableMedia(card);
            }
            if (event.key === 'Escape' && card.classList.contains('is-active')) {
                deactivate();
            }
        });

    });

    viewport.addEventListener('scroll', () => {
        if (!isMobileLayout()) return;
        if (mobileScrollTimer) clearTimeout(mobileScrollTimer);
        mobileScrollTimer = setTimeout(updateMobilePreviewFromViewport, 90);
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 900px)').matches) {
            closeNavMenu();
        }
        if (activeCard) {
            activate(activeCard);
            return;
        }
        placeGrid();
        updateMobilePreviewFromViewport();
    });

    if (seasonSelect) {
        seasonSelect.addEventListener('change', (event) => {
            applySeason(event.target.value);
            updateMobilePreviewFromViewport();
        });
        applySeason(seasonSelect.value || '1');
    } else {
        placeGrid();
        runStagger();
    }

    updateMobilePreviewFromViewport();
});



