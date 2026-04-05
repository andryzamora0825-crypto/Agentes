import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import SidebarNav from "@/components/SidebarNav";
import ClientSidebarWrapper from "@/components/ClientSidebarWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Proteger ruta, debe estar autenticado
  if (!userId) {
    redirect("/");
  }

  return (
    <ClientSidebarWrapper 
      userButton={<UserButton />}
      sidebarNav={<SidebarNav />}
    >
      {children}
    </ClientSidebarWrapper>
  );
}
