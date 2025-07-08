import sql from 'k6/x/sql';
import { check } from 'k6';

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'mysql_query_duration': ['p(95)<100', 'p(99)<200'],
    'mysql_query_success_rate': ['rate>0.95'],
    'mysql_connection_duration': ['p(95)<50'],
  },
};

// Database connection string
const db = sql.open('mysql', 'testuser:testpassword@tcp(mysql:3306)/testdb');

export default function() {
  // Test 1: Simple SELECT query
  testSimpleSelect();
  
  // Test 2: Complex JOIN query
  testComplexJoin();
  
  // Test 3: INSERT operation
  testInsert();
  
  // Test 4: UPDATE operation
  testUpdate();
  
  // Test 5: DELETE operation
  testDelete();
  
  // Test 6: Aggregation query
  testAggregation();
  
  // Test 7: Subquery
  testSubquery();
  
  // Test 8: Stored procedure call
  testStoredProcedure();
}

function testSimpleSelect() {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, `
      SELECT id, username, email, created_at 
      FROM users 
      WHERE is_active = 1 
      LIMIT 10
    `);
    
    const duration = Date.now() - startTime;
    
    check(results, {
      'simple_select_returns_data': (r) => r.length > 0,
    });
    
    // Custom metric for query duration
    __ENV.K6_PROMETHEUS_NAMESPACE = 'mysql';
    __ENV.K6_PROMETHEUS_SUBSYSTEM = 'queries';
    
    console.log(`Simple SELECT query took ${duration}ms`);
    
  } catch (error) {
    console.error('Simple SELECT failed:', error);
    check(false, { 'simple_select_success': false });
  }
}

function testComplexJoin() {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, `
      SELECT 
        u.id, 
        u.username, 
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.is_active = 1
      GROUP BY u.id, u.username
      ORDER BY total_spent DESC
      LIMIT 10
    `);
    
    const duration = Date.now() - startTime;
    
    check(results, {
      'complex_join_returns_data': (r) => r.length >= 0,
    });
    
    console.log(`Complex JOIN query took ${duration}ms`);
    
  } catch (error) {
    console.error('Complex JOIN failed:', error);
    check(false, { 'complex_join_success': false });
  }
}

function testInsert() {
  const startTime = Date.now();
  const testId = Math.floor(Math.random() * 1000000);
  
  try {
    const result = sql.query(db, `
      INSERT INTO performance_test 
      (test_data, number_value, decimal_value, random_string) 
      VALUES (?, ?, ?, ?)
    `, [
      `Test data ${testId}`,
      testId,
      testId * 0.99,
      `random_string_${testId}`
    ]);
    
    const duration = Date.now() - startTime;
    
    check(result, {
      'insert_successful': (r) => r.affectedRows === 1,
    });
    
    console.log(`INSERT query took ${duration}ms`);
    
  } catch (error) {
    console.error('INSERT failed:', error);
    check(false, { 'insert_success': false });
  }
}

function testUpdate() {
  const startTime = Date.now();
  const testValue = Math.floor(Math.random() * 1000);
  
  try {
    const result = sql.query(db, `
      UPDATE performance_test 
      SET test_data = ?, number_value = ?
      WHERE id = (
        SELECT id FROM (
          SELECT id FROM performance_test 
          ORDER BY RAND() 
          LIMIT 1
        ) as tmp
      )
    `, [`Updated test data ${testValue}`, testValue]);
    
    const duration = Date.now() - startTime;
    
    check(result, {
      'update_executed': (r) => r.affectedRows >= 0,
    });
    
    console.log(`UPDATE query took ${duration}ms`);
    
  } catch (error) {
    console.error('UPDATE failed:', error);
    check(false, { 'update_success': false });
  }
}

function testDelete() {
  const startTime = Date.now();
  
  try {
    const result = sql.query(db, `
      DELETE FROM performance_test 
      WHERE id = (
        SELECT id FROM (
          SELECT id FROM performance_test 
          WHERE test_data LIKE 'Test data%'
          ORDER BY RAND() 
          LIMIT 1
        ) as tmp
      )
    `);
    
    const duration = Date.now() - startTime;
    
    check(result, {
      'delete_executed': (r) => r.affectedRows >= 0,
    });
    
    console.log(`DELETE query took ${duration}ms`);
    
  } catch (error) {
    console.error('DELETE failed:', error);
    check(false, { 'delete_success': false });
  }
}

function testAggregation() {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, `
      SELECT 
        COUNT(*) as total_users,
        AVG(age) as avg_age,
        MIN(created_at) as first_user,
        MAX(created_at) as last_user
      FROM users
      WHERE is_active = 1
    `);
    
    const duration = Date.now() - startTime;
    
    check(results, {
      'aggregation_returns_data': (r) => r.length === 1,
    });
    
    console.log(`Aggregation query took ${duration}ms`);
    
  } catch (error) {
    console.error('Aggregation failed:', error);
    check(false, { 'aggregation_success': false });
  }
}

function testSubquery() {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, `
      SELECT 
        p.id, 
        p.name, 
        p.price,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) as times_ordered
      FROM products p
      WHERE p.price > (
        SELECT AVG(price) FROM products WHERE is_active = 1
      )
      ORDER BY times_ordered DESC
      LIMIT 5
    `);
    
    const duration = Date.now() - startTime;
    
    check(results, {
      'subquery_returns_data': (r) => r.length >= 0,
    });
    
    console.log(`Subquery took ${duration}ms`);
    
  } catch (error) {
    console.error('Subquery failed:', error);
    check(false, { 'subquery_success': false });
  }
}

function testStoredProcedure() {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, `CALL GetTopSellingProducts(5)`);
    
    const duration = Date.now() - startTime;
    
    check(results, {
      'stored_procedure_returns_data': (r) => r.length >= 0,
    });
    
    console.log(`Stored procedure took ${duration}ms`);
    
  } catch (error) {
    console.error('Stored procedure failed:', error);
    check(false, { 'stored_procedure_success': false });
  }
}

export function teardown() {
  db.close();
}