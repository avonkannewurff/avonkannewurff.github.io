// Sound effects, synthesized on the fly with WebAudio.
//
// No audio files: oscillators, a shared noise buffer, and a procedurally
// generated reverb impulse cover everything, which keeps the feature at zero
// extra bytes and matches the rest of the site's no-assets approach.
//
// These aim for realism rather than bleeps. Three things do most of that work:
//   - Layering. Every impact is a transient (a few ms of bright broadband
//     noise), a body (filtered noise sweeping downward), and a low pressure
//     thump. Real gunfire is mostly noise, not tone.
//   - Convolution reverb. A tail is what separates a recorded gunshot from a
//     synthesizer, and the impulse response is generated here rather than loaded.
//   - Jitter. Every call detunes and re-times itself slightly, so repeated
//     shots never sound like the same sample twice.
//
// Browsers won't let an AudioContext make noise until the user has interacted,
// so the context is built lazily on the first keypress or tap (see input.js).
// That means the tank can roll in silently on load without tripping autoplay.

const MUTE_KEY = 'tank:muted';
const MASTER_GAIN = 0.42;

/** Random walk around a value, so repeats don't sound machine-stamped. */
const jit = (value, amount = 0.07) => value * (1 + (Math.random() * 2 - 1) * amount);

export function createAudio() {
    let ctx = null;
    let master = null;
    let reverbIn = null;
    let noiseBuffer = null;
    let charge = null;
    let drive = null;

    let muted = false;
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

    /** Exponentially decaying noise — a serviceable small-room impulse response. */
    function buildImpulse(seconds, decay, darkness) {
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            let lp = 0;
            for (let i = 0; i < len; i++) {
                const raw = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
                lp += (raw - lp) * darkness; // one-pole lowpass warms the tail
                data[i] = lp;
            }
        }
        return buf;
    }

    function ensure() {
        if (ctx) return true;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;

        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_GAIN;
        master.connect(ctx.destination);

        // Two seconds of white noise, reused by every percussive sound.
        const len = Math.floor(ctx.sampleRate * 2);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        const convolver = ctx.createConvolver();
        convolver.buffer = buildImpulse(1.9, 2.6, 0.34);
        const wet = ctx.createGain();
        wet.gain.value = 0.85;
        convolver.connect(wet);
        wet.connect(master);
        reverbIn = convolver;
        return true;
    }

    /** Call from a real user gesture, or nothing will ever be audible. */
    function unlock() {
        if (!ensure()) return;
        if (ctx.state === 'suspended') ctx.resume();
    }

    const ready = () => ctx && !muted && ctx.state === 'running';
    const noiseSource = () => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;
        src.playbackRate.value = jit(1, 0.12);
        return src;
    };

    /**
     * Attack/decay envelope with a reverb send. Exponential ramps can't reach
     * zero, hence the 0.0001 floor everywhere.
     */
    function envelope(source, peak, decay, t0, attack = 0.003, send = 0) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
        source.connect(gain);
        gain.connect(master);
        if (send > 0) {
            const bus = ctx.createGain();
            bus.gain.value = send;
            gain.connect(bus);
            bus.connect(reverbIn);
        }
        return gain;
    }

    /** A pitched layer that slides from f0 to f1 — the low body of an impact. */
    function tone(type, f0, f1, decay, peak, { delay = 0, send = 0, attack = 0.003 } = {}) {
        if (!ready()) return;
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + decay);
        envelope(osc, peak, decay, t0, attack, send);
        osc.start(t0);
        osc.stop(t0 + decay + 0.1);
    }

    /** A filtered noise layer — the bulk of every realistic impact. */
    function noise(filter, f0, f1, decay, peak, { delay = 0, q = 1, send = 0, attack = 0.002 } = {}) {
        if (!ready()) return;
        const t0 = ctx.currentTime + delay;
        const src = noiseSource();

        const biquad = ctx.createBiquadFilter();
        biquad.type = filter;
        biquad.Q.value = q;
        biquad.frequency.setValueAtTime(f0, t0);
        biquad.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + decay);

        src.connect(biquad);
        envelope(biquad, peak, decay, t0, attack, send);
        src.start(t0);
        src.stop(t0 + decay + 0.1);
    }

    /** Irregular little ticks — grit and rubble thrown clear of an impact. */
    function scatter(count, spread, freq, peak) {
        for (let i = 0; i < count; i++) {
            noise('bandpass', jit(freq, 0.45), jit(freq * 0.6, 0.45), 0.02 + Math.random() * 0.05,
                peak * (0.35 + Math.random() * 0.65),
                { delay: 0.02 + Math.random() * spread, q: 2.2, send: 0.2 });
        }
    }

    /* ---- The kit ----------------------------------------------------- */

    /**
     * Main gun. A real tank cannon is a pressure wave, not a note: a very fast
     * broadband crack, a short filtered body, and a low thump underneath.
     */
    function shot() {
        if (!ready()) return;
        noise('highpass', jit(5200), jit(1500), 0.028, 0.42, { attack: 0.0008, send: 0.25 });
        noise('lowpass', jit(2600), jit(170), jit(0.26), 0.34, { send: 0.42 });
        tone('sine', jit(96), jit(36), jit(0.34), 0.34, { send: 0.35 });
        scatter(3, 0.09, 3200, 0.07);
    }

    /** Shell landing: crack, thud, then grit skittering away. */
    function impact() {
        if (!ready()) return;
        noise('bandpass', jit(1900), jit(900), 0.03, 0.26, { attack: 0.001, q: 0.8, send: 0.22 });
        noise('lowpass', jit(1500), jit(190), jit(0.24), 0.26, { send: 0.34 });
        tone('sine', jit(135), jit(42), jit(0.24), 0.24, { send: 0.3 });
        scatter(5, 0.16, 2600, 0.09);
    }

    /** Something on the page finally gave way — rubble, not a coin pickup. */
    function crunch() {
        if (!ready()) return;
        scatter(9, 0.3, 1500, 0.14);
        noise('lowpass', jit(900), jit(220), 0.2, 0.16, { delay: 0.02, send: 0.3 });
        tone('sine', jit(112), jit(38), 0.26, 0.17, { delay: 0.03, send: 0.28 });
    }

    /** Mortar landing: the big one, with a long tail and some saturation. */
    function boom() {
        if (!ready()) return;
        noise('highpass', jit(6000), jit(1800), 0.045, 0.5, { attack: 0.0008, send: 0.3 });
        noise('lowpass', jit(1400), jit(70), jit(1.05), 0.5, { send: 0.6 });
        tone('sine', jit(78), jit(19), jit(0.95), 0.48, { send: 0.5 });
        tone('triangle', jit(52), jit(16), jit(0.7), 0.24, { delay: 0.02, send: 0.5 });
        // Long, dark rumble trailing off after the main body.
        noise('lowpass', jit(240), jit(45), jit(1.7), 0.2, { delay: 0.06, send: 0.7 });
        scatter(11, 0.55, 2100, 0.11);
    }

    /**
     * The falling-ordnance whistle. The descent accelerates rather than sliding
     * linearly, which is what makes it read as something dropping toward you.
     */
    function whine(duration) {
        if (!ready()) return;
        const d = Math.max(0.25, duration);
        const t0 = ctx.currentTime;
        const f0 = jit(1250, 0.05);
        const f1 = jit(210, 0.05);

        const steps = 48;
        const curve = new Float32Array(steps);
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            curve[i] = f0 * Math.pow(f1 / f0, Math.pow(t, 1.8));
        }

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueCurveAtTime(curve, t0, d);

        // Swell in, then fall away as it nears the ground.
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + d * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        osc.connect(gain);
        gain.connect(master);
        const bus = ctx.createGain();
        bus.gain.value = 0.3;
        gain.connect(bus);
        bus.connect(reverbIn);
        osc.start(t0);
        osc.stop(t0 + d + 0.05);

        // A breath of air rush riding along with it.
        const air = noiseSource();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.4;
        bp.frequency.setValueCurveAtTime(curve, t0, d);
        air.connect(bp);
        const airGain = ctx.createGain();
        airGain.gain.setValueAtTime(0.0001, t0);
        airGain.gain.exponentialRampToValueAtTime(0.05, t0 + d * 0.5);
        airGain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        bp.connect(airGain);
        airGain.connect(master);
        air.start(t0);
        air.stop(t0 + d + 0.05);
    }

    /** Turret servo and loader working while the mortar is being set up. */
    function chargeStart() {
        if (!ready() || charge) return;
        const t0 = ctx.currentTime;

        const motor = ctx.createOscillator();
        motor.type = 'sawtooth';
        motor.frequency.setValueAtTime(58, t0);
        motor.frequency.linearRampToValueAtTime(132, t0 + 0.9);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(420, t0);
        lp.frequency.linearRampToValueAtTime(1100, t0 + 0.9);

        // The mechanical whir on top of the motor.
        const whirSrc = noiseSource();
        const whirBp = ctx.createBiquadFilter();
        whirBp.type = 'bandpass';
        whirBp.Q.value = 3.2;
        whirBp.frequency.setValueAtTime(1200, t0);
        whirBp.frequency.linearRampToValueAtTime(2300, t0 + 0.9);
        whirSrc.connect(whirBp);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.1);

        motor.connect(lp);
        lp.connect(gain);
        whirBp.connect(gain);
        gain.connect(master);

        motor.start(t0);
        whirSrc.start(t0);
        charge = { motor, whirSrc, gain };
    }

    function chargeStop() {
        if (!charge) return;
        const { motor, whirSrc, gain } = charge;
        charge = null;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        motor.stop(t + 0.1);
        whirSrc.stop(t + 0.1);
        // A mechanical clunk as the breech seats.
        noise('bandpass', 1700, 700, 0.05, 0.16, { q: 2, send: 0.2 });
    }

    /* ---- Tread and engine loop --------------------------------------- */

    /**
     * A continuous bed that tracks how fast the tank is going: a diesel drone
     * plus the metallic rattle of the tracks. The rattle is amplitude-modulated
     * by an LFO whose rate rises with speed, which is what gives it the
     * whirring, link-after-link quality instead of sounding like hiss.
     */
    function startDrive() {
        if (!ready() || drive) return;
        const t0 = ctx.currentTime;

        const engine = ctx.createOscillator();
        engine.type = 'sawtooth';
        engine.frequency.value = 38;
        const engineLp = ctx.createBiquadFilter();
        engineLp.type = 'lowpass';
        engineLp.frequency.value = 190;
        const engineGain = ctx.createGain();
        engineGain.gain.value = 0.0001;
        engine.connect(engineLp);
        engineLp.connect(engineGain);
        engineGain.connect(master);

        const tread = noiseSource();
        const treadBp = ctx.createBiquadFilter();
        treadBp.type = 'bandpass';
        treadBp.Q.value = 1.1;
        treadBp.frequency.value = 900;
        const treadGain = ctx.createGain();
        treadGain.gain.value = 0.0001;
        tread.connect(treadBp);
        treadBp.connect(treadGain);
        treadGain.connect(master);

        // LFO modulating the tread level: the individual track links going past.
        const lfo = ctx.createOscillator();
        lfo.type = 'sawtooth';
        lfo.frequency.value = 8;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0;
        lfo.connect(lfoDepth);
        lfoDepth.connect(treadGain.gain);

        engine.start(t0);
        tread.start(t0);
        lfo.start(t0);
        drive = { engine, engineLp, engineGain, tread, treadBp, treadGain, lfo, lfoDepth };
    }

    /** Feed the loop the current speed as a 0..1 fraction. */
    function setDrive(speedFrac) {
        if (muted || !ctx || ctx.state !== 'running') return;
        if (!drive) {
            if (speedFrac <= 0.001) return;
            startDrive();
            if (!drive) return;
        }
        const s = Math.min(1, Math.max(0, speedFrac));
        const now = ctx.currentTime;
        const glide = 0.09; // setTargetAtTime avoids zipper noise on every frame

        drive.engine.frequency.setTargetAtTime(34 + s * 44, now, glide);
        drive.engineLp.frequency.setTargetAtTime(170 + s * 280, now, glide);
        drive.engineGain.gain.setTargetAtTime(0.014 + s * 0.05, now, glide);

        drive.treadBp.frequency.setTargetAtTime(760 + s * 1500, now, glide);
        drive.treadGain.gain.setTargetAtTime(0.004 + s * 0.05, now, glide);
        drive.lfoDepth.gain.setTargetAtTime(s * 0.035, now, glide);
        drive.lfo.frequency.setTargetAtTime(9 + s * 30, now, glide);
    }

    function stopDrive() {
        if (!drive) return;
        const { engine, tread, lfo, engineGain, treadGain } = drive;
        drive = null;
        const t = ctx.currentTime;
        engineGain.gain.cancelScheduledValues(t);
        engineGain.gain.setTargetAtTime(0.0001, t, 0.08);
        treadGain.gain.cancelScheduledValues(t);
        treadGain.gain.setTargetAtTime(0.0001, t, 0.08);
        engine.stop(t + 0.4);
        tread.stop(t + 0.4);
        lfo.stop(t + 0.4);
    }

    /** Diesel starter turning over, then catching. */
    function deploy() {
        if (!ready()) return;
        noise('bandpass', 850, 620, 0.34, 0.1, { q: 2.6, send: 0.2 });
        tone('sawtooth', 30, 74, 0.55, 0.16, { delay: 0.1, send: 0.3, attack: 0.05 });
        tone('sine', 44, 30, 0.4, 0.12, { delay: 0.16, send: 0.25 });
    }

    /** Mechanical latches seating, one after another, as the page reassembles. */
    function repaired() {
        if (!ready()) return;
        for (let i = 0; i < 4; i++) {
            noise('bandpass', jit(2400, 0.25), jit(900, 0.25), 0.035, 0.16,
                { delay: i * 0.085 + Math.random() * 0.02, q: 2.4, send: 0.25 });
        }
        tone('sine', 150, 60, 0.22, 0.16, { delay: 0.36, send: 0.3 });
    }

    function setMuted(next) {
        muted = next;
        if (muted) { chargeStop(); stopDrive(); }
        if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
        try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
        return muted;
    }

    function dispose() {
        chargeStop();
        stopDrive();
        if (ctx) ctx.close().catch(() => {});
        ctx = master = reverbIn = noiseBuffer = null;
    }

    return {
        unlock, shot, impact, crunch, boom, whine, chargeStart, chargeStop,
        setDrive, stopDrive, deploy, repaired, setMuted, dispose,
        get muted() { return muted; },
        toggleMuted: () => setMuted(!muted),
    };
}
