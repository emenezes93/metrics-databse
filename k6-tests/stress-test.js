import sql from 'k6/x/sql';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for stress testing
const connectionErrors = new Counter('mysql_connection_errors');
const queryTimeouts = new Counter('mysql_query_timeouts');
const queryErrors = new Counter('mysql_query_errors');
const connectionAttempts = new Counter('mysql_connection_attempts');
const connectionSuccessRate = new Rate('mysql_connection_success_rate');
const querySuccessRate = new Rate('mysql_query_success_rate');
const queryDuration = new Trend('mysql_query_duration');
const connectionDuration = new Trend('mysql_connection_duration');

// Aggressive stress test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Quick ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 300 },   // Ramp up to 300 users (stress level)
    { duration: '5m', target: 500 },   // Ramp up to 500 users (high stress)
    { duration: '3m', target: 300 },   // Scale back to 300 users
    { duration: '2m', target: 100 },   // Scale back to 100 users
    { duration: '1m', target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    'mysql_query_duration': ['p(95)<1000', 'p(99)<2000'], // More relaxed thresholds for stress
    'mysql_query_success_rate': ['rate>0.85'], // Accept higher error rate under stress
    'mysql_connection_success_rate': ['rate>0.90'],
    'mysql_connection_errors': ['count<100'],
    'mysql_query_timeouts': ['count<50'],
    'http_req_duration': ['p(95)<1000'],
  },
};

// Connection pool with stress configuration
const connectionString = 'testuser:testpassword@tcp(mysql:3306)/testdb?timeout=30s&readTimeout=30s&writeTimeout=30s';

export default function() {
  // Simulate aggressive concurrent access patterns
  executeStressWorkload();
  
  // Minimal sleep to maintain high load
  sleep(Math.random() * 0.5);
}

function executeStressWorkload() {
  const db = createConnection();
  if (!db) return;
  
  try {
    // Execute multiple operations rapidly
    for (let i = 0; i < 5; i++) {
      executeRandomOperation(db);
    }
    
    // Test connection limits
    testConnectionLimits(db);
    
    // Test query timeouts
    testQueryTimeouts(db);
    
    // Test transaction rollbacks
    testTransactionRollbacks(db);
    
  } finally {
    closeConnection(db);
  }
}

function createConnection() {
  const startTime = Date.now();
  connectionAttempts.add(1);
  
  try {
    const db = sql.open('mysql', connectionString);
    const duration = Date.now() - startTime;
    
    connectionDuration.add(duration);
    connectionSuccessRate.add(true);
    
    return db;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    connectionDuration.add(duration);
    connectionSuccessRate.add(false);
    connectionErrors.add(1);
    
    console.error('Connection failed:', error);
    return null;
  }
}

function closeConnection(db) {
  try {
    if (db) {
      db.close();
    }
  } catch (error) {
    console.error('Error closing connection:', error);
  }
}

function executeRandomOperation(db) {
  const operations = [
    () => stressReadOperations(db),
    () => stressWriteOperations(db),
    () => stressConcurrentReads(db),
    () => stressConcurrentWrites(db),
    () => stressLockingOperations(db),
    () => stressComplexQueries(db),
    () => stressStoredProcedures(db),
  ];
  
  const operation = operations[Math.floor(Math.random() * operations.length)];
  operation();
}

function stressReadOperations(db) {
  const queries = [
    'SELECT * FROM users ORDER BY RAND() LIMIT 100',
    'SELECT * FROM products ORDER BY RAND() LIMIT 50',
    'SELECT * FROM orders ORDER BY RAND() LIMIT 25',
    'SELECT COUNT(*) FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)',
    'SELECT COUNT(*) FROM products WHERE stock_quantity < 10',
    'SELECT AVG(price) FROM products WHERE is_active = 1',
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  executeTimedQuery(db, 'stressRead', query);
}

function stressWriteOperations(db) {
  const operations = [
    () => stressInsertUsers(db),
    () => stressInsertProducts(db),
    () => stressInsertOrders(db),
    () => stressUpdateUsers(db),
    () => stressUpdateProducts(db),
    () => stressDeleteOperations(db),
  ];
  
  const operation = operations[Math.floor(Math.random() * operations.length)];
  operation();
}

function stressConcurrentReads(db) {
  // Simulate heavy concurrent reading
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(executeTimedQuery(db, 'concurrentRead', `
      SELECT 
        u.id, u.username, COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id, u.username
      ORDER BY order_count DESC
      LIMIT 10
    `));
  }
}

function stressConcurrentWrites(db) {
  // Simulate concurrent writes that might cause locks
  const id = Math.floor(Math.random() * 1000000);
  
  executeTimedQuery(db, 'concurrentWrite', `
    INSERT INTO performance_test (test_data, number_value, random_string)
    VALUES (?, ?, ?)
  `, [`Stress test ${id}`, id, `stress_${id}`]);
}

function stressLockingOperations(db) {
  // Operations that might cause table locks
  const userId = Math.floor(Math.random() * 1000) + 1;
  
  executeTimedQuery(db, 'lockingOperation', `
    UPDATE users 
    SET last_login = NOW()
    WHERE id = ?
  `, [userId]);
}

function stressComplexQueries(db) {
  // Complex queries that consume more resources
  executeTimedQuery(db, 'complexQuery', `
    SELECT 
      u.id,
      u.username,
      COUNT(DISTINCT o.id) as order_count,
      COUNT(DISTINCT r.id) as review_count,
      AVG(o.total_amount) as avg_order_value,
      SUM(o.total_amount) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    LEFT JOIN reviews r ON u.id = r.user_id
    WHERE u.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY u.id, u.username
    HAVING order_count > 0
    ORDER BY total_spent DESC
    LIMIT 20
  `);
}

