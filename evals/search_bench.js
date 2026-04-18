import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, Functions } from 'node-appwrite';
import 'dotenv/config';

const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || '69de7f335c0489352ff1';
const apiKey = process.env.APPWRITE_API_KEY;
const discoveryFunctionId = process.env.DISCOVERY_FUNCTION_ID || 'discoveryEngine';

if (!apiKey) {
  console.error('APPWRITE_API_KEY is required to run this benchmark.');
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const functions = new Functions(client);

const variants = ['semantic_only', 'hybrid_unfiltered', 'hybrid_filtered'];

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function matchesExpectedFilter(match, expected = {}) {
  if (!expected || Object.keys(expected).length === 0) return true;

  return Object.entries(expected).every(([key, expectedValue]) => {
    if (expectedValue === undefined || expectedValue === null) return true;

    if (typeof expectedValue === 'boolean') {
      return Boolean(match[key]) === expectedValue;
    }

    const actual = match[key];

    if (Array.isArray(expectedValue)) {
      const actualArray = Array.isArray(actual) ? actual.map(normalize) : [];
      return expectedValue.every((entry) => actualArray.includes(normalize(entry)));
    }

    if (Array.isArray(actual)) {
      return actual.map(normalize).includes(normalize(expectedValue));
    }

    return normalize(actual) === normalize(expectedValue);
  });
}

function summarizeVariant(records) {
  const latencies = records.map((r) => r.latency_ms).sort((a, b) => a - b);
  const results = records.map((r) => r.result_count);
  const compliant = records.filter((r) => r.filter_compliance !== null);

  return {
    runs: records.length,
    avg_latency_ms: Number((latencies.reduce((sum, n) => sum + n, 0) / (latencies.length || 1)).toFixed(1)),
    p50_latency_ms: percentile(latencies, 50),
    p95_latency_ms: percentile(latencies, 95),
    avg_result_count: Number((results.reduce((sum, n) => sum + n, 0) / (results.length || 1)).toFixed(2)),
    avg_filter_compliance_top3: compliant.length
      ? Number((compliant.reduce((sum, r) => sum + r.filter_compliance, 0) / compliant.length).toFixed(2))
      : null,
  };
}

async function run() {
  const benchPath = path.join(process.cwd(), 'evals', 'bench_queries.json');
  const benchRaw = await fs.readFile(benchPath, 'utf8');
  const queries = JSON.parse(benchRaw);

  const records = [];

  for (const variant of variants) {
    for (const q of queries) {
      const started = Date.now();
      let matches = [];
      let metadata = {};
      let error = null;

      try {
        const body = {
          action: 'search',
          query: q.query,
          variant,
        };

        const exec = await functions.createExecution(discoveryFunctionId, JSON.stringify(body), false);
        const parsed = JSON.parse(exec.responseBody || '{}');
        matches = Array.isArray(parsed.matches) ? parsed.matches : [];
        metadata = parsed.metadata || {};
      } catch (err) {
        error = err.message;
      }

      const elapsed = Date.now() - started;
      const top3 = matches.slice(0, 3);
      const hasExpectedFilters = q.expected_filters && Object.keys(q.expected_filters).length > 0;
      const compliance = hasExpectedFilters && top3.length > 0
        ? Number((top3.filter((m) => matchesExpectedFilter(m, q.expected_filters)).length / top3.length).toFixed(2))
        : null;

      const record = {
        query_id: q.id,
        query: q.query,
        variant,
        latency_ms: metadata.total_ms || elapsed,
        result_count: matches.length,
        filter_compliance: compliance,
        metadata,
        error,
      };

      records.push(record);

      const status = error ? `error=${error}` : `results=${matches.length}`;
      console.log(`[${variant}] ${q.id}: ${status}, latency=${record.latency_ms}ms, compliance=${compliance ?? 'n/a'}`);
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    discovery_function_id: discoveryFunctionId,
    variants: Object.fromEntries(variants.map((variant) => [
      variant,
      summarizeVariant(records.filter((r) => r.variant === variant && !r.error)),
    ])),
  };

  const outDir = path.join(process.cwd(), 'evals', 'results');
  await fs.mkdir(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `search_bench_${stamp}.json`);
  await fs.writeFile(outFile, JSON.stringify({ summary, records }, null, 2), 'utf8');

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nSaved benchmark report to: ${outFile}`);
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
