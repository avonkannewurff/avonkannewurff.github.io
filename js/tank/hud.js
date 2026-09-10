// Everything the tank adds to the DOM: the nav button, the hint toast, and the
// touch controls. All of it is tagged `data-tank` so destruction.js knows never
// to shoot at its own interface.

const TANK_ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2.5" y="11" width="13.5" height="4" rx="1.2"/>
  <rect x="7" y="7.2" width="6" height="4" rx="1.2"/>
  <path d="M13 9h8"/>
  <circle cx="5.5" cy="18" r="1.7"/>
  <circle cx="10" cy="18" r="1.7"/>
  <circle cx="14.5" cy="18" r="1.7"/>
</svg>`;

// Static markup, no interpolation of anything external.
const DESKTOP_HINT = `
<span class="tank-hint-row">
  <span class="tank-hint-item"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><b>drive</b></span>
  <span class="tank-hint-item"><kbd>Space</kbd><b>fire &middot; hold to lob</b></span>
  <span class="tank-hint-item"><kbd>R</kbd><b>repair</b></span>
  <span class="tank-hint-item"><kbd>M</kbd><b>sound</b></span>
  <span class="tank-hint-item"><kbd>Esc</kbd><b>stow</b></span>
</span>`;

const TOUCH_HINT = `
<span class="tank-hint-row">
  <span class="tank-hint-item"><b>Drag to drive</b></span>
  <span class="tank-hint-item"><b>Hold &#9679; to lob a mortar</b></span>
</span>`;

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

export function createHud({ onPrimary, onStow }) {
    const nodes = [];
    const track = (el) => { nodes.push(el); return el; };

    /* ---- Nav button ---------------------------------------------------- */
    const button = track(document.createElement('button'));
    button.type = 'button';
    button.className = 'tank-nav-btn';
    button.dataset.tank = 'nav';
    button.innerHTML = TANK_ICON;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', onPrimary);

    const navRight = document.querySelector('.site-nav .nav-right');
    const desktopToggle = navRight?.querySelector('.theme-toggle-desktop');
    if (navRight) navRight.insertBefore(button, desktopToggle || null);

    /* ---- Toast --------------------------------------------------------- */
    const toastEl = track(document.createElement('div'));
    toastEl.className = 'tank-toast';
    toastEl.dataset.tank = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.hidden = true;

    const toastIcon = document.createElement('span');
    toastIcon.className = 'tank-toast-icon';
    toastIcon.innerHTML = TANK_ICON;

    const toastBody = document.createElement('span');
    toastBody.className = 'tank-toast-body';

    const toastClose = document.createElement('button');
    toastClose.type = 'button';
    toastClose.className = 'tank-toast-close';
    toastClose.setAttribute('aria-label', 'Stow tank');
    toastClose.title = 'Stow tank';
    toastClose.textContent = '✕';
    toastClose.addEventListener('click', onStow);

    toastEl.append(toastIcon, toastBody, toastClose);
    document.body.appendChild(toastEl);

    let toastTimer = 0;
    let hideTimer = 0;

    function showToast(ms, isHint) {
        clearTimeout(toastTimer);
        clearTimeout(hideTimer);
        toastEl.classList.toggle('is-hint', isHint);
        toastEl.hidden = false;
        // Force a reflow so the transition runs even on a back-to-back toast.
        void toastEl.offsetWidth;
        toastEl.classList.add('is-visible');
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('is-visible');
            hideTimer = setTimeout(() => { toastEl.hidden = true; }, 400);
        }, ms);
    }

    /** Plain status message. Text only — never interpolate into markup here. */
    function toast(message, ms = 3200) {
        toastBody.textContent = message;
        showToast(ms, false);
    }

    /** The controls cheat-sheet, laid out as labelled key caps. */
    function showHint() {
        toastBody.innerHTML = isTouch() ? TOUCH_HINT : DESKTOP_HINT;
        showToast(8000, true);
    }

    /* ---- Touch controls ------------------------------------------------ */
    let touchControls = {};
    if (isTouch()) {
        const stickBase = track(document.createElement('div'));
        stickBase.className = 'tank-stick';
        stickBase.dataset.tank = 'stick';
        stickBase.setAttribute('aria-hidden', 'true');

        const stickNub = document.createElement('div');
        stickNub.className = 'tank-stick-nub';
        stickBase.appendChild(stickNub);

        const fireButton = track(document.createElement('button'));
        fireButton.type = 'button';
        fireButton.className = 'tank-fire';
        fireButton.dataset.tank = 'fire';
        fireButton.setAttribute('aria-label', 'Fire');
        fireButton.title = 'Fire (hold to lob a mortar)';

        // Touch has no Escape key, so stowing needs its own control.
        const stowButton = track(document.createElement('button'));
        stowButton.type = 'button';
        stowButton.className = 'tank-stow';
        stowButton.dataset.tank = 'stow';
        stowButton.setAttribute('aria-label', 'Stow tank');
        stowButton.title = 'Stow tank';
        stowButton.textContent = '✕';
        stowButton.addEventListener('click', onStow);

        document.body.append(stickBase, fireButton, stowButton);
        touchControls = { stickBase, stickNub, fireButton };
    }

    function setActive(active) {
        button.setAttribute('aria-pressed', String(active));
        // While the tank is out the button repairs and restarts it; stowing is
        // Escape, the toast's close button, or the touch stow control.
        const label = active ? 'Repair page and reset tank' : 'Summon tank';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.classList.toggle('is-active', active);
        document.documentElement.classList.toggle('tank-live', active);
    }

    function destroy() {
        clearTimeout(toastTimer);
        clearTimeout(hideTimer);
        nodes.forEach(el => el.remove());
        document.documentElement.classList.remove('tank-live');
    }

    setActive(false);

    return { button, toast, showHint, setActive, touchControls, destroy };
}
