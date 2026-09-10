# adamvonkannewurff.me

Personal site. Plain static HTML/CSS/JS served by GitHub Pages from `main`, with `CNAME` pointing
at the custom domain. There is no build step — what's in the repo is what ships.

```
index.html      the entire site: markup + all CSS inlined
js/main.js      progressive enhancement (scroll reveal, theme toggle, footer year)
js/tank/        the tank easter egg (see below)
css/tank.css    tank easter egg styles, injected at runtime
vendor/         pinned, self-hosted Three.js build
public/         resume PDF + project images
```

## Running locally

`index.html` loads `js/main.js` as an ES module, so opening the file directly over `file://` will
fail CORS. It has to be served over HTTP.

```sh
node serve.mjs        # http://localhost:8000  (or: npm run dev)
node serve.mjs 4000   # pick a port

./serve.sh            # same thing via python3, if you'd rather not use node
```

`serve.mjs` has no dependencies — it's plain Node built-ins — and behaves the same on Windows,
WSL, macOS, and inside a container. `npm install` is *not* needed to run the site.

### From Windows

The repo lives on the Windows drive, so the simplest option is to skip containers entirely. In
PowerShell:

```powershell
cd C:\Users\<you>\...\Repos\avonkannewurff.github.io
node serve.mjs          # or:  py -m http.server 8000
```

Then open <http://localhost:8000>.

### From a Docker container

Two things have to line up, and the first one is easy to miss:

1. **Bind to `0.0.0.0`, not `127.0.0.1`.** Inside a container, `127.0.0.1` means *that container's*
   loopback, so the port looks dead from the host. Both servers here detect `/.dockerenv` and
   default to `0.0.0.0` automatically; you can force it with `node serve.mjs 8000 0.0.0.0`.

2. **The port must be published**, and that can only be set when the container is *created* — you
   can't add a mapping to a running container. Check from the host with `docker ps`; you want to see
   `0.0.0.0:8000->8000/tcp` in the PORTS column. If it isn't there, recreate the container with
   `-p 8000:8000` (or add a `ports:` entry in `docker-compose.yml`).

With both in place, <http://localhost:8000> works from the Windows browser — Docker Desktop's WSL2
backend forwards published ports to Windows `localhost` for you.

## Deploying

GitHub Pages serves `main` directly, so `main` is production. Do work on a branch, verify it
locally, then merge:

```sh
git checkout -b feat/whatever
./serve.sh                    # check it
git checkout main && git merge feat/whatever && git push
```

## The tank

A drivable 3D tank rolls onto the page a second or two after load and can progressively blow the
page apart. It's an easter egg, and it's built to never get in the way:

| key | action |
| --- | --- |
| `W` `A` `S` `D` / arrows | drive — forward, rotate left, reverse, rotate right |
| mouse | aim the turret (optional; it follows the hull if you don't) |
| `Space` (tap) | fire a shell |
| `Space` (hold) | charge and lob a mortar — the longer you hold, the further it flies |
| `R` | repair the page — **works even after the tank is stowed** |
| `M` | mute / unmute the sound effects (remembered) |
| `Esc` | stow the tank |

The **tank button in the nav bar** summons the tank; while it's out, pressing it repairs the page
and sends the tank round again from the start. Stowing is `Esc`, the toast's ✕, or — on touch — the
small ✕ above the fire button.

Hits score points, with a combo multiplier that builds while you keep landing shots and lapses
after a couple of seconds of quiet. The running total follows the tank around; your best is kept in
`localStorage`, and once there's real damage the badge shows how much of the page is gone.

**Level the whole page** — all 84 shootable elements — and you get confetti, a "100% page cleared"
card, and a five-second countdown that repairs everything and starts you over.

On touch devices you get an on-screen joystick, a fire button (hold it to lob), and a stow button
instead of the keyboard.

Sound effects are synthesized with WebAudio — no audio files, and no `AudioContext` is created at
all until your first keypress or tap, so nothing trips the browser's autoplay rules.

Guardrails worth knowing about:

- **Nothing loads until after `window.load`**, and then only during idle time. Three.js is never on
  the critical path — first paint, LCP, and interactivity are identical to the site without it.
- It **skips loading entirely** — Three.js is never even fetched — when the visitor prefers reduced
  motion, has stowed it earlier in the session, or has no WebGL. The nav button still works in
  those cases and pays the download on click.
- The canvas is `pointer-events: none`, so every link, button, and scroll gesture on the real site
  keeps working while the tank is out.
- Destroyed elements are hidden, never removed from layout, so nothing on the page ever shifts.
  `R` puts it all back; a reload does too.
- `index.html` is untouched by the feature. Everything is injected at runtime by `js/tank/boot.js`.

### Refreshing the vendored Three.js

Three.js is self-hosted in `vendor/` so the site stays dependency-free at runtime, works offline,
and leaks no visitor IPs to a CDN. `package.json` pins the version for reproducibility; nothing at
runtime reads `node_modules`.

```sh
npm run vendor:three
```
