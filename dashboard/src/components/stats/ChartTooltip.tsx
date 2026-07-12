import React from 'react';
import { formatLocaleNumber } from "@/lib/utils";

interface TooltipPayloadItem {
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string;
    payload?: any;
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: readonly TooltipPayloadItem[] | any;
    label?: string | number;
    locale?: 'ru' | 'en';
    // Optional map to format specific keys differently
    formatters?: {
        [key: string]: (value: any, payloadItem: TooltipPayloadItem) => React.ReactNode;
    };
    // If you want a specific order of rendering
    order?: string[];
    // Recharts passes stroke="url(#gradient)" as color, which is invalid CSS background-color. Override here by dataKey.
    colorOverrides?: {
        [key: string]: string;
    };
}

export function ChartTooltip({ active, payload, label, locale = 'en', formatters, order, colorOverrides }: ChartTooltipProps) {
    if (!active || !payload || !payload.length) return null;

    const displayPayload = [...payload];

    if (order) {
        displayPayload.sort((a, b) => {
            const indexA = order.indexOf(a.dataKey || '');
            const indexB = order.indexOf(b.dataKey || '');
            const posA = indexA === -1 ? 999 : indexA;
            const posB = indexB === -1 ? 999 : indexB;
            return posA - posB;
        });
    }

    return (
        <div style={{
            backgroundColor: 'rgba(17,17,17,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(244,241,238,0.04)',
            borderRadius: '24px',
            padding: '12px 20px',
            boxShadow: '0 4px 20px rgba(14,14,14,0.2)'
        }}>
            {label != null && label !== '' && (
                <p style={{
                    color: '#f4f1ee',
                    fontSize: 14,
                    marginBottom: 12,
                    fontWeight: 700,
                    letterSpacing: '0.05em'
                }}>
                    {label}
                </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {displayPayload.map((entry, index) => {
                    const formattedValue = formatters && entry.dataKey && formatters[entry.dataKey] 
                        ? formatters[entry.dataKey](entry.value, entry) 
                        : formatLocaleNumber(Number(entry.value), locale);
                    const dotColor = (entry.dataKey && colorOverrides?.[entry.dataKey]) || entry.color || '#f4f1ee';
                        
                    return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor }} />
                            <span style={{ color: 'rgba(244,241,238,0.6)', fontSize: 14 }}>{entry.name}&nbsp;:&nbsp;</span>
                            <span style={{ color: '#f4f1ee', fontWeight: 700, fontSize: 14 }}>{formattedValue}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
