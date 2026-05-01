import fs from 'fs';
const f = 'src/app/dashboard/admin/page.tsx';
let c = fs.readFileSync(f, 'utf-8');

// 1. Header: replace stats block
c = c.replace(
  /(<div className="z-10 relative">[\s\S]*?<\/div>\s*{\/\* Stats[\s\S]*?<\/div>\s*<\/div>\s*<\/div>)/,
  `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2.5"><ShieldCheck className="w-5 h-5 text-[#FFDE00]" /> Panel Admin</h1>
             <p className="text-white/30 mt-1 text-xs">Control de agentes y despliegue.</p>
           </div>
           <div className="flex items-center gap-2">
              <div className="bg-[#0A0A0A] border border-white/[0.06] px-3 py-2 rounded-lg text-center"><div className="text-lg font-bold">{totalAgents}</div><div className="text-[8px] text-white/30 uppercase tracking-widest font-medium">Agentes</div></div>
              <div className="bg-[#0A0A0A] border border-white/[0.06] px-3 py-2 rounded-lg text-center"><div className="text-lg font-bold text-[#FFDE00]">{totalVips}</div><div className="text-[8px] text-[#FFDE00]/30 uppercase tracking-widest font-medium">VIPs</div></div>
              <div className="bg-[#0A0A0A] border border-white/[0.06] px-3 py-2 rounded-lg text-center"><div className="text-lg font-bold text-red-400">{users.filter(u => u.plan === 'VIP' && u.vipExpiresAt && u.vipExpiresAt <= Date.now()).length}</div><div className="text-[8px] text-red-400/30 uppercase tracking-widest font-medium">Vencidos</div></div>
           </div>
         </div>
         <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <button onClick={() => router.push('/dashboard/admin/codigos')} className="bg-[#FFDE00]/10 text-[#FFDE00] font-semibold px-3 py-2 rounded-lg hover:bg-[#FFDE00]/20 transition-all flex items-center gap-1.5 text-xs border border-[#FFDE00]/20"><Ticket className="w-3.5 h-3.5" /> Promos</button>
            <button onClick={() => { setShowAdminModal(true); loadAdmins(); }} className="bg-blue-500/10 text-blue-400 font-semibold px-3 py-2 rounded-lg hover:bg-blue-500/20 transition-all flex items-center gap-1.5 text-xs border border-blue-500/20"><UserPlus className="w-3.5 h-3.5" /> Admins</button>
            <button onClick={restartServer} disabled={restarting} className="bg-red-500/10 text-red-400 font-semibold px-3 py-2 rounded-lg hover:bg-red-500/20 transition-all flex items-center gap-1.5 text-xs border border-red-500/20 disabled:opacity-50">{restarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} {restarting ? "Reiniciando..." : "Reiniciar"}</button>
         </div>
      </div>

      {recentImages.length > 0 && (
        <div className="bg-[#141414] border border-white/[0.06] p-4 rounded-lg">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5" /> Actividad Reciente</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {recentImages.map(img => (
              <div key={img.id} className="shrink-0 w-28 group cursor-pointer" onClick={() => setLightboxAdminUrl(img.image_url)}>
                <div className="w-28 h-28 rounded-lg overflow-hidden border border-white/[0.06] bg-[#0A0A0A]"><img src={img.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" /></div>
                <div className="flex items-center gap-1.5 mt-1.5"><img src={img.author_avatar_url || 'https://ui-avatars.com/api/?name=U'} alt="" className="w-4 h-4 rounded-full" /><span className="text-[9px] text-white/40 truncate">{img.author_name}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}`
);
console.log('1. Header + activity feed');

// 2. Compact logos
c = c.replace(
  /<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">/,
  '<div className="flex flex-wrap gap-3">'
);
c = c.replace(
  /Logos de Plataformas \(Globales\)/,
  'Logos Globales'
);
// Remove verbose logo description paragraph
c = c.replace(
  /<p className="text-white\/30 text-sm mb-6 max-w-2xl">\s*Sube aqu[\s\S]*?<\/p>/,
  ''
);
// Compact logo card
c = c.replace(
  /<div key=\{plat\.id\} className="bg-\[#0A0A0A\] border border-white\/\[0\.08\] p-4 rounded-xl flex flex-col items-center text-center gap-3 group relative">/,
  '<div key={plat.id} className="bg-[#0A0A0A] border border-white/[0.08] p-2 rounded-lg flex items-center gap-3 group">'
);
c = c.replace(
  /<span className=\{`font-bold \$\{plat\.color\} text-sm z-10`\}>/,
  '<span className={`font-bold ${plat.color} text-xs`}>'
);
// Replace the big square preview + upload with compact inline
c = c.replace(
  /(<div className="relative w-full aspect-square[\s\S]*?<\/div>\s*<\/div>)\s*(<label className="cursor-pointer bg-white\/5[\s\S]*?<\/label>)/,
  `<label className="ml-auto cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1">
                {uploadingPlatform === plat.id ? <Loader2 className="w-3 h-3 animate-spin text-white/50" /> : <Upload className="w-3 h-3 text-white/40" />}
                <span className="text-[9px] text-white/40 font-medium">PNG</span>
                <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleUploadGlobalLogo(e, plat.id)} disabled={uploadingPlatform !== null} />
              </label>`
);
console.log('2. Compact logos');

// 3. Credit system: replace fixed buttons with input
c = c.replace(
  /<div className="flex items-center gap-2 bg-\[#0A0A0A\] p-2 rounded-xl border border-white\/\[0\.06\]">\s*<button\s*onClick=\{[^}]*modifyCredits\(u\.id, u\.credits, -1000\)[^}]*\}[\s\S]*?MASTER \+10K\s*<\/button>\s*<\/div>/,
  `<div className="flex items-center gap-2 bg-[#0A0A0A] p-2 rounded-xl border border-white/[0.06]">
                        <input type="number" min="1" placeholder="Cant." value={creditAmounts[u.id] || ''} onChange={e => setCreditAmounts(prev => ({ ...prev, [u.id]: e.target.value }))} className="w-24 h-10 bg-white/[0.04] text-white text-center text-sm font-bold rounded-lg border border-white/[0.06] focus:outline-none focus:border-[#FFDE00]/30 placeholder-white/20" />
                        <button onClick={() => { const amt = parseInt(creditAmounts[u.id] || '0'); if (amt > 0) modifyCredits(u.id, u.credits, -amt); }} disabled={processingId === u.id || !creditAmounts[u.id]} className="h-10 px-3 rounded-lg bg-red-500/10 text-red-400 flex items-center gap-1 hover:bg-red-500/20 transition-colors disabled:opacity-50 text-[10px] font-bold border border-red-500/20"><Minus className="w-3.5 h-3.5" /> Restar</button>
                        <button onClick={() => { const amt = parseInt(creditAmounts[u.id] || '0'); if (amt > 0) modifyCredits(u.id, u.credits, amt); }} disabled={processingId === u.id || !creditAmounts[u.id]} className="h-10 px-3 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-1 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 text-[10px] font-bold border border-emerald-500/20"><Plus className="w-3.5 h-3.5" /> Sumar</button>
                     </div>`
);
console.log('3. Credit system');

