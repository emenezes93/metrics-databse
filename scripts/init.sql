-- Database initialization script
-- Create test database and tables for performance testing

USE testdb;

-- Create users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    age INT,
    country VARCHAR(50),
    city VARCHAR(50)
);

-- Create products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INT,
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    weight DECIMAL(8, 2),
    dimensions VARCHAR(50),
    brand VARCHAR(50),
    sku VARCHAR(50) UNIQUE
);

-- Create orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    shipping_address TEXT,
    payment_method VARCHAR(50),
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create order_items table
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create categories table
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    parent_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Create reviews table
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create sessions table for testing connection handling
CREATE TABLE user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create performance test table
CREATE TABLE performance_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_data TEXT,
    number_value INT,
    decimal_value DECIMAL(10, 2),
    date_value DATE,
    datetime_value DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    random_string VARCHAR(255),
    json_data JSON,
    blob_data BLOB
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_country_city ON users(country, city);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_name ON products(name);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_performance_number ON performance_test(number_value);
CREATE INDEX idx_performance_decimal ON performance_test(decimal_value);
CREATE INDEX idx_performance_date ON performance_test(date_value);
CREATE INDEX idx_performance_created_at ON performance_test(created_at);

-- Create foreign key constraints
ALTER TABLE products ADD CONSTRAINT fk_products_category 
    FOREIGN KEY (category_id) REFERENCES categories(id);

-- Create views for complex queries
CREATE VIEW user_order_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    COUNT(o.id) as total_orders,
    SUM(o.total_amount) as total_spent,
    AVG(o.total_amount) as avg_order_value,
    MAX(o.order_date) as last_order_date,
    MIN(o.order_date) as first_order_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.username, u.email;

CREATE VIEW product_performance AS
SELECT 
    p.id as product_id,
    p.name,
    p.price,
    COUNT(oi.id) as total_sold,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.total_price) as total_revenue,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as review_count
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN reviews r ON p.id = r.product_id
GROUP BY p.id, p.name, p.price;

-- Create stored procedures for testing
DELIMITER //

CREATE PROCEDURE GetUserOrderStats(IN user_id INT)
BEGIN
    SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as avg_order_value,
        MAX(order_date) as last_order,
        MIN(order_date) as first_order
    FROM orders 
    WHERE user_id = user_id;
END //

CREATE PROCEDURE GetTopSellingProducts(IN limit_count INT)
BEGIN
    SELECT 
        p.id,
        p.name,
        p.price,
        SUM(oi.quantity) as total_sold,
        SUM(oi.total_price) as total_revenue
    FROM products p
    JOIN order_items oi ON p.id = oi.product_id
    GROUP BY p.id, p.name, p.price
    ORDER BY total_sold DESC
    LIMIT limit_count;
END //

CREATE PROCEDURE SimulateHeavyQuery()
BEGIN
    SELECT 
        u.id,
        u.username,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_spent,
        AVG(r.rating) as avg_rating
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN reviews r ON oi.product_id = r.product_id AND u.id = r.user_id
    GROUP BY u.id, u.username
    ORDER BY total_spent DESC;
END //

DELIMITER ;

-- Insert initial test data
INSERT INTO categories (name, description) VALUES 
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Clothing and fashion items'),
('Books', 'Books and educational materials'),
('Sports', 'Sports equipment and accessories'),
('Home', 'Home and garden items');

-- Insert some initial users
INSERT INTO users (username, email, password_hash, first_name, last_name, age, country, city) VALUES 
('testuser1', 'test1@example.com', 'hashed_password_1', 'John', 'Doe', 30, 'USA', 'New York'),
('testuser2', 'test2@example.com', 'hashed_password_2', 'Jane', 'Smith', 25, 'USA', 'Los Angeles'),
('testuser3', 'test3@example.com', 'hashed_password_3', 'Bob', 'Johnson', 35, 'Canada', 'Toronto'),
('testuser4', 'test4@example.com', 'hashed_password_4', 'Alice', 'Williams', 28, 'UK', 'London'),
('testuser5', 'test5@example.com', 'hashed_password_5', 'Charlie', 'Brown', 32, 'Australia', 'Sydney');

-- Insert some initial products
INSERT INTO products (name, description, price, category_id, stock_quantity, brand, sku) VALUES 
('Laptop', 'High-performance laptop', 999.99, 1, 50, 'TechBrand', 'LAPTOP001'),
('Smartphone', 'Latest smartphone model', 699.99, 1, 100, 'PhoneBrand', 'PHONE001'),
('T-Shirt', 'Comfortable cotton t-shirt', 19.99, 2, 200, 'FashionBrand', 'SHIRT001'),
('Programming Book', 'Learn programming basics', 39.99, 3, 75, 'EduPublisher', 'BOOK001'),
('Running Shoes', 'Professional running shoes', 129.99, 4, 60, 'SportsBrand', 'SHOES001');

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON testdb.* TO 'testuser'@'%';
FLUSH PRIVILEGES;