// Blowing holes in the actual DOM.
//
// No Three.js in here. A hit is resolved with document.elementsFromPoint() in
// viewport coordinates, and the damage itself is a stack of radial-gradient CSS
// masks composited with `intersect`, which makes the element genuinely
// transparent where it was hit -- descendants and all.
//
// When something finally dies it becomes `visibility: hidden`, never
// `display: none` and never removed. Keeping the box in flow means the page
// never reflows under the player mid-drive.

/**
 * Elements worth shooting. elementsFromPoint returns innermost-first, so taking
 * the first match here means a <li> is hit before its enclosing .resume-card --
 * good granularity for free. Layout containers are deliberately absent so
 * shells fly through empty space instead of stopping on a wrapper div.
 */
const TARGETS = [
    'h1', 'h2', 'h3', 'p', 'li', 'strong',
    '.btn', '.tag', '.link', '.download-btn', '.logo',
    '#nav-links a', '.nav-resume-link', '.nav-download-link',
    '.project-card img', '.image-container',
    '.resume-card', '.timeline-item', '.year', '.company', '.role',
    '.copyright', '.social-links a',
    '.theme-toggle', '#hamburger-btn', 'svg',
    '.highlight', '.desc',
].join(',');

/** Craters per impact, and the ceiling before an element is past saving anyway. */
const SUBCRATERS = 3;
const MAX_LAYERS = 33;

const COLLAPSE_MS = 700;
const HIT_FLASH_MS = 260;

const PARSEABLE = /^(#|rgba?\()/;

function sampleColors(el) {
    const out = [];
    const push = (value) => {
        if (!value || !PARSEABLE.test(value)) return;
        if (/rgba?\([^)]*,\s*0(\.0+)?\)\s*$/.test(value)) return; // fully transparent
        out.push(value);
    };

    const cs = getComputedStyle(el);
    push(cs.color);
    push(cs.backgroundColor);
    push(cs.borderTopColor);

    if (!out.length && el.parentElement) push(getComputedStyle(el.parentElement).backgroundColor);
    if (!out.length) out.push('#8a7f74');
    return out;
}

