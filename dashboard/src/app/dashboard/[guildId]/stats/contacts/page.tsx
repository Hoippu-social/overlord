'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Input } from '@nextui-org/react';
import * as THREE from 'three';


import {
    MicrophoneStage, ChatText, Intersect, MagnifyingGlass, User,
    Cube, CornersOut, CornersIn
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

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EDGE_COLORS: Record<string, string> = {
    reply: 'rgba(117,241,106,0.65)',
    mention: 'rgba(59,130,246,0.65)',
    voice: 'rgba(245,158,11,0.55)',
    mixed: 'rgba(139,92,246,0.6)',
};

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
    },
    ru: {
        voice: '\u0413\u043e\u043b\u043e\u0441', text: '\u0422\u0435\u043a\u0441\u0442', mixed: '\u0421\u043c\u0435\u0448\u0430\u043d\u043d\u044b\u0439',
        day7: '7 \u0434\u043d\u0435\u0439', day30: '30 \u0434\u043d\u0435\u0439', day90: '90 \u0434\u043d\u0435\u0439', day365: '365 \u0434\u043d\u0435\u0439',
        searchUser: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f...', selectUser: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0435\u0433\u043e \u0441\u0432\u044f\u0437\u0435\u0439',
        noData: '\u041d\u0435\u0442 \u0432\u0437\u0430\u0438\u043c\u043e\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u0437\u0430 \u044d\u0442\u043e\u0442 \u043f\u0435\u0440\u0438\u043e\u0434', loading: '\u0421\u0442\u0440\u043e\u0438\u043c \u0433\u0440\u0430\u0444 \u0441\u0432\u044f\u0437\u0435\u0439...',
        fullMap: '\u041f\u043e\u043b\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430', egoMode: '\u042d\u0433\u043e-\u0440\u0435\u0436\u0438\u043c', activeUsers: '\u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445', connections: '\u0441\u0432\u044f\u0437\u0435\u0439',
        egoBanner: '\u0421\u0435\u0440\u0432\u0435\u0440 \u0431\u043e\u043b\u044c\u0448\u043e\u0439 - \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c 2 \u0443\u0440\u043e\u0432\u043d\u044f \u0441\u0432\u044f\u0437\u0435\u0439 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
        loadingGraph: '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0433\u0440\u0430\u0444...',
        loading3D: '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c 3D \u0433\u0440\u0430\u0444...',
        reply: '\u041e\u0442\u0432\u0435\u0442',
        mention: '\u0423\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435',
        nodeSizeActivity: '\u0420\u0430\u0437\u043c\u0435\u0440 \u0443\u0437\u043b\u0430 = \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
        mode2D: '2D \u0440\u0435\u0436\u0438\u043c',
        mode3D: '3D \u0440\u0435\u0436\u0438\u043c',
        fullscreen: '\u041f\u043e\u043b\u043d\u044b\u0439 \u044d\u043a\u0440\u0430\u043d',
        score: '\u0441\u0447\u0451\u0442',
    },
} as const;

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Avatar image cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const avatarCache = new Map<string, HTMLImageElement>();
function loadAvatar(url: string): void {
    if (avatarCache.has(url)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => avatarCache.set(url, img);
    img.src = url;
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        return {
            nodes: data.nodes.map(n => ({ ...n, _size: n.size })),
            links: data.edges.map(e => ({
                source: e.source,
                target: e.target,
                weight: e.weight,
                types: e.types,
                _width: Math.max(0.5, (e.weight / maxWeight) * 5),
            })),
        };
    }, [data]);

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

    // Custom node 3D renderer
    const createNodeThreeObject = useCallback((node: any) => {
        const { id, name, avatar, _size } = node;
        const radius = _size || 4;

        const canvas = document.createElement('canvas');
        const imgSize = 120;
        const padding = 16;
        const textHeight = 40;
        canvas.width = imgSize + padding * 2;
        canvas.height = imgSize + padding * 2 + textHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.Object3D();

        const isHovered = hoveredNode === id;
        const isSelected = selectedUserId === id;

        const cx = canvas.width / 2;
        const cy = padding + imgSize / 2;
        const r = imgSize / 2 - 4;

        ctx.save();

        // Glow
        if (isSelected || isHovered) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.shadowBlur = 15;
            ctx.shadowColor = isSelected ? '#75F16A' : 'rgba(255,255,255,0.6)';
            ctx.fillStyle = isSelected ? 'rgba(117,241,106,0.3)' : 'rgba(255,255,255,0.2)';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // Clip region
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        const img = avatar ? avatarCache.get(avatar) : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
        } else {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, '#2a2a2a');
            g.addColorStop(1, '#151515');
            ctx.fillStyle = g;
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `bold ${r * 0.8}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((name || '?')[0].toUpperCase(), cx, cy);
        }

        ctx.restore();

        // Ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#75F16A' : isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = isSelected || isHovered ? 4 : 2;
        ctx.stroke();

        // Text
        if (isHovered || isSelected || _size >= 6) {
            const textY = cy + r + 24;
            ctx.font = `500 24px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.fillText(name || id, cx, textY);
            ctx.shadowBlur = 0;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(material);

        const spriteScale = radius * 4;
        sprite.scale.set(spriteScale, spriteScale * (canvas.height / canvas.width), 1);
        sprite.renderOrder = isSelected || isHovered ? 1 : 0;

        return sprite;
    }, [hoveredNode, selectedUserId]);

    // Custom node canvas renderer
    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y, _size, name, avatar, id } = node;
        const isHovered = hoveredNode === id;
        const isSelected = selectedUserId === id;
        const radius = (_size || 4) * 3.5;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return;

        ctx.save();

        // Glow
        if (isHovered || isSelected) {
            ctx.shadowBlur = 24;
            ctx.shadowColor = isSelected ? '#75F16A' : 'rgba(255,255,255,0.4)';
        }

        // Clip to circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();

        // Avatar or fallback initials
        const img = avatar ? avatarCache.get(avatar) : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
        } else {
            const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
            g.addColorStop(0, '#2a2a2a');
            g.addColorStop(1, '#151515');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = `bold ${radius * 0.8}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((name || '?')[0].toUpperCase(), x, y);
        }

        ctx.restore();

        // Ring
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#75F16A' : isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = isSelected || isHovered ? 2 : 0.8;
        ctx.stroke();

        // Label
        if (globalScale > 1.5 || isHovered || isSelected) {
            const fs = Math.min(14, Math.max(8, radius * 0.6)) / globalScale;
            ctx.save();
            ctx.font = `${fs}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.fillText(name || id, x, y + radius + 2 / globalScale);
            ctx.restore();
        }
    }, [hoveredNode, selectedUserId]);

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
        const types: string[] = link.types || [];
        const hasVoice = types.includes('voice');
        const hasText = types.includes('reply') || types.includes('mention');
        if (hasVoice && hasText) return EDGE_COLORS.mixed;
        if (hasVoice) return EDGE_COLORS.voice;
        if (types.includes('reply')) return EDGE_COLORS.reply;
        if (types.includes('mention')) return EDGE_COLORS.mention;
        return 'rgba(255,255,255,0.15)';
    }, []);

    const getLinkWidth = useCallback((link: any) => link._width || 1, []);

    const handleNodeClick = useCallback((node: any) => {
        setSelectedUserId((prev) => node?.id === prev ? null : (node?.id ?? null));
    }, []);

    const handleNodeHover = useCallback((node: any) => {
        setHoveredNode(node ? node.id : null);
    }, []);

    // â”€â”€â”€ Mode toggle button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ModeButton = ({ m, icon: Icon, label }: { m: 'voice' | 'text' | 'mixed'; icon: any; label: string }) => {
        const active = mode === m;
        return (
            <button
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-all ${active
                    ? 'bg-primary text-black shadow-[0_0_14px_rgba(117,241,106,0.3)]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    }`}
            >
                <Icon size={15} weight={active ? 'fill' : 'regular'} />
                <span>{label}</span>
            </button>
        );
    };

    // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div className="flex flex-col gap-3 px-3 pb-4 sm:gap-4 sm:px-0 sm:pb-6" style={{ height: 'calc(100dvh - 150px)', minHeight: 440 }}>

            {/* Controls */}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {/* Mode toggle */}
                    <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-divider bg-surface p-1 shadow-sm shadow-black/20 sm:rounded-full">
                        <ModeButton m="voice" icon={MicrophoneStage} label={t.voice} />
                        <ModeButton m="text" icon={ChatText} label={t.text} />
                        <ModeButton m="mixed" icon={Intersect} label={t.mixed} />
                    </div>

                    {/* Stats chips */}
                    {data && !loading && (
                        <div className="flex items-center gap-2 hidden md:flex">
                            <span className="text-xs text-white/30 font-semibold">
                                {data.graphMode === 'full' ? t.fullMap : t.egoMode}
                            </span>
                            <div className="h-4 w-px bg-white/[0.06]" />
                            <span className="text-xs text-white/50">
                                <span className="text-white/80 font-bold">{data.uniqueActiveUsers}</span> {t.activeUsers}
                            </span>
                            <div className="h-4 w-px bg-white/[0.06]" />
                            <span className="text-xs text-white/50">
                                <span className="text-white/80 font-bold">{data.edges.length}</span> {t.connections}
                            </span>
                        </div>
                    )}
                </div>
            </div>


            {/* Ego mode user picker */}
            {!loading && data?.graphMode === 'ego' && (
                <div className="flex-shrink-0 rounded-2xl border border-divider bg-surface p-3 sm:p-4">
                    <p className="text-white/40 text-xs mb-3">{t.egoBanner}</p>
                    <Input
                        placeholder={t.searchUser}
                        value={search}
                        onValueChange={setSearch}
                        startContent={<MagnifyingGlass size={14} className="text-white/30" />}
                        classNames={{
                            base: "mb-3 w-full sm:max-w-xs",
                            inputWrapper: "bg-white/[0.04] border border-white/[0.06] rounded-xl h-9",
                            input: "text-sm text-white/80",
                        }}
                    />
                    <div className="flex flex-wrap gap-2">
                        {filteredTopUsers.slice(0, 12).map(u => (
                            <button
                                key={u.id}
                                onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
                                className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${u.id === selectedUserId
                                    ? 'bg-primary/10 text-primary border-primary/30'
                                    : 'bg-white/[0.03] text-white/60 border-white/[0.05] hover:bg-white/[0.06] hover:text-white/80'
                                    }`}
                            >
                                {u.avatar
                                    ? <img src={u.avatar} alt="" className="w-4 h-4 rounded-full" />
                                    : <User size={12} />
                                }
                                {u.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Graph canvas area */}
            <div
                ref={containerRef}
                className="flex-1 relative rounded-2xl overflow-hidden border border-white/[0.04] bg-[#080808]"
                style={{ minHeight: 320 }}
            >
                {/* Floating View Toggles */}
                <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
                    <button
                        onClick={() => setIs3D(!is3D)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all ${is3D ? 'border-primary/40 bg-primary/20 text-primary' : 'border-white/[0.08] bg-black/60 text-white/60 hover:bg-black/80 hover:text-white'}`}
                        title={is3D ? t.mode2D : t.mode3D}
                    >
                        <Cube size={18} weight={is3D ? 'fill' : 'regular'} />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all ${isFullscreen ? 'border-primary/40 bg-primary/20 text-primary' : 'border-white/[0.08] bg-black/60 text-white/60 hover:bg-black/80 hover:text-white'}`}
                        title={t.fullscreen}
                    >
                        {isFullscreen ? <CornersIn size={18} /> : <CornersOut size={18} />}
                    </button>
                </div>
                {/* Legend */}
                <div className="pointer-events-none absolute left-4 top-4 z-10 hidden rounded-xl border border-white/[0.06] bg-black/60 p-3 backdrop-blur-md sm:block">
                    {(mode === 'voice' || mode === 'mixed') && (
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-px rounded-full" style={{ backgroundColor: EDGE_COLORS.voice, height: 2 }} />
                            <span className="text-[10px] text-white/40">{t.voice}</span>
                        </div>
                    )}
                    {(mode === 'text' || mode === 'mixed') && (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 rounded-full" style={{ backgroundColor: EDGE_COLORS.reply, height: 2 }} />
                                <span className="text-[10px] text-white/40">{t.reply}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-5 rounded-full" style={{ backgroundColor: EDGE_COLORS.mention, height: 2 }} />
                                <span className="text-[10px] text-white/40">{t.mention}</span>
                            </div>
                        </>
                    )}
                    {mode === 'mixed' && (
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 rounded-full" style={{ backgroundColor: EDGE_COLORS.mixed, height: 2 }} />
                            <span className="text-[10px] text-white/40">{t.mixed}</span>
                        </div>
                    )}
                    <div className="mt-1 pt-1.5 border-t border-white/[0.06] text-[10px] text-white/25">
                        {t.nodeSizeActivity}
                    </div>
                </div>

                {/* Ego prompt */}
                {showEgoSelector && !loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/25 pointer-events-none">
                        <MagnifyingGlass size={44} weight="thin" />
                        <p className="text-sm">{t.selectUser}</p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                        <p className="text-white/30 text-sm">{t.loading}</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !showEgoSelector && data && data.nodes.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/25">
                        <Intersect size={44} weight="thin" />
                        <p className="text-sm">{t.noData}</p>
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
                            backgroundColor="rgba(0,0,0,0)"
                            nodeThreeObject={createNodeThreeObject}
                            linkColor={getLinkColor}
                            linkWidth={getLinkWidth}
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={(link: any) => Math.max(0.5, link._width * 0.4)}
                            linkDirectionalParticleSpeed={0.003}
                            linkDirectionalParticleColor={getLinkColor}
                            nodeLabel={(node: any) => `${node.name} - ${t.score}: ${node.activity}`}
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
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={(link: any) => Math.max(0.5, link._width * 0.4)}
                            linkDirectionalParticleSpeed={0.003}
                            linkDirectionalParticleColor={getLinkColor}
                            nodeLabel={(node: any) => `${node.name} - ${t.score}: ${node.activity}`}
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

