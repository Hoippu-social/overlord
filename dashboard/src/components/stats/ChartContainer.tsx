'use client';

import React from 'react';
import { Card, CardBody, Skeleton } from "@nextui-org/react";

interface ChartContainerProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    loading?: boolean;
    height?: number | string;
    className?: string;
    headerAction?: React.ReactNode;
}

export function ChartContainer({
    title,
    subtitle,
    children,
    loading = false,
    height = 350,
    className = "",
    headerAction
}: ChartContainerProps) {
    return (
        <Card className={`bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg ${className}`}>
            <CardBody className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
                        {subtitle && <p className="text-sm text-default-400">{subtitle}</p>}
                    </div>
                    {headerAction}
                </div>

                <div style={{ height }} className="w-full relative">
                    {loading ? (
                        <div className="absolute inset-0 z-20 bg-[#18181b]/50 backdrop-blur-sm flex items-center justify-center">
                            <Skeleton className="w-full h-full rounded-xl opacity-20" />
                        </div>
                    ) : (
                        children
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
