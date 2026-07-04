'use client';

export interface StatsChartSeries {
    name: string;
    color: string;
    values: number[];
    dashed?: boolean;
}

export interface StatsChartPngOptions {
    title: string;
    subtitle?: string;
    labels: string[];
    series: StatsChartSeries[];
    kind?: 'line' | 'bar';
    valueFormatter?: (value: number) => string;
    width?: number;
    height?: number;
}

const FALLBACK_COLORS: Record<string, string> = {
    '--color-primary': '#75f16a',
    '--color-primary-1': '#75f16a',
    '--color-primary-2': '#8f5eff',
    '--color-success': '#10b981',
    '--color-warning': '#f59e0b',
    '--color-danger': '#f43f5e',
};

function triggerBlobDownload(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadStatsJson(filename: string, data: unknown): void {
    const json = JSON.stringify(data, null, 2);
    triggerBlobDownload(filename, new Blob([json], { type: 'application/json;charset=utf-8' }));
}

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'string' ? value : String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildArraySection(name: string, rows: unknown[]): string {
    if (rows.length === 0) {
        return `# ${name}\r\n(empty)`;
    }

    const first = rows[0];
    if (typeof first !== 'object' || first === null) {
        return [`# ${name}`, 'value', ...rows.map((v) => csvEscape(v))].join('\r\n');
    }

    const columns = Array.from(
        new Set(rows.flatMap((row) => Object.keys(row as Record<string, unknown>)))
    );
    const lines = [`# ${name}`, columns.map(csvEscape).join(',')];
    for (const row of rows as Record<string, unknown>[]) {
        lines.push(columns.map((c) => csvEscape(row[c])).join(','));
    }
    return lines.join('\r\n');
}

function buildObjectSection(name: string, obj: Record<string, unknown>): string {
    const lines = [`# ${name}`, 'key,value', ...Object.entries(obj).map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`)];
    return lines.join('\r\n');
}

function buildGenericStatsCsv(data: Record<string, unknown>): string {
    const sections: string[] = [];
    const summaryRows: [string, unknown][] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            sections.push(buildArraySection(key, value));
        } else if (typeof value === 'object') {
            sections.push(buildObjectSection(key, value as Record<string, unknown>));
        } else {
            summaryRows.push([key, value]);
        }
    }

    if (summaryRows.length) {
        const lines = ['# summary', 'key,value', ...summaryRows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`)];
        sections.unshift(lines.join('\r\n'));
    }

    return sections.join('\r\n\r\n');
}

export function downloadStatsCsv(filename: string, data: Record<string, unknown>): void {
    const csv = '﻿' + buildGenericStatsCsv(data);
    triggerBlobDownload(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

function resolveChartColor(color: string): string {
    if (!color.startsWith('var(')) return color;
    const varName = color.slice(4, -1).trim();
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return resolved || FALLBACK_COLORS[varName] || '#8f5eff';
}

export function downloadStatsChartPng(filename: string, options: StatsChartPngOptions): void {
    const width = options.width ?? 960;
    const height = options.height ?? 540;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const bg = '#0b0b0d';
    const textColor = '#e5e5e5';
    const mutedColor = '#8a8a90';
    const gridColor = 'rgba(255,255,255,0.1)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = textColor;
    ctx.font = '600 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(options.title, 24, 32);

    if (options.subtitle) {
        ctx.fillStyle = mutedColor;
        ctx.font = '400 13px sans-serif';
        ctx.fillText(options.subtitle, 24, 52);
    }

    const paddingLeft = 60;
    const paddingRight = 24;
    const paddingTop = 76;
    const paddingBottom = 60;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const allValues = options.series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
    const maxValue = Math.max(1, ...allValues, 0);
    const minValue = Math.min(0, ...allValues);
    const valueRange = maxValue - minValue || 1;

    const yFor = (v: number) => paddingTop + plotHeight - ((v - minValue) / valueRange) * plotHeight;
    const n = options.labels.length;
    const xFor = (i: number) => paddingLeft + (n <= 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);

    ctx.strokeStyle = gridColor;
    ctx.fillStyle = mutedColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const v = minValue + (valueRange * i) / gridLines;
        const y = yFor(v);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
        const label = options.valueFormatter ? options.valueFormatter(Math.round(v)) : Math.round(v).toLocaleString();
        ctx.fillText(label, paddingLeft - 10, y);
    }

    const maxLabels = 8;
    const step = Math.max(1, Math.ceil(n / maxLabels));
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < n; i += step) {
        ctx.fillText(options.labels[i], xFor(i), height - paddingBottom + 12);
    }

    if (options.kind === 'bar') {
        const groupWidth = plotWidth / Math.max(1, n);
        const barCount = options.series.length;
        options.series.forEach((s, si) => {
            ctx.fillStyle = resolveChartColor(s.color);
            s.values.forEach((v, i) => {
                const barWidth = (groupWidth * 0.6) / barCount;
                const x = paddingLeft + i * groupWidth + groupWidth * 0.2 + si * barWidth;
                const y = yFor(Math.max(0, v));
                const barHeight = yFor(minValue) - y;
                ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
            });
        });
    } else {
        options.series.forEach((s) => {
            ctx.strokeStyle = resolveChartColor(s.color);
            ctx.lineWidth = 2.5;
            ctx.setLineDash(s.dashed ? [6, 4] : []);
            ctx.beginPath();
            s.values.forEach((v, i) => {
                const x = xFor(i);
                const y = yFor(v);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        ctx.setLineDash([]);
    }

    let legendX = paddingLeft;
    const legendY = height - 22;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    options.series.forEach((s) => {
        const color = resolveChartColor(s.color);
        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY - 5, 10, 10);
        ctx.fillStyle = textColor;
        ctx.fillText(s.name, legendX + 14, legendY);
        legendX += 14 + ctx.measureText(s.name).width + 24;
    });

    canvas.toBlob((blob) => {
        if (blob) triggerBlobDownload(filename, blob);
    }, 'image/png');
}
