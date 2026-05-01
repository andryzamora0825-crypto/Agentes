// Script to patch admin panel with new features
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/dashboard/admin/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace header section (lines 567-594 area)
const headerOld = `         <div className="z-10 relative">
           <h1 className="text-xl font-semibold tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-[#FFDE00]" />
              Panel de Administración
            </h1>
            <p className="text-white/30 mt-1 text-sm max-w-md">Supervisa y controla los balances económicos y rangos de los agentes en tiempo real.</p>
            
            <button 
              onClick={() => router.push('/dashboard/admin/codigos')}
              className="mt-6 bg-[#FFDE00] text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition-all flex items-center gap-2 text-sm max-w-max"
            >
              <Ticket className="w-4 h-4" />
              Generar Códigos Promo
            </button>
         </div>

         {/* Stats Rápidas */}
         <div className="flex items-center gap-4 z-10 relative">
            <div className="bg-[#0A0A0A] border border-white/[0.06] p-4 rounded-lg text-center min-w-[120px]">
               <div className="text-2xl font-bold">{totalAgents}</div>
               <div className="text-[10px] text-white/30 uppercase tracking-widest font-medium mt-1">Agentes</div>
            </div>
            <div className="bg-[#0A0A0A] border border-white/[0.06] p-4 rounded-lg text-center min-w-[120px]">
               <div className="text-2xl font-bold text-[#FFDE00]">{totalVips}</div>
               <div className="text-[10px] text-[#FFDE00]/30 uppercase tracking-widest font-medium mt-1">VIPs</div>
            </div>
         </div>
      </div>`;

const headerNew = `         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2.5"><ShieldCheck className="w-5 h-5 text-[#FFDE00]" /> Panel Admin</h1>
             <p className="text-white/30 mt-1 text-xs">Control de agentes, economía y despliegue.</p>
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

      {/* Actividad Reciente */}
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
      )}`;

