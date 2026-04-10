import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-8">
      <div className="max-w-2xl bg-white/5 p-8 rounded-3xl border border-white/10 text-gray-300 space-y-6">
        <h1 className="text-3xl font-black text-white">Política de Privacidad</h1>
        <p>Última actualización: {new Date().toLocaleDateString()}</p>
        
        <h2 className="text-xl font-bold text-white mt-6">1. Información que recopilamos</h2>
        <p>En ZamTools, recopilamos información básica de tu perfil público de Facebook e Instagram para permitir la automatización de publicaciones a través de la API oficial de Meta (Graph API).</p>
        
        <h2 className="text-xl font-bold text-white mt-6">2. Uso de la Información</h2>
        <p>Utilizamos tus credenciales únicamente para:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Leer la lista de páginas que administras para que puedas seleccionarlas.</li>
          <li>Publicar contenido de forma automatizada en tu nombre en la página autorizada.</li>
        </ul>

        <h2 className="text-xl font-bold text-white mt-6">3. Eliminación de tus Datos</h2>
        <p>Si deseas revocar nuestro acceso o eliminar tus datos de nuestros sistemas, puedes hacerlo en cualquier momento a través del panel de configuración de tu cuenta o eliminando la aplicación desde la configuración de seguridad de Facebook.</p>

        <h2 className="text-xl font-bold text-white mt-6">4. Contacto</h2>
        <p>Para cualquier duda sobre el uso de tus datos, puedes contactar al administrador del sistema.</p>
      </div>
    </div>
  );
}
