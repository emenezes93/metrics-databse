import sql from 'k6/x/sql';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const queriesExecuted = new Counter('mysql_queries_total');
const querySuccessRate = new Rate('mysql_query_success_rate');
const queryDuration = new Trend('mysql_query_duration');
const connectionDuration = new Trend('mysql_connection_duration');

// Test configuration for load testing
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 25 },   // Ramp up to 25 users
    { duration: '5m', target: 25 },   // Stay at 25 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 75 },   // Ramp up to 75 users
    { duration: '5m', target: 75 },   // Stay at 75 users
    { duration: '3m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'mysql_query_duration': ['p(95)<200', 'p(99)<500'],
    'mysql_query_success_rate': ['rate>0.95'],
    'mysql_connection_duration': ['p(95)<100'],
    'mysql_queries_total': ['count>1000'],
    'http_req_duration': ['p(95)<300'],
  },
};

// Database connection pool
const db = sql.open('mysql', 'testuser:testpassword@tcp(mysql:3306)/testdb');

export default function() {
  // Simulate realistic load patterns
  executeReadHeavyWorkload();
  sleep(Math.random() * 2); // Random sleep between 0-2 seconds
  
  executeWriteOperations();
  sleep(Math.random() * 1); // Random sleep between 0-1 seconds
  
  executeMixedWorkload();
  sleep(Math.random() * 3); // Random sleep between 0-3 seconds
}

function executeReadHeavyWorkload() {
  const operations = [
    () => getUserList(),
    () => getProductCatalog(),
    () => getOrderHistory(),
    () => getOrderDetails(),
    () => getProductReviews(),
    () => getUserOrderSummary(),
    () => getTopSellingProducts(),
    () => getCategoryStats(),
  ];
  
  // Execute 3-5 random read operations
  const numOperations = Math.floor(Math.random() * 3) + 3;
  
  for (let i = 0; i < numOperations; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    operation();
  }
}

function executeWriteOperations() {
  const operations = [
    () => insertUser(),
    () => insertProduct(),
    () => insertOrder(),
    () => insertReview(),
    () => updateUserProfile(),
    () => updateProductStock(),
    () => updateOrderStatus(),
  ];
  
  // Execute 1-2 random write operations
  const numOperations = Math.floor(Math.random() * 2) + 1;
  
  for (let i = 0; i < numOperations; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    operation();
  }
}

function executeMixedWorkload() {
  // Simulate a typical user session
  const userId = Math.floor(Math.random() * 100) + 1;
  
  // User logs in (read user data)
  getUserById(userId);
  
  // User browses products (read operations)
  getProductCatalog();
  
  // User views product details (read operations)
  const productId = Math.floor(Math.random() * 100) + 1;
  getProductDetails(productId);
  getProductReviews(productId);
  
  // User might place an order (write operations)
  if (Math.random() < 0.3) { // 30% chance of placing order
    insertOrder(userId);
  }
  
  // User might leave a review (write operations)
  if (Math.random() < 0.2) { // 20% chance of leaving review
    insertReview(userId, productId);
  }
}

// Read operations
function getUserList() {
  executeTimedQuery('getUserList', `
    SELECT id, username, email, created_at, is_active 
    FROM users 
    WHERE is_active = 1 
    ORDER BY created_at DESC 
    LIMIT 20
  `);
}

function getUserById(userId) {
  executeTimedQuery('getUserById', `
    SELECT id, username, email, first_name, last_name, age, country, city, created_at
    FROM users 
    WHERE id = ? AND is_active = 1
  `, [userId]);
}

function getProductCatalog() {
  executeTimedQuery('getProductCatalog', `
    SELECT 
      p.id, p.name, p.price, p.stock_quantity, p.brand,
      c.name as category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    ORDER BY p.created_at DESC
    LIMIT 50
  `);
}

function getProductDetails(productId) {
  executeTimedQuery('getProductDetails', `
    SELECT 
      p.id, p.name, p.description, p.price, p.stock_quantity, 
      p.brand, p.weight, p.dimensions, p.sku,
      c.name as category_name,
      AVG(r.rating) as avg_rating,
      COUNT(r.id) as review_count
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE p.id = ? AND p.is_active = 1
    GROUP BY p.id
  `, [productId]);
}

function getOrderHistory() {
  const userId = Math.floor(Math.random() * 100) + 1;
  executeTimedQuery('getOrderHistory', `
    SELECT 
      o.id, o.order_date, o.total_amount, o.status, o.payment_status,
      COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.order_date DESC
    LIMIT 20
  `, [userId]);
}

function getOrderDetails() {
  const orderId = Math.floor(Math.random() * 100) + 1;
  executeTimedQuery('getOrderDetails', `
    SELECT 
      o.id, o.order_date, o.total_amount, o.status,
      oi.quantity, oi.price_per_unit, oi.total_price,
      p.name as product_name, p.sku
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.id = ?
  `, [orderId]);
}

