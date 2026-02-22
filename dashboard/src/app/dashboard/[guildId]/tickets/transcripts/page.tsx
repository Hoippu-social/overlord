'use client';
import { useParams } from 'next/navigation';
import { Card, CardBody, Spinner, Breadcrumbs, BreadcrumbItem } from '@nextui-org/react';

export default function TranscriptsPage() {
    const { guildId } = useParams<{ guildId: string }>();

    return (
        <div className="space-y-8 pb-10 animate-fade-in min-h-screen">
            <Breadcrumbs size="lg" className="mb-4">
                <BreadcrumbItem href={`/dashboard/${guildId}/tickets`}>Tickets</BreadcrumbItem>
                <BreadcrumbItem>Transcripts</BreadcrumbItem>
            </Breadcrumbs>

            <div className="flex items-center gap-5 mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Transcripts
                </h1>
            </div>

            <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px]">
                <CardBody className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 rounded-full bg-violet-500/10 text-violet-500">
                        <Spinner size="lg" color="current" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Coming Soon</h3>
                        <p className="text-default-500">This module is under construction.</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
