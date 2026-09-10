// The 100% payoff: a full-screen "COMPLETE" card and a countdown that resets
// the page when it runs out.
//
// Deliberately `pointer-events: none` throughout — the site underneath stays
// clickable even while this is on screen, same as the canvas.

const COUNTDOWN_FROM = 5;

export function createCelebration({ onFinish, reducedMotion = false }) {
    const root = document.createElement('div');
    root.className = 'tank-complete';
    root.dataset.tank = 'complete';
    root.setAttribute('role', 'status');
    root.hidden = true;

    const card = document.createElement('div');
    card.className = 'tank-complete-card';

    const pct = document.createElement('div');
    pct.className = 'tank-complete-pct';
    pct.textContent = '100%';

    const title = document.createElement('div');
    title.className = 'tank-complete-title';
    title.textContent = 'Page cleared';

    const sub = document.createElement('div');
    sub.className = 'tank-complete-sub';

    const count = document.createElement('div');
    count.className = 'tank-complete-count';

    card.append(pct, title, sub, count);
    root.appendChild(card);
    document.body.appendChild(root);

    let timer = 0;
    let running = false;

    function render(remaining) {
        count.textContent = `Resetting in ${remaining}…`;
    }

    /** `stats` is the destruction tally, shown as flavour under the title. */
    function start(stats) {
        if (running) return;
        running = true;

        sub.textContent = stats
            ? `${stats.destroyed} of ${stats.total} elements levelled`
            : '';
        let remaining = COUNTDOWN_FROM;
        render(remaining);

        root.hidden = false;
        void root.offsetWidth; // let the transition catch
        root.classList.add('is-visible');

        if (!reducedMotion) {
            card.animate([
                { transform: 'scale(.55) rotate(-8deg)', opacity: 0 },
                { transform: 'scale(1.12) rotate(2deg)', opacity: 1, offset: 0.55 },
                { transform: 'scale(1) rotate(0deg)', opacity: 1 },
            ], { duration: 720, easing: 'cubic-bezier(.2,1.5,.4,1)' });
        }

        timer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                stop();
                onFinish?.();
                return;
            }
            render(remaining);
            if (!reducedMotion) {
                count.animate(
                    [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
                    { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' },
                );
            }
        }, 1000);
    }

    function stop() {
        if (!running) return;
        running = false;
        clearInterval(timer);
        timer = 0;
        root.classList.remove('is-visible');
        setTimeout(() => { if (!running) root.hidden = true; }, 400);
    }

    return {
        start,
        stop,
        destroy: () => { clearInterval(timer); root.remove(); },
        get isRunning() { return running; },
    };
}
