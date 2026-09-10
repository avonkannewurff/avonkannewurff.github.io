// Everything that isn't the tank: tread marks, scorch, debris, projectiles,
// blasts, and the mortar reticle.
//
// Ground marks and debris are InstancedMesh ring buffers so that hundreds of
// them cost one draw call each. Projectiles and blasts are small object pools,
// since only a handful are ever live at once.

import { TILT, SIN_TILT, COS_TILT, placeAtPage } from './scene.js';
import { PALETTE } from './models.js';

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

function makeTexture(THREE, size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/**
 * Give an InstancedMesh per-instance opacity, which Three doesn't offer natively.
 *
 * This deliberately uses its own `instanceAlpha` attribute rather than borrowing
 * a channel of `instanceColor`: setting instanceColor makes Three multiply the
 * fragment colour by it, which tinted every tread mark and scorch blast red.
 * A custom attribute stays out of that plumbing entirely.
 */
function patchInstanceAlpha(material) {
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = 'attribute float instanceAlpha;\nvarying float vMarkAlpha;\n'
            + shader.vertexShader.replace('void main() {', 'void main() {\n\tvMarkAlpha = instanceAlpha;');
        shader.fragmentShader = 'varying float vMarkAlpha;\n' + shader.fragmentShader
            .replace('#include <opaque_fragment>',
                '\tdiffuseColor.a *= vMarkAlpha;\n#include <opaque_fragment>');
    };
}

/* ------------------------------------------------------------------ *
 * Ground marks — tread tracks and scorch
 * ------------------------------------------------------------------ */

function treadTexture(THREE) {
    return makeTexture(THREE, 64, (g, s) => {
        const grad = g.createLinearGradient(0, 0, 0, s);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.24, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.76, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
        // Notch out cleats across the direction of travel.
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 4; i++) g.fillRect(i * s / 4 + s / 14, 0, s / 11, s);
    });
}

function scorchTexture(THREE) {
    return makeTexture(THREE, 128, (g, s) => {
        const c = s / 2;
        // Ragged rim first, so the soft core paints over the seams.
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const d = c * (0.32 + Math.random() * 0.2);
            const r = c * (0.24 + Math.random() * 0.16);
            const blob = g.createRadialGradient(c + Math.cos(a) * d, c + Math.sin(a) * d, 0,
                c + Math.cos(a) * d, c + Math.sin(a) * d, r);
            blob.addColorStop(0, 'rgba(255,255,255,0.55)');
            blob.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = blob;
            g.fillRect(0, 0, s, s);
        }
        const core = g.createRadialGradient(c, c, 0, c, c, c * 0.62);
        core.addColorStop(0, 'rgba(255,255,255,0.95)');
        core.addColorStop(0.55, 'rgba(255,255,255,0.6)');
        core.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = core;
        g.fillRect(0, 0, s, s);
    });
}

function ringTexture(THREE) {
    return makeTexture(THREE, 128, (g, s) => {
        const c = s / 2;
        const grad = g.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.58, 'rgba(255,255,255,0.05)');
        grad.addColorStop(0.8, 'rgba(255,255,255,1)');
        grad.addColorStop(0.93, 'rgba(255,255,255,0.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
    });
}

/** Soft blob, pure white so the material colour does all the tinting. */
function flashTexture(THREE) {
    return makeTexture(THREE, 128, (g, s) => {
        const c = s / 2;
        const grad = g.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.82)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
    });
}

/**
 * A ring buffer of flat, fading quads lying on the page plane. Used for both
 * tread marks and scorch; the caller supplies the texture and how long a mark
 * survives before it's recycled.
 */
