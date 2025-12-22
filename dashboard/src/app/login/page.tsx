'use client';

import React, { Suspense } from 'react';
import { Card, CardBody, Button } from "@nextui-org/react";
import { DiscordLogo } from "@phosphor-icons/react";
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
    const [loading, setLoading] = React.useState(false);
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');
    const errorMessage = errorParam ? 'Discord login failed. Please try again.' : '';

    const handleDiscordLogin = async () => {
        setLoading(true);
        await signIn('discord', { callbackUrl: '/dashboard' });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md bg-surface border border-divider">
                <CardBody className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold">Welcome Back</h1>
                        <p className="text-default-500">Sign in with your Discord account to continue</p>
                    </div>

                    {errorMessage && (
                        <div className="text-sm text-danger text-center">{errorMessage}</div>
                    )}

                    <Button
                        color="primary"
                        fullWidth
                        isLoading={loading}
                        className="font-semibold"
                        startContent={!loading ? <DiscordLogo size={20} weight="fill" /> : null}
                        onPress={handleDiscordLogin}
                    >
                        Continue with Discord
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md bg-surface border border-divider">
                    <CardBody className="p-8 text-center">Loading...</CardBody>
                </Card>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
