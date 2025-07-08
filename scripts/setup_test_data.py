#!/usr/bin/env python3
"""
MySQL Test Data Setup Script
Generates realistic test data for performance testing
"""

import mysql.connector
import random
import string
import json
import time
from datetime import datetime, timedelta
import os
from faker import Faker

# Configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'mysql'),
    'port': int(os.getenv('MYSQL_PORT', '3306')),
    'user': os.getenv('MYSQL_USER', 'testuser'),
    'password': os.getenv('MYSQL_PASSWORD', 'testpassword'),
    'database': os.getenv('MYSQL_DATABASE', 'testdb'),
}

# Data generation parameters
USERS_COUNT = int(os.getenv('USERS_COUNT', '10000'))
PRODUCTS_COUNT = int(os.getenv('PRODUCTS_COUNT', '5000'))
ORDERS_COUNT = int(os.getenv('ORDERS_COUNT', '25000'))
REVIEWS_COUNT = int(os.getenv('REVIEWS_COUNT', '15000'))
PERFORMANCE_RECORDS = int(os.getenv('PERFORMANCE_RECORDS', '100000'))

fake = Faker()

def get_database_connection():
    """Create and return database connection"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"Database connection failed: {err}")
        return None

def wait_for_database():
    """Wait for database to be ready"""
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            conn = get_database_connection()
            if conn:
                conn.close()
                print("Database is ready!")
                return True
        except Exception as e:
            print(f"Waiting for database... (attempt {retry_count + 1}/{max_retries})")
            time.sleep(2)
            retry_count += 1
    
    print("Failed to connect to database after maximum retries")
    return False

def generate_users(conn, count):
    """Generate test users"""
    print(f"Generating {count} users...")
    
    cursor = conn.cursor()
    countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'India', 'China']
    
    batch_size = 1000
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        users_data = []
        
        for j in range(current_batch):
            user_id = i + j + 1
            country = random.choice(countries)
            
            user_data = (
                f"user_{user_id}",
                f"user_{user_id}@example.com",
                fake.sha256(),
                fake.first_name(),
                fake.last_name(),
                random.randint(18, 80),
                country,
                fake.city(),
                fake.date_time_between(start_date='-2y', end_date='now'),
                random.choice([True, False]) if random.random() < 0.05 else True,  # 5% inactive
                fake.date_time_between(start_date='-30d', end_date='now') if random.random() < 0.8 else None
            )
            users_data.append(user_data)
        
        insert_query = """
            INSERT INTO users (username, email, password_hash, first_name, last_name, 
                             age, country, city, created_at, is_active, last_login)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, users_data)
        conn.commit()
        
        if (i + current_batch) % 5000 == 0:
            print(f"Generated {i + current_batch} users...")
    
    cursor.close()
    print(f"✓ Generated {count} users")

