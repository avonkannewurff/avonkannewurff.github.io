// The tank itself: a chunky, beveled, low-poly model in a fixed terracotta.
//
// Local model frame: +X is forward (the barrel points down +X), +Y is the
// tank's left, +Z is up off the page.
//
// The scene camera never tilts -- that's what keeps world units equal to CSS
// pixels -- so the 3D read comes from a fixed tilt applied to the model here,
// OUTSIDE the hull's yaw. Tilt-outside-yaw means the foreshortening is always
// along page Y no matter which way the tank is pointing, which is what makes it
// look like a solid object standing on a flat page rather than a sprite that
// leans differently depending on its heading.

import { TILT, placeAtPage } from './scene.js';

/** Small hop off the page plane, so the contact shadow reads as a shadow. */
const LIFT = 6;

/** Overall size multiplier. The mesh below is authored at 1.0. */
const SCALE = 1.2;

/** Fixed palette. Deliberately NOT theme-adaptive -- terracotta in both themes. */
export const PALETTE = {
    lit: 0xe07a3e,
    hull: 0xc05621,
    side: 0xa8461a,
    recess: 0x7c3310,
    tread: 0x4a2a18,
};

/** Where the muzzle sits relative to the tank's centre, along its facing. */
export const MUZZLE_REACH = 35 * SCALE;

/** Half the distance between the treads -- where tread marks get stamped. */
export const TREAD_OFFSET = 14 * SCALE;

