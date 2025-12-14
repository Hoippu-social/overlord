'use client';

import React from 'react';
import { Card, CardBody, Button, Input } from "@nextui-org/react";
import { LockKey, User } from "@phosphor-icons/react";
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.push('/dashboard');
            } else {
                alert('Invalid password');
            }
        } catch (error) {
            console.error(error);
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
                        <p className="text-default-500">Enter your password to access the dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <Input
                            type="password"
                            label="Password"
                            placeholder="Enter your password"
                            startContent={<LockKey className="text-default-400" />}
                            value={password}
                            onValueChange={setPassword}
                            variant="bordered"
                        />

                        <Button
                            type="submit"
                            color="primary"
                            fullWidth
                            isLoading={loading}
                            className="font-semibold"
                        >
                            Login
                        </Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