function createMarkField(THREE, { capacity, texture, tint, z, life, renderOrder }) {
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: tint,
        transparent: true,
        depthWrite: false,
    });
    patchInstanceAlpha(material);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const alphas = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('instanceAlpha', alphas);

    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.frustumCulled = false; // instances span the whole document
    mesh.renderOrder = renderOrder;

    const slots = new Array(capacity).fill(null);
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();
    const _p = new THREE.Vector3();
    const _s = new THREE.Vector3();
    let next = 0;
    let live = 0;

    function add(px, py, angle, len, wid, alpha = 1) {
        const i = next;
        next = (next + 1) % capacity;
        if (!slots[i]) live++;
        slots[i] = { age: 0, alpha };

        _q.setFromEuler(_e.set(0, 0, -angle));
        _m.compose(_p.set(px, -py, z), _q, _s.set(len, wid, 1));
        mesh.setMatrixAt(i, _m);
        mesh.instanceMatrix.needsUpdate = true;
        // Write the alpha now rather than waiting for update(), so a recycled
        // slot never shows one frame at its previous occupant's opacity.
        alphas.array[i] = alpha;
        alphas.needsUpdate = true;
        return i;
    }

    function update(dt) {
        if (!live) return;
        const values = alphas.array;
        for (let i = 0; i < capacity; i++) {
            const slot = slots[i];
            if (!slot) continue;
            slot.age += dt;
            const t = slot.age / life;
            if (t >= 1) {
                slots[i] = null;
                live--;
                values[i] = 0;
                continue;
            }
            // Hold, then fade out over the last third of the lifetime.
            values[i] = slot.alpha * Math.min(1, (1 - t) * 3);
        }
        alphas.needsUpdate = true;
    }

    function clear() {
        slots.fill(null);
        live = 0;
        next = 0;
        alphas.array.fill(0);
        alphas.needsUpdate = true;
    }

    return {
        mesh,
        add,
        update,
        clear,
        setTint: (hex) => material.color.setHex(hex),
        dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); },
    };
}

export const createTracks = (THREE, tint) => createMarkField(THREE, {
    capacity: 640, texture: treadTexture(THREE), tint, z: 0.4, life: 26, renderOrder: 1,
});

export const createScorch = (THREE, tint) => createMarkField(THREE, {
    capacity: 140, texture: scorchTexture(THREE), tint, z: 0.8, life: 40, renderOrder: 2,
});

/* ------------------------------------------------------------------ *
 * Debris — tumbling cubes torn off whatever just got hit
 * ------------------------------------------------------------------ */

