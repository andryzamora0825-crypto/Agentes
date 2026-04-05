"use client";
import { useAuth } from "@clerk/nextjs";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function NavbarAuth() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button className="bg-[#FFDE00] text-black px-5 py-2 rounded-xl font-black text-sm hover:bg-[#FFC107] hover:shadow-[0_0_15px_rgba(255,222,0,0.4)] transition-all">
        Iniciar Sesión
      </button>
    </SignInButton>
  );
}

export function HeroCTA() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) {
    return (
      <Link
        href="/dashboard"
        className="bg-[#FFDE00] text-black font-black px-8 py-3.5 rounded-2xl shadow-[0_0_25px_rgba(255,222,0,0.3)] hover:bg-[#FFC107] hover:shadow-[0_0_40px_rgba(255,222,0,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
      >
        Ir al Panel <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }
  return (
    <SignInButton mode="modal">
      <button className="bg-[#FFDE00] text-black font-black px-8 py-3.5 rounded-2xl shadow-[0_0_25px_rgba(255,222,0,0.3)] hover:bg-[#FFC107] hover:shadow-[0_0_40px_rgba(255,222,0,0.5)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm uppercase tracking-widest">
        Empezar Ahora <ArrowRight className="w-4 h-4" />
      </button>
    </SignInButton>
  );
}
