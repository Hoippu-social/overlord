'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Input } from '@nextui-org/react';
import * as THREE from 'three';


import {
    MicrophoneStage, ChatText, Intersect, MagnifyingGlass, User,
    Cube, CornersOut, CornersIn, X
} from '@phosphor-icons/react';

import { useGuildLocale } from '@/lib/i18n';
import { usePersistentPeriod } from '@/hooks/usePersistentPeriod';

function GraphLoadingFallback() {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
        </div>
    );
}

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <GraphLoadingFallback />,
});

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <GraphLoadingFallback />,
});

const EDGE_COLORS: Record<string, string> = {
    reply: 'rgba(117,241,106,0.7)',
    mention: 'rgba(94,168,255,0.7)',
    voice: 'rgba(245,176,75,0.6)',
    mixed: 'rgba(143,94,255,0.65)',
};

const EDGE_COLORS_DIM = 'rgba(244,241,238,0.03)';

const ACCENT_LOW: [number, number, number] = [143, 94, 255];
const ACCENT_HIGH: [number, number, number] = [117, 241, 106];

const strings = {
    en: {
        voice: 'Voice', text: 'Text', mixed: 'Mixed',
        day7: '7 Days', day30: '30 Days', day90: '90 Days', day365: '365 Days',
        searchUser: 'Search user...', selectUser: 'Select a user to explore their network',
        noData: 'No interactions found for this period', loading: 'Building interaction graph...',
        fullMap: 'Full Map', egoMode: 'Ego Mode', activeUsers: 'active', connections: 'links',
        egoBanner: 'Large server - showing 2-level network for selected user',
        loadingGraph: 'Loading graph...',
        loading3D: 'Loading 3D graph...',
        reply: 'Reply',
        mention: 'Mention',
        nodeSizeActivity: 'Node size = activity',
        mode2D: '2D Mode',
        mode3D: '3D Mode',
        fullscreen: 'Toggle Fullscreen',
        score: 'score',
        deselect: 'Reset selection',
    },
    ru: {
        voice: 'Голос', text: 'Текст', mixed: 'Смешанный',
        day7: '7 дней', day30: '30 дней', day90: '90 дней', day365: '365 дней',
        searchUser: 'Поиск пользователя...', selectUser: 'Выберите пользователя для просмотра его связей',
        noData: 'Нет взаимодействий за этот период', loading: 'Строим граф связей...',
        fullMap: 'Полная карта', egoMode: 'Эго-режим', activeUsers: 'активных', connections: 'связей',
        egoBanner: 'Сервер большой - показываем 2 уровня связей выбранного пользователя',
        loadingGraph: 'Загружаем граф...',
        loading3D: 'Загружаем 3D граф...',
        reply: 'Ответ',
        mention: 'Упоминание',
        nodeSizeActivity: 'Размер узла = активность',
        mode2D: '2D режим',
        mode3D: '3D режим',
        fullscreen: 'Полный экран',
        score: 'счёт',
        deselect: 'Сбросить выбор',
    },
} as const;

interface GraphNode {
    id: string; name: string; avatar: string | null;
    activity: number; size: number; level?: number;
}
interface GraphEdge { source: string; target: string; weight: number; types: string[]; }
interface TopUser { id: string; name: string; avatar: string | null; activity: number; }
interface ContactsData {
    graphMode: 'full' | 'ego';
    uniqueActiveUsers: number;
    topUsers: TopUser[];
    nodes: GraphNode[];
    edges: GraphEdge[];
}

