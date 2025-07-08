import sql from 'k6/x/sql';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for spike testing
const spikeQueryDuration = new Trend('spike_query_duration');
const spikeQuerySuccessRate = new Rate('spike_query_success_rate');
const spikeConnectionErrors = new Counter('spike_connection_errors');
const spikeRecoveryTime = new Trend('spike_recovery_time');
const queriesPerSecond = new Counter('queries_per_second');

// Spike test configuration - sudden load increases
export const options = {
  stages: [
    { duration: '2m', target: 10 },    // Normal load
    { duration: '1m', target: 10 },    // Stable normal load
    { duration: '10s', target: 200 },  // Spike! Sudden jump to 200 users
    { duration: '1m', target: 200 },   // Maintain spike load
    { duration: '10s', target: 10 },   // Drop back to normal
    { duration: '2m', target: 10 },    // Recovery period
    { duration: '10s', target: 300 },  // Even bigger spike!
    { duration: '1m', target: 300 },   // Maintain bigger spike
    { duration: '10s', target: 10 },   // Drop back to normal
    { duration: '3m', target: 10 },    // Extended recovery
    { duration: '5s', target: 500 },   // Extreme spike!
    { duration: '30s', target: 500 },  // Brief extreme load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'spike_query_duration': ['p(95)<2000', 'p(99)<5000'], // Relaxed for spikes
    'spike_query_success_rate': ['rate>0.80'], // Accept higher error rate during spikes
    'spike_connection_errors': ['count<200'],
    'spike_recovery_time': ['p(95)<5000'],
    'http_req_duration': ['p(95)<2000'],
  },
};

// Connection configuration for spike testing
const connectionString = 'testuser:testpassword@tcp(mysql:3306)/testdb?timeout=10s&readTimeout=10s&writeTimeout=10s';

export default function() {
  const currentVUs = __VU;
  const currentStage = getCurrentStage();
  
  // Adjust behavior based on current load level
  if (currentVUs > 100) {
    // During spike - aggressive testing
    executeSpikeWorkload();
  } else {
    // Normal load - regular testing
    executeNormalWorkload();
  }
  
  // Minimal sleep during spikes, longer during normal periods
  const sleepTime = currentVUs > 100 ? Math.random() * 0.1 : Math.random() * 1;
  sleep(sleepTime);
}

function getCurrentStage() {
  const elapsed = __ENV.K6_ITERATION_DURATION || 0;
  // This is a simplified stage detection
  if (elapsed < 180) return 'normal';
  if (elapsed < 240) return 'spike';
  if (elapsed < 300) return 'recovery';
  return 'unknown';
}

function executeSpikeWorkload() {
  const db = createSpikeConnection();
  if (!db) return;
  
  try {
    // During spikes, execute rapid-fire queries
    for (let i = 0; i < 3; i++) {
      executeRandomSpikeQuery(db);
      queriesPerSecond.add(1);
    }
    
    // Test system behavior during spikes
    testSpikeRecovery(db);
    testConnectionPooling(db);
    testQueryQueueing(db);
    
  } finally {
    closeSpikeConnection(db);
  }
}

function executeNormalWorkload() {
  const db = createSpikeConnection();
  if (!db) return;
  
  try {
    // Normal load - single query
    executeRandomSpikeQuery(db);
    queriesPerSecond.add(1);
    
    // Baseline performance monitoring
    testBaselinePerformance(db);
    
  } finally {
    closeSpikeConnection(db);
  }
}

function createSpikeConnection() {
  const startTime = Date.now();
  
  try {
    const db = sql.open('mysql', connectionString);
    return db;
  } catch (error) {
    spikeConnectionErrors.add(1);
    console.error('Spike connection failed:', error);
    return null;
  }
}

function closeSpikeConnection(db) {
  try {
    if (db) {
      db.close();
    }
  } catch (error) {
    console.error('Error closing spike connection:', error);
  }
}

function executeRandomSpikeQuery(db) {
  const queries = [
    // Quick queries that should handle spikes well
    { name: 'quickUserLookup', query: 'SELECT id, username FROM users WHERE id = ? LIMIT 1', params: [Math.floor(Math.random() * 1000) + 1] },
    { name: 'quickProductLookup', query: 'SELECT id, name, price FROM products WHERE id = ? LIMIT 1', params: [Math.floor(Math.random() * 1000) + 1] },
    { name: 'quickOrderCount', query: 'SELECT COUNT(*) FROM orders WHERE user_id = ?', params: [Math.floor(Math.random() * 1000) + 1] },
    
    // Medium complexity queries
    { name: 'userOrderSummary', query: 'SELECT COUNT(*) as order_count, SUM(total_amount) as total FROM orders WHERE user_id = ?', params: [Math.floor(Math.random() * 1000) + 1] },
    { name: 'productStats', query: 'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE product_id = ?', params: [Math.floor(Math.random() * 1000) + 1] },
    
    // Queries that might struggle during spikes
    { name: 'recentOrders', query: 'SELECT * FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) ORDER BY created_at DESC LIMIT 10' },
    { name: 'popularProducts', query: 'SELECT p.id, p.name, COUNT(oi.id) as sales FROM products p JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id ORDER BY sales DESC LIMIT 5' },
    
    // Write operations during spikes
    { name: 'spikeInsert', query: 'INSERT INTO performance_test (test_data, number_value) VALUES (?, ?)', params: [`Spike test ${Date.now()}`, Math.floor(Math.random() * 1000)] },
    { name: 'spikeUpdate', query: 'UPDATE performance_test SET test_data = ? WHERE id = (SELECT id FROM (SELECT id FROM performance_test ORDER BY RAND() LIMIT 1) as tmp)', params: [`Updated during spike ${Date.now()}`] },
  ];
  
  const selectedQuery = queries[Math.floor(Math.random() * queries.length)];
  executeSpikeTimedQuery(db, selectedQuery.name, selectedQuery.query, selectedQuery.params || []);
}

