import React from 'react';
import { cn } from "@nextui-org/react";

interface RoleChipProps {
    name: string;
    color: string; // Hex color from Discord API
    icon?: React.ReactNode;
    className?: string;
}

export const RoleChip: React.FC<RoleChipProps> = ({ name, color, icon, className }) => {
    // If color is default (0), use a fallback gray
    const roleColor = color === '#000000' || color === '0' ? '#B5BAC1' : color;

    // Convert hex to RGB for background opacity
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 181, g: 186, b: 193 };
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
