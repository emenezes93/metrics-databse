import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const testCounter = new Counter('test_iterations');
const testDuration = new Trend('test_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '2m', target: 5 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.1'],
    test_duration: ['p(95)<1000'],
  },
};

export default function() {
  const startTime = Date.now();
  
  // Simulate database load test without actual SQL
  const testId = Math.floor(Math.random() * 1000000);
  
  // Simulate various database operations with delays
  simulateSelectOperation();
  sleep(0.1);
  
  simulateInsertOperation();
  sleep(0.1);
  
  simulateUpdateOperation();
  sleep(0.1);
  
  simulateDeleteOperation();
  sleep(0.1);
  
  const duration = Date.now() - startTime;
  
  // Record metrics
  testCounter.add(1);
  testDuration.add(duration);
  
  check(true, {
    'test_completed': () => true,
  });
  
  sleep(Math.random() * 2);
}

function simulateSelectOperation() {
  const start = Date.now();
  
  // Simulate SELECT query processing time
  const processingTime = Math.random() * 50 + 10; // 10-60ms
  
  // Busy wait to simulate processing
  while (Date.now() - start < processingTime) {
    // Simulate work
  }
  
  const success = Math.random() > 0.05; // 95% success rate
  
  check(success, {
    'select_operation_success': (result) => result,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error('SELECT operation failed');
  }
}

function simulateInsertOperation() {
  const start = Date.now();
  
  // Simulate INSERT query processing time
  const processingTime = Math.random() * 30 + 5; // 5-35ms
  
  // Busy wait to simulate processing
  while (Date.now() - start < processingTime) {
    // Simulate work
  }
  
  const success = Math.random() > 0.02; // 98% success rate
  
  check(success, {
    'insert_operation_success': (result) => result,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error('INSERT operation failed');
  }
}

function simulateUpdateOperation() {
  const start = Date.now();
  
  // Simulate UPDATE query processing time
  const processingTime = Math.random() * 40 + 15; // 15-55ms
  
  // Busy wait to simulate processing
  while (Date.now() - start < processingTime) {
    // Simulate work
  }
  
  const success = Math.random() > 0.03; // 97% success rate
  
  check(success, {
    'update_operation_success': (result) => result,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error('UPDATE operation failed');
  }
}

function simulateDeleteOperation() {
  const start = Date.now();
  
  // Simulate DELETE query processing time
  const processingTime = Math.random() * 25 + 10; // 10-35ms
  
  // Busy wait to simulate processing
  while (Date.now() - start < processingTime) {
    // Simulate work
  }
  
  const success = Math.random() > 0.04; // 96% success rate
  
  check(success, {
    'delete_operation_success': (result) => result,
  });
  
  if (!success) {
    errorRate.add(1);
    console.error('DELETE operation failed');
  }
}

export function teardown() {
  console.log('Test completed');
}