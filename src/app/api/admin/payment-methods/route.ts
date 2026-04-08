import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: ["andryzamora0825@gmail.com"] });
    if (users.data && users.data.length > 0) {
      const admin = users.data[0];
      const settings = admin.publicMetadata?.whatsappSettings as any;
      const banks = settings?.banksInfo || "Banco Pichincha: Cuenta ahorros 2207901170 | Andry Zamora";
      return NextResponse.json({ success: true, banksInfo: banks });
    }
    return NextResponse.json({ success: true, banksInfo: "Banco Pichincha: Cuenta de Ahorros 2207901170 | Andry Zamora" });
  } catch (err: any) {
    console.error("Error fetching admin payment methods:", err);
    return NextResponse.json({ success: true, banksInfo: "Banco Pichincha: Cuenta de Ahorros 2207901170 | Andry Zamora" });
  }
}
