const { execSync } = require('child_process');
try {
  console.log('--- GIT STATUS ---');
  console.log(execSync('git status', { encoding: 'utf8' }));
  console.log('--- GIT LOG ---');
  console.log(execSync('git log --oneline -n 15', { encoding: 'utf8' }));
} catch (e) {
  console.error(e.message);
}
