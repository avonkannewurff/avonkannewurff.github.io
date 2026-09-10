// The heavy half of the easter egg: everything that needs Three.js.
//
// boot.js only imports this module once it has decided the tank should actually
// come out, so the ~170KB of vendored Three.js is never fetched otherwise.

import { createScene, toModelAngle, COS_TILT, GROUND_TINT, SCORCH_TINT } from './scene.js';
import { createTank, MUZZLE_REACH, TREAD_OFFSET } from './models.js';
import { createTracks, createScorch, createDebris, createConfetti, createProjectilePool, createBlastPool, createReticle } from './effects.js';
import { createInput } from './input.js';
import { createDestruction } from './destruction.js';
import { createAudio } from './audio.js';
import { createScore } from './score.js';
import { createCelebration } from './celebrate.js';

/*
 * Movement is arcade, not simulation. Speed eases exponentially toward a target
 * rather than integrating a force, which gives a quick punch off the line that
 * softens as it approaches top speed -- and, with a snappier rate for braking,
 * a decisive stop instead of a long coast. Rotation gets the same treatment via
 * a spun-up angular velocity, so the tank leans into turns and drifts out of them.
 */
const MAX_FWD = 400;
const MAX_REV = 230;
const ACCEL_EASE = 8.5;    // approach rate when getting on the throttle
const BRAKE_EASE = 14;     // ...and when stopping or reversing into travel
const ROT_SPEED = 3.4;
const TURN_EASE = 13;
/** Divisor turning raw px/s² into the -1..1 signal the body animation wants. */
const ACCEL_REFERENCE = 2200;

const SHELL_SPEED = 640;
const SHELL_RADIUS = 34;
const SHELL_COOLDOWN = 0.26;
const MORTAR_RADIUS = 78;
const MORTAR_COOLDOWN = 0.7;

/** Below this, a Space press is a tap (direct shell); above it, it's a charge. */
const CHARGE_MIN_MS = 250;
const CHARGE_FULL_MS = 900;

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => {
    const w = (a + Math.PI) % TAU;
    return (w < 0 ? w + TAU : w) - Math.PI;
};
const approachAngle = (cur, target, t) => cur + wrapAngle(target - cur) * Math.min(1, t);

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const isDarkTheme = () => {
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    return scheme === 'dark' || (scheme === 'light dark' && prefersDark.matches);
};