export function createDestruction() {
    /** Strong refs so repair() can iterate; these elements outlive the tank anyway. */
    const registry = new Map();
    const timers = new Set();
    let allTargets = null;   // static: the DOM never changes under us
    let eligible = null;     // ...but which of them are visible does
    let eligibleAt = 0;

    function stateFor(el) {
        let state = registry.get(el);
        if (state) return state;

        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const area = rect.width * rect.height;
        state = {
            craters: [],
            hp: Math.max(2, Math.round(Math.sqrt(area) / 38)),
            dead: false,
        };
        registry.set(el, state);
        return state;
    }

    function applyMask(el, craters) {
        const layers = craters.map(c =>
            `radial-gradient(circle ${c.r.toFixed(1)}px at ${c.x.toFixed(1)}px ${c.y.toFixed(1)}px,`
            + ' #0000 0 58%, #00000059 80%, #000 100%)');
        const value = layers.join(',');

        // -webkit- first: in Blink the two are aliases of one another, so the
        // standard property has to be set last to win. In older WebKit only the
        // prefixed one exists, and `source-in` is its spelling of `intersect`.
        el.style.setProperty('-webkit-mask-repeat', 'no-repeat');
        el.style.setProperty('-webkit-mask-composite', 'source-in');
        el.style.setProperty('-webkit-mask-image', value);
        el.style.setProperty('mask-repeat', 'no-repeat');
        el.style.setProperty('mask-composite', 'intersect');
        el.style.setProperty('mask-image', value);
    }

    function flash(el) {
        el.classList.add('tank-hit');
        const t = setTimeout(() => {
            el.classList.remove('tank-hit');
            timers.delete(t);
        }, HIT_FLASH_MS);
        timers.add(t);
    }

    function collapse(el, state) {
        state.dead = true;
        el.classList.remove('tank-hit');

        // Anything shootable *inside* this element just went with it: it's
        // hidden now, so no shell can ever reach it. Count it destroyed too,
        // or clearing the page to 100% would be impossible.
        for (const child of el.querySelectorAll(TARGETS)) {
            const childState = registry.get(child);
            if (childState) childState.dead = true;
            else registry.set(child, { craters: [], hp: 0, dead: true });
            child.style.pointerEvents = 'none';
        }

        // transform has no effect on non-replaced inline boxes, so spans like
        // .highlight and <strong> would fade without ever toppling over.
        if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
        el.classList.add('tank-destroyed');
        // Immediately, so shells pass through to whatever is behind it.
        el.style.pointerEvents = 'none';
        const t = setTimeout(() => {
            el.style.visibility = 'hidden';
            timers.delete(t);
        }, COLLAPSE_MS);
        timers.add(t);
    }

    /**
     * Land `power` points of damage on `el` at document point (px, py).
     * Returns what the caller needs to throw debris, or null if nothing happened.
     */
    function damage(el, px, py, radius, power) {
        const state = stateFor(el);
        if (!state || state.dead) return null;

        const rect = el.getBoundingClientRect();
        const lx = px - (rect.left + window.scrollX);
        const ly = py - (rect.top + window.scrollY);

        // A few jittered circles per impact read as a ragged hole rather than
        // a neat cookie-cutter dot.
        for (let i = 0; i < SUBCRATERS; i++) {
            state.craters.push({
                x: lx + (Math.random() - 0.5) * radius * 0.8,
                y: ly + (Math.random() - 0.5) * radius * 0.8,
                r: radius * (0.55 + Math.random() * 0.6),
            });
        }
        if (state.craters.length > MAX_LAYERS) {
            state.craters.splice(0, state.craters.length - MAX_LAYERS);
        }
        applyMask(el, state.craters);

        state.hp -= power;
        const destroyed = state.hp <= 0;
        if (destroyed) collapse(el, state);
        else flash(el);

        return { el, x: px, y: py, colors: sampleColors(el), destroyed };
    }

    /** The topmost shootable element under a document point, if any. */
    function targetAt(px, py) {
        const vx = px - window.scrollX;
        const vy = py - window.scrollY;
        if (vx < 0 || vy < 0 || vx > window.innerWidth || vy > window.innerHeight) return null;

        for (const el of document.elementsFromPoint(vx, vy)) {
            if (!el.matches || !el.matches(TARGETS)) continue;
            if (el.closest('[data-tank]')) continue;
            const state = registry.get(el);
            if (state && state.dead) continue;
            return el;
        }
        return null;
    }

    /**
     * Area damage. Sampling a ring of points is both cheaper than intersecting
     * every element's rect and more interesting -- the blast eats whatever
     * happens to be under it, in ragged bites.
     */
    function blastAt(px, py, radius, power = 2.4) {
        const seen = new Map();
        const consider = (sx, sy, falloff) => {
            const el = targetAt(sx, sy);
            if (!el) return;
            const prev = seen.get(el);
            if (!prev || falloff > prev.falloff) seen.set(el, { x: sx, y: sy, falloff });
        };

        consider(px, py, 1);
        for (const [ring, count] of [[0.5, 8], [0.92, 12]]) {
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2 + ring;
                consider(px + Math.cos(a) * radius * ring, py + Math.sin(a) * radius * ring,
                    1 - ring * 0.55);
            }
        }

        const results = [];
        for (const [el, hit] of seen) {
            const r = damage(el, hit.x, hit.y, radius * 0.42, power * hit.falloff);
            if (r) results.push(r);
        }
        return results;
    }

    /**
     * How much of the page has been levelled, 0..1.
     *
     * The element list itself never changes, but which entries are *eligible*
     * does — the theme toggle swaps a hidden sun icon for a visible moon one,
     * for instance — so the zero-size filter is re-run on a throttle rather
     * than cached forever. Destroyed elements keep their layout box, so they
     * stay in the denominator.
     */
    function progress() {
        if (!allTargets) {
            allTargets = [...document.querySelectorAll(TARGETS)]
                .filter(el => !el.closest('[data-tank]'));
        }
        const now = performance.now();
        if (!eligible || now - eligibleAt > 500) {
            eligible = allTargets.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            eligibleAt = now;
        }

        if (!eligible.length) return { destroyed: 0, total: 0, ratio: 0 };
        let destroyed = 0;
        for (const el of eligible) {
            const state = registry.get(el);
            if (state && state.dead) destroyed++;
        }
        return { destroyed, total: eligible.length, ratio: destroyed / eligible.length };
    }

    /** Put the whole page back. Returns how many elements were visibly damaged. */
    function repair() {
        timers.forEach(clearTimeout);
        timers.clear();
        // Only count what the visitor could actually see was broken; entries
        // added by the descendant sweep above never had a mark on them.
        let restored = 0;
        for (const state of registry.values()) if (state.craters.length) restored++;

        for (const el of registry.keys()) {
            for (const prop of ['mask-image', 'mask-repeat', 'mask-composite',
                '-webkit-mask-image', '-webkit-mask-repeat', '-webkit-mask-composite']) {
                el.style.removeProperty(prop);
            }
            el.classList.remove('tank-hit', 'tank-destroyed');
            el.style.removeProperty('visibility');
            el.style.removeProperty('pointer-events');
            el.style.removeProperty('display');
        }
        registry.clear();
        eligible = null;
        return restored;
    }

    return { blastAt, targetAt, progress, repair };
}
