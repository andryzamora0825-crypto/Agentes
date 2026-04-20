import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A] items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Bienvenido a Zamtools</h1>
          <p className="text-white/40 text-sm">Ingresa para continuar a tu panel de operaciones</p>
        </div>
        
        <div className="flex justify-center">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: "bg-[#FFDE00] text-black hover:brightness-110",
                card: "bg-[#111111] border border-white/[0.08] shadow-2xl",
                headerTitle: "text-white hidden",
                headerSubtitle: "text-white/40 hidden",
                socialButtonsBlockButton: "border-white/[0.08] text-white hover:bg-white/[0.02]",
                socialButtonsBlockButtonText: "text-white/80 font-medium",
                dividerLine: "bg-white/[0.08]",
                dividerText: "text-white/40",
                formFieldLabel: "text-white/80",
                formFieldInput: "bg-[#0A0A0A] border-white/[0.08] text-white",
                footerActionText: "text-white/40",
                footerActionLink: "text-[#FFDE00] hover:text-[#FFDE00]/80"
              }
            }}
            path="/sign-in" 
            routing="path" 
            signUpUrl="/sign-up" 
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}
