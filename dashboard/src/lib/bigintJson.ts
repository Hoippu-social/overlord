// Make BigInt JSON-serialisable (Prisma raw queries can return BigInt counts).
// Importing this module applies the patch exactly once per process.
//
// Usage: `import '@/lib/bigintJson';` at the top of a route that serialises BigInt.

if (typeof (BigInt.prototype as { toJSON?: unknown }).toJSON !== 'function') {
    (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
        return this.toString();
    };
}

export {};
