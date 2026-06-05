import React from 'react';
import { cn } from "@nextui-org/react";

interface RoleChipProps {
    name: string;
    color: string; // Hex color from Discord API
    icon?: React.ReactNode;
    className?: string;
}

export const RoleChip: React.FC<RoleChipProps> = ({ name, color, icon, className }) => {
    // If color is default (0 or #0e0e0e), use spec-compliant fallback colors
    // Per UI spec: text/border = #a1a1aa (zinc-400), background = #52525b (zinc-600)
    const isDefaultColor = color === '#0e0e0e' || color === '0' || !color;
    const roleColor = isDefaultColor ? '#a1a1aa' : color;

    // Convert hex to RGB for background opacity
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 82, g: 82, b: 91 }; // zinc-600 fallback
    };

    const rgb = hexToRgb(roleColor);

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-[6px] border transition-all",
                className
            )}
            style={{
                backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
                borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
                color: roleColor,
            }}
        >
            {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
            <span className="text-sm font-semibold">{name}</span>
        </div>
    );
};