// 4. Add VIP countdown before credits section
c = c.replace(
  /(\{\/\* Econom[\s\S]{0,30}ditos \*\/\})/,
  `{/* VIP Countdown */}
                   {u.plan === 'VIP' && u.vipExpiresAt && (
                     <div className={\`flex items-center gap-3 p-3 rounded-xl border \${vipTimers[u.id] === 'VENCIDO' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#FFDE00]/5 border-[#FFDE00]/10'}\`}>
                       <Clock className={\`w-4 h-4 \${vipTimers[u.id] === 'VENCIDO' ? 'text-red-400' : 'text-[#FFDE00]'}\`} />
                       <span className={\`text-xs font-mono font-bold \${vipTimers[u.id] === 'VENCIDO' ? 'text-red-400' : 'text-[#FFDE00]'}\`}>{vipTimers[u.id] || '...'}</span>
                       <span className="text-[10px] text-white/30">restantes VIP</span>
                     </div>
                   )}

                   $1`
);
console.log('4. VIP countdown');

// 5. Add admin modal before final closing
c = c.replace(
  /(\s*<\/div>\s*\);\s*\}\s*)$/,
  `
      {/* MODAL ADMINISTRADORES */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-[#111111] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full relative">
              <button onClick={() => setShowAdminModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" /> Administradores</h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {adminList.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-[#0A0A0A] border border-white/[0.06] p-3 rounded-lg">
                    <span className="text-sm text-white font-medium">{a.email}</span>
                    <button onClick={() => removeAdmin(a.email)} className="text-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="email" placeholder="email@nuevo-admin.com" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="flex-1 bg-[#0A0A0A] text-white text-sm border border-white/[0.06] rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/30" />
                <button onClick={addAdmin} disabled={addingAdmin} className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1">{addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar</button>
              </div>
           </div>
        </div>
      )}

$1`
);
console.log('5. Admin modal');

fs.writeFileSync(f, c, 'utf-8');
console.log('Done! File patched.');
