# MySQL Performance Monitoring & Testing Suite

A comprehensive Docker-based solution for monitoring and testing MySQL performance using Prometheus, Grafana, and K6.

## 🎯 Overview

This project provides a complete setup for:
- MySQL performance monitoring with Prometheus and Grafana
- Load testing with K6 (including xk6-sql extension)
- Automated test data generation
- Real-time metrics visualization
- Performance benchmarking and analysis

## 📁 Project Structure

```
mysql-monitoring/
├── docker-compose.yml          # Main orchestration file
├── Dockerfile                  # Setup container configuration
├── requirements.txt            # Python dependencies
├── prometheus.yml              # Prometheus configuration
├── grafana/
│   ├── datasources/
│   │   └── datasource.yml     # Grafana datasource config
│   └── dashboards/
│       └── mysql-dashboard.json # Performance dashboard
├── mysql-config/
│   └── my.cnf                 # MySQL optimization config
├── scripts/
│   ├── init.sql               # Database initialization
│   └── setup_test_data.py     # Test data generator
├── k6-tests/
│   ├── mysql-performance-test.js # Basic performance tests
│   ├── load-test.js           # Throughput testing
│   ├── stress-test.js         # High load testing
│   └── spike-test.js          # Spike load testing
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- K6 with xk6-sql extension (for advanced MySQL testing)

### 1. Start the Infrastructure

```bash
# Clone or navigate to the project directory
cd mysql-monitoring

# Start all services
docker-compose up -d

# Check service status
docker-compose ps
```

### 2. Initialize Test Data

```bash
# Wait for MySQL to be ready (may take 1-2 minutes)
docker-compose logs mysql

# Generate test data
docker-compose exec setup python /scripts/setup_test_data.py

# Or run with custom data volumes
docker-compose exec setup env USERS_COUNT=50000 PRODUCTS_COUNT=25000 python /scripts/setup_test_data.py
```

### 3. Access the Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **MySQL**: localhost:3306 (testuser/testpassword)

### 4. Run Performance Tests

```bash
# Install K6 with SQL extension (if not already installed)
# Follow: https://github.com/grafana/xk6-sql

# Basic performance test
k6 run k6-tests/mysql-performance-test.js

# Load test with Prometheus output
k6 run --out prometheus k6-tests/load-test.js

# Stress test
k6 run --out prometheus k6-tests/stress-test.js

# Spike test
k6 run --out prometheus k6-tests/spike-test.js

# Generate HTML report
k6 run --out json=results.json k6-tests/load-test.js
```

## 📊 Available Tests

### 1. Basic Performance Test (`mysql-performance-test.js`)
Tests various MySQL operations to validate response times:
- Simple SELECT queries
- Complex JOINs and subqueries
- INSERT/UPDATE/DELETE operations
- Aggregations and stored procedures

**Thresholds:**
- 95th percentile < 100ms
- 99th percentile < 200ms
- Success rate > 95%

### 2. Load Test (`load-test.js`)
Gradual load increase to test throughput:
- Progressive ramp-up from 10 to 75 concurrent users
- Mixed read/write workloads
- Realistic user behavior simulation

**Thresholds:**
- 95th percentile < 200ms
- 99th percentile < 500ms
- Success rate > 95%
- Minimum 1000 queries total

### 3. Stress Test (`stress-test.js`)
High-load testing to find breaking points:
- Aggressive ramp-up to 500 concurrent users
- Connection pool testing
- Error rate monitoring
- Recovery time measurement

**Thresholds:**
- 95th percentile < 1000ms
- Success rate > 85%
- Connection errors < 100
- Query timeouts < 50

### 4. Spike Test (`spike-test.js`)
Sudden load spikes to test system resilience:
- Sudden jumps in concurrent users
- Recovery time measurement
- System stability validation

**Thresholds:**
- 95th percentile < 2000ms
- Success rate > 80%
- Connection errors < 200

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USERS_COUNT` | 10000 | Number of test users to generate |
| `PRODUCTS_COUNT` | 5000 | Number of test products |
| `ORDERS_COUNT` | 25000 | Number of test orders |
| `REVIEWS_COUNT` | 15000 | Number of test reviews |
| `PERFORMANCE_RECORDS` | 100000 | Performance test records |

