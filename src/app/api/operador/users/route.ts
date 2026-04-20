import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const meta = user.publicMetadata as any;
    if (meta?.role !== "operator") {
      return NextResponse.json({ error: "No eres un operador autorizado." }, { status: 403 });
    }

    const operatorId = user.id;
    const client = await clerkClient();

    // Fetch all users and filter by linkedOperatorId
    const response = await client.users.getUserList({
      orderBy: "-created_at",
      limit: 500
    });

    const subAgents = response.data
      .filter(u => (u.publicMetadata as any)?.linkedOperatorId === operatorId)
      .map(u => {
        const email = u.emailAddresses[0]?.emailAddress || 'Sin Email';
        const uMeta = u.publicMetadata as any;
        return {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Desconocido',
          email,
          avatar: u.imageUrl,
          credits: uMeta?.credits,
          plan: uMeta?.plan || 'FREE',
          vipExpiresAt: uMeta?.vipExpiresAt,
          createdAt: u.createdAt,
          activityLogs: uMeta?.activityLogs || []
        };
      });

    return NextResponse.json({
      success: true,
      operator: {
        id: operatorId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        affiliateCode: meta.affiliateCode,
        inventory: meta.operatorInventory || { vipTokens: 0, credits: 0 }
      },
      subAgents
    });
  } catch (error: any) {
    console.error("Error cargando sub-agentes del operador:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