function testSpikeRecovery(db) {
  const recoveryStartTime = Date.now();
  
  // Test how quickly the system recovers after spike
  executeSpikeTimedQuery(db, 'recoveryTest', `
    SELECT 
      COUNT(*) as active_connections,
      AVG(time) as avg_query_time
    FROM INFORMATION_SCHEMA.PROCESSLIST
    WHERE command != 'Sleep'
  `);
  
  const recoveryTime = Date.now() - recoveryStartTime;
  spikeRecoveryTime.add(recoveryTime);
}

function testConnectionPooling(db) {
  // Test connection pool behavior during spikes
  executeSpikeTimedQuery(db, 'connectionPoolTest', `
    SELECT 
      @@max_connections as max_connections,
      (SELECT COUNT(*) FROM INFORMATION_SCHEMA.PROCESSLIST) as current_connections,
      (SELECT COUNT(*) FROM INFORMATION_SCHEMA.PROCESSLIST WHERE command != 'Sleep') as active_connections
  `);
}

function testQueryQueueing(db) {
  // Test query queueing and processing during spikes
  executeSpikeTimedQuery(db, 'queueTest', `
    SELECT 
      COUNT(*) as queued_queries,
      AVG(time) as avg_wait_time
    FROM INFORMATION_SCHEMA.PROCESSLIST
    WHERE state LIKE '%Waiting%'
  `);
}

function testBaselinePerformance(db) {
  // Baseline performance test during normal load
  executeSpikeTimedQuery(db, 'baseline', `
    SELECT 
      u.id, u.username, COUNT(o.id) as order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id, u.username
    ORDER BY order_count DESC
    LIMIT 5
  `);
}

function executeSpikeTimedQuery(db, queryName, query, params = []) {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, query, ...params);
    const duration = Date.now() - startTime;
    
    spikeQueryDuration.add(duration);
    spikeQuerySuccessRate.add(true);
    
    // Log performance issues during spikes
    if (duration > 2000) {
      console.log(`Spike performance issue: ${queryName} took ${duration}ms`);
    }
    
    check(results, {
      [`spike_${queryName}_success`]: (r) => r !== null && r !== undefined,
      [`spike_${queryName}_performance`]: (r) => duration < 5000, // 5 second timeout
    });
    
    return results;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    spikeQueryDuration.add(duration);
    spikeQuerySuccessRate.add(false);
    
    // Categorize spike errors
    if (error.message && error.message.includes('timeout')) {
      console.log(`Spike timeout: ${queryName} timed out after ${duration}ms`);
    } else if (error.message && error.message.includes('connection')) {
      console.log(`Spike connection error: ${queryName} - ${error.message}`);
      spikeConnectionErrors.add(1);
    } else {
      console.log(`Spike query error: ${queryName} - ${error.message}`);
    }
    
    check(false, { [`spike_${queryName}_success`]: false });
    
    return null;
  }
}

// Test scenarios for different spike patterns
export function handleDataSpike() {
  // Simulate data-heavy operations during spikes
  const db = createSpikeConnection();
  if (!db) return;
  
  try {
    // Large result set queries
    executeSpikeTimedQuery(db, 'dataSpike', `
      SELECT * FROM users u
      JOIN orders o ON u.id = o.user_id
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
      LIMIT 1000
    `);
  } finally {
    closeSpikeConnection(db);
  }
}

export function handleWriteSpike() {
  // Simulate write-heavy operations during spikes
  const db = createSpikeConnection();
  if (!db) return;
  
  try {
    // Bulk inserts
    for (let i = 0; i < 5; i++) {
      const id = Math.floor(Math.random() * 1000000);
      executeSpikeTimedQuery(db, 'writeSpike', `
        INSERT INTO performance_test (test_data, number_value, random_string)
        VALUES (?, ?, ?)
      `, [`Write spike ${id}`, id, `spike_${id}`]);
    }
  } finally {
    closeSpikeConnection(db);
  }
}

export function handleReadSpike() {
  // Simulate read-heavy operations during spikes
  const db = createSpikeConnection();
  if (!db) return;
  
  try {
    // Multiple concurrent reads
    for (let i = 0; i < 3; i++) {
      executeSpikeTimedQuery(db, 'readSpike', `
        SELECT COUNT(*) FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [Math.floor(Math.random() * 30) + 1]);
    }
  } finally {
    closeSpikeConnection(db);
  }
}

export function setup() {
  console.log('Starting spike test...');
  console.log('This test simulates sudden traffic spikes and measures system resilience');
}

export function teardown() {
  console.log('Spike test completed');
  console.log('Check metrics for:');
  console.log('- Response time degradation during spikes');
  console.log('- Error rates during peak load');
  console.log('- Recovery time after spikes');
  console.log('- Connection pool behavior');
}