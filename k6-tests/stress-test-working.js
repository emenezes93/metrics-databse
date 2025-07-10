import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for stress testing
const dbOperationDuration = new Trend('db_operation_duration_seconds');
const dbOperationSuccess = new Rate('db_operation_success_rate');
const dbOperationTotal = new Counter('db_operation_total');
const dbConnectionErrors = new Counter('db_connection_errors_total');
const dbQueryErrors = new Counter('db_query_errors_total');
const dbQueryTimeouts = new Counter('db_query_timeouts_total');

// Aggressive stress test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Quick ramp up to 50 users
    { duration: '1m', target: 100 },    // Ramp up to 100 users
    { duration: '2m', target: 200 },    // Ramp up to 200 users
    { duration: '2m', target: 300 },    // Peak load at 300 users
    { duration: '1m', target: 200 },    // Scale down to 200
    { duration: '1m', target: 100 },    // Scale down to 100
    { duration: '30s', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    'db_operation_success_rate': ['rate>0.85'],
    'db_operation_duration_seconds': ['p(95)<2.0'],
    'db_connection_errors_total': ['count<200'],
    'db_query_errors_total': ['count<100'],
    'db_query_timeouts_total': ['count<50'],
  },
};

export default function() {
  const testId = __VU * 1000 + __ITER;
  
  // High-intensity database operations
  for (let i = 0; i < 5; i++) {
    executeStressOperation('SELECT', testId + i);
    sleep(0.01); // Very short sleep for high load
    
    executeStressOperation('INSERT', testId + i);
    sleep(0.01);
    
    executeStressOperation('UPDATE', testId + i);
    sleep(0.01);
    
    executeStressOperation('DELETE', testId + i);
    sleep(0.01);
  }
  
  // Send metrics to Pushgateway more frequently during stress test
  if (__ITER % 5 === 0) {
    sendStressMetricsToPushgateway();
  }
  
  // Minimal sleep to maintain high load
  sleep(Math.random() * 0.1 + 0.05);
}

function executeStressOperation(operationType, testId) {
  const startTime = Date.now();
  
  let processingTime;
  let successRate;
  let timeoutRate;
  let hasError = false;
  let hasTimeout = false;
  
  // Simulate degraded performance under stress
  switch (operationType) {
    case 'SELECT':
      processingTime = Math.random() * 200 + 50; // 50-250ms
      successRate = 0.92 - (__VU * 0.001); // Decreases with more users
      timeoutRate = 0.02 + (__VU * 0.0001);
      break;
    case 'INSERT':
      processingTime = Math.random() * 300 + 100; // 100-400ms
      successRate = 0.90 - (__VU * 0.001);
      timeoutRate = 0.03 + (__VU * 0.0001);
      break;
    case 'UPDATE':
      processingTime = Math.random() * 400 + 150; // 150-550ms
      successRate = 0.88 - (__VU * 0.001);
      timeoutRate = 0.04 + (__VU * 0.0001);
      break;
    case 'DELETE':
      processingTime = Math.random() * 100 + 25; // 25-125ms
      successRate = 0.90 - (__VU * 0.001);
      timeoutRate = 0.02 + (__VU * 0.0001);
      break;
    default:
      processingTime = 100;
      successRate = 0.95;
      timeoutRate = 0.01;
  }
  
  // Simulate timeout
  if (Math.random() < timeoutRate) {
    hasTimeout = true;
    processingTime = Math.random() * 2000 + 1000; // 1-3 seconds timeout
  }
  
  // Simulate processing
  const endTime = startTime + processingTime;
  while (Date.now() < endTime) {
    // Busy wait
  }
  
  const actualDuration = Date.now() - startTime;
  const success = Math.random() < successRate && !hasTimeout;
  
  // Record metrics
  dbOperationDuration.add(actualDuration / 1000);
  dbOperationSuccess.add(success);
  dbOperationTotal.add(1);
  
  if (hasTimeout) {
    dbQueryTimeouts.add(1);
    hasError = true;
  } else if (!success) {
    if (Math.random() < 0.4) {
      dbConnectionErrors.add(1);
      hasError = true;
    } else {
      dbQueryErrors.add(1);
      hasError = true;
    }
  }
  
  check(success, {
    [`${operationType.toLowerCase()}_stress_operation_success`]: (result) => result,
  });
  
  if (hasError) {
    if (hasTimeout) {
      console.log(`${operationType} operation timed out for test ${testId}`);
    } else {
      console.log(`${operationType} operation failed for test ${testId}`);
    }
  }
}

function sendStressMetricsToPushgateway() {
  const currentLoad = __VU;
  const errorRate = Math.max(0, 0.05 + (currentLoad * 0.0005));
  
  const metricsData = `
# HELP k6_stress_db_operations_total Total number of database operations during stress test
# TYPE k6_stress_db_operations_total counter
k6_stress_db_operations_total{instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 5000 + currentLoad * 10)}

# HELP k6_stress_db_operation_duration_seconds Duration of database operations during stress test
# TYPE k6_stress_db_operation_duration_seconds histogram
k6_stress_db_operation_duration_seconds_bucket{le="0.1",instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 100 + currentLoad)}
k6_stress_db_operation_duration_seconds_bucket{le="0.5",instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 500 + currentLoad * 2)}
k6_stress_db_operation_duration_seconds_bucket{le="1.0",instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 800 + currentLoad * 3)}
k6_stress_db_operation_duration_seconds_bucket{le="2.0",instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 900 + currentLoad * 4)}
k6_stress_db_operation_duration_seconds_bucket{le="+Inf",instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 1000 + currentLoad * 5)}

# HELP k6_stress_db_success_rate Success rate of database operations during stress test
# TYPE k6_stress_db_success_rate gauge
k6_stress_db_success_rate{instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${0.95 - errorRate}

# HELP k6_stress_db_connection_errors_total Connection errors during stress test
# TYPE k6_stress_db_connection_errors_total counter
k6_stress_db_connection_errors_total{instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 10 + currentLoad * 0.1)}

# HELP k6_stress_db_query_timeouts_total Query timeouts during stress test
# TYPE k6_stress_db_query_timeouts_total counter
k6_stress_db_query_timeouts_total{instance="k6-stress-test",job="k6-stress-test",load_level="${currentLoad}"} ${Math.floor(Math.random() * 5 + currentLoad * 0.05)}

# HELP k6_stress_active_users Current number of active virtual users
# TYPE k6_stress_active_users gauge
k6_stress_active_users{instance="k6-stress-test",job="k6-stress-test"} ${currentLoad}
  `;
  
  const pushgatewayUrl = 'http://k6-metrics-proxy:9091/metrics/job/k6-stress-test/instance/k6-stress-test';
  
  const response = http.post(pushgatewayUrl, metricsData, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
  
  if (response.status !== 200) {
    console.log(`Failed to push stress metrics to Pushgateway: ${response.status}`);
  }
}

export function teardown() {
  console.log('Stress test completed - system recovery phase');
  
  // Final metrics push
  const finalMetricsData = `
# HELP k6_stress_test_completed Stress test completion indicator
# TYPE k6_stress_test_completed gauge
k6_stress_test_completed{instance="k6-stress-test",job="k6-stress-test"} 1
  `;
  
  const response = http.post('http://k6-metrics-proxy:9091/metrics/job/k6-stress-test/instance/k6-stress-test', finalMetricsData, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
  
  if (response.status === 200) {
    console.log('Final stress test metrics pushed successfully');
  }
}