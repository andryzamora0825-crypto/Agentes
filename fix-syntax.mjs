import fs from 'fs';
const f = 'src/app/dashboard/admin/page.tsx';
let c = fs.readFileSync(f, 'utf-8');
const lines = c.split(/\r?\n/);

// Remove lines 596 and 597 (0-indexed 595, 596) which are:
// 596:         </div>
// 597:             </div>
// Actually, let's look at the correct structure that should be there:

const replacement = `        </div>
      )}

      {/* Campaña de Estados Masiva */}
      <div className="bg-[#141414] border border-white/[0.06] p-5 sm:p-6 rounded-lg relative overflow-hidden mt-6">
         <div className="flex items-start gap-4 z-10 relative">
            <div className="bg-purple-500/10 p-2 rounded-lg hidden sm:block">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">`;

// Let's replace lines 595 to 598 (inclusive) with our replacement
// 596:         </div>
// 597:             </div>
// 598:             <div className="flex-1">
lines.splice(595, 3, replacement);

fs.writeFileSync(f, lines.join('\n'), 'utf-8');
console.log("¡Arreglado!");