### MySQL Configuration

The `mysql-config/my.cnf` file includes optimizations for:
- Performance Schema enabled
- Slow query logging
- Connection limits
- Buffer pool sizing
- Query caching

### Prometheus Configuration

Monitors:
- MySQL metrics via mysql-exporter
- K6 metrics via prometheus output
- Custom application metrics

### Grafana Dashboard

Includes panels for:
- Queries per second
- Connection metrics
- Response times (avg, p95, p99)
- Error rates
- Buffer pool usage
- K6 performance metrics

## 📈 Metrics Collection

### MySQL Metrics
- `mysql_global_status_queries`: Total queries
- `mysql_global_status_threads_connected`: Active connections
- `mysql_global_status_slow_queries`: Slow queries
- `mysql_global_status_innodb_buffer_pool_*`: Buffer pool metrics

### K6 Metrics
- `k6_http_req_duration_*`: Response time percentiles
- `k6_http_reqs_rate`: Request rate
- `k6_http_req_failed_rate`: Error rate
- Custom MySQL query metrics

### Custom Metrics
- `mysql_query_duration`: Query execution time
- `mysql_query_success_rate`: Query success rate
- `mysql_connection_duration`: Connection establishment time

## 🔍 Performance Analysis

### Key Performance Indicators

1. **Response Time**
   - Target: p95 < 100ms, p99 < 200ms
   - Monitor: Query execution time trends

2. **Throughput**
   - Target: > 1000 QPS sustained
   - Monitor: Queries per second rate

3. **Error Rate**
   - Target: < 5% error rate
   - Monitor: Failed queries and connections

4. **Connection Health**
   - Target: < 80% of max connections
   - Monitor: Active vs total connections

### Troubleshooting Common Issues

1. **High Response Times**
   - Check slow query log
   - Analyze query execution plans
   - Review index usage

2. **Connection Errors**
   - Increase max_connections
   - Optimize connection pooling
   - Check for connection leaks

3. **Memory Issues**
   - Adjust buffer pool size
   - Monitor memory usage
   - Check for memory leaks

## 🧪 Test Data Schema

The test database includes realistic e-commerce data:

- **Users**: 10,000 users with demographics
- **Products**: 5,000 products with categories
- **Orders**: 25,000 orders with items
- **Reviews**: 15,000 product reviews
- **Performance Test Table**: 100,000 varied records

All tables include appropriate indexes for performance testing.

## 🎛️ Advanced Usage

### Custom Test Scenarios

Create custom K6 scripts for specific use cases:

```javascript
import sql from 'k6/x/sql';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
  ],
};

const db = sql.open('mysql', 'testuser:testpassword@tcp(mysql:3306)/testdb');

export default function() {
  const results = sql.query(db, 'SELECT * FROM your_table WHERE condition = ?', ['value']);
  // Add your custom logic here
}
```

### Monitoring Production

Adapt the monitoring setup for production:

1. Update MySQL credentials
2. Configure Prometheus scraping
3. Set up alerting rules
4. Customize Grafana dashboards

### Scaling Tests

For larger scale testing:

1. Increase test data volumes
2. Add more K6 instances
3. Use distributed K6 execution
4. Monitor resource utilization

## 📚 Resources

### Documentation
- [K6 Documentation](https://k6.io/docs/)
- [xk6-sql Extension](https://github.com/grafana/xk6-sql)
- [Prometheus MySQL Exporter](https://github.com/prometheus/mysqld_exporter)
- [Grafana Dashboards](https://grafana.com/docs/)

### Performance Tuning
- [MySQL Performance Schema](https://dev.mysql.com/doc/refman/8.0/en/performance-schema.html)
- [InnoDB Configuration](https://dev.mysql.com/doc/refman/8.0/en/innodb-configuration.html)
- [Query Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your improvements
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs: `docker-compose logs [service]`
3. Open an issue with detailed information

---

**Happy Testing! 🚀**