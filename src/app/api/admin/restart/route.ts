import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

async function isAdmin(email: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("email").eq("email", email).single();
  return !!data;
}

export async function POST() {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !(await isAdmin(email))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const vercelToken = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!vercelToken || !projectId) {
      return NextResponse.json({ error: "Tokens de Vercel no configurados" }, { status: 500 });
    }

    // Get the latest deployment to redeploy
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&state=READY`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );

    if (!deploymentsRes.ok) {
      const errText = await deploymentsRes.text();
      return NextResponse.json({ error: `Error obteniendo deployments: ${errText}` }, { status: 500 });
    }

    const deploymentsData = await deploymentsRes.json();
    const latestDeployment = deploymentsData.deployments?.[0];

    if (!latestDeployment) {
      return NextResponse.json({ error: "No se encontró un deployment activo" }, { status: 404 });
    }

    // Trigger a redeploy
    const redeployRes = await fetch(
      `https://api.vercel.com/v13/deployments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: latestDeployment.name,
          deploymentId: latestDeployment.uid,
          target: "production",
        }),
      }
    );

    if (!redeployRes.ok) {
      const errText = await redeployRes.text();
      return NextResponse.json({ error: `Error en redeploy: ${errText}` }, { status: 500 });
    }

    const redeployData = await redeployRes.json();

    return NextResponse.json({
      success: true,
      message: "Servidor reiniciado exitosamente. El redeploy está en progreso.",
      deploymentUrl: redeployData.url || null,
      deploymentId: redeployData.id || redeployData.uid || null,
    });
  } catch (err: any) {
    console.error("Error en restart:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