function getProductReviews(productId = null) {
  const id = productId || Math.floor(Math.random() * 100) + 1;
  executeTimedQuery('getProductReviews', `
    SELECT 
      r.id, r.rating, r.comment, r.created_at, r.is_verified,
      u.username
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT 10
  `, [id]);
}

function getUserOrderSummary() {
  executeTimedQuery('getUserOrderSummary', `
    SELECT * FROM user_order_summary
    ORDER BY total_spent DESC
    LIMIT 10
  `);
}

function getTopSellingProducts() {
  executeTimedQuery('getTopSellingProducts', `
    SELECT * FROM product_performance
    ORDER BY total_sold DESC
    LIMIT 10
  `);
}

function getCategoryStats() {
  executeTimedQuery('getCategoryStats', `
    SELECT 
      c.name as category_name,
      COUNT(p.id) as product_count,
      AVG(p.price) as avg_price,
      SUM(p.stock_quantity) as total_stock
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    WHERE c.is_active = 1
    GROUP BY c.id, c.name
    ORDER BY product_count DESC
  `);
}

// Write operations
function insertUser() {
  const id = Math.floor(Math.random() * 1000000);
  executeTimedQuery('insertUser', `
    INSERT INTO users (username, email, password_hash, first_name, last_name, age, country, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    `testuser_${id}`,
    `test${id}@example.com`,
    `hashed_password_${id}`,
    `FirstName${id}`,
    `LastName${id}`,
    Math.floor(Math.random() * 50) + 18,
    'TestCountry',
    'TestCity'
  ]);
}

function insertProduct() {
  const id = Math.floor(Math.random() * 1000000);
  executeTimedQuery('insertProduct', `
    INSERT INTO products (name, description, price, category_id, stock_quantity, brand, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    `Test Product ${id}`,
    `Description for test product ${id}`,
    Math.floor(Math.random() * 1000) + 10,
    Math.floor(Math.random() * 5) + 1,
    Math.floor(Math.random() * 100) + 1,
    `TestBrand${id}`,
    `SKU${id}`
  ]);
}

function insertOrder(userId = null) {
  const id = userId || Math.floor(Math.random() * 100) + 1;
  executeTimedQuery('insertOrder', `
    INSERT INTO orders (user_id, total_amount, status, payment_method, payment_status)
    VALUES (?, ?, ?, ?, ?)
  `, [
    id,
    Math.floor(Math.random() * 1000) + 10,
    'pending',
    'credit_card',
    'pending'
  ]);
}

function insertReview(userId = null, productId = null) {
  const uId = userId || Math.floor(Math.random() * 100) + 1;
  const pId = productId || Math.floor(Math.random() * 100) + 1;
  const reviewId = Math.floor(Math.random() * 1000000);
  
  executeTimedQuery('insertReview', `
    INSERT INTO reviews (user_id, product_id, rating, comment)
    VALUES (?, ?, ?, ?)
  `, [
    uId,
    pId,
    Math.floor(Math.random() * 5) + 1,
    `Test review comment ${reviewId}`
  ]);
}

function updateUserProfile() {
  const userId = Math.floor(Math.random() * 100) + 1;
  executeTimedQuery('updateUserProfile', `
    UPDATE users 
    SET last_login = NOW(), age = ? 
    WHERE id = ?
  `, [Math.floor(Math.random() * 50) + 18, userId]);
}

function updateProductStock() {
  const productId = Math.floor(Math.random() * 100) + 1;
  const stockChange = Math.floor(Math.random() * 20) - 10; // -10 to +10
  
  executeTimedQuery('updateProductStock', `
    UPDATE products 
    SET stock_quantity = GREATEST(0, stock_quantity + ?)
    WHERE id = ?
  `, [stockChange, productId]);
}

function updateOrderStatus() {
  const orderId = Math.floor(Math.random() * 100) + 1;
  const statuses = ['pending', 'processing', 'shipped', 'delivered'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  executeTimedQuery('updateOrderStatus', `
    UPDATE orders 
    SET status = ?, updated_at = NOW()
    WHERE id = ?
  `, [status, orderId]);
}

// Helper function to execute timed queries
function executeTimedQuery(queryName, query, params = []) {
  const startTime = Date.now();
  
  try {
    const results = sql.query(db, query, ...params);
    const duration = Date.now() - startTime;
    
    // Record metrics
    queriesExecuted.add(1);
    querySuccessRate.add(true);
    queryDuration.add(duration);
    
    check(results, {
      [`${queryName}_success`]: (r) => r !== null && r !== undefined,
    });
    
    return results;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Record metrics for failed queries
    queriesExecuted.add(1);
    querySuccessRate.add(false);
    queryDuration.add(duration);
    
    console.error(`${queryName} failed:`, error);
    check(false, { [`${queryName}_success`]: false });
    
    return null;
  }
}

export function teardown() {
  db.close();
}