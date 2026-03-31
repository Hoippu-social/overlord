import { ACCESS_PRESETS } from './constants';

const PRESET_META_PREFIX = '__preset_v2__|';

export type AccessPresetDefinition = {
    id: string;
    key: string;
    name: string;
    accessLevel: number;
    color: string | null;
    storageTitle: string;
    isBuiltin: boolean;
};

export const BUILTIN_PRESET_META: Record<string, { accessLevel: number; color: string }> = {
    Helper: { accessLevel: 25, color: '#60A5FA' },
    Moderator: { accessLevel: 50, color: '#FCD34D' },
    Control: { accessLevel: 70, color: '#F59E0B' },
    Admin: { accessLevel: 90, color: '#FB7185' },
};

const clampLevel = (level: number) => Math.max(0, Math.min(100, Math.round(level)));

export const normalizePresetName = (value: string) => value.trim();

export function normalizeHexColor(value: string | null | undefined) {
    if (!value) return null;
    const hex = value.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        return `#${hex.toUpperCase()}`;
    }
    return null;
}

export function parsePresetTitle(rawTitle: string) {
    const title = normalizePresetName(rawTitle);
    if (!title) {
        return {
            name: '',
            storageTitle: '',
            color: null as string | null,
            accessLevel: null as number | null,
            isBuiltin: false,
            key: '',
        };
    }

    const builtinMeta = BUILTIN_PRESET_META[title];
    if (builtinMeta) {
        return {
            name: title,
            storageTitle: title,
            color: builtinMeta.color,
            accessLevel: builtinMeta.accessLevel,
            isBuiltin: true,
            key: title.toLocaleLowerCase(),
        };
    }

    if (!title.startsWith(PRESET_META_PREFIX)) {
        return {
            name: title,
            storageTitle: title,
            color: null as string | null,
            accessLevel: null as number | null,
            isBuiltin: false,
            key: title.toLocaleLowerCase(),
        };
    }

    const [_, encodedName = '', levelRaw = '', colorRaw = ''] = title.split('|');
    let decodedName = encodedName || '';
    try {
        decodedName = decodeURIComponent(encodedName || '');
    } catch {
        decodedName = encodedName || '';
    }
    const name = normalizePresetName(decodedName);
    const parsedLevel = Number(levelRaw);
    const level = Number.isFinite(parsedLevel) ? clampLevel(parsedLevel) : null;
    const color = normalizeHexColor(colorRaw ? `#${colorRaw}` : null);

    if (!name) {
        return {
            name: title,
            storageTitle: title,
            color: null as string | null,
            accessLevel: null as number | null,
            isBuiltin: false,
            key: title.toLocaleLowerCase(),
        };
    }

    return {
        name,
        storageTitle: title,
        color,
        accessLevel: level,
        isBuiltin: false,
        key: name.toLocaleLowerCase(),
    };
}

export function buildPresetStorageTitle(input: { name: string; accessLevel: number; color: string | null }) {
    const name = normalizePresetName(input.name);
    if (!name) return '';

    if (ACCESS_PRESETS.includes(name)) {
        return name;
    }

    const level = clampLevel(input.accessLevel);
    const color = normalizeHexColor(input.color) ?? '#60A5FA';
    return `${PRESET_META_PREFIX}${encodeURIComponent(name)}|${level}|${color.slice(1)}`;
}

export function collectPresetDefinitions(
    roleBindings: Array<{ title: string; accessLevel: number }>,
) {
    const presetsByKey = new Map<string, AccessPresetDefinition>();

    for (const presetName of ACCESS_PRESETS) {
        const meta = BUILTIN_PRESET_META[presetName] ?? { accessLevel: 50, color: '#FFFFFF' };
        presetsByKey.set(presetName.toLocaleLowerCase(), {
            id: `preset:${presetName.toLocaleLowerCase()}`,
            key: presetName.toLocaleLowerCase(),
            name: presetName,
            accessLevel: meta.accessLevel,
            color: meta.color,
            storageTitle: presetName,
            isBuiltin: true,
        });
    }

    for (const binding of roleBindings) {
        const parsed = parsePresetTitle(binding.title);
        if (!parsed.name) continue;

        const level = parsed.accessLevel ?? clampLevel(binding.accessLevel);
        const existing = presetsByKey.get(parsed.key);

        if (!existing) {
            presetsByKey.set(parsed.key, {
                id: `preset:${parsed.key}`,
                key: parsed.key,
                name: parsed.name,
                accessLevel: level,
                color: parsed.color,
                storageTitle: parsed.storageTitle,
                isBuiltin: parsed.isBuiltin,
            });
            continue;
        }

        existing.accessLevel = Math.min(existing.accessLevel, level);
        if (!existing.color && parsed.color) {
            existing.color = parsed.color;
        }
        if (!existing.isBuiltin && parsed.storageTitle.startsWith(PRESET_META_PREFIX)) {
            existing.storageTitle = parsed.storageTitle;
        }
    }

    return Array.from(presetsByKey.values()).sort((left, right) => {
        if (left.accessLevel !== right.accessLevel) {
            return left.accessLevel - right.accessLevel;
        }
        return left.name.localeCompare(right.name);
    });
}
