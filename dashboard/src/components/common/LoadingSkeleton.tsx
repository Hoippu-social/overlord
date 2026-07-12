import type { HTMLAttributes } from 'react';

interface LoadingSkeletonProps extends HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export function LoadingSkeleton({ className = '', ...props }: LoadingSkeletonProps) {
    return (
        <div
            {...props}
            className={['skeleton', className].filter(Boolean).join(' ')}
        />
    );
}
