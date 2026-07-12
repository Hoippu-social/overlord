// Signed local-session token helpers (password-login session).
//
// The token is `${base64url(payloadJson)}.${base64url(hmac)}` where the HMAC is
// computed over the payload bytes with HMAC-SHA256 keyed by NEXTAUTH_SECRET.
// Implemented with Web Crypto (`crypto.subtle`) so it runs in both the Edge
// middleware runtime and the Node.js API-route runtime.

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type LocalSessionPayload = {
    iat: number;
    exp: number;
};

function getSecret(): string | null {
    const secret = process.env.NEXTAUTH_SECRET;
    return typeof secret === 'string' && secret.length > 0 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function importKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

async function sign(payloadBytes: Uint8Array, secret: string): Promise<Uint8Array> {
    const key = await importKey(secret);
    // BufferSource cast keeps TS happy across edge/node lib typings.
    const sig = await crypto.subtle.sign('HMAC', key, payloadBytes as unknown as ArrayBuffer);
    return new Uint8Array(sig);
}

// Constant-time comparison of two byte arrays.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

export async function createLocalSessionToken(): Promise<string | null> {
    const secret = getSecret();
    if (!secret) {
        return null;
    }

    const now = Date.now();
    const payload: LocalSessionPayload = { iat: now, exp: now + SESSION_TTL_MS };
    const payloadBytes = encoder.encode(JSON.stringify(payload));
    const sig = await sign(payloadBytes, secret);

    return `${toBase64Url(payloadBytes)}.${toBase64Url(sig)}`;
}

export async function verifyLocalSessionToken(token: string | undefined | null): Promise<boolean> {
    if (!token) {
        return false;
    }

    const secret = getSecret();
    if (!secret) {
        return false;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return false;
    }

    const [payloadPart, sigPart] = parts;

    let payloadBytes: Uint8Array;
    let providedSig: Uint8Array;
    try {
        payloadBytes = fromBase64Url(payloadPart);
        providedSig = fromBase64Url(sigPart);
    } catch {
        return false;
    }

    const expectedSig = await sign(payloadBytes, secret);
    if (!timingSafeEqual(providedSig, expectedSig)) {
        return false;
    }

    try {
        const payload = JSON.parse(decoder.decode(payloadBytes)) as LocalSessionPayload;
        if (typeof payload?.exp !== 'number') {
            return false;
        }
        return Date.now() < payload.exp;
    } catch {
        return false;
    }
}
