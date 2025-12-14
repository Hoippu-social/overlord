'use client';

import React from 'react';
import { Card, CardBody, Button, Progress } from "@nextui-org/react";
import { AreaChart, Card as TremorCard, Title } from "@tremor/react";
import { Power, ArrowClockwise, StopCircle, Cpu, HardDrives, Pulse } from "@phosphor-icons/react";

const chartdata = [
    { date: "12:00", CPU: 12, RAM: 45 },
    { date: "12:05", CPU: 15, RAM: 46 },
    { date: "12:10", CPU: 45, RAM: 50 },
    { date: "12:15", CPU: 32, RAM: 48 },
    { date: "12:20", CPU: 20, RAM: 47 },
    { date: "12:25", CPU: 25, RAM: 49 },
];

export default function GlobalSystemPage() {
    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">System Status</h1>
                        <p className="text-default-500">Monitor bot performance and resource usage</p>
                    </div>
                    <div className="flex gap-2">
                        <Button color="success" startContent={<Power size={18} />}>Start Bot</Button>
                        <Button color="warning" variant="flat" startContent={<ArrowClockwise size={18} />}>Restart</Button>
                        <Button color="danger" variant="flat" startContent={<StopCircle size={18} />}>Stop</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu size={24} /></div>
                                <span className="text-default-500 font-medium">CPU Usage</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">24%</span>
                                <span className="text-success text-sm mb-1">Stable</span>
                            </div>
                            <Progress value={24} color="primary" className="mt-3" size="sm" />
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><HardDrives size={24} /></div>
                                <span className="text-default-500 font-medium">RAM Usage</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">1.2 GB</span>
                                <span className="text-default-400 text-sm mb-1">/ 4 GB</span>
                            </div>
                            <Progress value={30} color="secondary" className="mt-3" size="sm" />
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-success/10 rounded-lg text-success"><Pulse size={24} /></div>
                                <span className="text-default-500 font-medium">Uptime</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">4d 12h</span>
                            </div>
                            <div className="text-xs text-default-400 mt-3">Since last restart</div>
                        </CardBody>
                    </Card>

                    <Card className="bg-surface border border-divider">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-warning/10 rounded-lg text-warning"><Pulse size={24} /></div>
                                <span className="text-default-500 font-medium">Ping</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold">24ms</span>
                                <span className="text-success text-sm mb-1">Excellent</span>
                            </div>
                            <div className="text-xs text-default-400 mt-3">Gateway latency</div>
                        </CardBody>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">CPU History</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={chartdata}
                            index="date"
                            categories={["CPU"]}
                            colors={["indigo"]}
                            valueFormatter={(number) => `${number}%`}
                            showAnimation={true}
                            autoMinValue={true}
                        />
                    </TremorCard>

                    <TremorCard className="bg-surface border border-divider ring-0">
                        <Title className="text-foreground">Memory History</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={chartdata}
                            index="date"
                            categories={["RAM"]}
                            colors={["emerald"]}
                            valueFormatter={(number) => `${number}%`}
                            showAnimation={true}
                            autoMinValue={true}
                        />
                    </TremorCard>
                </div>
            </div>
        </div>
    );
}
