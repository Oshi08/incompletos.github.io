document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    const topnav = document.querySelector('nav.topnav');
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const seriesSection = document.querySelector('.content-block');
    const chaptersSection = document.querySelector('.chapters-section');
    const btsSlides = Array.from(document.querySelectorAll('.bts-slide'));
    const btsSlider = document.querySelector('.bts-slider');
    const btsPrev = document.querySelector('.bts-nav.prev');
    const btsNext = document.querySelector('.bts-nav.next');
    const strip = document.querySelector('.chapters-strip');
    const viewport = document.querySelector('.chapters-viewport');
    const seasonSelect = document.querySelector('.season-selector');
    const cards = Array.from(document.querySelectorAll('.chapter-card'));
    const introOverlay = document.querySelector('.content-block.intro-overlay');
    const INTRO_SEEN_KEY = 'incompletos_intro_seen_v1';
    const PERFORMANCE_MODE_KEY = 'incompletos_performance_mode_v1';
    const performanceToggleButton = document.querySelector('.floating-performance-btn');

    const isPerformanceModeStored = (() => {
        try {
            return window.localStorage.getItem(PERFORMANCE_MODE_KEY) === '1';
        } catch (_) {
            return false;
        }
    })();

    const isLikelySoftwareRenderer = (() => {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return false;
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return false;
            const rendererRaw = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            const renderer = String(rendererRaw || '').toLowerCase();
            return /(swiftshader|software|llvmpipe|angle \(software|basic render|mesa offscreen)/.test(renderer);
        } catch (_) {
            return false;
        }
    })();

    const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0 && navigator.deviceMemory <= 4;
    const saveDataEnabled = Boolean(navigator.connection && navigator.connection.saveData);
    const supportsBackdropFilter = Boolean(
        window.CSS
        && typeof window.CSS.supports === 'function'
        && (
            window.CSS.supports('backdrop-filter: blur(1px)')
            || window.CSS.supports('-webkit-backdrop-filter: blur(1px)')
        )
    );

    const shouldAutoPerformanceMode = !isPerformanceModeStored && (
        saveDataEnabled
        || isLikelySoftwareRenderer
        || ((lowCpu || lowMemory) && !supportsBackdropFilter)
    );

    if (isPerformanceModeStored || shouldAutoPerformanceMode) {
        document.body.classList.add('performance-mode');
    }

    const systemPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowMotionMode = systemPrefersReducedMotion || isPerformanceModeStored || shouldAutoPerformanceMode;

    const hasSeenIntro = (() => {
        try {
            return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
        } catch (_) {
            return false;
        }
    })();

    const markIntroSeen = () => {
        try {
            window.localStorage.setItem(INTRO_SEEN_KEY, '1');
        } catch (_) {}
    };

    const applyPerformanceMode = (enabled, options = {}) => {
        const { persist = true } = options;
        document.body.classList.toggle('performance-mode', enabled);
        if (performanceToggleButton) {
            performanceToggleButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            performanceToggleButton.setAttribute('aria-label', enabled ? 'Desactivar modo rendimiento' : 'Activar modo rendimiento');
            performanceToggleButton.textContent = enabled ? 'ANIMACIONES OFF' : 'OPTIMIZAR';
        }
        if (!persist) return;
        try {
            window.localStorage.setItem(PERFORMANCE_MODE_KEY, enabled ? '1' : '0');
        } catch (_) {}
    };

    if (performanceToggleButton) {
        applyPerformanceMode(document.body.classList.contains('performance-mode'), { persist: false });
        performanceToggleButton.addEventListener('click', () => {
            const nextEnabled = !document.body.classList.contains('performance-mode');
            applyPerformanceMode(nextEnabled);
            window.location.reload();
        });
    }

    const forceStartFromTop = () => {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    const resetIntroBootState = () => {
        document.body.classList.remove('intro-locked', 'intro-revealing', 'intro-unlocked');
        if (!introOverlay) return;
        introOverlay.classList.remove('is-exiting');
        introOverlay.style.setProperty('--intro-bg-x', '0px');
        introOverlay.style.setProperty('--intro-bg-y', '0px');
        introOverlay.style.setProperty('--intro-text-x', '0px');
        introOverlay.style.setProperty('--intro-text-y', '0px');
        introOverlay.style.setProperty('--intro-motion-blur', '0px');
    };

    resetIntroBootState();
    forceStartFromTop();

    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        window.location.reload();
    });

    let introUnlocked = false;
    const unlockIntro = () => {
        if (introUnlocked) return;
        introUnlocked = true;
        document.body.classList.remove('intro-locked', 'intro-revealing');
        document.body.classList.add('intro-unlocked');
    };

    if (introOverlay) {
        const INTRO_HOLD_MS = systemPrefersReducedMotion ? 260 : (isPerformanceModeStored ? (hasSeenIntro ? 3800 : 5400) : (hasSeenIntro ? 4200 : 8600));
        const INTRO_EXIT_MS = systemPrefersReducedMotion ? 520 : (isPerformanceModeStored ? 980 : (hasSeenIntro ? 1300 : 1800));
        let introExitStarted = false;
        let introFinalized = false;
        let introHoldTimer = 0;
        let introExitTimer = 0;
        let introHardFallbackTimer = 0;
        let introPointerX = (window.innerWidth || 1) / 2;
        let introPointerY = (window.innerHeight || 1) / 2;
        let introPrevPointerX = introPointerX;
        let introPrevPointerY = introPointerY;
        let introParallaxRaf = 0;
        let introBlurRaf = 0;
        let introBlurTarget = 0;
        let introBlurCurrent = 0;
        let introMotionListenersAttached = false;
        const hasPointerMove = ('onpointermove' in window);
        const parseCssTimeToMs = (value) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) return 0;
            if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed) || 0;
            if (trimmed.endsWith('s')) return (Number.parseFloat(trimmed) || 0) * 1000;
            return Number.parseFloat(trimmed) || 0;
        };
        const getTransformTransitionMs = (element) => {
            const styles = window.getComputedStyle(element);
            const properties = styles.transitionProperty.split(',').map((item) => item.trim());
            const durations = styles.transitionDuration.split(',').map(parseCssTimeToMs);
            const delays = styles.transitionDelay.split(',').map(parseCssTimeToMs);
            const count = Math.max(properties.length, durations.length, delays.length, 1);
            let maxMs = 0;
            for (let index = 0; index < count; index += 1) {
                const property = properties[index] || properties[properties.length - 1] || 'all';
                if (property !== 'all' && property !== 'transform') continue;
                const duration = durations[index] ?? durations[durations.length - 1] ?? 0;
                const delay = delays[index] ?? delays[delays.length - 1] ?? 0;
                maxMs = Math.max(maxMs, duration + delay);
            }
            return maxMs;
        };
        const setIntroMotionBlur = (value) => {
            introOverlay.style.setProperty('--intro-motion-blur', `${Math.max(0, value).toFixed(2)}px`);
        };
        const flushIntroMotionBlur = () => {
            introBlurRaf = 0;
            introBlurCurrent += (introBlurTarget - introBlurCurrent) * 0.18;
            if (Math.abs(introBlurCurrent) < 0.015 && Math.abs(introBlurTarget) < 0.015) {
                introBlurCurrent = 0;
                introBlurTarget = 0;
                setIntroMotionBlur(0);
                return;
            }
            setIntroMotionBlur(introBlurCurrent);
            introBlurTarget *= 0.9;
            introBlurRaf = window.requestAnimationFrame(flushIntroMotionBlur);
        };
        const kickIntroMotionBlur = (pointerSpeed) => {
            const blurFromSpeed = Math.min(8.2, pointerSpeed * 0.14);
            introBlurTarget = Math.max(introBlurTarget, blurFromSpeed);
            if (introBlurRaf) return;
            introBlurRaf = window.requestAnimationFrame(flushIntroMotionBlur);
        };
        const updateIntroParallax = (clientX, clientY) => {
            const w = window.innerWidth || 1;
            const h = window.innerHeight || 1;
            const nx = (clientX / w) - 0.5;
            const ny = (clientY / h) - 0.5;
            introOverlay.style.setProperty('--intro-bg-x', `${Math.round(nx * 30)}px`);
            introOverlay.style.setProperty('--intro-bg-y', `${Math.round(ny * 24)}px`);
            introOverlay.style.setProperty('--intro-text-x', `${Math.round(nx * 30)}px`);
            introOverlay.style.setProperty('--intro-text-y', `${Math.round(ny * 22)}px`);
        };
        const flushIntroParallax = () => {
            introParallaxRaf = 0;
            updateIntroParallax(introPointerX, introPointerY);
        };
        const resetIntroParallax = () => {
            introOverlay.style.setProperty('--intro-bg-x', '0px');
            introOverlay.style.setProperty('--intro-bg-y', '0px');
            introOverlay.style.setProperty('--intro-text-x', '0px');
            introOverlay.style.setProperty('--intro-text-y', '0px');
            introBlurTarget = 0;
            introBlurCurrent = 0;
            setIntroMotionBlur(0);
        };
        const onIntroPointerMove = (event) => {
            if (introExitStarted || introFinalized) return;
            if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
            if ('pointerType' in event && event.pointerType === 'touch') return;
            if ('isPrimary' in event && event.isPrimary === false) return;
            const dx = event.clientX - introPrevPointerX;
            const dy = event.clientY - introPrevPointerY;
            introPrevPointerX = event.clientX;
            introPrevPointerY = event.clientY;
            kickIntroMotionBlur(Math.hypot(dx, dy));
            introPointerX = event.clientX;
            introPointerY = event.clientY;
            if (introParallaxRaf) return;
            introParallaxRaf = window.requestAnimationFrame(flushIntroParallax);
        };
        const onIntroWheel = (event) => {
            if (Math.abs(event.deltaY) < 1) return;
            startIntroExit();
        };
        const detachIntroMotionListeners = () => {
            if (!introMotionListenersAttached) return;
            introMotionListenersAttached = false;
            if (hasPointerMove) {
                window.removeEventListener('pointermove', onIntroPointerMove);
            } else {
                window.removeEventListener('mousemove', onIntroPointerMove);
            }
            window.removeEventListener('mouseleave', resetIntroParallax);
            window.removeEventListener('wheel', onIntroWheel);
        };
        const attachIntroMotionListeners = () => {
            if (lowMotionMode || introMotionListenersAttached) return;
            introMotionListenersAttached = true;
            if (hasPointerMove) {
                window.addEventListener('pointermove', onIntroPointerMove, { passive: true });
            } else {
                window.addEventListener('mousemove', onIntroPointerMove, { passive: true });
            }
            window.addEventListener('mouseleave', resetIntroParallax, { passive: true });
            window.addEventListener('wheel', onIntroWheel, { passive: true });
        };
        const cleanupIntroRuntime = () => {
            detachIntroMotionListeners();
            introOverlay.removeEventListener('click', startIntroExit);
            if (introParallaxRaf) {
                window.cancelAnimationFrame(introParallaxRaf);
                introParallaxRaf = 0;
            }
            if (introBlurRaf) {
                window.cancelAnimationFrame(introBlurRaf);
                introBlurRaf = 0;
            }
            introBlurTarget = 0;
            introBlurCurrent = 0;
            setIntroMotionBlur(0);
        };
        const finalizeIntro = () => {
            if (introFinalized) return;
            if (!introExitStarted && !introOverlay.classList.contains('is-exiting')) return;
            introFinalized = true;
            cleanupIntroRuntime();
            if (introHoldTimer) window.clearTimeout(introHoldTimer);
            if (introExitTimer) window.clearTimeout(introExitTimer);
            if (introHardFallbackTimer) window.clearTimeout(introHardFallbackTimer);
            markIntroSeen();
            unlockIntro();
        };
        const startIntroExit = () => {
            if (introExitStarted) return;
            introExitStarted = true;
            detachIntroMotionListeners();
            introBlurTarget = 0;
            if (!introBlurRaf && introBlurCurrent > 0.015) {
                introBlurRaf = window.requestAnimationFrame(flushIntroMotionBlur);
            }
            document.body.classList.remove('intro-locked');
            document.body.classList.add('intro-revealing');
            requestAnimationFrame(() => {
                introOverlay.classList.add('is-exiting');
                if (introExitTimer) window.clearTimeout(introExitTimer);
                const computedTransformTransitionMs = getTransformTransitionMs(introOverlay);
                const settleMs = computedTransformTransitionMs > 0
                    ? Math.max(INTRO_EXIT_MS, computedTransformTransitionMs) + 120
                    : 48;
                introExitTimer = window.setTimeout(finalizeIntro, settleMs);
            });
        };

        if (seriesSection) seriesSection.classList.add('is-visible');
        document.body.classList.add('intro-locked');
        forceStartFromTop();
        if (!lowMotionMode) updateIntroParallax(introPointerX, introPointerY);
        attachIntroMotionListeners();
        introOverlay.addEventListener('click', startIntroExit);

        introHoldTimer = window.setTimeout(startIntroExit, INTRO_HOLD_MS);

        introOverlay.addEventListener('transitionend', (event) => {
            if (event.target !== introOverlay) return;
            if (event.propertyName !== 'transform') return;
            finalizeIntro();
        }, { once: true });

        introOverlay.addEventListener('transitioncancel', (event) => {
            if (event.target !== introOverlay) return;
            if (event.propertyName !== 'transform') return;
            finalizeIntro();
        }, { once: true });
        introHardFallbackTimer = window.setTimeout(finalizeIntro, INTRO_HOLD_MS + INTRO_EXIT_MS + 600);
    } else {
        document.body.classList.add('intro-unlocked');
    }

    const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const performanceModeActiveAtBoot = document.body.classList.contains('performance-mode');
    if (supportsFinePointer && !performanceModeActiveAtBoot) {
        const cursor = document.createElement('div');
        cursor.className = 'app-cursor';
        document.body.appendChild(cursor);
        document.body.classList.add('has-custom-cursor');
        let cursorX = 0;
        let cursorY = 0;
        let cursorRaf = 0;
        let cursorHoverTarget = null;

        const isClickableTarget = (target) => {
            if (!(target instanceof Element)) return false;
            return Boolean(target.closest(
                'a, button, [role=\"button\"], input, select, textarea, label, .chapter-card, .season-selector, .vertice-btn, .nav-toggle'
            ));
        };

        const setActiveFromEvent = (eventTarget) => {
            cursor.classList.toggle('is-active', isClickableTarget(eventTarget));
        };
        const flushCursorPosition = () => {
            cursorRaf = 0;
            cursor.style.left = `${cursorX}px`;
            cursor.style.top = `${cursorY}px`;
        };

        window.addEventListener('mousemove', (event) => {
            cursorX = event.clientX;
            cursorY = event.clientY;
            if (!cursorRaf) cursorRaf = window.requestAnimationFrame(flushCursorPosition);
            if (!cursor.classList.contains('is-visible')) cursor.classList.add('is-visible');
            if (cursorHoverTarget !== event.target) {
                cursorHoverTarget = event.target;
                setActiveFromEvent(cursorHoverTarget);
            }
        }, { passive: true });

        document.addEventListener('mouseover', (event) => {
            cursorHoverTarget = event.target;
            setActiveFromEvent(cursorHoverTarget);
        }, { passive: true });

        document.addEventListener('mousedown', () => {
            cursor.classList.add('is-press');
        });

        document.addEventListener('mouseup', () => {
            cursor.classList.remove('is-press');
        });

        document.addEventListener('mouseleave', () => {
            cursor.classList.remove('is-visible', 'is-active', 'is-press');
            cursorHoverTarget = null;
            if (cursorRaf) {
                window.cancelAnimationFrame(cursorRaf);
                cursorRaf = 0;
            }
        });

        window.addEventListener('blur', () => {
            cursor.classList.remove('is-visible', 'is-active', 'is-press');
            cursorHoverTarget = null;
            if (cursorRaf) {
                window.cancelAnimationFrame(cursorRaf);
                cursorRaf = 0;
            }
        });
    }

    if (seriesSection) {
        if ('IntersectionObserver' in window) {
            const isCenteredInViewport = (entry) => {
                const viewportH = window.innerHeight || document.documentElement.clientHeight;
                const viewportCenterY = viewportH / 2;
                return entry.boundingClientRect.top <= viewportCenterY && entry.boundingClientRect.bottom >= viewportCenterY;
            };

            const seriesObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (!isCenteredInViewport(entry)) return;
                    seriesSection.classList.add('is-visible');
                    seriesObserver.unobserve(seriesSection);
                });
            }, {
                threshold: [0, 0.25, 0.5, 0.75, 1],
                rootMargin: '0px 0px 0px 0px'
            });
            seriesObserver.observe(seriesSection);
        } else {
            seriesSection.classList.add('is-visible');
        }
    }

    if (btsSlides.length > 0) {
        let btsIndex = 0;
        let btsAutoTimer = 0;
        let btsInViewport = true;
        const canAutoRotateBts = btsSlides.length > 1 && !systemPrefersReducedMotion;
        const btsAutoDelayMs = isPerformanceModeStored ? 6400 : 4600;
        const setBtsSlide = (index) => {
            const total = btsSlides.length;
            btsIndex = (index + total) % total;
            btsSlides.forEach((slide, i) => {
                slide.classList.toggle('is-active', i === btsIndex);
            });
        };
        const clearBtsAuto = () => {
            if (!btsAutoTimer) return;
            window.clearInterval(btsAutoTimer);
            btsAutoTimer = 0;
        };
        const startBtsAuto = () => {
            if (!canAutoRotateBts || document.hidden || !btsInViewport) return;
            clearBtsAuto();
            btsAutoTimer = window.setInterval(() => {
                setBtsSlide(btsIndex + 1);
            }, btsAutoDelayMs);
        };
        const restartBtsAuto = () => {
            if (!canAutoRotateBts) return;
            startBtsAuto();
        };

        if (btsPrev) {
            btsPrev.addEventListener('click', () => {
                setBtsSlide(btsIndex - 1);
                restartBtsAuto();
            });
        }
        if (btsNext) {
            btsNext.addEventListener('click', () => {
                setBtsSlide(btsIndex + 1);
                restartBtsAuto();
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                setBtsSlide(btsIndex - 1);
                restartBtsAuto();
            }
            if (event.key === 'ArrowRight') {
                setBtsSlide(btsIndex + 1);
                restartBtsAuto();
            }
        });

        if (btsSlider) {
            btsSlider.addEventListener('mouseenter', clearBtsAuto);
            btsSlider.addEventListener('mouseleave', startBtsAuto);
            btsSlider.addEventListener('focusin', clearBtsAuto);
            btsSlider.addEventListener('focusout', startBtsAuto);
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearBtsAuto();
                return;
            }
            startBtsAuto();
        });

        window.addEventListener('blur', clearBtsAuto);
        window.addEventListener('focus', startBtsAuto);

        if (btsSlider && 'IntersectionObserver' in window) {
            const btsObserver = new IntersectionObserver((entries) => {
                const entry = entries[0];
                btsInViewport = Boolean(entry && entry.isIntersecting);
                if (!btsInViewport) {
                    clearBtsAuto();
                    return;
                }
                startBtsAuto();
            }, {
                threshold: 0.15
            });
            btsObserver.observe(btsSlider);
        }

        startBtsAuto();
    }

    const charactersMarquee = document.querySelector('.characters-marquee');
    const charactersTrack = document.querySelector('.characters-track');
    if (charactersMarquee && charactersTrack) {
        const baseCharacterCards = Array.from(charactersTrack.children).map((card) => card.cloneNode(true));
        let charactersResizeRaf = 0;
        let charactersInViewport = true;
        let hasWindowFocus = document.hasFocus();

        const rebuildCharactersMarquee = () => {
            if (baseCharacterCards.length === 0) return;

            const viewportWidth = charactersMarquee.clientWidth || 1;
            charactersTrack.innerHTML = '';

            baseCharacterCards.forEach((card) => {
                charactersTrack.appendChild(card.cloneNode(true));
            });

            const oneSetWidth = Math.max(1, charactersTrack.scrollWidth);
            let safety = 0;
            while (charactersTrack.scrollWidth < (viewportWidth + oneSetWidth) && safety < 24) {
                baseCharacterCards.forEach((card) => {
                    charactersTrack.appendChild(card.cloneNode(true));
                });
                safety += 1;
            }

            baseCharacterCards.forEach((card) => {
                charactersTrack.appendChild(card.cloneNode(true));
            });

            charactersTrack.style.setProperty('--marquee-loop-distance', `${Math.round(oneSetWidth)}px`);
            const durationSeconds = Math.max(18, Math.min(60, oneSetWidth / 58));
            charactersTrack.style.setProperty('--marquee-duration', `${durationSeconds.toFixed(2)}s`);
        };

        const updateCharactersRuntimePause = () => {
            const shouldPause = document.hidden || !hasWindowFocus || !charactersInViewport;
            charactersMarquee.classList.toggle('is-paused-runtime', shouldPause);
        };

        const scheduleCharactersRebuild = () => {
            if (charactersResizeRaf) window.cancelAnimationFrame(charactersResizeRaf);
            charactersResizeRaf = window.requestAnimationFrame(() => {
                charactersResizeRaf = 0;
                rebuildCharactersMarquee();
            });
        };

        rebuildCharactersMarquee();
        window.addEventListener('resize', scheduleCharactersRebuild, { passive: true });

        if ('IntersectionObserver' in window) {
            const charactersObserver = new IntersectionObserver((entries) => {
                const entry = entries[0];
                charactersInViewport = Boolean(entry && entry.isIntersecting);
                updateCharactersRuntimePause();
            }, {
                threshold: 0.1
            });
            charactersObserver.observe(charactersMarquee);
        }

        document.addEventListener('visibilitychange', updateCharactersRuntimePause);
        window.addEventListener('blur', () => {
            hasWindowFocus = false;
            updateCharactersRuntimePause();
        });
        window.addEventListener('focus', () => {
            hasWindowFocus = true;
            updateCharactersRuntimePause();
        });
        updateCharactersRuntimePause();
    }

    const blurRevealSelectors = [
        '.characters-eyebrow',
        '.characters-title',
        '.vertice-eyebrow',
        '.vertice-logo',
        '.vertice-logo-mobile',
        '.bts-eyebrow',
        '.bts-title',
        '.cta-contact-eyebrow',
        '.cta-contact-title',
        '.contact-eyebrow',
        '.contact-title'
    ];

    const stairRevealSelectors = [
        '.vertice-text',
        '.bts-text',
        '.cta-contact-text',
        '.contact-text'
    ];

    const buildStairRevealWords = (element) => {
        if (!(element instanceof HTMLElement)) return;
        if (element.dataset.stairBuilt === 'true') return;

        const rawText = (element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!rawText) return;

        const words = rawText.split(' ');
        element.textContent = '';
        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.className = 'stair-reveal-word';
            span.style.setProperty('--stair-index', String(index));
            span.textContent = word;
            element.appendChild(span);
            if (index < words.length - 1) element.appendChild(document.createTextNode(' '));
        });

        element.dataset.stairBuilt = 'true';
    };

    const blurRevealTargets = blurRevealSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
    );
    blurRevealTargets.forEach((element) => element.classList.add('reveal-blur'));

    const stairRevealTargets = stairRevealSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
    );
    stairRevealTargets.forEach((element) => {
        buildStairRevealWords(element);
        element.classList.add('reveal-stair');
    });

    const allRevealTargets = Array.from(new Set([...blurRevealTargets, ...stairRevealTargets]));
    if (allRevealTargets.length > 0) {
        if ('IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                });
            }, {
                threshold: 0.22,
                rootMargin: '0px 0px -8% 0px'
            });

            allRevealTargets.forEach((element) => revealObserver.observe(element));
        } else {
            allRevealTargets.forEach((element) => element.classList.add('is-visible'));
        }
    }

    const navSectionLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    const navTargets = navSectionLinks
        .map((link) => {
            const targetId = link.getAttribute('href')?.slice(1).trim();
            if (!targetId) return null;
            const section = document.getElementById(targetId);
            if (!section) return null;
            return { link, targetId, section };
        })
        .filter(Boolean);

    if (navTargets.length > 0) {
        let navRaf = 0;
        const scrollNavTarget = (targetId, section) => {
            if (!(section instanceof HTMLElement)) return;
            const rect = section.getBoundingClientRect();
            const currentY = window.scrollY || window.pageYOffset || 0;
            const viewportH = window.innerHeight || document.documentElement.clientHeight || 1;
            const navHeight = topnav ? topnav.offsetHeight : 0;
            const isChapters = targetId === 'capitulos';
            let targetTop = currentY + rect.top - navHeight;

            if (isChapters) {
                if (section.offsetHeight <= viewportH) {
                    targetTop = currentY + rect.top - ((viewportH - section.offsetHeight) / 2);
                } else {
                    targetTop = currentY + rect.top - Math.max(navHeight + 20, viewportH * 0.14);
                }
            } else {
                targetTop = currentY + rect.top - Math.max(navHeight + 10, 18);
            }

            const maxScroll = Math.max(0, (document.documentElement.scrollHeight - viewportH));
            const clampedTop = Math.min(maxScroll, Math.max(0, targetTop));
            window.scrollTo({
                top: Math.round(clampedTop),
                behavior: lowMotionMode ? 'auto' : 'smooth'
            });
        };
        const replaySectionAnimations = (targetId, section) => {
            if (!(section instanceof HTMLElement)) return;

            if (targetId === 'capitulos' && chaptersSection && strip) {
                chaptersSection.classList.remove('is-visible');
                strip.classList.remove('stagger-in');
                void strip.offsetWidth;
                chaptersSection.classList.add('is-visible');
                strip.classList.add('stagger-in');
                return;
            }

            const revealNodes = Array.from(section.querySelectorAll('.reveal-blur, .reveal-stair'));
            if (revealNodes.length === 0) return;
            revealNodes.forEach((node) => node.classList.remove('is-visible'));
            void section.offsetWidth;
            revealNodes.forEach((node, index) => {
                window.setTimeout(() => {
                    node.classList.add('is-visible');
                }, Math.min(180, index * 28));
            });
        };
        const setActiveNav = (activeId) => {
            navTargets.forEach(({ link, targetId }) => {
                const isActive = targetId === activeId;
                link.classList.toggle('is-active', isActive);
                if (isActive) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        };

        const updateActiveNavFromScroll = () => {
            navRaf = 0;
            const viewportProbeY = (window.innerHeight || 1) * 0.42;
            let activeId = navTargets[0].targetId;
            let bestDistance = Number.POSITIVE_INFINITY;

            navTargets.forEach(({ targetId, section }) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= viewportProbeY && rect.bottom >= viewportProbeY) {
                    activeId = targetId;
                    bestDistance = 0;
                    return;
                }
                const distance = Math.abs(rect.top - viewportProbeY);
                if (bestDistance !== 0 && distance < bestDistance) {
                    bestDistance = distance;
                    activeId = targetId;
                }
            });

            setActiveNav(activeId);
        };

        const scheduleActiveNavUpdate = () => {
            if (navRaf) return;
            navRaf = window.requestAnimationFrame(updateActiveNavFromScroll);
        };

        navTargets.forEach(({ link, targetId, section }) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                scrollNavTarget(targetId, section);
                window.setTimeout(() => replaySectionAnimations(targetId, section), targetId === 'capitulos' ? 220 : 120);
            });
        });

        window.addEventListener('scroll', scheduleActiveNavUpdate, { passive: true });
        window.addEventListener('resize', scheduleActiveNavUpdate, { passive: true });
        updateActiveNavFromScroll();
    }

    if (!strip || !viewport || cards.length === 0) return;

    const CLOSED_WIDTH = 276;
    const CARD_HEIGHT = 636;
    const GAP = 28;
    const DESC_WIDTH = 393;
    const CINEMA_ASPECT = 16 / 9;
    const CINEMA_MEDIA_WIDTH = Math.round(CARD_HEIGHT * CINEMA_ASPECT);
    const UNIFORM_OPEN_WIDTH = CINEMA_MEDIA_WIDTH + DESC_WIDTH;
    const HOVER_DELAY_MS = 520;

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
                label: 'CAPÍTULO 01',
                title: 'Capítulo 01',
                desc: 'Un episodio íntimo sobre la pérdida y el peso de lo que no se dice.',
                poster: 'img/Captura.PNG',
                src: 'img/videos/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 02',
                title: 'Capítulo 02',
                desc: 'Un estallido de luz que transforma lo cotidiano en celebración.',
                poster: 'img/Captura2.PNG',
                src: 'img/videos/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 03',
                title: 'Capítulo 03',
                desc: 'La energía que rompe el silencio y obliga a tomar posición.',
                poster: 'img/Captura.PNG',
                src: 'img/videos/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 04',
                title: 'Capítulo 04',
                desc: 'Un recorrido por la incertidumbre y el impulso de protegerse.',
                poster: 'img/Captura2.PNG',
                src: 'img/videos/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 05',
                title: 'Capítulo 05',
                desc: 'El límite entre lo tolerable y lo que necesitamos apartar.',
                poster: 'img/Captura.PNG',
                src: 'img/videos/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            }
        ],
        2: [
            {
                label: 'CAPÍTULO 06',
                title: 'Capítulo 06',
                desc: 'Una pausa que ordena el ruido y devuelve el control.',
                poster: 'img/Captura2.PNG',
                src: 'img/videos/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 07',
                title: 'Capítulo 07',
                desc: 'El impulso que acelera el corazón y borra los límites.',
                poster: 'img/Captura.PNG',
                src: 'img/videos/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 08',
                title: 'Capítulo 08',
                desc: 'La sombra que aparece cuando el recuerdo se vuelve espejo.',
                poster: 'img/Captura2.PNG',
                src: 'img/videos/6013655_People_Men_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 09',
                title: 'Capítulo 09',
                desc: 'Una grieta de luz que abre camino en la oscuridad.',
                poster: 'img/Captura.PNG',
                src: 'img/videos/7188675_Woman_Young_Women_3840x2160.mp4',
                type: 'video/mp4'
            },
            {
                label: 'CAPÍTULO 10',
                title: 'Capítulo 10',
                desc: 'El silencio absoluto donde todo se reinicia.',
                poster: 'img/Captura2.PNG',
                src: 'img/videos/6013655_People_Men_3840x2160.mp4',
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

        card.classList.remove('is-hover-arming');
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

    const getActiveShiftForLayout = (activeIndex, expandedWidth) => {
        const viewportCenterX = viewport.clientWidth / 2;
        const activeWidth = expandedWidth;
        const firstWidth = activeIndex === 0 ? expandedWidth : CLOSED_WIDTH;
        const lastWidth = activeIndex === (cards.length - 1) ? expandedWidth : CLOSED_WIDTH;
        const activeLeft = activeIndex * (CLOSED_WIDTH + GAP);
        const activeCenterX = activeLeft + (activeWidth / 2);
        const trackWidth = expandedWidth + ((cards.length - 1) * CLOSED_WIDTH) + ((cards.length - 1) * GAP);
        const firstCenterX = firstWidth / 2;
        const lastCenterX = trackWidth - (lastWidth / 2);
        const minShift = viewportCenterX - lastCenterX;
        const maxShift = viewportCenterX - firstCenterX;
        const targetShift = viewportCenterX - activeCenterX;
        return Math.min(maxShift, Math.max(minShift, targetShift));
    };

    const centerActiveCard = (activeIndex) => {
        if (isMobileLayout()) {
            setStripShift(0);
            const card = cards[activeIndex];
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
            return;
        }
        const card = cards[activeIndex];
        const firstCard = cards[0];
        const lastCard = cards[cards.length - 1];
        if (!card || !firstCard || !lastCard) return;

        const viewportCenterX = viewport.clientWidth / 2;
        const activeCenterX = card.offsetLeft + (card.offsetWidth / 2);
        const firstCenterX = firstCard.offsetLeft + (firstCard.offsetWidth / 2);
        const lastCenterX = lastCard.offsetLeft + (lastCard.offsetWidth / 2);
        const targetShift = viewportCenterX - activeCenterX;
        const minShift = viewportCenterX - lastCenterX;
        const maxShift = viewportCenterX - firstCenterX;
        setStripShift(Math.min(maxShift, Math.max(minShift, targetShift)));
    };

    const runStagger = () => {
        strip.classList.remove('stagger-in');
        void strip.offsetWidth;
        strip.classList.add('stagger-in');
    };

    let chaptersVisible = false;
    if (chaptersSection && 'IntersectionObserver' in window) {
        const isCenteredInViewport = (entry) => {
            const viewportH = window.innerHeight || document.documentElement.clientHeight;
            const viewportCenterY = viewportH / 2;
            return entry.boundingClientRect.top <= viewportCenterY && entry.boundingClientRect.bottom >= viewportCenterY;
        };

        const chaptersObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || chaptersVisible) return;
                if (!isCenteredInViewport(entry)) return;
                chaptersVisible = true;
                chaptersSection.classList.add('is-visible');
                runStagger();
                chaptersObserver.unobserve(chaptersSection);
            });
        }, {
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: '0px 0px 0px 0px'
        });
        chaptersObserver.observe(chaptersSection);
    } else if (chaptersSection) {
        chaptersVisible = true;
        chaptersSection.classList.add('is-visible');
    }

    const placeGrid = () => {
        cards.forEach((card) => {
            card.classList.remove('is-active', 'is-media', 'is-previewing', 'is-hover-arming');
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
        const performanceModeEnabled = document.body.classList.contains('performance-mode');

        clearAllPreview();

        if (activeCard && activeCard !== card) {
            const prevVideo = activeCard.querySelector('video');
            resetVideo(prevVideo, false);
        }

        cards.forEach((item) => {
            item.classList.remove('is-active', 'is-media', 'is-previewing', 'is-hover-arming');
            item.setAttribute('aria-expanded', 'false');
            setCardSizes(item, CLOSED_WIDTH, CLOSED_WIDTH);
        });

        const maxExpanded = Math.max(
            CLOSED_WIDTH + DESC_WIDTH,
            viewport.clientWidth - (GAP * 2)
        );
        const expandedWidth = Math.min(UNIFORM_OPEN_WIDTH, maxExpanded);
        const mediaWidth = Math.max(CLOSED_WIDTH, expandedWidth - DESC_WIDTH);

        setCardSizes(card, expandedWidth, mediaWidth);
        card.classList.add('is-active');
        card.setAttribute('aria-expanded', 'true');
        activeCard = card;
        if (!isMobileLayout()) {
            setStripShift(getActiveShiftForLayout(activeIndex, expandedWidth));
        } else {
            centerActiveCard(activeIndex);
        }
        if (performanceModeEnabled) {
            centerActiveCard(activeIndex);
            return;
        }
        card.addEventListener('transitionend', (event) => {
            if (event.propertyName !== 'flex-basis') return;
            if (activeCard !== card) return;
            centerActiveCard(activeIndex);
        }, { once: true });
        setTimeout(() => {
            if (activeCard !== card) return;
            centerActiveCard(activeIndex);
        }, 1450);
    };

    const startPreview = (card) => {
        card.classList.remove('is-hover-arming');
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
        if (chaptersVisible) runStagger();
    };

    cards.forEach((card) => {
        const closeButton = card.querySelector('.chapter-close');
        const playButton = card.querySelector('.chapter-play-btn');

        card.addEventListener('mouseenter', () => {
            if (activeCard) return;
            stopPreview(card);
            card.classList.add('is-hover-arming');
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
                return;
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
    }

    updateMobilePreviewFromViewport();
});




