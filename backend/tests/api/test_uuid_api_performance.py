"""
UUID API Performance Tests

Performance tests for API endpoints with UUID parameters to ensure
acceptable response times and throughput.
"""

import pytest
import uuid
import time
import statistics
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.journal_entry import JournalEntry
from app.models.reminder import Reminder
from tests.test_config import TestDataFactory


class TestUUIDAPIPerformance:
    """Test performance of API endpoints with UUID parameters."""

    def test_single_uuid_lookup_performance(self, client: TestClient, token_headers: dict):
        """Test performance of single UUID lookup operations."""
        # Create a journal entry
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Performance Test Entry",
                "content": "Testing UUID lookup performance",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Measure lookup performance
        lookup_times = []
        for _ in range(10):
            start_time = time.time()
            response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
            end_time = time.time()
            
            assert response.status_code == 200
            lookup_times.append(end_time - start_time)
        
        # Verify performance metrics
        avg_time = statistics.mean(lookup_times)
        max_time = max(lookup_times)
        
        # Performance requirements (adjust as needed)
        assert avg_time < 0.5, f"Average lookup time {avg_time:.3f}s exceeds 0.5s"
        assert max_time < 1.0, f"Maximum lookup time {max_time:.3f}s exceeds 1.0s"
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_bulk_uuid_operations_performance(self, client: TestClient, token_headers: dict):
        """Test performance of bulk operations with UUID parameters."""
        # Create multiple journal entries
        journal_ids = []
        create_times = []
        
        for i in range(20):
            start_time = time.time()
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Bulk Test Entry {i}",
                    "content": f"Bulk testing content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            end_time = time.time()
            
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
            create_times.append(end_time - start_time)
        
        # Measure bulk retrieval performance
        start_time = time.time()
        list_response = client.get("/api/journals", headers=token_headers)
        end_time = time.time()
        
        assert list_response.status_code == 200
        list_time = end_time - start_time
        
        # Verify performance metrics
        avg_create_time = statistics.mean(create_times)
        
        # Performance requirements
        assert avg_create_time < 0.5, f"Average create time {avg_create_time:.3f}s exceeds 0.5s"
        assert list_time < 2.0, f"List time {list_time:.3f}s exceeds 2.0s"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_concurrent_uuid_operations_performance(self, client: TestClient, token_headers: dict):
        """Test performance under concurrent UUID operations."""
        import threading
        import queue
        
        # Create a journal entry to test with
        create_response = client.post(
            "/api/journals",
            headers=token_headers,
            json={
                "title": "Concurrent Test Entry",
                "content": "Testing concurrent UUID operations",
                "entry_date": "2023-03-27"
            }
        )
        assert create_response.status_code == 201
        journal_id = create_response.json()["id"]
        
        # Queue to collect results
        results = queue.Queue()
        
        def worker():
            """Worker function for concurrent requests."""
            start_time = time.time()
            response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
            end_time = time.time()
            
            results.put({
                'status_code': response.status_code,
                'response_time': end_time - start_time
            })
        
        # Launch concurrent requests
        threads = []
        num_threads = 5
        
        for _ in range(num_threads):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Collect results
        response_times = []
        while not results.empty():
            result = results.get()
            assert result['status_code'] == 200
            response_times.append(result['response_time'])
        
        # Verify performance under concurrency
        avg_time = statistics.mean(response_times)
        max_time = max(response_times)
        
        assert avg_time < 1.0, f"Average concurrent response time {avg_time:.3f}s exceeds 1.0s"
        assert max_time < 2.0, f"Maximum concurrent response time {max_time:.3f}s exceeds 2.0s"
        
        # Clean up
        client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_uuid_parameter_parsing_performance(self, client: TestClient, token_headers: dict):
        """Test performance of UUID parameter parsing."""
        # Create test data
        journal_ids = []
        for i in range(10):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Parsing Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Test various UUID formats and measure parsing time
        parsing_times = []
        
        for journal_id in journal_ids:
            # Test standard UUID format
            start_time = time.time()
            response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
            end_time = time.time()
            
            assert response.status_code == 200
            parsing_times.append(end_time - start_time)
            
            # Test uppercase UUID format
            start_time = time.time()
            response = client.get(f"/api/journals/{journal_id.upper()}", headers=token_headers)
            end_time = time.time()
            
            assert response.status_code == 200
            parsing_times.append(end_time - start_time)
        
        # Verify parsing performance
        avg_parsing_time = statistics.mean(parsing_times)
        max_parsing_time = max(parsing_times)
        
        assert avg_parsing_time < 0.3, f"Average parsing time {avg_parsing_time:.3f}s exceeds 0.3s"
        assert max_parsing_time < 0.5, f"Maximum parsing time {max_parsing_time:.3f}s exceeds 0.5s"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_uuid_response_serialization_performance(self, client: TestClient, token_headers: dict):
        """Test performance of UUID response serialization."""
        # Create multiple entries to test serialization performance
        journal_ids = []
        for i in range(50):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Serialization Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Test list endpoint serialization performance
        serialization_times = []
        
        for _ in range(5):
            start_time = time.time()
            response = client.get("/api/journals", headers=token_headers)
            end_time = time.time()
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert len(data["items"]) >= 50
            
            serialization_times.append(end_time - start_time)
        
        # Verify serialization performance
        avg_serialization_time = statistics.mean(serialization_times)
        max_serialization_time = max(serialization_times)
        
        assert avg_serialization_time < 1.0, f"Average serialization time {avg_serialization_time:.3f}s exceeds 1.0s"
        assert max_serialization_time < 2.0, f"Maximum serialization time {max_serialization_time:.3f}s exceeds 2.0s"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)