export function createDebris(THREE, capacity = 220) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // Do NOT add `vertexColors: true` here. instanceColor tints on its own; with
    // vertexColors on and no `color` attribute on the geometry, the shader
    // multiplies by an unbound attribute that reads as (0,0,0) and every chip
    // renders black.
    const material = new THREE.MeshStandardMaterial({
        roughness: 0.85, metalness: 0, flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.frustumCulled = false;
    mesh.castShadow = true;

    const bits = new Array(capacity).fill(null);
    const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, 0, 0));
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _spin = new THREE.Quaternion();
    const _e = new THREE.Euler();
    const _p = new THREE.Vector3();
    const _s = new THREE.Vector3();
    const _c = new THREE.Color();
    let next = 0;
    let live = 0;

    function burst(px, py, count, colors, force = 1) {
        for (let n = 0; n < count; n++) {
            const i = next;
            next = (next + 1) % capacity;
            if (!bits[i]) live++;

            const dir = Math.random() * Math.PI * 2;
            const speed = (60 + Math.random() * 210) * force;
            bits[i] = {
                x: px + (Math.random() - 0.5) * 14,
                y: py + (Math.random() - 0.5) * 14,
                h: 2 + Math.random() * 10,
                vx: Math.cos(dir) * speed,
                vy: Math.sin(dir) * speed,
                vh: (110 + Math.random() * 230) * force,
                rx: (Math.random() - 0.5) * 14,
                ry: (Math.random() - 0.5) * 14,
                rz: (Math.random() - 0.5) * 14,
                ax: Math.random() * 6, ay: Math.random() * 6, az: Math.random() * 6,
                size: 2.4 + Math.random() * 5,
                age: 0,
                life: 1.9 + Math.random() * 1.4,
            };

            // Lift the sampled page colour: body text is near-black, and
            // unlifted chips of it just read as flat dots against the page.
            _c.set(colors[(Math.random() * colors.length) | 0]);
            _c.offsetHSL(0, 0.04, 0.16 + Math.random() * 0.08);
            mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
        }
        mesh.instanceColor.needsUpdate = true;
    }

    function update(dt) {
        if (!live) return;
        for (let i = 0; i < capacity; i++) {
            const b = bits[i];
            if (!b) continue;

            b.age += dt;
            if (b.age >= b.life) {
                bits[i] = null;
                live--;
                _m.makeScale(0, 0, 0);
                mesh.setMatrixAt(i, _m);
                continue;
            }

            b.vh -= 1500 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.h += b.vh * dt;

            if (b.h <= 0) {
                b.h = 0;
                b.vh *= -0.34;
                b.vx *= 0.62;
                b.vy *= 0.62;
                b.ax *= 0.5; b.ay *= 0.5; b.az *= 0.5;
                if (Math.abs(b.vh) < 14) b.vh = 0;
            }

            b.rx += b.ax * dt; b.ry += b.ay * dt; b.rz += b.az * dt;

            // Shrink away over the last 35% of life instead of popping out.
            const t = b.age / b.life;
            const scale = b.size * (t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1);

            _spin.setFromEuler(_e.set(b.rx, b.ry, b.rz));
            _q.copy(tiltQ).multiply(_spin);
            _p.set(b.x, -b.y + b.h * SIN_TILT, b.h * COS_TILT + 1);
            _m.compose(_p, _q, _s.setScalar(scale));
            mesh.setMatrixAt(i, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    function clear() {
        for (let i = 0; i < capacity; i++) {
            if (!bits[i]) continue;
            bits[i] = null;
            _m.makeScale(0, 0, 0);
            mesh.setMatrixAt(i, _m);
        }
        live = 0;
        mesh.instanceMatrix.needsUpdate = true;
    }

    // Start every instance collapsed; otherwise unused slots render as unit cubes.
    clear();

    return {
        mesh, burst, update, clear,
        dispose: () => { geometry.dispose(); material.dispose(); },
    };
}

/* ------------------------------------------------------------------ *
 * Confetti — the 100% payoff
 * ------------------------------------------------------------------ */

const CONFETTI_COLOURS = [
    0xe07a3e, 0xc05621, 0xffd34d, 0xa4be7b, 0x4b6630,
    0xf2e8d5, 0xe4572e, 0x76a865, 0xffb703,
];

/**
 * Paper falling down the *page*, not off a height: gravity here runs along
 * page Y so it sweeps the whole viewport regardless of where the camera is.
 */
export function createConfetti(THREE, capacity = 360) {
    const geometry = new THREE.BoxGeometry(1, 1, 0.16);
    // See createDebris: instanceColor tints by itself, and `vertexColors: true`
    // would black the whole thing out.
    const material = new THREE.MeshStandardMaterial({
        roughness: 0.55, metalness: 0, flatShading: true, side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.frustumCulled = false;

    const bits = new Array(capacity).fill(null);
    const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, 0, 0));
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _spin = new THREE.Quaternion();
    const _e = new THREE.Euler();
    const _p = new THREE.Vector3();
    const _s = new THREE.Vector3();
    const _c = new THREE.Color();
    let next = 0;
    let live = 0;

    function burst(count = capacity) {
        const left = window.scrollX;
        const top = window.scrollY;
        const width = window.innerWidth;

        for (let n = 0; n < count; n++) {
            const i = next;
            next = (next + 1) % capacity;
            if (!bits[i]) live++;

            bits[i] = {
                x: left + Math.random() * width,
                // Staggered above the fold so it rains in rather than all at once.
                y: top - 40 - Math.random() * 900,
                h: 14 + Math.random() * 46,
                vx: (Math.random() - 0.5) * 70,
                vy: 130 + Math.random() * 210,
                sway: 18 + Math.random() * 46,
                phase: Math.random() * Math.PI * 2,
                rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
                ax: (Math.random() - 0.5) * 9,
                ay: (Math.random() - 0.5) * 9,
                az: (Math.random() - 0.5) * 9,
                w: 4 + Math.random() * 6,
                l: 7 + Math.random() * 9,
                age: 0,
            };
            _c.setHex(CONFETTI_COLOURS[(Math.random() * CONFETTI_COLOURS.length) | 0]);
            mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
        }
        mesh.instanceColor.needsUpdate = true;
    }

    function update(dt) {
        if (!live) return;
        const bottom = window.scrollY + window.innerHeight + 160;
        for (let i = 0; i < capacity; i++) {
            const b = bits[i];
            if (!b) continue;

            b.age += dt;
            b.phase += dt * 3.4;
            b.y += b.vy * dt;
            b.x += (b.vx + Math.sin(b.phase) * b.sway) * dt;
            b.vy = Math.min(b.vy + 120 * dt, 420);
            b.rx += b.ax * dt; b.ry += b.ay * dt; b.rz += b.az * dt;

            if (b.y > bottom || b.age > 14) {
                bits[i] = null;
                live--;
                _m.makeScale(0, 0, 0);
                mesh.setMatrixAt(i, _m);
                continue;
            }

            _spin.setFromEuler(_e.set(b.rx, b.ry, b.rz));
            _q.copy(tiltQ).multiply(_spin);
            _p.set(b.x, -b.y + b.h * SIN_TILT, b.h * COS_TILT + 3);
            _m.compose(_p, _q, _s.set(b.l, b.w, 1));
            mesh.setMatrixAt(i, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    function clear() {
        for (let i = 0; i < capacity; i++) {
            if (!bits[i]) continue;
            bits[i] = null;
            _m.makeScale(0, 0, 0);
            mesh.setMatrixAt(i, _m);
        }
        live = 0;
        mesh.instanceMatrix.needsUpdate = true;
    }

    clear();

    return {
        mesh, burst, update, clear,
        dispose: () => { geometry.dispose(); material.dispose(); },
    };
}

/* ------------------------------------------------------------------ *
 * Projectiles
 * ------------------------------------------------------------------ */

export function createProjectilePool(THREE, size = 16) {
    const group = new THREE.Group();
    const shellGeo = new THREE.OctahedronGeometry(3.4, 0);
    const mortarGeo = new THREE.OctahedronGeometry(5, 0);
    const shellMat = new THREE.MeshStandardMaterial({
        color: PALETTE.recess, roughness: 0.6, metalness: 0.1, flatShading: true,
    });
    const mortarMat = new THREE.MeshStandardMaterial({
        color: PALETTE.tread, roughness: 0.7, metalness: 0.1, flatShading: true,
    });

    const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, 0, 0));
    const _yawQ = new THREE.Quaternion();
    const _tumbleQ = new THREE.Quaternion();
    const _e = new THREE.Euler();

    const pool = [];
    for (let i = 0; i < size; i++) {
        const mesh = new THREE.Mesh(shellGeo, shellMat);
        mesh.castShadow = true;
        mesh.visible = false;
        mesh.frustumCulled = false;
        group.add(mesh);
        pool.push(mesh);
    }

    /** Claim a mesh for a projectile, or null if the pool is exhausted. */
    function acquire(kind) {
        const mesh = pool.find(m => !m.visible);
        if (!mesh) return null;
        mesh.geometry = kind === 'mortar' ? mortarGeo : shellGeo;
        mesh.material = kind === 'mortar' ? mortarMat : shellMat;
        mesh.scale.set(kind === 'mortar' ? 1.1 : 1.9, 1, 1);
        mesh.visible = true;
        return mesh;
    }

    function place(mesh, px, py, h, angle, tumble = 0) {
        placeAtPage(mesh, px, py, h);
        mesh.position.z += 1;
        // World tilt first, then the projectile's heading, then any tumble.
        _yawQ.setFromEuler(_e.set(0, 0, -angle));
        mesh.quaternion.copy(tiltQ).multiply(_yawQ);
        if (tumble) {
            _tumbleQ.setFromEuler(_e.set(0, tumble, 0));
            mesh.quaternion.multiply(_tumbleQ);
        }
    }

    return {
        group, acquire, place,
        release: (mesh) => { mesh.visible = false; },
        clear: () => pool.forEach(m => { m.visible = false; }),
        dispose: () => {
            shellGeo.dispose(); mortarGeo.dispose();
            shellMat.dispose(); mortarMat.dispose();
        },
    };
}

/* ------------------------------------------------------------------ *
 * Blasts, muzzle flashes, and the mortar reticle
 * ------------------------------------------------------------------ */

export function createBlastPool(THREE, size = 14) {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const ringTex = ringTexture(THREE);
    const flashTex = flashTexture(THREE);

    const items = [];
    for (let i = 0; i < size; i++) {
        const material = new THREE.MeshBasicMaterial({
            map: ringTex, transparent: true, depthWrite: false, opacity: 0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 5;
        group.add(mesh);
        items.push({ mesh, material, age: 0, life: 1, from: 0, to: 1, additive: false });
    }

    function spawn(px, py, h, { from, to, life, color, additive, texture }) {
        const item = items.find(it => !it.mesh.visible);
        if (!item) return;
        item.age = 0;
        item.life = life;
        item.from = from;
        item.to = to;
        item.material.map = texture === 'flash' ? flashTex : ringTex;
        item.material.color.setHex(color);
        item.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        item.material.opacity = 1;
        item.material.needsUpdate = true;
        placeAtPage(item.mesh, px, py, h);
        item.mesh.position.z += 2;
        item.mesh.scale.setScalar(from);
        item.mesh.visible = true;
    }

    /**
     * A shell or mortar landing: a quick flash plus a longer shock ring.
     * The flash is deliberately brief and small -- held any longer it stops
     * reading as an explosion and starts reading as an orange disc.
     */
    function detonate(px, py, radius) {
        spawn(px, py, 8, {
            from: radius * 0.3, to: radius * 1.5, life: 0.2,
            color: 0xffb066, additive: true, texture: 'flash',
        });
        spawn(px, py, 1, {
            from: radius * 0.5, to: radius * 3.1, life: 0.6,
            color: 0xffc890, additive: false, texture: 'ring',
        });
    }

    function muzzleFlash(px, py, h) {
        spawn(px, py, h, {
            from: 8, to: 30, life: 0.14, color: 0xfff0c8, additive: true, texture: 'flash',
        });
    }

    /** Exhaust smoke off the back of the tank when it gets on the throttle. */
    function puff(px, py, color) {
        spawn(px, py, 5, {
            from: 6, to: 26 + Math.random() * 12, life: 0.5 + Math.random() * 0.25,
            color, additive: false, texture: 'flash',
        });
    }

    function update(dt) {
        for (const item of items) {
            if (!item.mesh.visible) continue;
            item.age += dt;
            const t = item.age / item.life;
            if (t >= 1) {
                item.mesh.visible = false;
                continue;
            }
            const eased = 1 - Math.pow(1 - t, 3);
            item.mesh.scale.setScalar(item.from + (item.to - item.from) * eased);
            item.material.opacity = 1 - t;
        }
    }

    return {
        group, detonate, muzzleFlash, puff, update,
        clear: () => items.forEach(it => { it.mesh.visible = false; }),
        dispose: () => {
            geometry.dispose();
            ringTex.dispose();
            flashTex.dispose();
            items.forEach(it => it.material.dispose());
        },
    };
}

export function createReticle(THREE) {
    const texture = ringTexture(THREE);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
        map: texture, color: PALETTE.lit, transparent: true, depthWrite: false, opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;

    let pulse = 0;

    function show(px, py, charge, dt) {
        pulse += dt * 7;
        placeAtPage(mesh, px, py, 0);
        mesh.position.z += 3;
        mesh.scale.setScalar(34 + charge * 30 + Math.sin(pulse) * 3);
        material.opacity = 0.35 + charge * 0.55;
        mesh.visible = true;
    }

    return {
        mesh, show,
        hide: () => { mesh.visible = false; },
        dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); },
    };
}
