import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics with proper naming for Prometheus
const dbOperationDuration = new Trend('db_operation_duration_seconds');
const dbOperationSuccess = new Rate('db_operation_success_rate');
const dbOperationTotal = new Counter('db_operation_total');
const dbConnectionErrors = new Counter('db_connection_errors_total');
const dbQueryErrors = new Counter('db_query_errors_total');

// Test configuration optimized for Prometheus
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
  
  // Simulate database operations with proper timing
  executeOperation('SELECT', testId);
  sleep(0.1);
  
  executeOperation('INSERT', testId);
  sleep(0.1);
  
  executeOperation('UPDATE', testId);
  sleep(0.1);
  
  executeOperation('DELETE', testId);
  sleep(0.1);
  
  // Random sleep to avoid timestamp conflicts
  sleep(Math.random() * 0.5 + 0.5);
}

function executeOperation(operationType, testId) {
  const startTime = Date.now();
  
  // Simulate different processing times
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
  dbOperationDuration.add(actualDuration / 1000); // Convert to seconds
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

export function teardown() {
  console.log('Prometheus compatible test completed');
}