def generate_products(conn, count):
    """Generate test products"""
    print(f"Generating {count} products...")
    
    cursor = conn.cursor()
    
    # Get category IDs
    cursor.execute("SELECT id FROM categories")
    category_ids = [row[0] for row in cursor.fetchall()]
    
    brands = ['TechCorp', 'InnovateCo', 'QualityBrand', 'BestChoice', 'PremiumLine', 
              'ValueMax', 'ProSeries', 'EliteGoods', 'SmartTech', 'EcoFriendly']
    
    batch_size = 1000
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        products_data = []
        
        for j in range(current_batch):
            product_id = i + j + 1
            
            product_data = (
                f"Product {product_id}: {fake.catch_phrase()}",
                fake.text(max_nb_chars=200),
                round(random.uniform(9.99, 999.99), 2),
                random.choice(category_ids),
                random.randint(0, 1000),
                fake.date_time_between(start_date='-1y', end_date='now'),
                random.choice([True, False]) if random.random() < 0.05 else True,  # 5% inactive
                round(random.uniform(0.1, 50.0), 2),
                f"{random.randint(10, 200)}x{random.randint(10, 200)}x{random.randint(10, 200)}cm",
                random.choice(brands),
                f"SKU{product_id:06d}"
            )
            products_data.append(product_data)
        
        insert_query = """
            INSERT INTO products (name, description, price, category_id, stock_quantity, 
                                created_at, is_active, weight, dimensions, brand, sku)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, products_data)
        conn.commit()
        
        if (i + current_batch) % 2000 == 0:
            print(f"Generated {i + current_batch} products...")
    
    cursor.close()
    print(f"✓ Generated {count} products")

def generate_orders(conn, count):
    """Generate test orders"""
    print(f"Generating {count} orders...")
    
    cursor = conn.cursor()
    
    # Get user IDs
    cursor.execute("SELECT id FROM users WHERE is_active = 1")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    # Get product IDs and prices
    cursor.execute("SELECT id, price FROM products WHERE is_active = 1")
    products = cursor.fetchall()
    
    statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    payment_methods = ['credit_card', 'paypal', 'bank_transfer', 'cash_on_delivery']
    payment_statuses = ['pending', 'paid', 'failed', 'refunded']
    
    batch_size = 500
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        orders_data = []
        order_items_data = []
        
        for j in range(current_batch):
            order_id = i + j + 1
            user_id = random.choice(user_ids)
            
            # Generate order items
            num_items = random.randint(1, 5)
            order_total = 0
            
            for item_num in range(num_items):
                product_id, product_price = random.choice(products)
                quantity = random.randint(1, 3)
                item_total = product_price * quantity
                order_total += item_total
                
                order_items_data.append((
                    order_id,
                    product_id,
                    quantity,
                    product_price,
                    item_total
                ))
            
            order_data = (
                user_id,
                fake.date_time_between(start_date='-1y', end_date='now'),
                round(order_total, 2),
                random.choice(statuses),
                fake.address(),
                random.choice(payment_methods),
                random.choice(payment_statuses),
                fake.date_time_between(start_date='-1y', end_date='now'),
                fake.date_time_between(start_date='-1y', end_date='now')
            )
            orders_data.append(order_data)
        
        # Insert orders
        insert_orders_query = """
            INSERT INTO orders (user_id, order_date, total_amount, status, shipping_address,
                              payment_method, payment_status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_orders_query, orders_data)
        
        # Insert order items
        insert_items_query = """
            INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price)
            VALUES (%s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_items_query, order_items_data)
        conn.commit()
        
        if (i + current_batch) % 2000 == 0:
            print(f"Generated {i + current_batch} orders...")
    
    cursor.close()
    print(f"✓ Generated {count} orders with items")

def generate_reviews(conn, count):
    """Generate test reviews"""
    print(f"Generating {count} reviews...")
    
    cursor = conn.cursor()
    
    # Get user IDs
    cursor.execute("SELECT id FROM users WHERE is_active = 1")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    # Get product IDs
    cursor.execute("SELECT id FROM products WHERE is_active = 1")
    product_ids = [row[0] for row in cursor.fetchall()]
    
    review_templates = [
        "Great product! Really satisfied with the quality.",
        "Good value for money. Would recommend.",
        "Excellent customer service and fast delivery.",
        "Product quality could be better.",
        "Amazing! Exceeded my expectations.",
        "Decent product but took too long to arrive.",
        "Perfect! Exactly what I was looking for.",
        "Not bad, but there are better alternatives.",
        "Outstanding quality and great price.",
        "Disappointed with the product quality."
    ]
    
    batch_size = 1000
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        reviews_data = []
        
        for j in range(current_batch):
            user_id = random.choice(user_ids)
            product_id = random.choice(product_ids)
            rating = random.randint(1, 5)
            
            # Generate comment based on rating
            if rating >= 4:
                comment = random.choice(review_templates[:5])
            elif rating >= 3:
                comment = random.choice(review_templates[5:7])
            else:
                comment = random.choice(review_templates[7:])
            
            review_data = (
                user_id,
                product_id,
                rating,
                comment,
                fake.date_time_between(start_date='-1y', end_date='now'),
                fake.date_time_between(start_date='-1y', end_date='now'),
                random.choice([True, False]) if random.random() < 0.7 else False  # 70% verified
            )
            reviews_data.append(review_data)
        
        insert_query = """
            INSERT INTO reviews (user_id, product_id, rating, comment, created_at, updated_at, is_verified)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, reviews_data)
        conn.commit()
        
        if (i + current_batch) % 5000 == 0:
            print(f"Generated {i + current_batch} reviews...")
    
    cursor.close()
    print(f"✓ Generated {count} reviews")

