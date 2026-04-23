const { exec } = require('child_process');

exec('npx tsc --noEmit src/app/dashboard/admin/page.tsx', (error, stdout, stderr) => {
    console.log(stdout || stderr || "Success!");
});
