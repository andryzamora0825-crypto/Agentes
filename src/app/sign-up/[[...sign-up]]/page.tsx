import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A] items-center justify-center p-4">
      <div className="w-full max-w-md pt-8 pb-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Crear Cuenta</h1>
          <p className="text-white/40 text-sm">Únete a Zamtools para acceder al portal</p>
        </div>
        
        <div className="flex justify-center">
          <SignUp 
            appearance={{
              elements: {
                formButtonPrimary: "bg-[#FFDE00] text-black font-black uppercase tracking-widest hover:brightness-110",
                card: "bg-[#111111] border border-white/[0.08] shadow-[0_0_50px_rgba(255,222,0,0.05)]",
                headerTitle: "text-white hidden",
                headerSubtitle: "text-white/40 hidden",
                socialButtonsBlockButton: "border-white/[0.08] text-white hover:bg-white/[0.05] transition-colors",
                socialButtonsBlockButtonText: "text-white/80 font-bold",
                dividerLine: "bg-white/[0.08]",
                dividerText: "text-white/40",
                formFieldLabel: "text-white/80 text-xs font-bold uppercase tracking-wider",
                formFieldInput: "bg-[#0A0A0A] border-white/[0.08] text-white focus:border-[#FFDE00]/50 transition-colors",
                footerActionText: "text-white/40",
                footerActionLink: "text-[#FFDE00] hover:text-[#FFDE00]/80 font-bold"
              }
            }}
            path="/sign-up" 
            routing="path" 
            signInUrl="/sign-in"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}
