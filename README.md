> 🌐 **Versão em Português:** [Leia o README em Português](README_PT.md)

---

# CriptoVéu

Public and open-source 100% client-side web application to protect files, messages, QR codes, links, images with steganography, and notes directly in the browser.

CriptoVéu was built with privacy in mind: files, passwords, messages, and notes are processed on the user's device, without uploading sensitive data to the application's servers.

**Production site:** https://www.criptoveu.com/

**Repository:** https://github.com/Alexh0102/Projeto_Criptoveu

**Android app:** [Download the latest APK](https://github.com/Alexh0102/Projeto_Criptoveu/releases/latest/download/CriptoVeu.apk)

> Important notice: CriptoVéu must not be considered a “100% secure” solution or a substitute for a formal cryptographic audit. Final security depends on the selected password, device, browser, integrity of the JavaScript delivered to the user, and execution environment.

---

## Summary

CriptoVéu provides simple tools for encrypting, decrypting, and sharing protected content in a **100% client-side** environment.

The application uses the browser's native **Web Crypto API** for authenticated **AES-GCM** encryption. New files, messages, QR codes, protected links, and VéuNotes vaults use **Argon2id in WebAssembly**, running inside a **Web Worker**. Earlier V1 formats using PBKDF2/SHA-256 remain supported for reading.

Main features:

- Local file encryption and decryption.
- Chunked processing for large files.
- Recoverable XOR parity for one damaged data ciphertext per group.
- Local preview of decrypted files when supported by the browser, including an advanced video player.
- Long-key generation in the style used by formats such as `.crypt15`.
- Password-protected QR codes.
- Protected links with expiration embedded in the payload and a view limit controlled locally by the browser.
- Steganography for hiding protected messages inside images.
- VéuNotes, a portable vault for multiple encrypted notes.
- Local browser diagnostics for HTTPS, Web Crypto, WebAssembly, Workers, and Argon2id memory profiles.
- PWA support with a service worker for controlled application-shell caching.

---

## Available tools

| Route | Tool | Description |
|---|---|---|
| `/arquivos` | File encryption | Protects or decrypts local files with a password. |
| `/qr-secreto` | Protected QR | Creates and reads QR codes containing encrypted messages. |
| `/link-secreto` | Protected link | Generates links with an encrypted message in the URL hash. |
| `/esteganografia` | Hidden message | Hides or reveals protected messages in images. |
| `/veu-notes` | VéuNotes | Organizes multiple notes in a local vault exportable as `.criptoveu-note`. |
| `/diagnostico-navegador` | Browser diagnostics | Checks local compatibility and recommends Argon2id memory profiles. |
| `/seguranca` | Security | Explains the project's security model. |
| `/detalhes-tecnicos` | Technical details | Presents implementation details. |

---

## Technology highlights

- AES-256-GCM via the Web Crypto API.
- Argon2id v1.3 via WebAssembly in Web Workers (`hash-wasm`).
- 2 MB chunked file processing with an encrypted integrity manifest (V4/V5/V6).
- OPFS-backed file encryption and decryption in a dedicated Web Worker when `createSyncAccessHandle` is available.
- Local media previews use object URLs from the recovered file without Base64 conversion or whole-file ArrayBuffer loading.
- Dual protection with password + key file (V5).
- Recoverable XOR parity for one damaged ciphertext per group (V6).
- Portable encrypted note vault (VéuNotes / `PORTABLE_VAULT1`).
- URL hash payload serialization for links and QR codes; payloads are never sent in HTTP requests.
- LSB steganography for PNG images.
- Strict security headers, including CSP with Trusted Types, COOP, and COEP.

Additional technologies:

- React 18 with TypeScript.
- Vite 7 for development, builds, and previews.
- React Router DOM for client-side navigation.
- Tailwind CSS and PostCSS for styling.
- `lucide-react` for icons.
- `qrcode` for QR code generation.
- `jsqr` for reading QR codes from images.
- Service Worker and Web App Manifest for the PWA experience.
- ESLint with React Hooks, React Refresh, and TypeScript rules.

---

## Cryptography by tool

| Tool | Cryptography | Key derivation | Storage / output |
|---|---|---|---|
| V5 files with dual protection | AES-256-GCM + encrypted SHA-256 manifest | SHA-256 of password + key file, followed by Argon2id | `.criptoveu` file |
| V6 files with recoverable parity | AES-256-GCM + encrypted SHA-256 manifest + local XOR parity | Argon2id v1.3 via WASM in a Web Worker | `.criptoveu` file |
| V4 files | AES-256-GCM + encrypted SHA-256 manifest | Argon2id v1.3 via WASM in a Web Worker | `.criptoveu` file |
| Legacy files | AES-GCM | Argon2id in `CRIPTOVEU3`; PBKDF2/SHA-256 in earlier formats | `CRIPTOVEU3`, `CRIPTOVEU2`, `CRIPTIFY2`, and `CRIPTIFY1` packages |
| `MSG2` messages | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | `CVM2` payload |
| Protected `QR2` QR codes | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | `CVQ2` payload in the URL hash |
| Protected `LINK2` links | AES-256-GCM | Argon2id, 64 MB, `t=2`, `p=1` | `CVL2` payload in the URL hash |
| Steganography | `MSG2` message protected before hiding | Argon2id, 64 MB, `t=2`, `p=1` | PNG image with hidden data |
| VéuNotes `NOTE2`/`NOTE3` + `PORTABLE_VAULT1` | AES-256-GCM; NOTE3 adds XOR parity | Argon2id, 128 MB, `t=2`, `p=1` | `localStorage` and `.criptoveu-note` file |
| Legacy V1 formats | AES-GCM | PBKDF2/SHA-256 | Read-compatible; new creations use V2 |

---

## How it works

### Files

The file tool accepts multiple files in protection mode and creates `.criptoveu` packages.

Encryption and decryption take place in chunks of up to **2 MB**. On browsers that support OPFS synchronous access handles, the dedicated worker writes each record directly to temporary OPFS storage instead of accumulating the package or recovered file in RAM. The temporary entry is flushed, closed, converted to a `File` snapshot, and removed after the result is handed back to the application.

The OPFS path removes the previous fixed 1 GB application limit. Its practical boundary is the storage quota available to the browser, while memory remains proportional to the active chunk, authentication data, and selected Argon2id profile rather than to the total file size. On browsers without the required OPFS API, the compatibility fallback remains available with a conservative 1 GB safety guard.

Current V4/V5/V6 package format:

```text
CRIPTOVEU[4|5|6] + ram_mb_ascii + passes_ascii + salt + initial_iv
  + chunk_size + block_count
  + [data_type + ciphertext_size + ciphertext]...
  + [parity_type + parity_size + parity]... (V6 only, after each group of up to 4 data blocks)
  + [manifest_type + ciphertext_size + encrypted_manifest]
```

V4, V5, and V6 header structure:

```text
offset  size   field
0       10     signature: "CRIPTOVEU4", "CRIPTOVEU5", or "CRIPTOVEU6"
10      4      Argon2id RAM in MB, decimal ASCII
14      4      Argon2id passes, decimal ASCII
18      16     salt
34      12     initial IV
46      4      chunk size in bytes
50      4      block count
54      ...    data and manifest records
```

Technical details:

- Algorithm: **AES-256-GCM**.
- Key derivation for new files: **Argon2id v1.3 via WASM in a Web Worker**.
- Argon2id parameters: `t=2`, `p=1`.
- Argon2id memory profiles: **64 MB**, **256 MB** by default, or **512 MB**.
- Memory selection is cached only for creating new files.
- The V4/V5/V6 header records RAM, passes, salt, initial IV, chunk size, and block count.
- Decryption reads parameters directly from the package and does not depend on `localStorage`.
- Each block is up to 2 MB.
- The fixed header, type, index, and size of each record are included in AAD to reject tampering, reordering, and truncation.
- The first block uses the IV stored in the header.
- Subsequent records use unique IVs derived from the initial IV and index; the manifest uses the index immediately after the last block.
- In V6, each group of up to four encrypted data blocks is followed by an XOR parity record. One damaged data ciphertext per group can be reconstructed before AES-GCM and SHA-256 verification; multiple damaged blocks or damaged parity cannot be recovered.
- The **Integrity Shield** calculates SHA-256 for the complete file and each block in a separate Web Worker.
- The manifest stores the original name, MIME type, size, hashes, algorithms, and Argon2id parameters. It is encrypted and authenticated as the final package record.
- After recovery, the browser recalculates content hashes and confirms integrity only when all hashes match.
- Password-free inspection validates only package structure and uses the phrase **plausible structure**. Authenticity requires the correct password.
- Each result can produce a local JSON report containing the format, KDF, Argon2id parameters, block count, and verification status.
- Reading remains compatible with `CRIPTOVEU3`, `CRIPTOVEU2`, `CRIPTIFY2`, and `CRIPTIFY1`.
- V6 recoverable parity cannot be combined with the V5 key-file protection; choose one protection mode per package.
- With OPFS, the practical limit is the available local storage and browser quota. The fallback path is limited to **1 GB**.

In the Capacitor Android app, completed results are exported to `Download/` through the native Filesystem plugin, one 2 MB Base64-encoded slice at a time. On Android versions where `ExternalStorage` is unavailable, the WebView download manager is used as a fallback.

> Note: the manifest SHA-256 complements AES-GCM authentication and enables explicit post-recovery verification. It does not replace AES-GCM or make a password-free structure “verified.”

#### Dual protection with a key file

When **Password + key file** is enabled, new files use the `CRIPTOVEU5` signature. The remaining block, AAD, and manifest structure follows the authenticated V4 design, but the Argon2id key depends on both factors.

The KDF material is built locally as follows:

```text
key_file_hash = SHA-256(exact_key_file_bytes)
material = SHA-256(
  "CriptoVeu:password-key-file:v1"
  || 0x00
  || password_utf8_length_as_uint32_be
  || password_utf8
  || key_file_hash
)
aes_key = Argon2id(material_hex, package_salt, header_parameters)
```

Security rules:

- The key file must be between 1 byte and 32 MB.
- The file name does not participate in derivation; only the exact bytes matter.
- The file, name, hash, and combined material are **not embedded** in the package or report.
- The V5 signature indicates only that a key file is required.
- The same key file may be renamed, but changing any byte prevents opening the package.
- The password and key file should be stored and shared separately.
- Losing either factor makes recovery impossible.
- A public or predictable key file provides little protection against an attacker who already has access to it.

Files without a key file or recoverable parity are created as `CRIPTOVEU4` by default. Key-file protection creates `CRIPTOVEU5`, and recoverable parity creates `CRIPTOVEU6`. Reading V4, V5, V6, and all previous formats remains supported.

#### Recoverable parity with `CRIPTOVEU6`

When **Recoverable mode with parity** is enabled, new files use the `CRIPTOVEU6` signature. The package keeps the V4/V5/V6 authenticated header, encrypted manifest, and SHA-256 verification, while adding one local XOR parity record after each group of up to four encrypted data blocks. If one data ciphertext in a group is damaged but the other data ciphertexts and parity remain intact, the application reconstructs that ciphertext and then verifies it with AES-GCM and the final manifest hashes.

Parity is redundancy, not a replacement for encryption or a backup. It cannot recover two damaged data blocks in the same group, a damaged parity record, a deleted record, or a lost password. The mode cannot be combined with a key file and adds roughly 25% overhead for full four-block groups.
---

### Decrypted media preview

Decrypted media is previewed locally from the recovered `File`/`Blob` through `URL.createObjectURL`. The preview never converts the media to Base64 or loads the entire file into a JavaScript `ArrayBuffer`. The temporary object URL is revoked when the preview closes or unmounts.

File encryption/decryption and video preview limits are selected from the runtime platform:

| Environment | Maximum total size per batch |
|---|---:|
| Conventional desktop browser (web) | **5 GB** |
| PWA (installed, standalone mode) | **1 GB** |
| Capacitor Android/iOS or touch mobile browser | **1 GB** |

Other media keeps the existing conservative preview limits: **100 MB** on the web, **50 MB** in the native app, and **5 MB** for text. Files above their applicable limit remain available for download but are not opened in the browser player.

The video player displays a loading notice and spinner until metadata or playback is available. It provides a seek timeline, elapsed/total time, 10-second rewind and fast-forward controls, playback rates of **0.5x, 1.0x, 1.25x, 1.5x, and 2.0x**, and native fullscreen. On desktop, `Space` toggles play/pause, the left and right arrows seek by 10 seconds, and `F` toggles fullscreen.

If the browser or WebView cannot decode the video's format or codec, the player is replaced with an explanation and the user is directed to download the decrypted file for playback in VLC or the device's native media player.

---

### Messages, QR codes, and protected links

Messages are encrypted locally with AES-256-GCM and serialized into CriptoVéu payloads. New creations use Argon2id inside a Web Worker:

- `CVM2.` / `MSG2` for protected messages and steganography.
- `CVQ2.` / `QR2` for protected QR codes.
- `CVL2.` / `LINK2` for protected links.
- **64 MB** of memory, `t=2`, and `p=1`.
- Random 16-byte salt and random 12-byte IV.
- Base64URL for the V2 envelope.

Protected QR codes point to `/qr-secreto` using the URL hash. Protected links use `/link-secreto`, also with data in the URL hash.

Important:

- The URL hash is not sent to the server in traditional HTTP requests.
- Anyone who receives the link or QR code has access to the encrypted payload.
- The password or key is never included in the link or QR code and must be shared separately.
- Actual protection depends on the password used to open the message.
- Type, version, KDF, Argon2id parameters, and, for `LINK2`, creation time, expiration, and view limit are included in AES-GCM AAD.
- Changing the ciphertext, IV, salt, or authenticated metadata causes opening to fail.
- Earlier V1 payloads using **PBKDF2/SHA-256 and 600,000 iterations** remain readable but are no longer generated.

#### Credential generator and strength meter

File, link, QR code, and VéuNotes creation flows share a local security panel with three options:

- Passphrase with eight non-repeating words and a numeric suffix.
- Random 24-character password with letters, numbers, and symbols.
- Maximum-strength key with **32 random bytes**, displayed as 64 hexadecimal characters for a total of **256 bits**.

All randomness uses `crypto.getRandomValues`, with rejection sampling to avoid modulo bias. There is no `Math.random`, external library, API, telemetry, or credential persistence.

The meter for manually entered values is deliberately heuristic. It considers length and variety, while penalizing common words, sequences, repetitions, years, low diversity, the project name, and short passwords masked by symbols. Its rating guides the user but is not a mathematical proof of entropy.

When CriptoVéu generates the credential, the interface distinguishes known process randomness from the human-entered estimate. The credential can be revealed and copied locally, is never stored, and never enters a shared link or QR payload.

#### Expiration and view limits

Because CriptoVéu does not use a database for global state, the protected-link view limit is controlled locally by the browser that opens the link.

This means:

- The limit can act as local protection against reopening in the same browser.
- It does not prevent the same payload from being opened in another browser, device, or copy of the link.
- It must not be treated as a guaranteed server-enforced global single view.

---

### Steganography

The steganography tool uses a local image, browser canvas, and LSB on RGB channels to insert a protected message.

The output is a PNG image containing hidden data. The message should be protected with a password before it is hidden.

Applied limits:

- Input image up to **10 MB**.
- Maximum resolution of **20 million pixels**.
- Image capacity is validated before writing the message.

---

### VéuNotes

VéuNotes organizes multiple notes in an encrypted `localStorage` vault and allows exporting the same content as a portable `.criptoveu-note` file. Titles, text, labels, and identifiers remain inside the ciphertext; search happens locally only after unlocking.

The envelope is encrypted with AES-256-GCM and protected by a master password. Standard vaults use `NOTE2` externally; **Recoverable mode with parity** uses `NOTE3`. Both contain the authenticated `PORTABLE_VAULT1` document internally.

Main parameters:

- Minimum password: **12 characters**.
- Argon2id in a Web Worker with **128 MB**, `t=2`, and `p=1`.
- Standard mode stores one authenticated ciphertext in `NOTE2`.
- Recoverable mode stores two authenticated ciphertexts with independent IVs plus an XOR parity value in `NOTE3`. One damaged ciphertext can be reconstructed if the other ciphertext and parity remain intact; the resulting plaintext still must pass AES-GCM and vault validation.
- Recoverable mode makes the encrypted envelope approximately three times larger and cannot recover two damaged ciphertexts, damaged parity, or a lost password.
- Type, version, and KDF parameters are authenticated as AAD.
- Up to **500 notes**, with titles, content, and up to 12 labels per note.
- Local search by title, text, or label only during an unlocked session.
- Automatic locking after inactivity or while the tab remains in the background.
- Password changes require confirmation of the current password and use a new Argon2id salt.
- Export to `.criptoveu-note`; older JSON backups remain accepted.
- `NOTE1` vaults using PBKDF2 remain readable.
- `NOTE2` and `NOTE3` vaults remain readable, and the recovery mode can be toggled after unlocking.
- After successful legacy opening, the single note is converted into a portable-vault note and re-encrypted as `NOTE2`; the old blob is replaced only after re-encryption finishes.
- Imports validate size, allowed fields, limits, and AES-GCM authentication before replacing the local vault.

The portable file does not contain the password and cannot provide recovery without it. Backups exported before a password change remain protected by the old password.

---

## Tests and public vectors

Directories under `test-vectors/` contain reproducible vectors for `MSG2`, `QR2`, `LINK2`, and `NOTE2`, including the test password, salt, IV, AAD, and expected ciphertext.

Fixed salts and IVs exist only in these vectors. Production always uses `crypto.getRandomValues`.

The automated suite checks V1 compatibility, `NOTE1` migration, `NOTE3` parity recovery, incorrect passwords, truncated payloads, and tampering of ciphertext, IV, salt, type, version, KDF, Argon2id parameters, expiration, and limits. File tests also cover `CRIPTOVEU6` recovery of one damaged data block and rejection when parity cannot recover the group.

Generator tests check the actual 256-bit key size, random-password character classes, passphrase structure, sample uniqueness, Web Crypto usage, and weak-pattern detection.

> Warning: `localStorage` belongs to the current browser and may be deleted by the user, system, extensions, data cleanup, or browser policies. Create a backup when necessary.

---

## Threat model

CriptoVéu is designed to reduce sensitive-data exposure in web tools, keeping files, messages, notes, and passwords on the user's device whenever possible.

### What the project aims to protect

- File, message, and note contents from reading without the correct password.
- Sensitive data from being uploaded to application servers.
- Encrypted packages from tampering, truncation, and corruption through AES-GCM authentication.
- Offline attacks against new file packages by making password attempts more expensive with Argon2id and explicit memory use.
- Accidental exposure of link and QR payloads, provided the password has sufficient entropy.

### Out of scope

- Devices compromised by malware, keyloggers, screen recorders, or malicious extensions.
- Weak, reused, or insecurely shared passwords.
- Public, predictable, lost, or copied key files shared together with the package and password.
- Compromise of the domain, build pipeline, hosting provider, deployment account, or JavaScript served to the browser.
- Phishing with fake copies of the application.
- Content recovery when the password is lost.
- A global expiration or single-view guarantee for links, since no database or server controls global state.
- Protection against every future model of quantum computing.

### Security assumptions

- The user accesses the official domain over HTTPS.
- The browser correctly implements the Web Crypto API.
- JavaScript delivered to the user is intact.
- The user chooses strong and unique passwords.
- The user's device is not compromised.

---

## Security level

CriptoVéu adopts a strong security model for a client-side application, but its limits are important to understand.

Security depends mainly on:

- The strength of the user's selected password.
- The integrity of JavaScript served by the official domain.
- HTTPS or localhost, required for secure Web Crypto API access.
- Sensitive data not being sent to application servers.
- The security of the user's device and browser.

Implemented measures:

- Local processing for files, messages, and notes.
- Passwords are not stored by the application.
- Cryptographic keys are derived in the browser.
- New file packages use Argon2id with explicit memory cost in the header.
- AES-GCM provides confidentiality and content authentication.
- `salt` and `iv` are generated with `crypto.getRandomValues`.
- Processing is blocked outside secure contexts such as HTTPS pages.
- Size validation for files, images, QR codes, and backups.
- Error handling for incorrect passwords, invalid files, and corrupted payloads.
- Local previews using temporary URLs created in the browser.

Headers and hardening policies are configured in `vercel.json` and `netlify.toml`:

- Restrictive Content Security Policy.
- Strict-Transport-Security.
- Cross-Origin-Opener-Policy.
- Cross-Origin-Embedder-Policy.
- Cross-Origin-Resource-Policy.
- Referrer-Policy: `no-referrer`.
- Permissions-Policy with sensitive features disabled.
- X-Frame-Options: `DENY`.
- X-Content-Type-Options: `nosniff`.
- `frame-ancestors 'none'`.
- `object-src 'none'`.
- Conservative HTML caching and long caching for versioned assets.

Build hardening:

- Production builds without source maps.
- esbuild minification.
- Removal of `console` and `debugger` in the build.
- Modern `es2022` target.

---

## Important limitations

No client-side web application can completely hide its own code because the browser must receive executable JavaScript. Therefore, the project avoids depending on secrets embedded in the frontend.

CriptoVéu should not be considered a substitute for a formal cryptographic audit. It uses solid browser primitives, but final protection still depends on the password, device, browser, and deployment integrity.

Argon2id makes parallel brute-force attacks more difficult by requiring memory per attempt. AES-256 is considered a prudent choice against known quantum models, but the project does not claim absolute quantum resistance. Low-entropy passwords remain vulnerable to guessing.

Also remember:

- If the password is lost, content cannot be recovered.
- Links and QR codes carry encrypted payloads; share them only with authorized people.
- Protected-link view limits are controlled locally by the browser that opens the link.
- VéuNotes `localStorage` belongs to the current browser and may be deleted by the user, system, or browser policies.
- The project does not currently use post-quantum KEMs for key exchange between users. Password-based tools depend mainly on password entropy and KDF cost.

---

## Security auditing and contributions

This project is open source, and security reviews are welcome.

Especially important review areas include:

- Correct use of AES-GCM and unique IVs.
- `salt` and `iv` generation with `crypto.getRandomValues`.
- Key derivation with Argon2id and PBKDF2.
- Payload, header, and size validation.
- Authentication of additional data, especially in file blocks.
- Service Worker and cache-policy security.
- CSP and security headers.
- XSS and DOM-manipulation risks.
- `localStorage` security in VéuNotes.
- Compatibility and security of legacy formats.

To report vulnerabilities or discuss security improvements, see [`SECURITY.md`](SECURITY.md) in this repository.

---

## Roadmap

Future ideas and improvements planned or under consideration:

- [ ] Ephemeral encrypted chat without a database.
- [ ] Pairing through a temporary room ID.
- [ ] WebSocket or WebRTC DataChannel transport.
- [ ] End-to-end encryption in the browser.
- [ ] Classical/post-quantum hybrid key exchange for chat.
- [ ] Manual session-fingerprint verification.
- [x] Migration of messages, QR codes, links, and VéuNotes to Argon2id while keeping V1 payloads readable.
- [x] Integrity Shield for files with `CRIPTOVEU4`, encrypted manifest, post-recovery verification, structural inspector, and local report.
- [x] Local passphrase, password, and 256-bit key generator with heuristic meter and weak-pattern warnings.
- [x] Dual file protection with password + key file in `CRIPTOVEU5`.
- [x] Recoverable file packages with local XOR parity in `CRIPTOVEU6`.
- [x] VéuNotes portable vault with multiple notes, labels, local search, password changes, and `.criptoveu-note` files.
- [x] Recoverable VéuNotes envelopes with XOR parity in `NOTE3`.
- [x] Browser diagnostics with local checks of critical APIs and conservative Argon2id profile recommendations.

> Note about future chat: even without storing messages, a signaling or relay server may observe metadata such as IP address, time, session duration, and approximate packet size. This must be documented clearly when the feature is implemented.

---

## Requirements

- Node.js compatible with Vite 7.
- npm.
- Modern browser with Web Crypto API, Streams, Canvas, and Service Worker support.
- HTTPS in production.

Target browsers:

- Google Chrome.
- Microsoft Edge.
- Mozilla Firefox.
- Modern Safari, subject to practical browser-memory limits.

---

## Running locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Test the local build:

```bash
npm run preview
```

Run static analysis:

```bash
npm run lint
```

---

## Deployment

The project is prepared for deployment on Vercel and Netlify.

Expected configuration:

- Build command: `npm run build`.
- Install command: `npm ci`.
- Output directory: `dist`.
- SPA rewrites pointing routes to `index.html`.
- Security headers applied at the platform edge.

After deployment, validate:

- HTTPS is active.
- Security headers are present.
- File encryption and decryption.
- Protected QR generation and reading.
- Protected links.
- Steganography.
- VéuNotes.
- Browser diagnostics.
- PWA behavior.

---

## Project structure

```text
src/
  components/          Reusable interface components
  components/file-crypto/
                       File encryption, download, and preview area
  config/              Definitions of tools shown on the site
  context/             Theme and global providers
  hooks/               Processing, QR, and inactivity hooks
  lib/                 Cryptography, payloads, steganography, and storage
  pages/               Main pages and routes

public/
  service-worker.js    PWA service worker
  site.webmanifest     Application manifest
```

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
