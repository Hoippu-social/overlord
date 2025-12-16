import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
    // Verify session
    const session = (await cookies()).get('session');
    if (!session?.value) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
