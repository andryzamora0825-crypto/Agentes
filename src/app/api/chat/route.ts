import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { content, receiver_email } = body;
    const sender_email = user.primaryEmailAddress?.emailAddress;
    const sender_name = user.fullName || user.firstName || "Usuario";
    const sender_avatar = user.imageUrl;

    if (!content || !receiver_email || !sender_email) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const { error } = await supabase.from("chats").insert({
      sender_email,
      sender_name,
      sender_avatar,
      receiver_email,
      content
    });

    if (error) throw error;

    // Auto-respuesta del sistema para confirmar compra
    if (content.includes("confirmo mi intención de comprar el *Plan VIP*") || content.includes("confirmo mi intención de recargar")) {
      await supabase.from("chats").insert({
        sender_email: "andryzamora0825@gmail.com",
        sender_name: "Soporte Zamtools",
        sender_avatar: "https://ui-avatars.com/api/?name=Soporte&background=FFDE00&color=000",
        receiver_email: sender_email,
        content: "✅ ¡Hola! Hemos recibido tu solicitud de compra en la tienda.\n\nPor favor, realiza tu pago a la siguiente cuenta oficial:\n\n🏦 Banco Pichincha\n🔹 Cuenta de ahorro transaccional\n🔹 Número: 2215379279\n🔹 A nombre de Andry Zamora\n\nUna vez realizada la transferencia, adjunta la captura del comprobante por este chat. Te validaremos de inmediato para activar tu compra."
      });
    } else if (content.includes("Quiero solicitar la creación de un")) {
      await supabase.from("chats").insert({
        sender_email: "andryzamora0825@gmail.com",
        sender_name: "Soporte Zamtools",
        sender_avatar: "https://ui-avatars.com/api/?name=Soporte&background=FFDE00&color=000",
        receiver_email: sender_email,
        content: "✅ ¡Hola! Hemos recibido tu solicitud de Servicio con Inteligencia Artificial.\n\nPor favor, para proceder con la creación de tu Video Personalizado, envíanos por aquí:\n\n1. Ideas o guion principal.\n2. Imágenes o videos de referencia.\n3. Si deseas incluir a una persona en específico (adjunta fotos claras de su rostro).\n4. Nombre de tu agencia y detalles adicionales relevantes.\n\n🎬 *Nota:* Descontaremos los créditos tras confirmar todo. El proceso de creación súper hiperrealista puede tomar hasta **24 horas** a partir de la entrega de requerimientos. ¡Quedamos atentos a tus instrucciones!"
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error enviando chat:", error);
    return NextResponse.json({ error: "Error enviando el mensaje." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const email = user.primaryEmailAddress?.emailAddress;
    const isAdmin = email === "andryzamora0825@gmail.com";

    // Acción para Administrador: Obtener la lista única de usuarios que le han escrito
    if (isAdmin && action === "get_contacts") {
      // Obtenemos todos los chats donde receiver es admin o sender es admin
      const { data, error } = await supabase
        .from("chats")
        .select("sender_email, sender_name, sender_avatar, receiver_email, is_read, created_at, content")
        .or(`receiver_email.eq.${email},sender_email.eq.${email}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Agrupar contactos únicos (el opuesto a mí)
      const contactsMap = new Map();
      
      data.forEach(msg => {
        const contactEmail = msg.sender_email === email ? msg.receiver_email : msg.sender_email;
        if (!contactsMap.has(contactEmail) && contactEmail !== email) {
          contactsMap.set(contactEmail, {
            email: contactEmail,
            name: msg.sender_email === contactEmail ? msg.sender_name : (msg.receiver_email===contactEmail ? "Usuario" : msg.sender_name),
            avatar: msg.sender_email === contactEmail ? msg.sender_avatar : null, // Simplificado
            lastMessage: msg.content,
            time: msg.created_at,
            unread: 0
          });
        }
        
        // Sumar mensajes no leídos para este contacto
        if (msg.receiver_email === email && msg.is_read === false) {
          const contact = contactsMap.get(contactEmail);
          if (contact) {
            contact.unread += 1;
          }
        }
      });

      return NextResponse.json({ success: true, contacts: Array.from(contactsMap.values()) });
    }

    // Acción: Obtener contador de mensajes no leídos para el usuario actual
    if (action === "unread_count") {
      const { count, error } = await supabase
        .from("chats")
        .select('*', { count: 'exact', head: true })
        .eq("receiver_email", email)
        .eq("is_read", false);
      if (error) throw error;
      return NextResponse.json({ success: true, count: count || 0 });
    }

    // Acción General: Cargar la conversación entre 2 personas
    const targetEmail = searchParams.get("targetEmail") || "andryzamora0825@gmail.com"; // Por defecto, agentes hablan con admin
    
    // Validar: Si un agente pide chats, targetEmail OBLIGATORIAMENTE debe ser el admin (evita que espien)
    if (!isAdmin && targetEmail !== "andryzamora0825@gmail.com") {
      return NextResponse.json({ error: "Restringido" }, { status: 403 });
    }

    // Marcar los mensajes como leídos si yo soy el receptor
    await supabase
      .from("chats")
      .update({ is_read: true })
      .eq("receiver_email", email)
      .eq("sender_email", targetEmail)
      .eq("is_read", false);

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .or(`and(sender_email.eq.${email},receiver_email.eq.${targetEmail}),and(sender_email.eq.${targetEmail},receiver_email.eq.${email})`)
      .order("created_at", { ascending: true }) // Viejos arriba, nuevos abajo
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ success: true, messages: data });
  } catch (error: any) {
    console.error("Error leyendo chats:", error);
    return NextResponse.json({ error: "Error leyendo la conversación." }, { status: 500 });
  }
}
