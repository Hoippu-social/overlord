'use client';

import React from 'react';
import { Card, CardBody, Skeleton } from "@nextui-org/react";
import { TrendUp, TrendDown } from "@phosphor-icons/react";

interface StatsCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        label?: string;
        isPositive?: boolean;
    };
    loading?: boolean;
    className?: string;
    description?: string;
}

export function StatsCard({
    title,
    value,
    subValue,
    icon,
    trend,
    loading = false,
    className = "",
    description
}: StatsCardProps) {
    return (
        <Card className={`bg-[#18181b]/60 backdrop-blur-md border border-white/5 shadow-lg hover:border-primary/20 transition-all duration-300 ${className}`}>
            <CardBody className="p-6 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full pointer-events-none" />

                <div className="flex items-start justify-between mb-4 relative z-10">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-primary shadow-inner flex-shrink-0">
                            {icon}
                        </div>
                    )}

                    {trend && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border ${trend.isPositive !== false
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}>
                            {trend.isPositive !== false ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                            <span>{trend.value}%</span>
                        </div>
                    )}
                </div>

                <div className="relative z-10">
                    <p className="text-default-400 text-sm font-medium mb-1">{title}</p>

                    <div className="flex items-baseline gap-2">
                        {loading ? (
                            <Skeleton className="h-10 w-24 rounded-lg my-1" />
                        ) : (
                            <h3 className="text-4xl font-black tracking-tight text-white">
                                {value}
                            </h3>
                        )}
                        {subValue && !loading && (
                            <span className="text-sm text-default-400 font-medium">{subValue}</span>
                        )}
                    </div>

                    {description && (
                        <p className="text-xs text-default-500 mt-2 font-medium">{description}</p>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
