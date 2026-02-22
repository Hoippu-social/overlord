import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Button, Avatar, Tooltip, Link } from "@nextui-org/react";
import { List, ChartPie, Eye, EyeSlash, Hash, User } from "@phosphor-icons/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface TopItem {
    id: string;
    name: string;
    value: number;
    avatar?: string;
    discordUrl?: string; // For channels
    color?: string;
    [key: string]: any;
}

interface StatsTopWidgetProps {
    title: string;
    data: TopItem[];
    type: 'list' | 'pie';
    valueFormatter: (val: number) => string;
    icon?: React.ReactNode;
    totalValue?: number; // Total for calculating "Others"
    isChannel?: boolean; // Whether this is a channel list (for styling)
    hideLegend?: boolean;
    hideHeader?: boolean;
    className?: string;
    pieRadius?: [number, number];
    hideControls?: boolean;
    largeText?: boolean;
}

export const COLORS = ['#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#6366F1'];
const OTHERS_COLOR = '#52525b'; // Gray for "Others"

export const StatsTopWidget: React.FC<StatsTopWidgetProps> = ({
    title,
    data,
    type: defaultType = 'list',
    valueFormatter,
    icon,
    totalValue,
    isChannel = false,
    hideLegend = false,
    hideHeader = false,
    className,
    pieRadius,
    hideControls = false,
    largeText = false
}) => {
    const [viewType, setViewType] = useState<'list' | 'pie'>(hideControls ? defaultType : defaultType);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

    // Calculate "Others" value
    const othersValue = useMemo(() => {
        if (!totalValue) return 0;
        const topSum = data.reduce((acc, item) => acc + item.value, 0);
        return Math.max(0, totalValue - topSum);
    }, [data, totalValue]);

    // Data with "Others" for pie chart
    const pieData = useMemo(() => {
        const items = data.map((item, index) => ({
            ...item,
            color: COLORS[index % COLORS.length]
        }));

        if (othersValue > 0) {
            items.push({
                id: 'others',
                name: 'Прочие',
                value: othersValue,
                color: OTHERS_COLOR
            });
        }

        return items;
    }, [data, othersValue]);

    const activeData = useMemo(() => {
        return pieData.filter(item => !hiddenIds.has(item.id));
    }, [pieData, hiddenIds]);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index);
    };

    const onPieLeave = () => {
        setActiveIndex(null);
    };

    const toggleSegment = (id: string) => {
        const newHidden = new Set(hiddenIds);
        if (newHidden.has(id)) {
            newHidden.delete(id);
        } else {
            newHidden.add(id);
        }
        setHiddenIds(newHidden);
    };

    // Calculate center text
    const centerInfo = useMemo(() => {
        if (activeIndex !== null && activeData[activeIndex]) {
            const item = activeData[activeIndex];
            return {
                label: item.name,
                value: valueFormatter(item.value),
                sub: `${((item.value / (activeData.reduce((a, b) => a + b.value, 0) || 1)) * 100).toFixed(1)}%`
            };
        }
        // Default to total
        const total = activeData.reduce((acc, curr) => acc + curr.value, 0);
        return {
            label: "Total",
            value: valueFormatter(total),
            sub: null
        };
    }, [activeIndex, activeData, valueFormatter]);

    return (
        <Card className={`h-full bg-[#18181b]/50 border border-white/5 shadow-sm ${className || ''}`}>
            {!hideHeader && (
                <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        {icon && <div className="text-default-500 flex-shrink-0">{icon}</div>}
                        <h3 className="text-lg font-semibold">{title}</h3>
                    </div>
                    {!hideControls && (
                        <div className="flex gap-1 bg-default-100/10 p-1 rounded-lg">
                            <Button
                                size="sm"
                                isIconOnly
                                variant={viewType === 'list' ? "solid" : "light"}
                                color={viewType === 'list' ? "primary" : "default"}
                                onPress={() => setViewType('list')}
                            >
                                <List size={18} />
                            </Button>
                            <Button
                                size="sm"
                                isIconOnly
                                variant={viewType === 'pie' ? "solid" : "light"}
                                color={viewType === 'pie' ? "primary" : "default"}
                                onPress={() => setViewType('pie')}
                            >
                                <ChartPie size={18} />
                            </Button>
                        </div>
                    )}
                </CardHeader>
            )}
            <CardBody className="p-6 h-[400px] overflow-hidden">
                <AnimatePresence mode="wait">
                    {viewType === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="h-full overflow-y-auto pr-2 custom-scrollbar space-y-3"
                        >
                            {data.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-default-500">
                                    No Data
                                </div>
                            ) : (
                                data.map((item, index) => (
                                    <div key={item.id} className="flex items-center justify-between p-2 md:p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-6 md:w-8 text-center text-default-400 font-medium text-sm">#{index + 1}</div>
                                            {isChannel ? (
                                                <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center flex-shrink-0">
                                                    <Hash size={16} className="text-default-400" />
                                                </div>
                                            ) : (
                                                <Avatar
                                                    src={item.avatar}
                                                    name={item.name}
                                                    size="sm"
                                                    className="flex-shrink-0 w-8 h-8 text-tiny"
                                                    showFallback
                                                    fallback={<User size={16} className="text-default-400" />}
                                                />
                                            )}
                                            {item.discordUrl ? (
                                                <Link
                                                    href={item.discordUrl}
                                                    isExternal
                                                    className="font-medium truncate text-white hover:text-primary transition-colors text-sm md:text-base flex-1 min-w-0 block"
                                                >
                                                    {item.name}
                                                </Link>
                                            ) : (
                                                <span className="font-medium truncate text-sm md:text-base flex-1 min-w-0 block">{item.name}</span>
                                            )}
                                        </div>
                                        <div className="font-bold font-mono text-primary text-sm md:text-base whitespace-nowrap ml-2 md:ml-4 text-right">
                                            {valueFormatter(item.value)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pie"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="h-full flex flex-col"
                        >
                            <div className="flex-1 min-h-0 relative">
                                {/* Center Info Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className={`${largeText ? 'w-[180px]' : 'w-[100px]'} text-center px-1`}>
                                        <div className={`text-default-500 ${largeText ? 'text-xs mb-2' : 'text-[10px] mb-1'} font-bold uppercase tracking-widest leading-tight break-words whitespace-normal line-clamp-2`}>
                                            {centerInfo.label}
                                        </div>
                                        <div className={`${largeText ? 'text-3xl' : 'text-xl'} font-bold text-white font-mono tracking-tight transition-all`}>
                                            {centerInfo.value}
                                        </div>
                                        {centerInfo.sub && (
                                            <div className={`flex justify-center ${largeText ? 'mt-2' : 'mt-1'}`}>
                                                <div className={`${largeText ? 'text-sm px-2 py-1' : 'text-xs px-1.5 py-0.5'} text-primary font-semibold bg-primary/10 rounded-md inline-block`}>
                                                    {centerInfo.sub}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activeData}
                                            innerRadius={pieRadius ? pieRadius[0] : 60}
                                            outerRadius={pieRadius ? pieRadius[1] : 90}
                                            paddingAngle={4}
                                            dataKey="value"
                                            onMouseEnter={onPieEnter}
                                            onMouseLeave={onPieLeave}
                                            cornerRadius={4}
                                        >
                                            {activeData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${entry.id}`}
                                                    fill={entry.color || COLORS[0]}
                                                    stroke="none"
                                                    style={{
                                                        filter: activeIndex === index ? 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' : 'none',
                                                        transform: activeIndex === index ? 'scale(1.02)' : 'scale(1)',
                                                        transformOrigin: 'center center',
                                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                        outline: 'none'
                                                    }}
                                                />
                                            ))}
                                        </Pie>
                                        {/* Tooltip removed in favor of center info, or keep simplified */}
                                        <RechartsTooltip cursor={false} content={() => null} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Legend Grid - Conditionally rendered */}
                            {!hideLegend && (
                                <div className="mt-4 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar grid grid-cols-2 gap-2">
                                    {pieData.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${(activeIndex === index || activeIndex === null) && !hiddenIds.has(item.id)
                                                ? 'bg-white/5 border-transparent hover:bg-white/10'
                                                : 'bg-transparent border-white/5 opacity-40'
                                                }`}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                            onClick={() => toggleSegment(item.id)}
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className={`text-xs truncate flex-1 font-medium ${item.id === 'others' ? 'italic text-default-400' : 'text-default-300'}`}>
                                                {item.name}
                                            </span>
                                            <span className="text-[10px] text-default-500 font-mono">
                                                {((item.value / (pieData.reduce((a, b) => a + b.value, 0) || 1)) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardBody>
        </Card>
    );
};


