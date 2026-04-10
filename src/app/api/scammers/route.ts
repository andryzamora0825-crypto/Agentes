import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUser } from "@clerk/nextjs/server";

const ADMIN_EMAIL = "andryzamora0825@gmail.com";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const email = user.primaryEmailAddress?.emailAddress || "";
    const isAdmin = email === ADMIN_EMAIL;
    const plan = (user.publicMetadata as any)?.plan || "FREE";
    const isVip = plan === "VIP";

    // Solo Admin y VIP pueden reportar estafadores
    if (!isAdmin && !isVip) {
      return NextResponse.json({ error: "Se requiere plan VIP para reportar estafadores." }, { status: 403 });
    }

    const formData = await request.formData();
    const phone_number = formData.get("phone_number") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    
    // Validar teléfono obligatorio
    if (!phone_number) {
      return NextResponse.json({ error: "El teléfono es obligatorio." }, { status: 400 });
    }

    const mainPhoto = formData.get("main_photo") as File | null;
    const proofFiles: File[] = [];
    for (let i = 0; i < 5; i++) {
      const proof = formData.get(`proof_${i}`) as File | null;
      if (proof && proof.size > 0) {
        proofFiles.push(proof);
      }
    }

    // Helper to upload to Supabase Storage
    const uploadFile = async (file: File, folder: string) => {
      const extension = file.name.split('.').pop();
      const filename = `${folder}/${crypto.randomUUID()}.${extension}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabase.storage
        .from('scammers-evidence')
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error("Storage upload error:", error);
        throw new Error("Error al subir archivo");
      }

      // Obtener URL Pública
      const { data: publicUrlData } = supabase.storage
        .from('scammers-evidence')
        .getPublicUrl(filename);

      return publicUrlData.publicUrl;
    };

    let photo_url = null;
    if (mainPhoto && mainPhoto.size > 0) {
      photo_url = await uploadFile(mainPhoto, "profiles");
    }

    const proof_urls: string[] = [];
    for (const file of proofFiles) {
      const url = await uploadFile(file, "proofs");
      proof_urls.push(url);
    }

    // Insertar en la Base de Datos
    const { data: scammerData, error: dbError } = await supabase
      .from("scammers")
      .insert({
        phone_number,
        name: name || null,
        description: description || null,
        photo_url,
        proof_urls,
        created_by: email
      })
      .select()
      .single();

    if (dbError) {
      console.error("Supabase DB Insert Error:", dbError);
      return NextResponse.json({ error: "Error al registrar en la base de datos." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: scammerData });

  } catch (error: any) {
    console.error("Error global en carga de estafador:", error);
    return NextResponse.json({ error: "Ocurrió un error interno durante el proceso." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: "Se requiere un número de teléfono para la búsqueda." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('scammers')
      .select('*')
      .eq('phone_number', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found in Supabase return
         return NextResponse.json({ found: false });
      }
      throw error;
    }

    return NextResponse.json({ found: true, data });
  } catch (error: any) {
    console.error("Error al buscar estafador:", error);
    return NextResponse.json({ error: "Error interno en el servidor." }, { status: 500 });
  }
}