export function createTank(THREE, RoundedBoxGeometry) {
    const geometries = [];
    const materials = new Map();

    const mat = (hex) => {
        let m = materials.get(hex);
        if (!m) {
            m = new THREE.MeshStandardMaterial({
                color: hex,
                roughness: 0.82,
                metalness: 0.0,
                flatShading: true,
            });
            materials.set(hex, m);
        }
        return m;
    };

    const box = (w, d, h, radius = 1.6) => {
        const g = new RoundedBoxGeometry(w, d, h, 2, radius);
        geometries.push(g);
        return g;
    };

    const part = (geo, hex, x, y, z) => {
        const m = new THREE.Mesh(geo, mat(hex));
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    };

    // anchor -> tilt -> body(yaw) -> lean(juice) -> parts
    const anchor = new THREE.Group();

    const tilt = new THREE.Group();
    tilt.rotation.x = -TILT;
    tilt.scale.setScalar(SCALE);
    anchor.add(tilt);

    const body = new THREE.Group();
    tilt.add(body);

    const lean = new THREE.Group();
    body.add(lean);

    // --- Running gear -------------------------------------------------------
    const treadGeo = box(48, 9, 12, 2.2);
    lean.add(part(treadGeo, PALETTE.tread, 0, 14, 6));
    lean.add(part(treadGeo, PALETTE.tread, 0, -14, 6));

    // Fenders over the treads catch the light and break up the silhouette.
    const fenderGeo = box(46, 11, 2, 0.8);
    lean.add(part(fenderGeo, PALETTE.side, 0, 14, 12.6));
    lean.add(part(fenderGeo, PALETTE.side, 0, -14, 12.6));

    // --- Hull ---------------------------------------------------------------
    lean.add(part(box(42, 24, 11, 2), PALETTE.side, 0, 0, 7));

    // Sloped glacis at the front, the classic tank read.
    const glacis = part(box(17, 22, 5, 1.4), PALETTE.lit, 13.5, 0, 13.2);
    glacis.rotation.y = -0.38;
    lean.add(glacis);

    lean.add(part(box(24, 22, 5, 1.4), PALETTE.lit, -8, 0, 14));
    lean.add(part(box(7, 16, 3, 1), PALETTE.recess, -19, 0, 15.5)); // rear engine deck

    // --- Turret -------------------------------------------------------------
    const turret = new THREE.Group();
    turret.position.set(-2, 0, 16.5);
    lean.add(turret);

    turret.add(part(box(21, 19, 9, 2.6), PALETTE.hull, 0, 0, 4.5));
    turret.add(part(box(9, 9, 2.4, 1), PALETTE.lit, -3, 0, 9.6));      // hatch
    turret.add(part(box(6, 8, 6, 1.6), PALETTE.recess, 10, 0, 4.2));   // mantlet

    const barrelGeo = new THREE.CylinderGeometry(2.1, 2.7, 24, 12);
    geometries.push(barrelGeo);
    const barrel = new THREE.Mesh(barrelGeo, mat(PALETTE.recess));
    barrel.rotation.z = -Math.PI / 2; // cylinder's +Y becomes +X
    barrel.position.set(23, 0, 4.2);
    barrel.castShadow = true;
    turret.add(barrel);

    const muzzleGeo = new THREE.CylinderGeometry(3, 3, 4, 12);
    geometries.push(muzzleGeo);
    const muzzle = new THREE.Mesh(muzzleGeo, mat(PALETTE.tread));
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(33, 0, 4.2);
    muzzle.castShadow = true;
    turret.add(muzzle);

    // Spring state for the suspension juice. The springs are deliberately
    // under-damped: the overshoot is what makes it read as a cartoon toy
    // rather than a vehicle simulation.
    const juice = {
        pitch: 0, pitchV: 0,
        roll: 0, rollV: 0,
        stretch: 0, stretchV: 0,
        recoil: 0, bob: 0,
    };

    const spring = (pos, vel, target, k, c, dt) => {
        const v = vel + ((target - pos) * k - vel * c) * dt;
        return [pos + v * dt, v];
    };

    /**
     * Drive the body animation from what the tank is actually doing.
     * `accel` is normalised change-in-speed (-1..1) and does most of the work:
     * it dives the nose, and stretches the hull along its direction of travel
     * on the way up, squashing it on the way down.
     */
    function updateJuice(dt, { turn, speedFrac, accel }) {
        const targetPitch = -accel * 0.22 - juice.recoil * 0.55;
        const targetRoll = turn * speedFrac * 0.24;
        const targetStretch = accel * 0.17 - juice.recoil * 0.14;

        [juice.pitch, juice.pitchV] = spring(juice.pitch, juice.pitchV, targetPitch, 190, 12, dt);
        [juice.roll, juice.rollV] = spring(juice.roll, juice.rollV, targetRoll, 160, 11, dt);
        [juice.stretch, juice.stretchV] = spring(juice.stretch, juice.stretchV, targetStretch, 230, 13, dt);
        juice.recoil = Math.max(0, juice.recoil - dt * 4.5);

        // A trundling bob, faster the quicker it's going.
        juice.bob += dt * (4 + speedFrac * 17);
        const bob = Math.sin(juice.bob) * speedFrac * 1.7;
        const waddle = Math.sin(juice.bob * 0.5) * speedFrac * 0.055;

        lean.rotation.y = -juice.pitch;
        lean.rotation.x = juice.roll + waddle;
        lean.position.z = -Math.abs(juice.pitch) * 7 + bob;

        // Squash and stretch, conserving rough volume.
        const s = juice.stretch;
        lean.scale.set(1 + s, 1 - s * 0.55, 1 - s * 0.75);

        barrel.position.x = 23 - juice.recoil * 6;
        muzzle.position.x = 33 - juice.recoil * 6;
    }

    function kickRecoil(amount = 1) {
        juice.recoil = Math.min(1.4, juice.recoil + amount);
        juice.pitchV += amount * 3.6;
        juice.stretchV -= amount * 2.4;
    }

    /** A nearby blast rattles the tank on its springs. */
    function kickBlast(amount = 1) {
        juice.stretchV -= amount * 3.2;
        juice.rollV += (Math.random() - 0.5) * amount * 7;
        juice.pitchV += (Math.random() - 0.5) * amount * 5;
    }

    function resetJuice() {
        Object.assign(juice, {
            pitch: 0, pitchV: 0, roll: 0, rollV: 0,
            stretch: 0, stretchV: 0, recoil: 0, bob: 0,
        });
        lean.scale.set(1, 1, 1);
    }

    /** Place the tank. `x`/`y` are document pixels; angles are page-space radians. */
    function setPose(x, y, angle, turretAngle) {
        placeAtPage(anchor, x, y, LIFT);
        body.rotation.z = -angle;
        // The body group already applied -angle, so this composes to -turretAngle.
        turret.rotation.z = -(turretAngle - angle);
    }

    function dispose() {
        geometries.forEach(g => g.dispose());
        materials.forEach(m => m.dispose());
        geometries.length = 0;
        materials.clear();
    }

    return { anchor, setPose, updateJuice, kickRecoil, kickBlast, resetJuice, dispose };
}