if (content.includes(headerOld)) {
  content = content.replace(headerOld, headerNew);
  console.log('✅ Header replaced');
} else {
  console.log('⚠️ Header not found - trying normalized');
  // Try normalizing line endings
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedOld = headerOld.replace(/\r\n/g, '\n');
  if (normalizedContent.includes(normalizedOld)) {
    content = content.replace(/\r\n/g, '\n').replace(normalizedOld, headerNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n');
    console.log('✅ Header replaced (normalized)');
  } else {
    console.log('❌ Header still not found');
  }
}

// 2. Replace logo section with compact version
const logosOld = `      {/* Control de Logos Multiplataforma Globales */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg relative mt-6">
        <h2 className="text-lg font-semibold text-white/90 mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-400" />
          Logos de Plataformas (Globales)
        </h2>
        <p className="text-white/30 text-sm mb-6 max-w-2xl">
          Sube aquí los logos base sin fondo (.PNG) de altísima calidad. Estos logotipos serán inyectados mágicamente en el cerebro de la IA para cualquier agente que utilice estas plataformas. Al subirlos, sobrescribirán a los anteriores inmediatamente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">`;

const logosNew = `      {/* Logos Multiplataforma (Compactos) */}
      <div className="bg-[#141414] border border-white/[0.06] p-4 rounded-lg">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" /> Logos Globales
        </h2>
        <div className="flex flex-wrap gap-3">`;

if (content.includes(logosOld)) {
  content = content.replace(logosOld, logosNew);
  console.log('✅ Logos header replaced');
} else {
  const nc = content.replace(/\r\n/g, '\n');
  const no = logosOld.replace(/\r\n/g, '\n');
  if (nc.includes(no)) {
    content = nc.replace(no, logosNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n');
    console.log('✅ Logos header replaced (normalized)');
  } else {
    console.log('❌ Logos header not found');
  }
}

// 3. Replace individual logo cards with compact version
const logoCardOld = `          <div key={plat.id} className="bg-[#0A0A0A] border border-white/[0.08] p-4 rounded-xl flex flex-col items-center text-center gap-3 group relative">
              <span className={\`font-bold \${plat.color} text-sm z-10\`}>{plat.name}</span>
               
              <div className="relative w-full aspect-square bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex items-center justify-center p-4">
                <img 
                  src={\`\${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-generations/agency-assets/default_\${plat.id}.png?t=\${imageTokens[plat.id] || 1}\`} 
                  alt={plat.name}
                  className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.1'; }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                />
              </div>

              <label className="cursor-pointer bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-lg px-4 py-2 flex flex-col items-center justify-center w-full min-h-[50px] z-10">
                {uploadingPlatform === plat.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-white/40 mb-1" />
                    <span className="text-[10px] text-white/40 font-medium">Reemplazar PNG</span>
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
            </div>`;

const logoCardNew = `          <div key={plat.id} className="bg-[#0A0A0A] border border-white/[0.08] p-2 rounded-lg flex items-center gap-3 group relative">
              <div className="w-12 h-12 shrink-0 bg-[#141414] border border-white/5 rounded-lg overflow-hidden flex items-center justify-center p-1">
                <img 
                  src={\`\${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ai-generations/agency-assets/default_\${plat.id}.png?t=\${imageTokens[plat.id] || 1}\`} 
                  alt={plat.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.1'; }}
                />
              </div>
              <span className={\`font-bold \${plat.color} text-xs\`}>{plat.name}</span>
              <label className="ml-auto cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 flex items-center gap-1">
                {uploadingPlatform === plat.id ? <Loader2 className="w-3 h-3 animate-spin text-white/50" /> : <Upload className="w-3 h-3 text-white/40" />}
                <span className="text-[9px] text-white/40 font-medium">PNG</span>
                <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleUploadGlobalLogo(e, plat.id)} disabled={uploadingPlatform !== null} />
              </label>
            </div>`;

if (content.includes(logoCardOld)) {
  content = content.replace(logoCardOld, logoCardNew);
  console.log('✅ Logo cards replaced');
} else {
  const nc = content.replace(/\r\n/g, '\n');
  const no = logoCardOld.replace(/\r\n/g, '\n');
  if (nc.includes(no)) {
    content = nc.replace(no, logoCardNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n');
    console.log('✅ Logo cards replaced (normalized)');
  } else {
    console.log('❌ Logo cards not found');
  }
}

// 4. Replace credit system 
const creditsOld = `                   {/* Economía de Créditos */}
                   <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                     <div>
                       <div className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Billetera de Créditos</div>
                       <div className="flex items-center gap-3">
                          <Coins className="w-6 h-6 text-[#FFDE00]" />
                          {u.credits === undefined ? (
                            <span className="text-sm font-semibold text-white/30 italic drop-shadow-md">Aún sin Billetera</span>
                          ) : (
                            <span className="text-2xl font-black text-white tracking-tight">{u.credits.toLocaleString()}</span>
                          )}
                       </div>
                     </div>

                     <div className="flex items-center gap-2 bg-[#0A0A0A] p-2 rounded-xl border border-white/[0.06]">
                        <button 
                          onClick={() => modifyCredits(u.id, u.credits, -1000)}
                          disabled={processingId === u.id || (u.credits !== undefined && u.credits <= 0)}
                          className="w-10 h-10 rounded-lg bg-white/[0.04] text-white/50 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Restar 1,000"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => modifyCredits(u.id, u.credits, 1000)}
                          disabled={processingId === u.id}
                          className="w-10 h-10 rounded-lg bg-white/[0.04] text-white/50 flex items-center justify-center hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors disabled:opacity-50"
                          title="Añadir 1,000"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-white/[0.06] mx-2"></div>
                        <button 
                          onClick={() => modifyCredits(u.id, u.credits, 10000)}
                          disabled={processingId === u.id}
                          className="px-4 h-10 rounded-lg text-[11px] font-black bg-[#FFDE00]/10 text-[#FFDE00] border border-[#FFDE00]/20 hover:bg-[#FFDE00] hover:text-black transition-all disabled:opacity-50"
                          title="Inyectar Paquete Master"
                        >
                          MASTER +10K
                        </button>
                     </div>
                   </div>`;

const creditsNew = `                   {/* VIP Countdown */}
                   {u.plan === 'VIP' && u.vipExpiresAt && (
                     <div className={\`flex items-center gap-3 p-3 rounded-xl border \${vipTimers[u.id] === 'VENCIDO' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#FFDE00]/5 border-[#FFDE00]/10'}\`}>
                       <Clock className={\`w-4 h-4 \${vipTimers[u.id] === 'VENCIDO' ? 'text-red-400' : 'text-[#FFDE00]'}\`} />
                       <span className={\`text-xs font-mono font-bold \${vipTimers[u.id] === 'VENCIDO' ? 'text-red-400' : 'text-[#FFDE00]'}\`}>{vipTimers[u.id] || '...'}</span>
                       <span className="text-[10px] text-white/30">restantes VIP</span>
                     </div>
                   )}

                   {/* Credits */}
                   <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                     <div>
                       <div className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Billetera</div>
                       <div className="flex items-center gap-3">
                          <Coins className="w-6 h-6 text-[#FFDE00]" />
                          {u.credits === undefined ? (
                            <span className="text-sm font-semibold text-white/30 italic">Sin Billetera</span>
                          ) : (
                            <span className="text-2xl font-black text-white tracking-tight">{u.credits.toLocaleString()}</span>
                          )}
                       </div>
                     </div>
                     <div className="flex items-center gap-2 bg-[#0A0A0A] p-2 rounded-xl border border-white/[0.06]">
                        <input type="number" min="1" placeholder="Cant." value={creditAmounts[u.id] || ''} onChange={e => setCreditAmounts(prev => ({ ...prev, [u.id]: e.target.value }))} className="w-24 h-10 bg-white/[0.04] text-white text-center text-sm font-bold rounded-lg border border-white/[0.06] focus:outline-none focus:border-[#FFDE00]/30 placeholder-white/20" />
                        <button onClick={() => { const amt = parseInt(creditAmounts[u.id] || '0'); if (amt > 0) modifyCredits(u.id, u.credits, -amt); }} disabled={processingId === u.id || !creditAmounts[u.id]} className="h-10 px-3 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center gap-1 hover:bg-red-500/20 transition-colors disabled:opacity-50 text-[10px] font-bold border border-red-500/20"><Minus className="w-3.5 h-3.5" /> Restar</button>
                        <button onClick={() => { const amt = parseInt(creditAmounts[u.id] || '0'); if (amt > 0) modifyCredits(u.id, u.credits, amt); }} disabled={processingId === u.id || !creditAmounts[u.id]} className="h-10 px-3 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center gap-1 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 text-[10px] font-bold border border-emerald-500/20"><Plus className="w-3.5 h-3.5" /> Sumar</button>
                     </div>
                   </div>`;

if (content.includes(creditsOld)) {
  content = content.replace(creditsOld, creditsNew);
  console.log('✅ Credits replaced');
} else {
  const nc = content.replace(/\r\n/g, '\n');
  const no = creditsOld.replace(/\r\n/g, '\n');
  if (nc.includes(no)) {
    content = nc.replace(no, creditsNew.replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n');
    console.log('✅ Credits replaced (normalized)');
  } else {
    console.log('❌ Credits not found');
  }
}

// 5. Add Admin Modal before the closing </div> and )
const closingPattern = `    </div>
  );
}`;

const adminModal = `      {/* MODAL ADMINISTRADORES */}
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

`;

if (content.includes(closingPattern)) {
  content = content.replace(closingPattern, adminModal + closingPattern);
  console.log('✅ Admin modal added');
} else {
  const nc = content.replace(/\r\n/g, '\n');
  const no = closingPattern.replace(/\r\n/g, '\n');
  if (nc.includes(no)) {
    content = nc.replace(no, (adminModal + closingPattern).replace(/\r\n/g, '\n')).replace(/\n/g, '\r\n');
    console.log('✅ Admin modal added (normalized)');
  } else {
    console.log('❌ Closing pattern not found');
  }
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('\n🎉 Patch complete! File saved.');
