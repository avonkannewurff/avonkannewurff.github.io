// The cheap half of the easter egg. main.js loads this after `load`, during
// idle time, and it is the only part that always runs.
//
// Its job is to decide whether the tank should come out at all. Three.js lives
// behind a dynamic import in game.js, so when the answer is no -- reduced
// motion, already stowed this session, no WebGL -- those ~170KB are never
// requested.

import { createHud } from './hud.js';

const STOW_KEY = 'tank:stowed';
const DEPLOY_DELAY = 1200;

const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const stowedThisSession = () => {
    try { return sessionStorage.getItem(STOW_KEY) === '1'; } catch { return false; }
};

const rememberStowed = () => {
    try { sessionStorage.setItem(STOW_KEY, '1'); } catch { /* private mode */ }
};

function supportsWebGL() {
    try {
        const probe = document.createElement('canvas');
        return !!(window.WebGLRenderingContext
            && (probe.getContext('webgl2') || probe.getContext('webgl')));
    } catch {
        return false;
    }
}

function loadStylesheet() {
    const href = new URL('../../css/tank.css', import.meta.url).href;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

export function init() {
    // Without WebGL there's nothing to offer, so don't even advertise it.
    if (!supportsWebGL()) return;

    loadStylesheet();

    let game = null;
    let pending = null;

    const hud = createHud({
        onPrimary: () => primary(),
        onStow: () => game?.stow(),
    });

    async function summon() {
        if (game?.isActive) return;
        hud.button.disabled = true;
        try {
            if (!pending) {
                // This import is what pulls in Three.js.
                pending = import('./game.js').then(m => m.createGame({
                    reducedMotion: reducedMotion(),
                    hud,
                    onStowed: () => {
                        rememberStowed();
                        hud.setActive(false);
                    },
                }));
            }
            game = await pending;
            game.deploy();
            hud.showHint();
        } catch (err) {
            console.warn('[tank] could not start', err);
            pending = null;
        } finally {
            hud.button.disabled = false;
        }
    }

    /**
     * The nav button. While the tank is stowed it summons; while it's out it
     * repairs the page and sends the tank round again, rather than dismissing
     * it. Stowing lives on Escape, the toast's close button, and the touch
     * stow control.
     */
    function primary() {
        if (game?.isActive) game.reset();
        else summon();
    }

    // Auto-deploy is the default, but never over a reduced-motion preference
    // and never after the visitor has stowed it earlier in this session.
    if (!reducedMotion() && !stowedThisSession()) {
        setTimeout(summon, DEPLOY_DELAY);
    }

    return {
        summon,
        stow: () => game?.stow(),
        reset: () => game?.reset(),
        dispose: () => { game?.dispose(); hud.destroy(); },
    };
}