export async function createGame({ reducedMotion = false, hud, onStowed } = {}) {
    const THREE = await import('../../vendor/three.module.min.js');
    const { RoundedBoxGeometry } = await import('../../vendor/RoundedBoxGeometry.js');

    const view = createScene(THREE);
    document.body.appendChild(view.canvas);

    const startsDark = isDarkTheme();
    const tank = createTank(THREE, RoundedBoxGeometry);
    const tracks = createTracks(THREE, startsDark ? GROUND_TINT.dark : GROUND_TINT.light);
    const scorch = createScorch(THREE, startsDark ? SCORCH_TINT.dark : SCORCH_TINT.light);
    const debris = createDebris(THREE);
    const confetti = createConfetti(THREE);
    const projectiles = createProjectilePool(THREE);
    const blasts = createBlastPool(THREE);
    const reticle = createReticle(THREE);
    const destruction = createDestruction();
    const audio = createAudio();
    const score = createScore({ reducedMotion });

    const celebration = createCelebration({ reducedMotion, onFinish: () => reset() });

    view.scene.add(tank.anchor, tracks.mesh, scorch.mesh, debris.mesh, confetti.mesh,
        projectiles.group, blasts.group, reticle.mesh);

    const state = {
        x: 0, y: 0, angle: 0, speed: 0, turnVel: 0, turretAngle: 0,
        phase: 'idle',      // idle | deploying | live | stowing
        shellCd: 0,
        mortarCd: 0,
        trackAccum: 0,
        puffCd: 0,
        accel: 0,           // normalised, drives the squash and stretch
    };
    const shots = [];
    let running = false;
    let lastTime = 0;
    let charging = false;

    /* --------------------------------------------------------------- *
     * Firing
     * --------------------------------------------------------------- */

    const muzzlePoint = () => ({
        x: state.x + Math.cos(state.turretAngle) * MUZZLE_REACH,
        y: state.y + Math.sin(state.turretAngle) * MUZZLE_REACH,
    });

    const chargeOf = (heldMs) =>
        clamp((heldMs - CHARGE_MIN_MS) / (CHARGE_FULL_MS - CHARGE_MIN_MS), 0, 1);

    const reticlePoint = (charge) => ({
        x: state.x + Math.cos(state.turretAngle) * (90 + charge * 520),
        y: state.y + Math.sin(state.turretAngle) * (90 + charge * 520),
    });

    function fireShell() {
        if (state.shellCd > 0 || state.phase !== 'live') return;
        state.shellCd = SHELL_COOLDOWN;

        const mesh = projectiles.acquire('shell');
        if (!mesh) return;
        const m = muzzlePoint();
        shots.push({
            kind: 'shell', mesh, angle: state.turretAngle,
            x: m.x, y: m.y, h: 21, life: 1.6,
        });
        blasts.muzzleFlash(m.x, m.y, 21);
        tank.kickRecoil(0.7);
        audio.shot();
        if (!reducedMotion) view.addShake(3.5);
    }

    function fireMortar(charge) {
        if (state.mortarCd > 0 || state.phase !== 'live') return;
        state.mortarCd = MORTAR_COOLDOWN;

        const mesh = projectiles.acquire('mortar');
        if (!mesh) return;
        const m = muzzlePoint();
        const target = reticlePoint(charge);
        shots.push({
            kind: 'mortar', mesh, angle: state.turretAngle,
            x: m.x, y: m.y, h: 21,
            x0: m.x, y0: m.y, tx: target.x, ty: target.y,
            t: 0, flight: 0.5 + charge * 0.6, peak: 70 + charge * 110, tumble: 0,
        });
        blasts.muzzleFlash(m.x, m.y, 21);
        tank.kickRecoil(1.3);
        audio.shot();
        audio.whine(0.5 + charge * 0.6);
        if (!reducedMotion) view.addShake(6);
    }

    /** Resolve an explosion: shake, scorch, page damage, debris, points, noise. */
    function detonate(px, py, radius, power) {
        const big = radius > SHELL_RADIUS;
        blasts.detonate(px, py, radius);
        scorch.add(px, py, Math.random() * TAU, radius * 2.3, radius * 2.3, 0.55);
        if (big) audio.boom(); else audio.impact();
        if (!reducedMotion) {
            view.addShake(radius * 0.16);
            // Anything landing near the tank rattles it on its springs.
            const near = Math.hypot(px - state.x, py - state.y);
            if (near < radius * 3) tank.kickBlast(1 - near / (radius * 3));
        }

        const force = radius / SHELL_RADIUS;
        let destroyedAny = false;
        for (const hit of destruction.blastAt(px, py, radius, power)) {
            const count = reducedMotion ? 3 : (hit.destroyed ? 16 : 7);
            debris.burst(hit.x, hit.y, count, hit.colors, force);
            destroyedAny = destroyedAny || hit.destroyed;
            score.award({
                destroyed: hit.destroyed,
                vx: hit.x - window.scrollX,
                vy: hit.y - window.scrollY,
            });
        }
        if (destroyedAny) audio.crunch();
        if (destroyedAny) checkCleared();
    }

    /**
     * Has the page been levelled? Only worth asking after something actually
     * died, and only once per run — the countdown then resets everything.
     */
    function checkCleared() {
        if (celebration.isRunning) return;
        const stats = destruction.progress();
        score.setProgress(stats.ratio);
        if (stats.total === 0 || stats.ratio < 1) return;

        confetti.burst();
        celebration.start(stats);
        audio.repaired();
        if (!reducedMotion) view.addShake(10);
    }

    /* --------------------------------------------------------------- *
     * Input plumbing
     * --------------------------------------------------------------- */

    const input = createInput({
        onFireRelease: (heldMs) => {
            reticle.hide();
            audio.chargeStop();
            charging = false;
            if (state.phase !== 'live') return;
            if (heldMs < CHARGE_MIN_MS) fireShell();
            else fireMortar(chargeOf(heldMs));
        },
        // Deliberately not gated on the tank being out: R has to put the page
        // back together even after the tank has been stowed.
        onRepair: () => repair(),
        onStow: () => stow(),
        onMute: () => {
            const muted = audio.toggleMuted();
            hud?.toast(muted ? 'Sound off' : 'Sound on', 1600);
        },
        onGesture: () => audio.unlock(),
    });
    if (hud) input.bindTouchControls(hud.touchControls);

    /* --------------------------------------------------------------- *
     * Per-frame update
     * --------------------------------------------------------------- */

    function steer(dt) {
        let drive = input.state.drive;
        let turn = input.state.turn;

        // The touch joystick points where you want to go, rather than mapping
        // to rotate/throttle, which is unusable with a thumb.
        if (input.state.stick) {
            const diff = wrapAngle(input.state.stick.angle - state.angle);
            turn = clamp(diff * 2.4, -1, 1);
            drive = input.state.stick.mag * (Math.abs(diff) < 1.4 ? 1 : 0.35);
        }

        if (state.phase === 'deploying') { drive = 1; turn = 0; }
        if (state.phase === 'stowing') { drive = 1; turn = 0; }

        // Steering spins up and coasts down rather than snapping on and off.
        state.turnVel += (turn * ROT_SPEED - state.turnVel) * Math.min(1, TURN_EASE * dt);
        state.angle = wrapAngle(state.angle + state.turnVel * dt);

        // Ease toward a target speed. Braking (no throttle, or throttle against
        // the current direction of travel) uses the snappier rate.
        const target = drive * (drive > 0 ? MAX_FWD : MAX_REV);
        const braking = drive === 0
            || (state.speed !== 0 && Math.sign(target) !== Math.sign(state.speed));
        const previous = state.speed;
        state.speed += (target - state.speed) * Math.min(1, (braking ? BRAKE_EASE : ACCEL_EASE) * dt);
        // Exponential easing never quite reaches zero; snap the last crawl away.
        if (drive === 0 && Math.abs(state.speed) < 3) state.speed = 0;
        state.accel = clamp((state.speed - previous) / dt / ACCEL_REFERENCE, -1, 1);

        state.x += Math.cos(state.angle) * state.speed * dt;
        state.y += Math.sin(state.angle) * state.speed * dt;

        const docW = document.documentElement.scrollWidth;
        const docH = document.documentElement.scrollHeight;
        if (state.phase !== 'deploying' && state.phase !== 'stowing') {
            state.x = clamp(state.x, 26, docW - 26);
            state.y = clamp(state.y, 26, docH - 26);
        }

        // Turret: the mouse owns it while it's moving, otherwise it recentres.
        const aim = input.state.aimFresh ? input.state.aimPage : null;
        const want = aim
            ? Math.atan2(aim.y - state.y, aim.x - state.x)
            : state.angle;
        state.turretAngle = approachAngle(state.turretAngle, want, (aim ? 14 : 6) * dt);

        return { drive, turn };
    }

    /** Keep the tank on screen by scrolling the page under it. */
    function followWithScroll() {
        if (Math.abs(state.speed) < 6) return;
        const vy = state.y - window.scrollY;
        const top = window.innerHeight * 0.28;
        const bottom = window.innerHeight * 0.72;
        const delta = vy < top ? vy - top : (vy > bottom ? vy - bottom : 0);
        // `instant` is required: the site sets html { scroll-behavior: smooth }.
        if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
    }

    function layTracks(dt) {
        state.trackAccum += Math.abs(state.speed) * dt;
        if (state.trackAccum < 7) return;
        // Subtract rather than zero, so a slow frame doesn't lose the remainder
        // and leave a gap in the trail; capped so it can never run away.
        state.trackAccum = Math.min(state.trackAccum - 7, 14);

        // Stamp where the treads *appear*, which the tilt foreshortens along page Y.
        const m = toModelAngle(state.angle);
        for (const side of [-TREAD_OFFSET, TREAD_OFFSET]) {
            tracks.add(
                state.x + side * Math.sin(m),
                state.y - side * Math.cos(m) * COS_TILT,
                state.angle, 13, 11, 0.62,
            );
        }
    }

    /** Exhaust smoke out the back whenever it's actually pulling. */
    function layExhaust(dt) {
        state.puffCd -= dt;
        if (reducedMotion || state.accel < 0.22 || state.puffCd > 0) return;
        state.puffCd = 0.075;

        const m = toModelAngle(state.angle);
        blasts.puff(
            state.x - Math.cos(m) * 32 + (Math.random() - 0.5) * 8,
            state.y - Math.sin(m) * 32 * COS_TILT + (Math.random() - 0.5) * 8,
            isDarkTheme() ? GROUND_TINT.dark : GROUND_TINT.light,
        );
    }

    function updateShots(dt) {
        const pending = [];

        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            let done = false;

            if (s.kind === 'shell') {
                s.life -= dt;
                // March in short steps so a fast shell can't tunnel through a
                // thin element between frames.
                let remaining = SHELL_SPEED * dt;
                while (remaining > 0 && !done) {
                    const step = Math.min(8, remaining);
                    remaining -= step;
                    s.x += Math.cos(s.angle) * step;
                    s.y += Math.sin(s.angle) * step;
                    if (destruction.targetAt(s.x, s.y)) {
                        pending.push({ x: s.x, y: s.y, r: SHELL_RADIUS, p: 1.3 });
                        done = true;
                    }
                }
                if (!done && s.life <= 0) done = true;
                projectiles.place(s.mesh, s.x, s.y, s.h, s.angle);
            } else {
                s.t += dt / s.flight;
                s.tumble += dt * 9;
                const t = Math.min(1, s.t);
                s.x = s.x0 + (s.tx - s.x0) * t;
                s.y = s.y0 + (s.ty - s.y0) * t;
                s.h = 21 + 4 * s.peak * t * (1 - t);
                projectiles.place(s.mesh, s.x, s.y, s.h, s.angle, s.tumble);
                if (s.t >= 1) {
                    pending.push({ x: s.tx, y: s.ty, r: MORTAR_RADIUS, p: 2.6 });
                    done = true;
                }
            }

            if (done) {
                projectiles.release(s.mesh);
                shots.splice(i, 1);
            }
        }

        // Damage is applied only after every projectile has been hit-tested:
        // punching masks mid-loop would dirty layout for the remaining probes.
        for (const b of pending) detonate(b.x, b.y, b.r, b.p);
    }

    function updateReticle(dt) {
        if (state.phase !== 'live' || !input.state.fireHeld) { reticle.hide(); return; }
        const heldMs = performance.now() - input.state.fireHeldSince;
        if (heldMs < CHARGE_MIN_MS) { reticle.hide(); return; }

        if (!charging) { charging = true; audio.chargeStart(); }
        const charge = chargeOf(heldMs);
        const p = reticlePoint(charge);
        reticle.show(p.x, p.y, charge, dt);
    }

    function updatePhase() {
        if (state.phase === 'deploying' && state.x > window.scrollX + 150) {
            state.phase = 'live';
        } else if (state.phase === 'stowing') {
            const vx = state.x - window.scrollX;
            if (vx < -120 || vx > window.innerWidth + 120) finishStow();
        }
    }

    function frame(now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - lastTime) / 1000) || 0;
        lastTime = now;
        if (document.hidden) return;

        input.update();
        const { turn } = steer(dt);
        updatePhase();
        followWithScroll();
        layTracks(dt);
        layExhaust(dt);

        state.shellCd = Math.max(0, state.shellCd - dt);
        state.mortarCd = Math.max(0, state.mortarCd - dt);

        updateShots(dt);
        updateReticle(dt);

        tank.updateJuice(dt, {
            turn,
            speedFrac: Math.abs(state.speed) / MAX_FWD,
            accel: state.accel,
        });
        tank.setPose(state.x, state.y, toModelAngle(state.angle), toModelAngle(state.turretAngle));

        // Engine and tread bed follows however hard it's actually working.
        audio.setDrive(Math.min(1, Math.abs(state.speed) / MAX_FWD
            + Math.abs(state.turnVel) / ROT_SPEED * 0.35));

        tracks.update(dt);
        scorch.update(dt);
        debris.update(dt);
        confetti.update(dt);
        blasts.update(dt);
        score.update(dt, state.x - window.scrollX, state.y - window.scrollY);

        view.sync(dt);
        view.render();
    }

    /* --------------------------------------------------------------- *
     * Lifecycle
     * --------------------------------------------------------------- */

    /** Park the tank off the left edge of whatever the visitor is looking at. */
    function placeOffscreen() {
        state.x = window.scrollX - 90;
        state.y = window.scrollY + window.innerHeight * 0.62;
        state.angle = 0;
        state.turnVel = 0;
        state.turretAngle = 0;
        state.speed = MAX_FWD * 0.6;
        state.accel = 0;
        state.phase = 'deploying';
        tank.resetJuice();
    }

    function deploy() {
        if (running) return;
        running = true;
        lastTime = performance.now();
        placeOffscreen();

        view.resize();
        view.canvas.classList.add('is-live');
        view.renderer.setAnimationLoop(frame);
        input.setEnabled(true);
        score.reset();
        score.show();
        audio.deploy();
        hud?.setActive(true);
    }

    /**
     * Put the page back and send the tank round again from the top. This is
     * what the nav button does while the tank is out -- stowing it is Escape,
     * the toast's close button, or the touch stow control.
     */
    function reset() {
        celebration.stop();
        confetti.clear();
        if (!running) { deploy(); return; }
        repair({ silent: true });
        shots.length = 0;
        projectiles.clear();
        reticle.hide();
        charging = false;
        audio.chargeStop();
        placeOffscreen();
        audio.deploy();
        hud?.toast('Reset', 1400);
    }

    function stow() {
        if (!running || state.phase === 'stowing') return;
        state.phase = 'stowing';
        reticle.hide();
        // Point at the nearer horizontal edge and drive off it.
        const vx = state.x - window.scrollX;
        state.angle = vx < window.innerWidth / 2 ? Math.PI : 0;
        hud?.setActive(false);
        // Safety net in case something stops the loop before it drives clear.
        setTimeout(() => { if (state.phase === 'stowing') finishStow(); }, 2500);
    }

    function finishStow() {
        if (!running) return;
        running = false;
        state.phase = 'idle';
        // Hand the keyboard back to the browser -- except for R, which stays
        // live so the page can still be put back together once it's gone.
        input.setEnabled(false);
        audio.chargeStop();
        audio.stopDrive();
        celebration.stop();
        confetti.clear();
        charging = false;
        view.renderer.setAnimationLoop(null);
        view.canvas.classList.remove('is-live');
        projectiles.clear();
        shots.length = 0;
        score.hide();
        onStowed?.();
    }

    /**
     * Restore every damaged element and wipe the battlefield. Works whether or
     * not the tank is currently out; if it is stowed, the canvas is idle so the
     * marks are cleared for the next deploy rather than redrawn now.
     */
    function repair({ silent = false } = {}) {
        const restored = destruction.repair();
        celebration.stop();
        tracks.clear();
        scorch.clear();
        debris.clear();
        confetti.clear();
        blasts.clear();
        score.reset();

        if (silent) return restored;
        if (restored > 0) {
            audio.repaired();
            hud?.toast(`Page repaired — ${restored} element${restored === 1 ? '' : 's'} restored`);
        } else {
            hud?.toast('Nothing to repair', 1600);
        }
        return restored;
    }

    function syncTheme() {
        const dark = isDarkTheme();
        tracks.setTint(dark ? GROUND_TINT.dark : GROUND_TINT.light);
        scorch.setTint(dark ? SCORCH_TINT.dark : SCORCH_TINT.light);
        view.setTheme(dark);
    }

    const onResize = () => view.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('themechange', syncTheme);
    prefersDark.addEventListener('change', syncTheme);
    syncTheme();

    function dispose() {
        running = false;
        view.renderer.setAnimationLoop(null);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        document.removeEventListener('themechange', syncTheme);
        prefersDark.removeEventListener('change', syncTheme);
        input.dispose();
        destruction.repair();
        audio.dispose();
        score.destroy();
        celebration.destroy();
        [tank, tracks, scorch, debris, confetti, projectiles, blasts, reticle]
            .forEach(o => o.dispose());
        view.dispose();
    }

    return {
        deploy, stow, reset, repair, dispose,
        get isActive() { return running; },
    };
}
