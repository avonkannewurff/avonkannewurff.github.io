// Arcade scoring: a running total and a combo multiplier, on a badge that
// trails the tank around the page.
//
// This is DOM rather than canvas on purpose -- text, web fonts, and squash
// animations are all things CSS already does better than a 3D scene would.

const COMBO_WINDOW = 2.4;   // seconds of quiet before a combo lapses
const COMBO_STEP = 3;       // hits per extra multiplier
const MAX_MULTIPLIER = 9;
const BEST_KEY = 'tank:best';

const POINTS_HIT = 15;
const POINTS_DESTROY = 150;

/** Half of .tank-score's fixed width in tank.css — keep the two in step. */
const HALF_WIDTH = 70;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const readBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const writeBest = (value) => {
    try { localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
};

export function createScore({ reducedMotion = false } = {}) {
    // Two nested elements on purpose: the outer one carries the follow
    // translate, written every frame, and the inner one carries the squish
    // animation. A Web Animations transform outranks inline style, so sharing
    // one element would snap the badge to the top-left corner on every hit.
    const root = document.createElement('div');
    root.className = 'tank-score';
    root.dataset.tank = 'score';
    root.setAttribute('aria-hidden', 'true');

    const card = document.createElement('div');
    card.className = 'tank-score-card';

    const valueEl = document.createElement('div');
    valueEl.className = 'tank-score-value';
    const comboEl = document.createElement('div');
    comboEl.className = 'tank-score-combo';
    const bestEl = document.createElement('div');
    bestEl.className = 'tank-score-best';
    card.append(valueEl, comboEl, bestEl);
    root.appendChild(card);
    document.body.appendChild(root);

    // Pool of floating "+N" labels; recycled rather than churning DOM nodes.
    const pops = [];
    for (let i = 0; i < 16; i++) {
        const pop = document.createElement('div');
        pop.className = 'tank-pop';
        pop.dataset.tank = 'pop';
        pop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(pop);
        pops.push(pop);
    }
    let popIndex = 0;

    let score = 0;
    let shown = 0;          // lags `score` for an odometer roll-up
    let combo = 0;
    let comboTimer = 0;
    let best = readBest();
    let beatBest = false;
    let progress = 0;
    // Follow position lags the tank, which reads as weight rather than lag.
    let fx = 0;
    let fy = 0;
    let placed = false;

    const multiplier = () => Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));

    function squish(strength) {
        if (reducedMotion) return;
        card.animate([
            { transform: 'scale(1)' },
            { transform: `scale(${1 + 0.34 * strength}, ${1 - 0.16 * strength})` },
            { transform: `scale(${1 - 0.1 * strength}, ${1 + 0.08 * strength})` },
            { transform: 'scale(1)' },
        ], { duration: 340 + 120 * strength, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    }

    function floatPop(text, vx, vy, big) {
        const pop = pops[popIndex];
        popIndex = (popIndex + 1) % pops.length;
        pop.textContent = text;
        pop.classList.toggle('is-big', big);
        pop.style.transform = `translate3d(${vx}px, ${vy}px, 0)`;
        pop.style.display = 'block';

        const drift = reducedMotion ? 0 : (Math.random() - 0.5) * 44;
        const spin = reducedMotion ? 0 : (Math.random() - 0.5) * 22;
        const anim = pop.animate([
            { transform: `translate3d(${vx}px, ${vy}px, 0) scale(.5) rotate(0deg)`, opacity: 0 },
            { transform: `translate3d(${vx + drift * 0.3}px, ${vy - 26}px, 0) scale(1.25) rotate(${spin}deg)`, opacity: 1, offset: 0.28 },
            { transform: `translate3d(${vx + drift}px, ${vy - 86}px, 0) scale(.9) rotate(${spin * 1.6}deg)`, opacity: 0 },
        ], { duration: big ? 1100 : 850, easing: 'cubic-bezier(.2,.9,.3,1)' });
        anim.onfinish = () => { pop.style.display = 'none'; };
    }

    /**
     * Register a hit. `vx`/`vy` are viewport coords for the floating label.
     * Returns the points actually awarded, multiplier included.
     */
    function award({ destroyed, vx, vy }) {
        combo += 1;
        comboTimer = COMBO_WINDOW;

        const mult = multiplier();
        const points = (destroyed ? POINTS_DESTROY : POINTS_HIT) * mult;
        score += points;

        if (score > best) {
            best = score;
            if (!beatBest) beatBest = true;
            writeBest(best);
        }

        floatPop(`+${points}`, vx, vy, destroyed);
        squish(destroyed ? 1 : 0.5);
        root.classList.toggle('is-hot', combo >= COMBO_STEP * 2);
        return points;
    }

    function update(dt, tankVx, tankVy) {
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                combo = 0;
                root.classList.remove('is-hot');
            }
        }

        // Stand well off the tank's shoulder so it never sits on top of the
        // hull or its tracks, but never let it wander off the screen either.
        const targetX = clamp(tankVx + 104, HALF_WIDTH + 12, window.innerWidth - HALF_WIDTH - 12);
        const targetY = clamp(tankVy - 118, 12, window.innerHeight - 110);
        if (!placed) { fx = targetX; fy = targetY; placed = true; }
        const k = Math.min(1, 9 * dt);
        fx += (targetX - fx) * k;
        fy += (targetY - fy) * k;
        root.style.transform = `translate3d(${Math.round(fx)}px, ${Math.round(fy)}px, 0)`;

        if (Math.abs(score - shown) > 0.5) {
            shown += (score - shown) * Math.min(1, 11 * dt);
        } else {
            shown = score;
        }
        valueEl.textContent = Math.round(shown).toLocaleString();

        const mult = multiplier();
        if (combo >= COMBO_STEP) {
            comboEl.textContent = `×${mult} combo`;
            comboEl.style.opacity = '1';
        } else {
            comboEl.style.opacity = '0';
        }

        // Once there's real damage, how close the page is to gone is more
        // useful than the high score, so it takes over the third line.
        if (progress > 0.05) {
            bestEl.textContent = `${Math.floor(progress * 100)}% razed`;
            bestEl.style.opacity = '1';
        } else {
            bestEl.textContent = best > 0 ? `best ${best.toLocaleString()}` : '';
            bestEl.style.opacity = best > 0 && score < best ? '1' : '0';
        }
    }

    function setProgress(ratio) {
        progress = ratio;
    }

    function reset() {
        score = 0;
        shown = 0;
        combo = 0;
        comboTimer = 0;
        beatBest = false;
        placed = false;
        progress = 0;
        root.classList.remove('is-hot');
        valueEl.textContent = '0';
        comboEl.style.opacity = '0';
    }

    return {
        award,
        update,
        reset,
        setProgress,
        show: () => root.classList.add('is-visible'),
        hide: () => {
            root.classList.remove('is-visible');
            pops.forEach(p => { p.style.display = 'none'; });
        },
        destroy: () => { root.remove(); pops.forEach(p => p.remove()); pops.length = 0; },
        get score() { return score; },
        get best() { return best; },
    };
}
