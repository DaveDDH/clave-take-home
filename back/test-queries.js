import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.API_URL || 'http://localhost:5006';
const TEST_DATA_DIR = path.join(__dirname, 'test_data');

// Load all test files
function loadTestFiles() {
  const files = fs.readdirSync(TEST_DATA_DIR)
    .filter(file => file.match(/^q\d+\.json$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  return files.map(file => {
    const content = fs.readFileSync(path.join(TEST_DATA_DIR, file), 'utf-8');
    return { file, ...JSON.parse(content) };
  });
}

async function startChatProcess(query) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: query }],
      options: { useConsistency: true, debug: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.processId;
}

async function getProcessStatus(processId) {
  const response = await fetch(`${API_BASE_URL}/api/chat/status/${processId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function pollProcessStatus(processId, maxAttempts = 60) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getProcessStatus(processId);

    if (status.status === 'completed') {
      // Return result with logs
      return {
        result: status.result,
        logs: status.logs || [],
      };
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Process failed', { cause: { logs: status.logs } });
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Process polling timeout');
}

function compareCharts(actual, expected) {
  const errors = [];

  // Check if both are undefined/null
  if (!actual && !expected) return { match: true, errors: [] };
  if (!actual) return { match: false, errors: ['Actual charts is undefined/null'] };
  if (!expected) return { match: false, errors: ['Expected charts is undefined/null'] };

  // Check array length
  if (actual.length !== expected.length) {
    errors.push(`Chart count mismatch: expected ${expected.length}, got ${actual.length}`);
    return { match: false, errors };
  }

  // Compare each chart
  for (let i = 0; i < expected.length; i++) {
    const actualChart = actual[i];
    const expectedChart = expected[i];

    // Check chart type
    if (actualChart.type !== expectedChart.type) {
      errors.push(`Chart ${i}: type mismatch - expected "${expectedChart.type}", got "${actualChart.type}"`);
    }

    // Check config
    if (expectedChart.config) {
      if (!actualChart.config) {
        errors.push(`Chart ${i}: missing config`);
      } else {
        if (actualChart.config.xKey !== expectedChart.config.xKey) {
          errors.push(`Chart ${i}: config.xKey mismatch - expected "${expectedChart.config.xKey}", got "${actualChart.config.xKey}"`);
        }
        if (actualChart.config.yKey !== expectedChart.config.yKey) {
          errors.push(`Chart ${i}: config.yKey mismatch - expected "${expectedChart.config.yKey}", got "${actualChart.config.yKey}"`);
        }
      }
    }

    // Check data
    if (!actualChart.data || !expectedChart.data) {
      errors.push(`Chart ${i}: missing data`);
      continue;
    }

    if (actualChart.data.length !== expectedChart.data.length) {
      errors.push(`Chart ${i}: data row count mismatch - expected ${expectedChart.data.length}, got ${actualChart.data.length}`);
      continue;
    }

    // Deep compare data rows
    for (let j = 0; j < expectedChart.data.length; j++) {
      const actualRow = actualChart.data[j];
      const expectedRow = expectedChart.data[j];

      const actualKeys = Object.keys(actualRow).sort();
      const expectedKeys = Object.keys(expectedRow).sort();

      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        errors.push(`Chart ${i}, row ${j}: column mismatch - expected [${expectedKeys.join(', ')}], got [${actualKeys.join(', ')}]`);
        continue;
      }

      // Compare values
      for (const key of expectedKeys) {
        const actualVal = actualRow[key];
        const expectedVal = expectedRow[key];

        // For numbers, allow small floating point differences
        if (typeof expectedVal === 'number' && typeof actualVal === 'number') {
          if (Math.abs(actualVal - expectedVal) > 0.01) {
            errors.push(`Chart ${i}, row ${j}, key "${key}": value mismatch - expected ${expectedVal}, got ${actualVal}`);
          }
        } else if (actualVal !== expectedVal) {
          errors.push(`Chart ${i}, row ${j}, key "${key}": value mismatch - expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actualVal)}`);
        }
      }
    }
  }

  return { match: errors.length === 0, errors };
}

async function testQuery(testCase, index, total) {
  const startTime = Date.now();
  let logs = [];

  try {
    console.log(`\n[${index + 1}/${total}] Testing: "${testCase.query}"`);
    console.log(`  File: ${testCase.file}`);

    // Start process
    const processId = await startChatProcess(testCase.query);
    console.log(`  Process ID: ${processId}`);

    // Poll for result
    const { result, logs: processLogs } = await pollProcessStatus(processId);
    logs = processLogs;
    const duration = Date.now() - startTime;

    // Compare charts
    const comparison = compareCharts(result.charts, testCase.result.charts);

    if (comparison.match) {
      console.log(`  ✅ PASSED (${duration}ms)`);
      return { file: testCase.file, query: testCase.query, success: true, duration, logs };
    } else {
      console.log(`  ❌ FAILED (${duration}ms)`);
      comparison.errors.forEach(error => console.log(`     - ${error}`));

      // Print logs for failed test
      console.log(`\n  📋 Process Logs:`);
      if (logs.length > 0) {
        logs.forEach(log => console.log(`     ${log}`));
      } else {
        console.log(`     (no logs available)`);
      }

      return { file: testCase.file, query: testCase.query, success: false, duration, errors: comparison.errors, logs };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`  ❌ ERROR (${duration}ms): ${error.message}`);

    // Print logs for errored test
    console.log(`\n  📋 Process Logs:`);
    const errorLogs = error.cause?.logs || logs;
    if (errorLogs.length > 0) {
      errorLogs.forEach(log => console.log(`     ${log}`));
    } else {
      console.log(`     (no logs available)`);
    }

    return { file: testCase.file, query: testCase.query, success: false, duration, errors: [error.message], logs: errorLogs };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          C3 Text-to-SQL Query Test Suite                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Load test files
  const testCases = loadTestFiles();

  if (testCases.length === 0) {
    console.log('\n❌ No test files found in test_data/ directory');
    console.log('   Expected files: q1.json, q2.json, etc.\n');
    process.exit(1);
  }

  console.log(`\nLoaded ${testCases.length} test case(s) from test_data/`);
  console.log('Running tests in parallel...\n');

  const startTime = Date.now();

  // Run all tests in parallel
  const results = await Promise.all(
    testCases.map((testCase, index) => testQuery(testCase, index, testCases.length))
  );

  const totalDuration = Date.now() - startTime;

  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total tests:     ${testCases.length}`);
  console.log(`✅ Passed:       ${passed.length} (${((passed.length / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed:       ${failed.length} (${((failed.length / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Total time:   ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`⏱️  Avg per test:  ${(totalDuration / testCases.length).toFixed(0)}ms`);

  if (passed.length > 0) {
    const avgDuration = passed.reduce((sum, r) => sum + r.duration, 0) / passed.length;
    console.log(`⏱️  Avg passed:   ${avgDuration.toFixed(0)}ms`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    failed.forEach((result, index) => {
      console.log(`\n  ${index + 1}. ${result.file}: "${result.query}"`);
      result.errors.forEach(error => console.log(`     - ${error}`));
    });
  }

  console.log('\n');

  // Exit with error code if any tests failed
  process.exit(failed.length > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
