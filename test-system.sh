#!/bin/bash

echo "=== Testing MySQL Metrics Database System ==="

# Test 1: Check if all containers are running
echo "1. Checking container status..."
docker-compose ps

# Test 2: Check MySQL connectivity
echo "2. Testing MySQL connectivity..."
docker-compose exec mysql mysql -u testuser -ptestpassword -D testdb -e "SELECT 'MySQL is working!' as status;"

# Test 3: Check MySQL exporter
echo "3. Testing MySQL exporter..."
curl -s http://localhost:9104/metrics | grep -i mysql_up

# Test 4: Check Prometheus
echo "4. Testing Prometheus..."
curl -s http://localhost:9090/api/v1/label/__name__/values | head -20

# Test 5: Test k6 with Prometheus output
echo "5. Running k6 test with Prometheus output..."
docker-compose exec k6 k6 run --out experimental-prometheus-rw=http://prometheus:9090/api/v1/write /scripts/prometheus-compatible-test.js

# Test 6: Check if metrics are in Prometheus
echo "6. Checking if k6 metrics are in Prometheus..."
sleep 10
curl -s "http://localhost:9090/api/v1/query?query=db_operation_total" | grep -o '"value":\[[^]]*\]' | head -5

# Test 7: Check Grafana accessibility
echo "7. Testing Grafana accessibility..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

echo "=== System test completed ==="