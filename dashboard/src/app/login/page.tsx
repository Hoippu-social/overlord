'use client';

import React, { Suspense } from 'react';
import { Card, CardBody, Button } from "@nextui-org/react";
import { DiscordLogo } from "@phosphor-icons/react";
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
    const [loading, setLoading] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [errorMessage, setErrorMessage] = React.useState('');
    const searchParams = useSearchParams();
    const router = require('next/navigation').useRouter();

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (res.ok) {
                // Force a hard navigation to dashboard to reload states
                window.location.href = '/dashboard';
            } else {
                setErrorMessage('Invalid admin password');
            }
        } catch (err) {
            setErrorMessage('Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md bg-surface border border-divider">
                <CardBody className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold">Welcome Back</h1>
                        <p className="text-default-500">Sign in with the admin password to continue</p>
                    </div>

                    {errorMessage && (
                        <div className="text-sm text-danger text-center">{errorMessage}</div>
                    )}

                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <input
                            type="password"
                            className="w-full p-2 border border-divider rounded bg-background text-foreground"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                        <Button
                            color="primary"
                            fullWidth
                            isLoading={loading}
                            className="font-semibold"
                            type="submit"
                        >
                            Sign In
                        </Button>
                    </form>
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
