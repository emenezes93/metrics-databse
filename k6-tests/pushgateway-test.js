import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics with proper naming for Prometheus
const dbOperationDuration = new Trend('db_operation_duration_seconds');
const dbOperationSuccess = new Rate('db_operation_success_rate');
const dbOperationTotal = new Counter('db_operation_total');
const dbConnectionErrors = new Counter('db_connection_errors_total');
const dbQueryErrors = new Counter('db_query_errors_total');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 5 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'db_operation_success_rate': ['rate>0.95'],
    'db_operation_duration_seconds': ['p(95)<1.0'],
    'db_connection_errors_total': ['count<5'],
    'db_query_errors_total': ['count<10'],
  },
};

export default function() {
  const testId = __VU * 1000 + __ITER;
  
  // Simulate database operations
  executeOperation('SELECT', testId);
  sleep(0.1);
  
  executeOperation('INSERT', testId);
  sleep(0.1);
  
  executeOperation('UPDATE', testId);
  sleep(0.1);
  
  executeOperation('DELETE', testId);
  sleep(0.1);
  
  // Send metrics to Pushgateway every 10 iterations
  if (__ITER % 10 === 0) {
    sendMetricsToPushgateway();
  }
  
  sleep(Math.random() * 0.5 + 0.5);
}

function executeOperation(operationType, testId) {
  const startTime = Date.now();
  
  let processingTime;
  let successRate;
  let hasError = false;
  
  switch (operationType) {
    case 'SELECT':
      processingTime = Math.random() * 50 + 20;
      successRate = 0.98;
      break;
    case 'INSERT':
      processingTime = Math.random() * 30 + 15;
      successRate = 0.97;
      break;
    case 'UPDATE':
      processingTime = Math.random() * 40 + 25;
      successRate = 0.96;
      break;
    case 'DELETE':
      processingTime = Math.random() * 20 + 10;
      successRate = 0.95;
      break;
    default:
      processingTime = 20;
      successRate = 0.99;
  }
  
  // Simulate processing
  const endTime = startTime + processingTime;
  while (Date.now() < endTime) {
    // Busy wait
  }
  
  const actualDuration = Date.now() - startTime;
  const success = Math.random() < successRate;
  
  // Record metrics
  dbOperationDuration.add(actualDuration / 1000);
  dbOperationSuccess.add(success);
  dbOperationTotal.add(1);
  
  if (!success) {
    if (Math.random() < 0.3) {
      dbConnectionErrors.add(1);
      hasError = true;
    } else {
      dbQueryErrors.add(1);
      hasError = true;
    }
  }
  
  check(success, {
    [`${operationType.toLowerCase()}_operation_success`]: (result) => result,
  });
  
  if (hasError) {
    console.log(`${operationType} operation failed for test ${testId}`);
  }
}

function sendMetricsToPushgateway() {
  const metricsData = `
# HELP k6_db_operations_total Total number of database operations
# TYPE k6_db_operations_total counter
k6_db_operations_total{instance="k6-test",job="k6-load-test"} ${Math.floor(Math.random() * 1000)}

# HELP k6_db_operation_duration_seconds Duration of database operations
# TYPE k6_db_operation_duration_seconds histogram
k6_db_operation_duration_seconds_bucket{le="0.1",instance="k6-test",job="k6-load-test"} ${Math.floor(Math.random() * 100)}
k6_db_operation_duration_seconds_bucket{le="0.5",instance="k6-test",job="k6-load-test"} ${Math.floor(Math.random() * 500)}
k6_db_operation_duration_seconds_bucket{le="1.0",instance="k6-test",job="k6-load-test"} ${Math.floor(Math.random() * 800)}
k6_db_operation_duration_seconds_bucket{le="+Inf",instance="k6-test",job="k6-load-test"} ${Math.floor(Math.random() * 1000)}

# HELP k6_db_success_rate Success rate of database operations
# TYPE k6_db_success_rate gauge
k6_db_success_rate{instance="k6-test",job="k6-load-test"} ${0.95 + Math.random() * 0.05}
  `;
  
  const pushgatewayUrl = 'http://k6-metrics-proxy:9091/metrics/job/k6-load-test/instance/k6-test';
  
  const response = http.post(pushgatewayUrl, metricsData, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
  
  if (response.status !== 200) {
    console.log(`Failed to push metrics to Pushgateway: ${response.status}`);
  }
}

export function teardown() {
  console.log('Pushgateway test completed');
}