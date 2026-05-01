import fs from 'fs';
const f = 'src/app/dashboard/admin/page.tsx';
let c = fs.readFileSync(f, 'utf-8');

// 1. Add state variable
c = c.replace(
  /const \[addingAdmin, setAddingAdmin\] = useState\(false\);/,
  `const [addingAdmin, setAddingAdmin] = useState(false);\n  const [showLogosModal, setShowLogosModal] = useState(false);`
);

// 2. Add header button
c = c.replace(
  /<button onClick=\{restartServer\}/,
  `<button onClick={() => setShowLogosModal(true)} className="bg-emerald-500/10 text-emerald-400 font-semibold px-3 py-2 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 text-xs border border-emerald-500/20"><Upload className="w-3.5 h-3.5" /> Logos Globales</button>
            <button onClick={restartServer}`
);

// 3. Remove the block from the main body
const blockRegex = /\s*\{\/\* Control de Logos Multiplataforma Globales \*\/\}[\s\S]*?(?=\s*<div className="flex flex-col xl:flex-row justify-between)/;
c = c.replace(blockRegex, '');

// 4. Inject Modal at the end
const modalHTML = `
      {/* MODAL LOGOS GLOBALES */}
      {showLogosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
           <div className="bg-[#111111] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-5xl w-full relative my-auto">
              <button onClick={() => setShowLogosModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Upload className="w-5 h-5 text-emerald-400" /> Logos Globales (Identidad Visual)</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  { id: "ecuabet", name: "Ecuabet", color: "text-[#FFDE00]" },
                  { id: "doradobet", name: "DoradoBet", color: "text-[#F5A623]" },
                  { id: "masparley", name: "MasParley", color: "text-[#e82f2f]" },
                  { id: "databet", name: "DataBet", color: "text-[#1d4ed8]" },
                  { id: "astrobet", name: "AstroBet", color: "text-[#4A8FE7]" },
                ].map((plat) => (
                  <div key={plat.id} className="bg-[#0A0A0A] border border-white/[0.08] p-4 rounded-xl flex flex-col items-center gap-4 group hover:border-emerald-500/30 transition-colors">
                    <span className={\`font-black uppercase tracking-widest \${plat.color} text-[10px]\`}>{plat.name}</span>
                    
                    <div className="relative w-full aspect-square bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex items-center justify-center p-2">
                      <img 
                        src={\`\${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-generations/agency-assets/default_\${plat.id}.png?t=\${imageTokens[plat.id] || 1}\`} 
                        alt={plat.name}
                        className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity drop-shadow-md"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.1'; }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                      />
                    </div>

                    <label className="cursor-pointer bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 text-white/50 transition-colors border border-white/10 rounded-lg px-4 py-2 flex items-center justify-center gap-2 w-full">
                      {uploadingPlatform === plat.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Cambiar</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/png, image/jpeg" 
                        onChange={(e) => handleUploadGlobalLogo(e, plat.id)}
                        disabled={uploadingPlatform !== null}
                      />
                    </label>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
`;

c = c.replace(
  /(\s*<\/div>\s*\);\s*\}\s*)$/,
  modalHTML + '$1'
);

fs.writeFileSync(f, c, 'utf-8');
console.log("Logos modal refactored!");
