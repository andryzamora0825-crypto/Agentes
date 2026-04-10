import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Requerimientos de Vercel Cron
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Obtener todos los usuarios con auto_generate = true
    const { data: users, error } = await supabase
      .from('social_settings')
      .select('user_id, meta_page_id, meta_page_access_token')
      .eq('auto_generate', true)
      .not('meta_page_access_token', 'is', null)
      .not('meta_page_id', 'is', null);

    if (error) {
      console.error("[Cron Trigger] Error fetching users:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: "No active users found for auto-publish." });
    }

    console.log(`[Cron Trigger] Despertando. Encontrados ${users.length} usuarios con auto_generate=TRUE. Iniciando ráfaga...`);

    // 2. Patrón Fan-Out: Invocar las lambdas asíncronamente
    const url = new URL(request.url);
    const workerBaseUrl = `${url.protocol}//${url.host}/api/cron/auto-publish-worker`;

    const dispatched = [];

    for (const u of users) {
      try {
        // Ejecución "Fire and Forget"
        fetch(`${workerBaseUrl}?userId=${u.user_id}`, { method: 'POST' }).catch(e => {
            console.error(`[Cron Trigger] Error despachando worker para ${u.user_id}:`, e);
        });
        dispatched.push(u.user_id);
      } catch (e: any) {
         console.error(`[Cron Trigger] Failed to dispatch ${u.user_id}`, e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Trigger successful. Dispatched ${dispatched.length} background workers.` 
    });

  } catch (error: any) {
    console.error('[Cron Trigger Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
