'use client';

import React from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input } from '@nextui-org/react';
import { Palette } from '@phosphor-icons/react';

interface ColorPickerProps {
    color: number;
    onChange: (color: number) => void;
}

const PRESET_COLORS = [
    0x5865F2, // Blurple
    0xEB459E, // Fuchsia
    0xED4245, // Red
    0xFEE75C, // Yellow
    0x57F287, // Green
    0xFFFFFF, // White
    0x000000, // Black
    0x95A5A6, // Gray
];

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
    const hexColor = '#' + color.toString(16).padStart(6, '0');

    const handleHexChange = (val: string) => {
        const clean = val.replace('#', '');
        if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
            onChange(parseInt(clean, 16));
        }
    };

    return (
        <Popover placement="bottom">
            <PopoverTrigger>
                <div
                    className="w-full h-10 rounded-xl cursor-pointer border border-white/10 flex items-center justify-between px-3 hover:border-primary transition-colors"
                    style={{ backgroundColor: hexColor }}
                >
                    <span className="font-mono text-xs mix-blend-difference text-white opacity-80">{hexColor}</span>
                    <Palette className="mix-blend-difference text-white opacity-60" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="bg-[#181A20] border border-white/10 p-4 w-64">
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                className="w-8 h-8 rounded-full border border-white/10 hover:scale-110 transition-transform"
                                style={{ backgroundColor: '#' + c.toString(16).padStart(6, '0') }}
                                onClick={() => onChange(c)}
                            />
                        ))}
                    </div>
                    <Input
                        label="Hex Color"
                        placeholder="#FFFFFF"
                        variant="bordered"
                        size="sm"
                        value={hexColor}
                        onValueChange={(v) => handleHexChange(v)}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