const avatarCache = new Map<string, HTMLImageElement>();
function loadAvatar(url: string): void {
    if (avatarCache.has(url)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => avatarCache.set(url, img);
    img.src = url;
}

function lerpAccent(t: number): [number, number, number] {
    return [
        Math.round(ACCENT_LOW[0] + (ACCENT_HIGH[0] - ACCENT_LOW[0]) * t),
        Math.round(ACCENT_LOW[1] + (ACCENT_HIGH[1] - ACCENT_LOW[1]) * t),
        Math.round(ACCENT_LOW[2] + (ACCENT_HIGH[2] - ACCENT_LOW[2]) * t),
    ];
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, radius);
    } else {
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default function ContactsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];

    const [period] = usePersistentPeriod('30d');
    const [mode, setMode] = useState<'voice' | 'text' | 'mixed'>('mixed');
    const [data, setData] = useState<ContactsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
    const [is3D, setIs3D] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [initialZoomDone, setInitialZoomDone] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef2D = useRef<any>(null);
    const graphRef3D = useRef<any>(null);
    const currentGraphRef = is3D ? graphRef3D : graphRef2D;

    // Fullscreen logic
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Responsive container
    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            for (const e of entries) {
                setDimensions({ w: e.contentRect.width, h: e.contentRect.height });
            }
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    // Fetch graph data
    useEffect(() => {
        setLoading(true);
        let url = `/api/guilds/${guildId}/stats/contacts?period=${period}&mode=${mode}`;
        if (selectedUserId) url += `&userId=${selectedUserId}`;

        fetch(url)
            .then(r => r.json())
            .then((d: ContactsData) => {
                setData(d);
                for (const node of d.nodes) {
                    if (node.avatar) loadAvatar(node.avatar);
                }
            })
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [guildId, period, mode, selectedUserId]);

    const showEgoSelector = data?.graphMode === 'ego' && !selectedUserId;

    const handleModeChange = (m: 'voice' | 'text' | 'mixed') => {
        setMode(m);
        setSelectedUserId(null);
    };

    const filteredTopUsers = useMemo(() => {
        if (!data?.topUsers) return [];
        const q = search.toLowerCase();
        return data.topUsers.filter(u => u.name.toLowerCase().includes(q));
    }, [data?.topUsers, search]);

    // Build graph data for react-force-graph
    const graphData = useMemo(() => {
        if (!data || data.nodes.length === 0) return { nodes: [], links: [] };
        const maxWeight = Math.max(...data.edges.map(e => e.weight), 1);
        const ranked = [...data.nodes].sort((a, b) => a.activity - b.activity);
        const rankById = new Map<string, number>();
        ranked.forEach((n, i) => rankById.set(n.id, ranked.length > 1 ? i / (ranked.length - 1) : 1));
        return {
            nodes: data.nodes.map(n => {
                const [r, g, b] = lerpAccent(rankById.get(n.id) ?? 0.5);
                return { ...n, _size: n.size, _accentRGB: `${r},${g},${b}` };
            }),
            links: data.edges.map(e => ({
                source: e.source,
                target: e.target,
                weight: e.weight,
                types: e.types,
                _width: Math.max(0.5, (e.weight / maxWeight) * 5),
            })),
        };
    }, [data]);

    const neighborsById = useMemo(() => {
        const m = new Map<string, Set<string>>();
        if (!data) return m;
        for (const e of data.edges) {
            if (!m.has(e.source)) m.set(e.source, new Set());
            if (!m.has(e.target)) m.set(e.target, new Set());
            m.get(e.source)!.add(e.target);
            m.get(e.target)!.add(e.source);
        }
        return m;
    }, [data]);

    const selectedNode = useMemo(() => {
        if (!selectedUserId || !data) return null;
        return data.nodes.find(n => n.id === selectedUserId)
            ?? data.topUsers.find(u => u.id === selectedUserId)
            ?? null;
    }, [selectedUserId, data]);

    const selectedLinkCount = useMemo(() => {
        if (!selectedUserId) return 0;
        return neighborsById.get(selectedUserId)?.size ?? 0;
    }, [selectedUserId, neighborsById]);

    // After physics settles, trigger zoom and set link distances
    const handleEngineStop = useCallback(() => {
        const fg = currentGraphRef.current;
        if (fg && !initialZoomDone) {
            try { fg.zoomToFit(400, 50); } catch (e) { }

            const maxW = Math.max(...graphData.links.map((l: any) => l.weight), 1);
            if (typeof fg.d3Force === 'function') {
                const linkForce = fg.d3Force('link');
                if (linkForce) {
                    linkForce.distance((link: any) => {
                        return Math.max(is3D ? 80 : 40, (is3D ? 400 : 200) - (link.weight / maxW) * (is3D ? 280 : 140));
                    });
                    try { fg.d3ReheatSimulation?.(); } catch (e) { }
                }
            }
            setInitialZoomDone(true);
        }
    }, [initialZoomDone, currentGraphRef, graphData.links, is3D]);

    // Reset initial zoom state when layouts change
    useEffect(() => {
        setInitialZoomDone(false);
    }, [graphData.links, is3D]);

    const isNodeDimmed = useCallback((id: string) => {
        if (!hoveredNode || hoveredNode === id) return false;
        return !neighborsById.get(hoveredNode)?.has(id);
    }, [hoveredNode, neighborsById]);

    // Custom node 3D renderer
    const createNodeThreeObject = useCallback((node: any) => {
        const { id, name, avatar, _size, _accentRGB } = node;
        const radius = _size || 4;
        const accent = _accentRGB || '143,94,255';

        const canvas = document.createElement('canvas');
        const imgSize = 120;
        const padding = 24;
        const textHeight = 44;
        canvas.width = imgSize + padding * 2;
        canvas.height = imgSize + padding * 2 + textHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Object3D();

        const isHovered = hoveredNode === id;
        const isSelected = selectedUserId === id;
        const dimmed = isNodeDimmed(id);

        const cx = canvas.width / 2;
        const cy = padding + imgSize / 2;
        const r = imgSize / 2 - 4;

        ctx.save();

        // Soft accent halo
        const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r + padding);
        halo.addColorStop(0, `rgba(${isSelected ? '117,241,106' : accent},${isSelected || isHovered ? 0.4 : 0.22})`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, r + padding, 0, Math.PI * 2);
        ctx.fill();

        // Clip region
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        // Background
        ctx.fillStyle = '#131315';
        ctx.fill();

        const img = avatar ? avatarCache.get(avatar) : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        } else {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, `rgba(${accent},0.28)`);
            g.addColorStop(1, '#121214');
            ctx.fillStyle = g;
            ctx.fill();

            ctx.fillStyle = 'rgba(244,241,238,0.75)';
            ctx.font = `bold ${r * 0.8}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((name || '?')[0].toUpperCase(), cx, cy);
        }

        ctx.restore();

        // Ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
            ? '#75F16A'
            : isHovered
                ? 'rgba(244,241,238,0.8)'
                : `rgba(${accent},0.55)`;
        ctx.lineWidth = isSelected || isHovered ? 5 : 3;
        ctx.stroke();

        // Label pill
        if (isHovered || isSelected || _size >= 6) {
            const label = name || id;
            ctx.font = `600 22px Inter, sans-serif`;
            const tw = ctx.measureText(label).width;
            const pillW = Math.min(tw + 28, canvas.width - 4);
            const pillH = 34;
            const pillX = cx - pillW / 2;
            const pillY = cy + r + 8;

            ctx.fillStyle = 'rgba(8,8,10,0.78)';
            drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
            ctx.fill();
            ctx.strokeStyle = isSelected ? 'rgba(117,241,106,0.4)' : 'rgba(244,241,238,0.12)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = 'rgba(244,241,238,0.95)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, pillY + pillH / 2, pillW - 20);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        const material = new THREE.SpriteMaterial({
            map: texture,
            depthTest: false,
            transparent: true,
            opacity: dimmed ? 0.14 : 1,
        });
        const sprite = new THREE.Sprite(material);

        const spriteScale = radius * 4;
        sprite.scale.set(spriteScale, spriteScale * (canvas.height / canvas.width), 1);
        sprite.renderOrder = isSelected || isHovered ? 1 : 0;

        return sprite;
    }, [hoveredNode, selectedUserId, isNodeDimmed]);

    // Custom node canvas renderer
    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y, _size, name, avatar, id, _accentRGB } = node;
        const isHovered = hoveredNode === id;
        const isSelected = selectedUserId === id;
        const dimmed = isNodeDimmed(id);
        const accent = _accentRGB || '143,94,255';
        const radius = (_size || 4) * 3.5;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return;

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.12 : 1;

        // Soft accent halo
        if (!dimmed) {
            const haloR = radius * (isHovered || isSelected ? 2.4 : 1.8);
            const halo = ctx.createRadialGradient(x, y, radius * 0.6, x, y, haloR);
            halo.addColorStop(0, `rgba(${isSelected ? '117,241,106' : accent},${isSelected || isHovered ? 0.35 : 0.16})`);
            halo.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(x, y, haloR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Clip to circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.save();
        ctx.clip();

        // Background
        ctx.fillStyle = '#131315';
        ctx.fill();

        // Avatar or fallback initials
        const img = avatar ? avatarCache.get(avatar) : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        } else {
            const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
            g.addColorStop(0, `rgba(${accent},0.28)`);
            g.addColorStop(1, '#121214');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.fillStyle = 'rgba(244,241,238,0.75)';
            ctx.font = `bold ${radius * 0.8}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((name || '?')[0].toUpperCase(), x, y);
        }

        ctx.restore();

        // Ring
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
            ? '#75F16A'
            : isHovered
                ? 'rgba(244,241,238,0.85)'
                : `rgba(${accent},0.5)`;
        ctx.lineWidth = isSelected || isHovered ? 2 : 1;
        ctx.stroke();

        // Label pill
        if (globalScale > 1.5 || isHovered || isSelected) {
            const label = name || id;
            const fs = Math.min(14, Math.max(8, radius * 0.6)) / globalScale;
            ctx.font = `600 ${fs}px Inter, sans-serif`;
            const tw = ctx.measureText(label).width;
            const padX = 6 / globalScale;
            const pillH = fs + 8 / globalScale;
            const pillW = tw + padX * 2;
            const pillX = x - pillW / 2;
            const pillY = y + radius + 3 / globalScale;

            ctx.fillStyle = 'rgba(8,8,10,0.72)';
            drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
            ctx.fill();
            ctx.strokeStyle = isSelected ? 'rgba(117,241,106,0.35)' : 'rgba(244,241,238,0.08)';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();

            ctx.fillStyle = 'rgba(244,241,238,0.92)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, pillY + pillH / 2);
        }

        ctx.restore();
    }, [hoveredNode, selectedUserId, isNodeDimmed]);

    // Node hit area
    const paintNodePointer = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const radius = (node._size || 4) * 3.5;
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(radius) || radius < 0) return;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }, []);

    const getLinkColor = useCallback((link: any) => {
        if (hoveredNode) {
            const srcId = typeof link.source === 'object' ? link.source?.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target?.id : link.target;
            if (srcId !== hoveredNode && tgtId !== hoveredNode) return EDGE_COLORS_DIM;
        }
        const types: string[] = link.types || [];
        const hasVoice = types.includes('voice');
        const hasText = types.includes('reply') || types.includes('mention');
        if (hasVoice && hasText) return EDGE_COLORS.mixed;
        if (hasVoice) return EDGE_COLORS.voice;
        if (types.includes('reply')) return EDGE_COLORS.reply;
        if (types.includes('mention')) return EDGE_COLORS.mention;
        return 'rgba(244,241,238,0.15)';
    }, [hoveredNode]);

    const getLinkWidth = useCallback((link: any) => link._width || 1, []);

    const nodeTooltip = useCallback((node: any) => {
        const name = escapeHtml(node.name || node.id || '');
        const avatarUrl = node.avatar ? escapeHtml(node.avatar) : null;
        const initial = escapeHtml(((node.name || '?')[0] || '?').toUpperCase());
        const accent = node._accentRGB || '143,94,255';
        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(${accent},0.6)" />`
            : `<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(${accent},0.16);border:1.5px solid rgba(${accent},0.5);color:rgba(244,241,238,0.85);font-weight:700;font-size:15px">${initial}</div>`;
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px 9px 9px;background:rgba(10,10,12,0.88);border:1px solid rgba(244,241,238,0.09);border-radius:999px;backdrop-filter:blur(14px);box-shadow:0 12px 40px rgba(0,0,0,0.55)">${avatarHtml}<div style="line-height:1.25"><div style="font-size:13px;font-weight:700;color:rgba(244,241,238,0.95)">${name}</div><div style="font-size:11px;color:rgba(244,241,238,0.45)">${t.score}: ${Number(node.activity) || 0}</div></div></div>`;
    }, [t]);

    const handleNodeClick = useCallback((node: any) => {
        setSelectedUserId((prev) => node?.id === prev ? null : (node?.id ?? null));
    }, []);

    const handleNodeHover = useCallback((node: any) => {
        setHoveredNode(node ? node.id : null);
    }, []);

    const ModeButton = ({ m, icon: Icon, label }: { m: 'voice' | 'text' | 'mixed'; icon: any; label: string }) => {
        const active = mode === m;
        return (
            <button
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex flex-none items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition-all duration-300 ${active
                    ? 'bg-gradient-to-r from-[#75f16a] to-[#9dff94] text-black shadow-[0_0_20px_rgba(117,241,106,0.35)]'
                    : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
                    }`}
            >
                <Icon size={15} weight={active ? 'fill' : 'regular'} />
                <span>{label}</span>
            </button>
        );
    };

    const legendItems = [
        ...(mode === 'voice' || mode === 'mixed' ? [{ color: EDGE_COLORS.voice, label: t.voice }] : []),
        ...(mode === 'text' || mode === 'mixed' ? [
            { color: EDGE_COLORS.reply, label: t.reply },
            { color: EDGE_COLORS.mention, label: t.mention },
        ] : []),
        ...(mode === 'mixed' ? [{ color: EDGE_COLORS.mixed, label: t.mixed }] : []),
    ];

    return (
        <div className="flex flex-col gap-3 px-3 pb-4 sm:gap-4 sm:px-0 sm:pb-6" style={{ height: 'calc(100dvh - 150px)', minHeight: 440 }}>
            <style>{`
                .graph-tooltip, .scene-tooltip {
                    background: transparent !important;
                    padding: 0 !important;
                    border: none !important;
                    color: inherit !important;
                    font-family: inherit !important;
                }
                @keyframes cgPulseRing {
                    0% { transform: scale(0.55); opacity: 0.9; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                @keyframes cgBreathe {
                    0%, 100% { opacity: 0.55; }
                    50% { opacity: 1; }
                }
            `}</style>

            {/* Controls */}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-divider bg-surface p-1 shadow-sm shadow-black/20 sm:rounded-full">
                        <ModeButton m="voice" icon={MicrophoneStage} label={t.voice} />
                        <ModeButton m="text" icon={ChatText} label={t.text} />
                        <ModeButton m="mixed" icon={Intersect} label={t.mixed} />
                    </div>
                </div>
            </div>

            {/* Ego mode user picker */}
            {!loading && data?.graphMode === 'ego' && (
                <div className="flex-shrink-0 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.015] p-4 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Intersect size={14} weight="bold" />
                        </div>
                        <p className="text-xs text-white/45">{t.egoBanner}</p>
                    </div>
                    <Input
                        placeholder={t.searchUser}
                        value={search}
                        onValueChange={setSearch}
                        startContent={<MagnifyingGlass size={14} className="text-white/30" />}
                        classNames={{
                            base: "mb-3 w-full sm:max-w-xs",
                            inputWrapper: "bg-white/[0.04] border border-white/[0.07] rounded-full h-9 hover:border-white/[0.14] transition-colors",
                            input: "text-sm text-white/80",
                        }}
                    />
                    <div className="flex flex-wrap gap-2">
                        {filteredTopUsers.slice(0, 12).map(u => (
                            <button
                                key={u.id}
                                onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
                                className={`flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-all duration-300 ${u.id === selectedUserId
                                    ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_16px_rgba(117,241,106,0.2)]'
                                    : 'border-white/[0.06] bg-white/[0.03] text-white/60 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white/85'
                                    }`}
                            >
                                {u.avatar
                                    ? <img src={u.avatar} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10" />
                                    : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06]"><User size={11} /></span>
                                }
                                <span className="truncate">{u.name}</span>
                                <span className={`text-[10px] font-bold tabular-nums ${u.id === selectedUserId ? 'text-primary/70' : 'text-white/25'}`}>{u.activity}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Graph canvas area */}
            <div
                ref={containerRef}
                data-tour="stats-contacts-graph"
                className="relative flex-1 overflow-hidden rounded-3xl border border-white/[0.06] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
                style={{ minHeight: 320, background: '#070709' }}
            >
                {/* Backdrop: ambient glows */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: [
                            'radial-gradient(ellipse 70% 55% at 22% 8%, rgba(117,241,106,0.05), transparent 60%)',
                            'radial-gradient(ellipse 65% 55% at 82% 92%, rgba(143,94,255,0.06), transparent 60%)',
                            'radial-gradient(ellipse 90% 80% at 50% 50%, rgba(20,20,24,0.6), transparent 100%)',
                        ].join(','),
                    }}
                />
                {/* Backdrop: dot grid */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(244,241,238,0.055) 1px, transparent 1.2px)',
                        backgroundSize: '26px 26px',
                        maskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 30%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 30%, transparent 100%)',
                    }}
                />

                {/* HUD: stats capsule */}
                {data && !loading && !showEgoSelector && data.nodes.length > 0 && (
                    <div className="pointer-events-none absolute left-3 top-3 z-20 hidden items-center gap-3 rounded-full border border-white/[0.07] bg-black/55 py-2 pl-3.5 pr-4 shadow-lg shadow-black/40 backdrop-blur-xl sm:left-4 sm:top-4 sm:flex">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" style={{ animation: 'cgPulseRing 2s cubic-bezier(0,0,0.2,1) infinite' }} />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                            {data.graphMode === 'full' ? t.fullMap : t.egoMode}
                        </span>
                        <span className="h-3.5 w-px bg-white/[0.09]" />
                        <span className="text-xs text-white/45">
                            <span className="font-bold tabular-nums text-white/90">{data.uniqueActiveUsers}</span> {t.activeUsers}
                        </span>
                        <span className="h-3.5 w-px bg-white/[0.09]" />
                        <span className="text-xs text-white/45">
                            <span className="font-bold tabular-nums text-white/90">{data.edges.length}</span> {t.connections}
                        </span>
                    </div>
                )}

                {/* HUD: view toggles */}
                <div className="absolute right-3 top-3 z-20 flex items-center overflow-hidden rounded-full border border-white/[0.07] bg-black/55 shadow-lg shadow-black/40 backdrop-blur-xl sm:right-4 sm:top-4">
                    <button
                        onClick={() => setIs3D(!is3D)}
                        className={`flex h-9 w-10 items-center justify-center transition-all duration-300 ${is3D ? 'bg-primary/15 text-primary' : 'text-white/50 hover:bg-white/[0.06] hover:text-white'}`}
                        title={is3D ? t.mode2D : t.mode3D}
                    >
                        <Cube size={17} weight={is3D ? 'fill' : 'regular'} />
                    </button>
                    <div className="h-5 w-px bg-white/[0.08]" />
                    <button
                        onClick={toggleFullscreen}
                        className={`flex h-9 w-10 items-center justify-center transition-all duration-300 ${isFullscreen ? 'bg-primary/15 text-primary' : 'text-white/50 hover:bg-white/[0.06] hover:text-white'}`}
                        title={t.fullscreen}
                    >
                        {isFullscreen ? <CornersIn size={17} /> : <CornersOut size={17} />}
                    </button>
                </div>

                {/* HUD: legend */}
                {!loading && !showEgoSelector && graphData.nodes.length > 0 && (
                    <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden items-center gap-4 rounded-full border border-white/[0.07] bg-black/55 px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur-xl sm:bottom-4 sm:left-4 sm:flex">
                        {legendItems.map(item => (
                            <span key={item.label} className="flex items-center gap-1.5">
                                <span
                                    className="h-1 w-4 rounded-full"
                                    style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`, boxShadow: `0 0 6px ${item.color}` }}
                                />
                                <span className="text-[10px] font-semibold text-white/50">{item.label}</span>
                            </span>
                        ))}
                        <span className="h-3 w-px bg-white/[0.09]" />
                        <span className="text-[10px] text-white/30">{t.nodeSizeActivity}</span>
                    </div>
                )}

                {/* HUD: selected user card */}
                {selectedNode && !loading && !showEgoSelector && (
                    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-3 rounded-full border border-primary/25 bg-black/60 py-1.5 pl-1.5 pr-2 shadow-[0_0_30px_rgba(117,241,106,0.12)] backdrop-blur-xl sm:bottom-4 sm:right-4">
                        {selectedNode.avatar
                            ? <img src={selectedNode.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/50" />
                            : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-2 ring-primary/40">{(selectedNode.name || '?')[0].toUpperCase()}</span>
                        }
                        <div className="min-w-0 leading-tight">
                            <p className="max-w-[140px] truncate text-xs font-bold text-white/90">{selectedNode.name}</p>
                            <p className="text-[10px] tabular-nums text-white/40">
                                {t.score}: <span className="text-primary/80">{selectedNode.activity}</span>
                                {selectedLinkCount > 0 && <> · {selectedLinkCount} {t.connections}</>}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedUserId(null)}
                            className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
                            title={t.deselect}
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </div>
                )}

                {/* Ego prompt */}
                {showEgoSelector && !loading && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                        <div className="relative flex h-20 w-20 items-center justify-center">
                            <span className="absolute inset-0 rounded-full border border-primary/20" style={{ animation: 'cgPulseRing 2.4s cubic-bezier(0,0,0.2,1) infinite' }} />
                            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/40 backdrop-blur-sm">
                                <MagnifyingGlass size={26} weight="light" />
                            </span>
                        </div>
                        <p className="text-sm text-white/35">{t.selectUser}</p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5">
                        <div className="relative flex h-16 w-16 items-center justify-center">
                            <span className="absolute inset-0 rounded-full border border-primary/25" style={{ animation: 'cgPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
                            <span className="absolute inset-0 rounded-full border border-[#8f5eff]/25" style={{ animation: 'cgPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite 0.6s' }} />
                            <span className="h-9 w-9 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                        </div>
                        <p className="text-sm text-white/35" style={{ animation: 'cgBreathe 1.8s ease-in-out infinite' }}>{t.loading}</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !showEgoSelector && data && data.nodes.length === 0 && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-white/30 backdrop-blur-sm">
                            <Intersect size={26} weight="light" />
                        </span>
                        <p className="text-sm text-white/35">{t.noData}</p>
                    </div>
                )}

                {/* The Graph */}
                {!loading && !showEgoSelector && graphData.nodes.length > 0 && (
                    is3D ? (
                        <ForceGraph3D
                            ref={graphRef3D}
                            graphData={graphData}
                            width={dimensions.w}
                            height={dimensions.h}
                            backgroundColor="rgba(14,14,14,0)"
                            nodeThreeObject={createNodeThreeObject}
                            linkColor={getLinkColor}
                            linkWidth={getLinkWidth}
                            linkCurvature={0.15}
                            linkOpacity={0.55}
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={(link: any) => Math.max(0.5, link._width * 0.4)}
                            linkDirectionalParticleSpeed={0.003}
                            linkDirectionalParticleColor={getLinkColor}
                            nodeLabel={nodeTooltip}
                            onNodeHover={handleNodeHover}
                            onNodeClick={(node) => handleNodeClick(node)}
                            d3AlphaDecay={0.015}
                            d3VelocityDecay={0.25}
                            cooldownTicks={100}
                            onEngineStop={handleEngineStop}
                        />
                    ) : (
                        <ForceGraph2D
                            ref={graphRef2D}
                            graphData={graphData}
                            width={dimensions.w}
                            height={dimensions.h}
                            backgroundColor="transparent"
                            nodeCanvasObject={drawNode}
                            nodeCanvasObjectMode={() => 'replace'}
                            nodePointerAreaPaint={paintNodePointer}
                            linkColor={getLinkColor}
                            linkWidth={getLinkWidth}
                            linkCurvature={0.15}
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={(link: any) => Math.max(0.5, link._width * 0.4)}
                            linkDirectionalParticleSpeed={0.003}
                            linkDirectionalParticleColor={getLinkColor}
                            nodeLabel={nodeTooltip}
                            onNodeHover={handleNodeHover}
                            onNodeClick={(node) => handleNodeClick(node)}
                            d3AlphaDecay={0.015}
                            d3VelocityDecay={0.25}
                            nodeVal={(node: any) => node._size || 4}
                            cooldownTicks={100}
                            onEngineStop={handleEngineStop}
                            enableZoomInteraction={true}
                            enablePanInteraction={true}
                        />
                    )
                )}
            </div>
        </div>
    );
}