function stressStoredProcedures(db) {
  const procedures = [
    'CALL GetTopSellingProducts(10)',
    'CALL GetUserOrderStats(1)',
    'CALL SimulateHeavyQuery()',
  ];
  
  const procedure = procedures[Math.floor(Math.random() * procedures.length)];
  executeTimedQuery(db, 'storedProcedure', procedure);
}

function testConnectionLimits(db) {
  // Test what happens when we hit connection limits
  executeTimedQuery(db, 'connectionTest', `
    SELECT 
      CONNECTION_ID() as connection_id,
      @@max_connections as max_connections,
      (SELECT COUNT(*) FROM INFORMATION_SCHEMA.PROCESSLIST) as current_connections
  `);
}

function testQueryTimeouts(db) {
  // Intentionally slow query to test timeout handling
  executeTimedQuery(db, 'timeoutTest', `
    SELECT 
      p1.id, p2.id
    FROM products p1
    CROSS JOIN products p2
    WHERE p1.price > p2.price
    LIMIT 1000
  `);
}

function testTransactionRollbacks(db) {
  // Test transaction handling under stress
  const id = Math.floor(Math.random() * 1000000);
  
  try {
    executeTimedQuery(db, 'transactionStart', 'START TRANSACTION');
    
    executeTimedQuery(db, 'transactionInsert', `
      INSERT INTO performance_test (test_data, number_value)
      VALUES (?, ?)
    `, [`Transaction test ${id}`, id]);
    
    // Randomly commit or rollback
    if (Math.random() < 0.7) {
      executeTimedQuery(db, 'transactionCommit', 'COMMIT');
    } else {
      executeTimedQuery(db, 'transactionRollback', 'ROLLBACK');
    }
    
  } catch (error) {
    executeTimedQuery(db, 'transactionRollback', 'ROLLBACK');
  }
}

// Individual stress write operations
function stressInsertUsers(db) {
  const id = Math.floor(Math.random() * 1000000);
  executeTimedQuery(db, 'stressInsertUser', `
    INSERT INTO users (username, email, password_hash, first_name, last_name, age, country, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    `stressuser_${id}`,
    `stress${id}@example.com`,
    `hashed_password_${id}`,
    `StressFirst${id}`,
    `StressLast${id}`,
    Math.floor(Math.random() * 50) + 18,
    'StressCountry',
    'StressCity'
  ]);
}

function stressInsertProducts(db) {
  const id = Math.floor(Math.random() * 1000000);
  executeTimedQuery(db, 'stressInsertProduct', `
    INSERT INTO products (name, description, price, category_id, stock_quantity, brand, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    `Stress Product ${id}`,
    `Stress description ${id}`,
    Math.floor(Math.random() * 1000) + 1,
    Math.floor(Math.random() * 5) + 1,
    Math.floor(Math.random() * 1000) + 1,
    `StressBrand${id}`,
    `STRESS${id}`
  ]);
}

function stressInsertOrders(db) {
  const userId = Math.floor(Math.random() * 1000) + 1;
  executeTimedQuery(db, 'stressInsertOrder', `
    INSERT INTO orders (user_id, total_amount, status, payment_method, payment_status)
    VALUES (?, ?, ?, ?, ?)
  `, [
    userId,
    Math.floor(Math.random() * 1000) + 1,
    'pending',
    'stress_test',
    'pending'
  ]);
}

function stressUpdateUsers(db) {
  const userId = Math.floor(Math.random() * 1000) + 1;
  executeTimedQuery(db, 'stressUpdateUser', `
    UPDATE users 
    SET last_login = NOW(), age = ?, updated_at = NOW()
    WHERE id = ?
  `, [Math.floor(Math.random() * 50) + 18, userId]);
}

function stressUpdateProducts(db) {
  const productId = Math.floor(Math.random() * 1000) + 1;
  const stockChange = Math.floor(Math.random() * 100) - 50;
  
  executeTimedQuery(db, 'stressUpdateProduct', `
    UPDATE products 
    SET stock_quantity = GREATEST(0, stock_quantity + ?), updated_at = NOW()
    WHERE id = ?
  `, [stockChange, productId]);
}

function stressDeleteOperations(db) {
  // Delete old test data to prevent table bloat
  executeTimedQuery(db, 'stressDelete', `
    DELETE FROM performance_test 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    LIMIT 100
  `);
}

// Enhanced helper function for stress testing
function executeTimedQuery(db, queryName, query, params = []) {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, query, ...params);
    const duration = Date.now() - startTime;
    
    queryDuration.add(duration);
    querySuccessRate.add(true);
    
    // Log slow queries under stress
    if (duration > 1000) {
      console.log(`Slow query detected: ${queryName} took ${duration}ms`);
    }
    
    check(results, {
      [`${queryName}_success`]: (r) => r !== null && r !== undefined,
    });
    
    return results;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    queryDuration.add(duration);
    querySuccessRate.add(false);
    queryErrors.add(1);
    
    // Check for specific error types
    if (error.message && error.message.includes('timeout')) {
      queryTimeouts.add(1);
    }
    
    console.error(`${queryName} failed (${duration}ms):`, error);
    check(false, { [`${queryName}_success`]: false });
    
    return null;
  }
}

export function teardown() {
  console.log('Stress test completed');
  console.log('Check metrics for connection errors, timeouts, and performance degradation');
}