class TestUUIDAPIThroughput:
    """Test API throughput with UUID parameters."""

    def test_create_operations_throughput(self, client: TestClient, token_headers: dict):
        """Test throughput of create operations with UUID responses."""
        num_operations = 30
        start_time = time.time()
        
        journal_ids = []
        for i in range(num_operations):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Throughput Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Calculate throughput
        throughput = num_operations / total_time
        
        # Verify throughput requirements
        assert throughput > 10, f"Create throughput {throughput:.2f} ops/sec is below 10 ops/sec"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_read_operations_throughput(self, client: TestClient, token_headers: dict):
        """Test throughput of read operations with UUID parameters."""
        # Create test data
        journal_ids = []
        for i in range(10):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Read Throughput Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Test read throughput
        num_reads = 50
        start_time = time.time()
        
        for i in range(num_reads):
            journal_id = journal_ids[i % len(journal_ids)]
            response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
            assert response.status_code == 200
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Calculate throughput
        throughput = num_reads / total_time
        
        # Verify throughput requirements
        assert throughput > 20, f"Read throughput {throughput:.2f} ops/sec is below 20 ops/sec"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_mixed_operations_throughput(self, client: TestClient, token_headers: dict):
        """Test throughput of mixed CRUD operations with UUID parameters."""
        operations = []
        journal_ids = []
        
        # Create initial data
        for i in range(5):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Mixed Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Define mixed operations
        start_time = time.time()
        
        # Create operations
        for i in range(10):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Mixed Create {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
            operations.append("create")
        
        # Read operations
        for i in range(20):
            journal_id = journal_ids[i % len(journal_ids)]
            response = client.get(f"/api/journals/{journal_id}", headers=token_headers)
            assert response.status_code == 200
            operations.append("read")
        
        # Update operations
        for i in range(5):
            journal_id = journal_ids[i % len(journal_ids)]
            response = client.put(
                f"/api/journals/{journal_id}",
                headers=token_headers,
                json={
                    "title": f"Updated Mixed Test {i}",
                    "content": f"Updated content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 200
            operations.append("update")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Calculate throughput
        total_operations = len(operations)
        throughput = total_operations / total_time
        
        # Verify throughput requirements
        assert throughput > 15, f"Mixed operations throughput {throughput:.2f} ops/sec is below 15 ops/sec"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)


class TestUUIDAPIScalability:
    """Test API scalability with UUID parameters."""

    def test_large_dataset_performance(self, client: TestClient, token_headers: dict):
        """Test performance with large datasets containing UUID values."""
        # Create a large number of entries
        num_entries = 100
        journal_ids = []
        
        # Batch create entries
        for i in range(num_entries):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Large Dataset Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Test list performance with large dataset
        start_time = time.time()
        response = client.get("/api/journals", headers=token_headers)
        end_time = time.time()
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= num_entries
        
        list_time = end_time - start_time
        
        # Verify performance doesn't degrade significantly with large datasets
        assert list_time < 3.0, f"List time {list_time:.3f}s exceeds 3.0s for large dataset"
        
        # Test random access performance
        random_access_times = []
        import random
        
        for _ in range(10):
            random_id = random.choice(journal_ids)
            start_time = time.time()
            response = client.get(f"/api/journals/{random_id}", headers=token_headers)
            end_time = time.time()
            
            assert response.status_code == 200
            random_access_times.append(end_time - start_time)
        
        avg_access_time = statistics.mean(random_access_times)
        assert avg_access_time < 0.5, f"Average random access time {avg_access_time:.3f}s exceeds 0.5s"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers)

    def test_memory_usage_with_uuid_responses(self, client: TestClient, token_headers: dict):
        """Test memory usage with UUID-heavy responses."""
        import psutil
        import os
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Create many entries to test memory usage
        journal_ids = []
        for i in range(50):
            response = client.post(
                "/api/journals",
                headers=token_headers,
                json={
                    "title": f"Memory Test {i}",
                    "content": f"Content {i}",
                    "entry_date": "2023-03-27"
                }
            )
            assert response.status_code == 201
            journal_ids.append(response.json()["id"])
        
        # Make multiple list requests to test memory usage
        for _ in range(10):
            response = client.get("/api/journals", headers=token_headers)
            assert response.status_code == 200
        
        # Check memory usage after operations
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        # Verify memory usage is reasonable (adjust threshold as needed)
        max_memory_increase = 50 * 1024 * 1024  # 50MB
        assert memory_increase < max_memory_increase, f"Memory increase {memory_increase / 1024 / 1024:.2f}MB exceeds {max_memory_increase / 1024 / 1024}MB"
        
        # Clean up
        for journal_id in journal_ids:
            client.delete(f"/api/journals/{journal_id}", headers=token_headers) 