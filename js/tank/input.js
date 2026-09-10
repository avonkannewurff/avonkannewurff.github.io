// Keyboard, mouse, and touch, funnelled into one input state the game reads.
//
// Keys are only captured while the tank is out, and never when focus is in a
// form field, so the site's normal keyboard behaviour is untouched the rest of
// the time. Escape always releases, so there's no way to get stuck.

const DRIVE_KEYS = {
    KeyW: ['drive', 1], ArrowUp: ['drive', 1],
    KeyS: ['drive', -1], ArrowDown: ['drive', -1],
    KeyA: ['turn', -1], ArrowLeft: ['turn', -1],
    KeyD: ['turn', 1], ArrowRight: ['turn', 1],
};

const OWNED = new Set([...Object.keys(DRIVE_KEYS), 'Space', 'KeyR', 'KeyM', 'Escape']);

/**
 * Keys that keep working after the tank has been stowed. Repair has to reach a
 * page that's still full of holes once the tank is gone, and mute should be
 * changeable at any time. Neither scrolls the page, so owning them costs nothing.
 */
const ALWAYS_LIVE = new Set(['KeyR', 'KeyM']);

const isTypingTarget = (el) => !!el && (
    el.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
);

/** How long the mouse stays "in charge" of the turret after it last moved. */
const AIM_TIMEOUT = 2500;

export function createInput({ onFireRelease, onRepair, onStow, onMute, onGesture }) {
    const held = new Set();
    // The listeners outlive a stow so the tank can be re-summoned without
    // rebuilding everything -- but while it's stowed they must not swallow
    // arrow keys or space, or the page would stop scrolling from the keyboard.
    let enabled = false;
    const state = {
        drive: 0,
        turn: 0,
        fireHeld: false,
        fireHeldSince: 0,
        aimPage: null,     // document coords of the pointer
        aimFresh: false,   // has the pointer moved recently enough to steer the turret?
        stick: null,       // touch joystick: { angle, mag } in page space
    };

    let lastAimMove = -Infinity;
    const listeners = [];
    const on = (target, type, fn, opts) => {
        target.addEventListener(type, fn, opts);
        listeners.push([target, type, fn, opts]);
    };

    function recompute() {
        let drive = 0;
        let turn = 0;
        for (const code of held) {
            const map = DRIVE_KEYS[code];
            if (!map) continue;
            if (map[0] === 'drive') drive += map[1];
            else turn += map[1];
        }
        state.drive = Math.max(-1, Math.min(1, drive));
        state.turn = Math.max(-1, Math.min(1, turn));
    }

    function beginFire() {
        if (state.fireHeld) return;
        state.fireHeld = true;
        state.fireHeldSince = performance.now();
    }

    function endFire() {
        if (!state.fireHeld) return;
        const heldMs = performance.now() - state.fireHeldSince;
        state.fireHeld = false;
        state.fireHeldSince = 0;
        onFireRelease(heldMs);
    }

    on(window, 'keydown', (e) => {
        if (!OWNED.has(e.code)) return;
        if (!enabled && !ALWAYS_LIVE.has(e.code)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(document.activeElement)) return;

        // Owning the key means owning its default too, or the page scrolls
        // out from under the player on every arrow press and space bar.
        e.preventDefault();
        onGesture?.();
        if (e.repeat) return;

        if (e.code === 'Escape') { onStow(); return; }
        if (e.code === 'KeyR') { onRepair(); return; }
        if (e.code === 'KeyM') { onMute?.(); return; }
        if (e.code === 'Space') { beginFire(); return; }
        held.add(e.code);
        recompute();
    });

    on(window, 'keyup', (e) => {
        if (!enabled || !OWNED.has(e.code)) return;
        if (e.code === 'Space') { endFire(); return; }
        held.delete(e.code);
        recompute();
    });

    on(window, 'pointermove', (e) => {
        if (!enabled || e.pointerType === 'touch') return;
        state.aimPage = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
        lastAimMove = performance.now();
    }, { passive: true });

    // Losing focus mid-drive would otherwise leave keys stuck down forever.
    const release = () => {
        held.clear();
        state.stick = null;
        recompute();
        if (state.fireHeld) {
            state.fireHeld = false;
            state.fireHeldSince = 0;
        }
    };
    on(window, 'blur', release);

    function setEnabled(next) {
        enabled = next;
        if (!next) release();
    }

    /** Wire up the touch joystick and fire button that hud.js created. */
    function bindTouchControls({ stickBase, stickNub, fireButton }) {
        if (!stickBase || !fireButton) return;
        let stickId = null;
        const radius = 46;

        const moveStick = (e) => {
            const rect = stickBase.getBoundingClientRect();
            const dx = e.clientX - (rect.left + rect.width / 2);
            const dy = e.clientY - (rect.top + rect.height / 2);
            const dist = Math.hypot(dx, dy);
            const mag = Math.min(1, dist / radius);
            state.stick = dist > 4 ? { angle: Math.atan2(dy, dx), mag } : null;
            const clamp = Math.min(dist, radius) || 0;
            const nx = dist ? (dx / dist) * clamp : 0;
            const ny = dist ? (dy / dist) * clamp : 0;
            stickNub.style.transform = `translate(${nx}px, ${ny}px)`;
        };

        on(stickBase, 'pointerdown', (e) => {
            if (!enabled) return;
            onGesture?.();
            stickId = e.pointerId;
            stickBase.setPointerCapture(e.pointerId);
            moveStick(e);
            e.preventDefault();
        });
        on(stickBase, 'pointermove', (e) => {
            if (e.pointerId !== stickId) return;
            moveStick(e);
        });
        const dropStick = (e) => {
            if (e.pointerId !== stickId) return;
            stickId = null;
            state.stick = null;
            stickNub.style.transform = '';
        };
        on(stickBase, 'pointerup', dropStick);
        on(stickBase, 'pointercancel', dropStick);

        on(fireButton, 'pointerdown', (e) => {
            if (!enabled) return;
            onGesture?.();
            fireButton.setPointerCapture(e.pointerId);
            beginFire();
            e.preventDefault();
        });
        on(fireButton, 'pointerup', endFire);
        on(fireButton, 'pointercancel', endFire);
    }

    function update() {
        state.aimFresh = state.aimPage !== null
            && performance.now() - lastAimMove < AIM_TIMEOUT;
    }

    function dispose() {
        listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts));
        listeners.length = 0;
        held.clear();
    }

    return { state, update, setEnabled, bindTouchControls, dispose };
}
