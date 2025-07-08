import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('operation_success_rate');
const operationCounter = new Counter('operations_total');

// Test configuration - quick test
export const options = {
  stages: [
    { duration: '30s', target: 3 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    operation_success_rate: ['rate>0.9'],
    operations_total: ['count>10'],
  },
};

export default function() {
  // Simulate database operations
  for (let i = 0; i < 4; i++) {
    const operationType = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'][i];
    const success = simulateOperation(operationType);
    
    successRate.add(success);
    operationCounter.add(1);
    
    check(success, {
      [`${operationType}_success`]: (result) => result,
    });
    
    sleep(0.1);
  }
  
  sleep(Math.random() * 2);
}

function simulateOperation(type) {
  const start = Date.now();
  
  // Simulate different processing times for different operations
  let processingTime;
  let successRate;
  
  switch (type) {
    case 'SELECT':
      processingTime = Math.random() * 30 + 5;
      successRate = 0.98;
      break;
    case 'INSERT':
      processingTime = Math.random() * 20 + 10;
      successRate = 0.97;
      break;
    case 'UPDATE':
      processingTime = Math.random() * 25 + 8;
      successRate = 0.96;
      break;
    case 'DELETE':
      processingTime = Math.random() * 15 + 5;
      successRate = 0.95;
      break;
    default:
      processingTime = 10;
      successRate = 0.99;
  }
  
  // Simulate processing
  while (Date.now() - start < processingTime) {
    // Busy wait
  }
  
  return Math.random() < successRate;
}

export function teardown() {
  console.log('Quick test completed successfully!');
}