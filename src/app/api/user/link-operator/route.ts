import { NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const meta = user.publicMetadata as any;

    // Check if already linked (irreversible)
    if (meta?.linkedOperatorId) {
      return NextResponse.json({
        error: "Tu cuenta ya está vinculada a un operador. Este enlace es permanente.",
        linkedOperatorId: meta.linkedOperatorId
      }, { status: 400 });
    }

    // Operators cannot link to other operators
    if (meta?.role === "operator") {
      return NextResponse.json({ error: "Los operadores no pueden vincularse a otros operadores." }, { status: 400 });
    }

    const { affiliateCode } = await request.json();
    if (!affiliateCode) {
      return NextResponse.json({ error: "Código de afiliado requerido." }, { status: 400 });
    }

    // Find the operator with this affiliate code
    const client = await clerkClient();
    const response = await client.users.getUserList({ limit: 500 });

    const operator = response.data.find(u => {
      const uMeta = u.publicMetadata as any;
      return uMeta?.role === "operator" && uMeta?.affiliateCode === affiliateCode.toUpperCase();
    });

    if (!operator) {
      return NextResponse.json({ error: "Código de afiliado inválido. Verifica e intenta de nuevo." }, { status: 404 });
    }

    // Link: write the operator's ID into the user's metadata (permanent)
    await client.users.updateUserMetadata(user.id, {
      publicMetadata: {
        linkedOperatorId: operator.id
      }
    });

    const operatorName = `${operator.firstName || ''} ${operator.lastName || ''}`.trim() || 'Operador';

    return NextResponse.json({
      success: true,
      message: `Tu cuenta fue vinculada exitosamente a la agencia de ${operatorName}.`,
      operatorName
    });

  } catch (error: any) {
    console.error("Error vinculando usuario a operador:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