def generate_performance_data(conn, count):
    """Generate performance test data"""
    print(f"Generating {count} performance test records...")
    
    cursor = conn.cursor()
    
    batch_size = 2000
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        performance_data = []
        
        for j in range(current_batch):
            record_id = i + j + 1
            
            # Generate varied data types for testing
            test_data = f"Performance test record {record_id}: {fake.text(max_nb_chars=100)}"
            number_value = random.randint(1, 1000000)
            decimal_value = round(random.uniform(0.01, 9999.99), 2)
            date_value = fake.date_between(start_date='-5y', end_date='today')
            datetime_value = fake.date_time_between(start_date='-2y', end_date='now')
            random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=50))
            
            # Generate JSON data
            json_data = json.dumps({
                'id': record_id,
                'category': random.choice(['A', 'B', 'C', 'D', 'E']),
                'tags': [fake.word() for _ in range(random.randint(1, 5))],
                'metadata': {
                    'source': random.choice(['web', 'mobile', 'api']),
                    'priority': random.randint(1, 10),
                    'processed': random.choice([True, False])
                }
            })
            
            # Generate blob data (small binary data)
            blob_data = bytes([random.randint(0, 255) for _ in range(random.randint(10, 100))])
            
            performance_record = (
                test_data,
                number_value,
                decimal_value,
                date_value,
                datetime_value,
                random_string,
                json_data,
                blob_data
            )
            performance_data.append(performance_record)
        
        insert_query = """
            INSERT INTO performance_test (test_data, number_value, decimal_value, date_value, 
                                        datetime_value, random_string, json_data, blob_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, performance_data)
        conn.commit()
        
        if (i + current_batch) % 10000 == 0:
            print(f"Generated {i + current_batch} performance records...")
    
    cursor.close()
    print(f"✓ Generated {count} performance test records")

def generate_user_sessions(conn, count):
    """Generate user session data"""
    print(f"Generating {count} user sessions...")
    
    cursor = conn.cursor()
    
    # Get user IDs
    cursor.execute("SELECT id FROM users WHERE is_active = 1")
    user_ids = [row[0] for row in cursor.fetchall()]
    
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (Android 11; Mobile; rv:68.0) Gecko/68.0 Firefox/88.0'
    ]
    
    batch_size = 1000
    for i in range(0, count, batch_size):
        current_batch = min(batch_size, count - i)
        sessions_data = []
        
        for j in range(current_batch):
            user_id = random.choice(user_ids)
            session_token = ''.join(random.choices(string.ascii_letters + string.digits, k=64))
            created_at = fake.date_time_between(start_date='-30d', end_date='now')
            expires_at = created_at + timedelta(hours=random.randint(1, 24))
            
            session_data = (
                user_id,
                session_token,
                created_at,
                expires_at,
                random.choice([True, False]) if random.random() < 0.8 else False,  # 80% active
                fake.ipv4(),
                random.choice(user_agents)
            )
            sessions_data.append(session_data)
        
        insert_query = """
            INSERT INTO user_sessions (user_id, session_token, created_at, expires_at, 
                                     is_active, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.executemany(insert_query, sessions_data)
        conn.commit()
        
        if (i + current_batch) % 5000 == 0:
            print(f"Generated {i + current_batch} sessions...")
    
    cursor.close()
    print(f"✓ Generated {count} user sessions")

def create_additional_indexes(conn):
    """Create additional indexes for performance testing"""
    print("Creating additional indexes for performance testing...")
    
    cursor = conn.cursor()
    
    indexes = [
        "CREATE INDEX idx_performance_json ON performance_test((json_data->>'$.category'))",
        "CREATE INDEX idx_orders_date_status ON orders(order_date, status)",
        "CREATE INDEX idx_reviews_rating_date ON reviews(rating, created_at)",
        "CREATE INDEX idx_users_country_age ON users(country, age)",
        "CREATE INDEX idx_products_price_category ON products(price, category_id)",
        "CREATE INDEX idx_order_items_product_quantity ON order_items(product_id, quantity)",
        "CREATE INDEX idx_sessions_expires_active ON user_sessions(expires_at, is_active)",
    ]
    
    for index_sql in indexes:
        try:
            cursor.execute(index_sql)
            conn.commit()
            print(f"✓ Created index: {index_sql.split()[2]}")
        except mysql.connector.Error as err:
            print(f"Index creation failed (may already exist): {err}")
    
    cursor.close()

def update_statistics(conn):
    """Update table statistics for query optimization"""
    print("Updating table statistics...")
    
    cursor = conn.cursor()
    
    tables = ['users', 'products', 'orders', 'order_items', 'reviews', 'categories', 'user_sessions', 'performance_test']
    
    for table in tables:
        try:
            cursor.execute(f"ANALYZE TABLE {table}")
            conn.commit()
            print(f"✓ Analyzed table: {table}")
        except mysql.connector.Error as err:
            print(f"Table analysis failed: {err}")
    
    cursor.close()

def verify_data_integrity(conn):
    """Verify data integrity and relationships"""
    print("Verifying data integrity...")
    
    cursor = conn.cursor()
    
    # Check record counts
    tables = ['users', 'products', 'orders', 'order_items', 'reviews', 'categories', 'user_sessions', 'performance_test']
    
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"✓ {table}: {count:,} records")
    
    # Check foreign key relationships
    cursor.execute("""
        SELECT COUNT(*) as orphaned_orders
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE u.id IS NULL
    """)
    orphaned_orders = cursor.fetchone()[0]
    print(f"✓ Orphaned orders: {orphaned_orders}")
    
    cursor.execute("""
        SELECT COUNT(*) as orphaned_items
        FROM order_items oi
        LEFT JOIN orders o ON oi.order_id = o.id
        WHERE o.id IS NULL
    """)
    orphaned_items = cursor.fetchone()[0]
    print(f"✓ Orphaned order items: {orphaned_items}")
    
    cursor.close()

