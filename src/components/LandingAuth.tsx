"use client";
import { useAuth } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function NavbarAuth() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <UserButton />;
  return (
    <Link href="/sign-in">
      <button className="bg-[#FFDE00] text-black px-4 py-2 rounded-lg font-semibold text-xs hover:brightness-110 transition-all">
        Iniciar Sesión
      </button>
    </Link>
  );
}

export function HeroCTA() {
  const { isSignedIn } = useAuth();
  const cls = "bg-[#FFDE00] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-all flex items-center gap-2 text-sm";
  if (isSignedIn) {
    return (
      <Link href="/dashboard" className={cls}>
        Ir al Panel <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }
  return (
    <Link href="/sign-in">
      <button className={cls}>
        Empezar Ahora <ArrowRight className="w-4 h-4" />
      </button>
    </Link>
  );
}
