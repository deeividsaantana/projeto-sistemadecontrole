import lighthouse from 'lighthouse';
import { writeFileSync } from 'fs';

const url = 'http://localhost:4174';

console.log(`\n🔍 Running Lighthouse audit on ${url}...`);
console.log('This may take 2-3 minutes...\n');

try {
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  };

  const runnerResult = await lighthouse(url, options);
  const json = JSON.stringify(runnerResult.lhr, null, 2);

  writeFileSync('lighthouse-results.json', json);

  // Extract and display scores
  const categories = runnerResult.lhr.categories;
  console.log('\n✅ Lighthouse Audit Complete!\n');
  console.log('📊 Scores (0-100):');
  console.log('┌─────────────────────────┬────────┬──────────┐');
  console.log('│ Category                │ Score  │ Status   │');
  console.log('├─────────────────────────┼────────┼──────────┤');

  const results = [];
  for (const [key, category] of Object.entries(categories)) {
    const score = Math.round(category.score * 100);
    const status = score >= 90 ? '✅ PASS' : score >= 50 ? '⚠️  WARN' : '❌ FAIL';
    console.log(`│ ${key.padEnd(23)} │ ${String(score).padStart(4)} │ ${status.padEnd(8)} │`);
    results.push({ category: key, score, status });
  }
  console.log('└─────────────────────────┴────────┴──────────┘\n');

  // Check if all pass
  const allPass = results.every(r => r.score >= 90);
  console.log(`Overall: ${allPass ? '✅ ALL CATEGORIES PASS (>90)' : '❌ SOME CATEGORIES BELOW 90'}\n`);

  process.exit(allPass ? 0 : 1);
} catch (error) {
  console.error('\n❌ Error running Lighthouse:\n', error.message);
  process.exit(1);
}