def main():
    """Main function to set up test data"""
    print("🚀 Starting MySQL test data setup...")
    print(f"Configuration: {DB_CONFIG}")
    print(f"Target data volumes:")
    print(f"  - Users: {USERS_COUNT:,}")
    print(f"  - Products: {PRODUCTS_COUNT:,}")
    print(f"  - Orders: {ORDERS_COUNT:,}")
    print(f"  - Reviews: {REVIEWS_COUNT:,}")
    print(f"  - Performance records: {PERFORMANCE_RECORDS:,}")
    print()
    
    # Wait for database to be ready
    if not wait_for_database():
        return False
    
    # Connect to database
    conn = get_database_connection()
    if not conn:
        return False
    
    try:
        start_time = time.time()
        
        # Generate test data
        generate_users(conn, USERS_COUNT)
        generate_products(conn, PRODUCTS_COUNT)
        generate_orders(conn, ORDERS_COUNT)
        generate_reviews(conn, REVIEWS_COUNT)
        generate_performance_data(conn, PERFORMANCE_RECORDS)
        generate_user_sessions(conn, USERS_COUNT // 2)  # About half as many sessions as users
        
        # Create additional indexes
        create_additional_indexes(conn)
        
        # Update statistics
        update_statistics(conn)
        
        # Verify data integrity
        verify_data_integrity(conn)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n✅ Test data setup completed successfully!")
        print(f"⏱️  Total time: {duration:.2f} seconds")
        print(f"🎯 Database is ready for performance testing!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during setup: {e}")
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)