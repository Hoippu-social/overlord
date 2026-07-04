'use client';

import React from 'react';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import { DownloadSimple, FileCsv, FileImage, FileJs } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import {
    downloadStatsChartPng,
    downloadStatsCsv,
    downloadStatsJson,
    type StatsChartSeries,
} from '@/lib/statsExport';

const strings = {
    en: {
        export: 'Export',
        json: 'JSON',
        csv: 'CSV',
        png: 'PNG (chart)',
    },
    ru: {
        export: 'Экспорт',
        json: 'JSON',
        csv: 'CSV',
        png: 'PNG (график)',
    },
} as const;

export interface StatsExportChart {
    title: string;
    subtitle?: string;
    labels: string[];
    series: StatsChartSeries[];
    kind?: 'line' | 'bar';
    valueFormatter?: (value: number) => string;
}

interface StatsExportMenuProps {
    locale: LocaleCode;
    period: string;
    filenamePrefix: string;
    data: Record<string, unknown> | null | undefined;
    chart?: StatsExportChart;
}

export function StatsExportMenu({ locale, period, filenamePrefix, data, chart }: StatsExportMenuProps) {
    const text = strings[locale];

    const baseName = () => `${filenamePrefix}-${period}-${new Date().toISOString().slice(0, 10)}`;

    const handleAction = (key: React.Key) => {
        if (!data) return;
        if (key === 'json') {
            downloadStatsJson(`${baseName()}.json`, data);
        } else if (key === 'csv') {
            downloadStatsCsv(`${baseName()}.csv`, data);
        } else if (key === 'png' && chart) {
            downloadStatsChartPng(`${baseName()}.png`, chart);
        }
    };

    return (
        <Dropdown placement="bottom-end">
            <DropdownTrigger>
                <Button
                    isIconOnly
                    variant="light"
                    isDisabled={!data}
                    aria-label={text.export}
                    title={text.export}
                    className="h-10 w-10 flex-shrink-0 rounded-full border border-divider bg-surface text-white/70 shadow-sm shadow-black/20 transition-all hover:bg-white/[0.04] hover:text-[var(--color-primary-1)]"
                >
                    <DownloadSimple size={18} />
                </Button>
            </DropdownTrigger>
            <DropdownMenu
                aria-label={text.export}
                onAction={handleAction}
                classNames={{ base: 'rounded-2xl border border-divider bg-surface shadow-2xl' }}
            >
                <DropdownItem key="json" startContent={<FileJs size={16} />}>
                    {text.json}
                </DropdownItem>
                <DropdownItem key="csv" startContent={<FileCsv size={16} />}>
                    {text.csv}
                </DropdownItem>
                {chart ? (
                    <DropdownItem key="png" startContent={<FileImage size={16} />}>
                        {text.png}
                    </DropdownItem>
                ) : null}
            </DropdownMenu>
        </Dropdown>
    );
}
