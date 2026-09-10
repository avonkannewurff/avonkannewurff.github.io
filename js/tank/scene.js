// Three.js scene, camera, and lighting for the tank easter egg.
//
// The whole feature hinges on one decision made here: the camera is
// ORTHOGRAPHIC and looks straight down the -Z axis, with the frustum sized to
// exactly the viewport in CSS pixels. That makes world units CSS pixels and
// puts world (x, -y) exactly on document (x, y) at any height, so driving,
// hit-testing, and crater placement are all plain page arithmetic with no
// unprojection anywhere.
//
// A tilted camera would break that mapping, so nothing is ever tilted here.
// The 3D read comes from tilting the *models* instead — see models.js.

/** Document Y grows downward, Three's Y grows upward, so world Y is negated. */
const toWorldY = (docY) => -docY;

/**
 * How far models are tipped toward the viewer. This is the projection: because
 * the camera looks straight down, height above the page produces no screen
 * movement on its own, so "up" has to be baked into the models and into
 * placeAtPage() below. Everything that can leave the ground shares this angle,
 * which is what keeps the tank, its shells, and its debris in one coherent space.
 */
export const TILT = 40 * Math.PI / 180;
export const SIN_TILT = Math.sin(TILT);
export const COS_TILT = Math.cos(TILT);

/**
 * Put an object at document position (px, py), `h` pixels above the page.
 * The height becomes a screen-space lift plus real depth, so the object rises
 * visually AND its cast shadow slides away from it -- the cue that sells height.
 */
export function placeAtPage(obj, px, py, h = 0) {
    obj.position.set(px, -py + h * SIN_TILT, h * COS_TILT);
}

/**
 * Convert a page-space heading into the model yaw that *looks* like that
 * heading. The tilt squashes everything along page Y, so a model yawed to 45°
 * appears to point at about 40°. Gameplay stays in page space -- shells travel
 * where you aimed -- and only rendering goes through here, which is what keeps
 * the barrel visually pointing at whatever the mouse is over.
 */
export const toModelAngle = (pageAngle) =>
    Math.atan2(Math.sin(pageAngle) / COS_TILT, Math.cos(pageAngle));

/** Height of the camera above the page plane. Everything lives well inside. */
const CAM_Z = 2000;

/** Direction the sun comes from, in world space: upper-left, in front of the page. */
const LIGHT_DIR = [-0.55, 0.78, 1.0];

/**
 * Ground marks have to stay visible against both the warm off-white and the
 * near-black background, so unlike the tank body -- which is a fixed terracotta
 * on purpose -- these do flip with the theme.
 *
 * Scorch gets its own, muter pair: at the tracks' brightness it stops reading as
 * a burn in dark mode and starts reading as snow.
 */
export const GROUND_TINT = { light: 0x3d2a1c, dark: 0xe8d9c8 };
export const SCORCH_TINT = { light: 0x2b1a10, dark: 0x93857a };

export function createScene(THREE) {
    const canvas = document.createElement('canvas');
    canvas.dataset.tank = 'canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'tank-canvas';

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, CAM_Z * 2);
    camera.position.z = CAM_Z;
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x4a3b2f, 2.1));

    const sun = new THREE.DirectionalLight(0xfff1de, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.6;

    // The light and its target ride along with the camera so the shadow frustum
    // only ever has to cover the viewport. Fitting it to the whole ~3-viewport
    // tall document would leave the shadows a blurry mess.
    const rig = new THREE.Group();
    rig.add(sun, sun.target);
    scene.add(rig);
    sun.position.set(LIGHT_DIR[0] * 700, LIGHT_DIR[1] * 700, LIGHT_DIR[2] * 700);
    sun.target.position.set(0, 0, 0);

    // Invisible plane that exists only to catch the shadows. ShadowMaterial
    // renders nothing but the shadow, so on an alpha canvas the tank appears to
    // cast onto the page itself.
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.24, color: 0x2a1c12 });
    // Must not write depth: the tank is tilted, so its lower corners dip below
    // z = 0, and a depth-writing catcher plane would slice them off.
    shadowMat.depthWrite = false;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
    ground.receiveShadow = true;
    ground.renderOrder = -1;
    scene.add(ground);

    let width = 0;
    let height = 0;
    const shake = { x: 0, y: 0, mag: 0 };

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);

        // Cover the viewport plus enough margin for shadows cast from off-screen.
        const reach = Math.hypot(width, height) / 2 + 220;
        const cam = sun.shadow.camera;
        cam.left = -reach;
        cam.right = reach;
        cam.top = reach;
        cam.bottom = -reach;
        cam.near = 1;
        cam.far = 2400;
        cam.updateProjectionMatrix();

        ground.scale.set(width + 600, height + 600, 1);
    }

    /** Point the camera at the current scroll position, plus any impact shake. */
    function sync(dt) {
        if (shake.mag > 0.01) {
            shake.mag = Math.max(0, shake.mag - shake.mag * 9 * dt - 12 * dt);
            shake.x = (Math.random() * 2 - 1) * shake.mag;
            shake.y = (Math.random() * 2 - 1) * shake.mag;
        } else {
            shake.mag = shake.x = shake.y = 0;
        }

        const cx = window.scrollX + width / 2 + shake.x;
        const cy = window.scrollY + height / 2 + shake.y;
        camera.position.x = cx;
        camera.position.y = toWorldY(cy);
        rig.position.set(cx, toWorldY(cy), 0);
        ground.position.set(cx, toWorldY(cy), 0);
    }

    function addShake(mag) {
        shake.mag = Math.min(26, shake.mag + mag);
    }

    function setTheme(dark) {
        shadowMat.opacity = dark ? 0.42 : 0.24;
        shadowMat.color.setHex(dark ? 0x000000 : 0x2a1c12);
    }

    function render() {
        renderer.render(scene, camera);
    }

    function dispose() {
        ground.geometry.dispose();
        shadowMat.dispose();
        renderer.dispose();
        canvas.remove();
    }

    resize();

    return {
        canvas, renderer, scene, camera,
        resize, sync, render, addShake, setTheme, dispose,
        get width() { return width; },
        get height() { return height; },
    };
}
