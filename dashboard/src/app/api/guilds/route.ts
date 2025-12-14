import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const guilds = await prisma.guild.findMany({
            select: {
                id: true,
                name: true,
                icon: true,
            }
        });
        return NextResponse.json(guilds);
    } catch (error) {
        console.error("Failed to fetch guilds:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
