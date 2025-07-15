"""
Performance Tests for UUID-based Database Query Operations

This module tests the performance of database queries that utilize UUID primary keys
and indexes, validating that the new schema provides optimal query performance.
"""

import pytest
import uuid
import random
from typing import List, Dict, Any

from .performance_utils import (
    DatabasePerformanceTester,
    PerformanceMetrics,
    PerformanceTestSetup,
    PerformanceTimer
)


class TestUUIDQueryPerformance:
    """Test suite for UUID-based query performance."""
    
    @pytest.fixture(scope="class")
    def db_tester(self):
        """Create database performance tester."""
        return DatabasePerformanceTester()
    
    @pytest.fixture(scope="class")
    def test_setup(self, db_tester):
        """Set up test data for performance testing."""
        setup = PerformanceTestSetup(db_tester)
        setup.setup_test_data(
            user_count=1000,
            journal_count=5000,
            tag_count=2000,
            reminder_count=1000,
            secret_tag_count=500
        )
        yield setup
        setup.cleanup_test_data()
    
    def test_primary_key_lookup_performance(self, db_tester, test_setup):
        """Test performance of primary key lookups for all tables."""
        # Test user primary key lookups
        user_ids = random.sample(test_setup.test_data_ids["users"], 100)
        user_params = [{"user_id": user_id} for user_id in user_ids]
        
        user_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM users WHERE id = :user_id",
            user_params
        )
        
        # Test journal primary key lookups
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 100)
        journal_params = [{"journal_id": journal_id} for journal_id in journal_ids]
        
        journal_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM journal_entries WHERE id = :journal_id",
            journal_params
        )
        
        # Test tag primary key lookups
        tag_ids = random.sample(test_setup.test_data_ids["tags"], 100)
        tag_params = [{"tag_id": tag_id} for tag_id in tag_ids]
        
        tag_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM tags WHERE id = :tag_id",
            tag_params
        )
        
        # Test reminder primary key lookups
        reminder_ids = random.sample(test_setup.test_data_ids["reminders"], 100)
        reminder_params = [{"reminder_id": reminder_id} for reminder_id in reminder_ids]
        
        reminder_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM reminders WHERE id = :reminder_id",
            reminder_params
        )
        
        # Assert performance requirements
        user_metrics.assert_performance(max_average=0.005)  # 5ms average
        journal_metrics.assert_performance(max_average=0.005)  # 5ms average
        tag_metrics.assert_performance(max_average=0.005)  # 5ms average
        reminder_metrics.assert_performance(max_average=0.005)  # 5ms average
        
        # Print performance summaries
        print(f"\n=== Primary Key Lookup Performance ===")
        print(f"Users: {user_metrics.get_summary()}")
        print(f"Journals: {journal_metrics.get_summary()}")
        print(f"Tags: {tag_metrics.get_summary()}")
        print(f"Reminders: {reminder_metrics.get_summary()}")
    
    def test_foreign_key_relationship_performance(self, db_tester, test_setup):
        """Test performance of foreign key relationship queries."""
        # Test journal entries by user
        user_ids = random.sample(test_setup.test_data_ids["users"], 50)
        user_journal_params = [{"user_id": user_id} for user_id in user_ids]
        
        user_journal_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM journal_entries WHERE user_id = :user_id",
            user_journal_params
        )
        
        # Test tags by journal
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 50)
        journal_tag_params = [{"journal_id": journal_id} for journal_id in journal_ids]
        
        journal_tag_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM tags WHERE journal_id = :journal_id",
            journal_tag_params
        )
        
        # Test reminders by user
        user_reminder_params = [{"user_id": user_id} for user_id in user_ids]
        
        user_reminder_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM reminders WHERE user_id = :user_id",
            user_reminder_params
        )
        
        # Test secret tags by journal
        secret_tag_params = [{"journal_id": journal_id} for journal_id in journal_ids]
        
        secret_tag_metrics = db_tester.time_multiple_queries(
            "SELECT * FROM secret_tags WHERE journal_id = :journal_id",
            secret_tag_params
        )
        
        # Assert performance requirements
        user_journal_metrics.assert_performance(max_average=0.020)  # 20ms average
        journal_tag_metrics.assert_performance(max_average=0.020)  # 20ms average
        user_reminder_metrics.assert_performance(max_average=0.020)  # 20ms average
        secret_tag_metrics.assert_performance(max_average=0.020)  # 20ms average
        
        # Print performance summaries
        print(f"\n=== Foreign Key Relationship Performance ===")
        print(f"User -> Journals: {user_journal_metrics.get_summary()}")
        print(f"Journal -> Tags: {journal_tag_metrics.get_summary()}")
        print(f"User -> Reminders: {user_reminder_metrics.get_summary()}")
        print(f"Journal -> Secret Tags: {secret_tag_metrics.get_summary()}")
    
    def test_index_utilization_analysis(self, db_tester, test_setup):
        """Test that queries are utilizing indexes effectively."""
        # Test primary key index utilization
        user_id = random.choice(test_setup.test_data_ids["users"])
        query_plan = db_tester.get_query_plan(
            "SELECT * FROM users WHERE id = :user_id",
            {"user_id": user_id}
        )
        
        # Verify index usage (should use Index Scan, not Seq Scan)
        plan_json = query_plan[0][0][0]["Plan"]
        assert "Index Scan" in plan_json["Node Type"] or "Index Only Scan" in plan_json["Node Type"], \
            f"Primary key query should use index scan, got: {plan_json['Node Type']}"
        
        # Test foreign key index utilization
        journal_id = random.choice(test_setup.test_data_ids["journals"])
        fk_query_plan = db_tester.get_query_plan(
            "SELECT * FROM tags WHERE journal_id = :journal_id",
            {"journal_id": journal_id}
        )
        
        # Verify foreign key index usage
        fk_plan_json = fk_query_plan[0][0][0]["Plan"]
        # Should use either Index Scan or Bitmap Index Scan for foreign keys
        assert any(scan_type in fk_plan_json["Node Type"] for scan_type in 
                  ["Index Scan", "Bitmap Index Scan", "Index Only Scan"]), \
            f"Foreign key query should use index scan, got: {fk_plan_json['Node Type']}"
        
        print(f"\n=== Index Utilization Analysis ===")
        print(f"Primary key query plan: {plan_json['Node Type']}")
        print(f"Foreign key query plan: {fk_plan_json['Node Type']}")
    
    def test_complex_join_performance(self, db_tester, test_setup):
        """Test performance of complex queries with joins."""
        # Test user with journal entries and tags
        user_ids = random.sample(test_setup.test_data_ids["users"], 20)
        user_params = [{"user_id": user_id} for user_id in user_ids]
        
        complex_join_metrics = db_tester.time_multiple_queries("""
            SELECT u.id, u.email, j.title, t.name as tag_name
            FROM users u
            JOIN journal_entries j ON u.id = j.user_id
            JOIN tags t ON j.id = t.journal_id
            WHERE u.id = :user_id
        """, user_params)
        
        # Test user with reminders and journal count
        user_summary_metrics = db_tester.time_multiple_queries("""
            SELECT u.id, u.email, 
                   COUNT(DISTINCT j.id) as journal_count,
                   COUNT(DISTINCT r.id) as reminder_count
            FROM users u
            LEFT JOIN journal_entries j ON u.id = j.user_id
            LEFT JOIN reminders r ON u.id = r.user_id
            WHERE u.id = :user_id
            GROUP BY u.id, u.email
        """, user_params)
        
        # Assert performance requirements
        complex_join_metrics.assert_performance(max_average=0.050)  # 50ms average
        user_summary_metrics.assert_performance(max_average=0.050)  # 50ms average
        
        # Print performance summaries
        print(f"\n=== Complex Join Performance ===")
        print(f"User-Journal-Tag join: {complex_join_metrics.get_summary()}")
        print(f"User summary with counts: {user_summary_metrics.get_summary()}")
    
    def test_range_and_filtering_performance(self, db_tester, test_setup):
        """Test performance of range queries and filtering."""
        # Test journal entries created in date range
        date_range_metrics = db_tester.time_multiple_queries("""
            SELECT * FROM journal_entries 
            WHERE created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 100
        """, [{}] * 20)  # Run 20 times
        
        # Test incomplete reminders
        incomplete_reminder_metrics = db_tester.time_multiple_queries("""
            SELECT * FROM reminders 
            WHERE is_completed = false 
            AND due_date <= NOW() + INTERVAL '7 days'
            ORDER BY due_date ASC
            LIMIT 50
        """, [{}] * 20)  # Run 20 times
        
        # Test journal entries with tag filtering
        tag_filter_metrics = db_tester.time_multiple_queries("""
            SELECT DISTINCT j.* FROM journal_entries j
            JOIN tags t ON j.id = t.journal_id
            WHERE t.name LIKE :tag_pattern
            ORDER BY j.created_at DESC
            LIMIT 100
        """, [{"tag_pattern": f"tag_{i}%"} for i in range(20)])
        
        # Assert performance requirements
        date_range_metrics.assert_performance(max_average=0.030)  # 30ms average
        incomplete_reminder_metrics.assert_performance(max_average=0.030)  # 30ms average
        tag_filter_metrics.assert_performance(max_average=0.050)  # 50ms average
        
        # Print performance summaries
        print(f"\n=== Range and Filtering Performance ===")
        print(f"Date range queries: {date_range_metrics.get_summary()}")
        print(f"Incomplete reminders: {incomplete_reminder_metrics.get_summary()}")
        print(f"Tag filtering: {tag_filter_metrics.get_summary()}")
    
    def test_aggregation_performance(self, db_tester, test_setup):
        """Test performance of aggregation queries."""
        # Test user statistics
        user_stats_metrics = db_tester.time_multiple_queries("""
            SELECT u.id, u.email,
                   COUNT(DISTINCT j.id) as journal_count,
                   COUNT(DISTINCT t.id) as tag_count,
                   COUNT(DISTINCT r.id) as reminder_count,
                   COUNT(DISTINCT st.id) as secret_tag_count
            FROM users u
            LEFT JOIN journal_entries j ON u.id = j.user_id
            LEFT JOIN tags t ON j.id = t.journal_id
            LEFT JOIN reminders r ON u.id = r.user_id
            LEFT JOIN secret_tags st ON j.id = st.journal_id
            GROUP BY u.id, u.email
            ORDER BY journal_count DESC
            LIMIT 50
        """, [{}] * 10)  # Run 10 times
        
        # Test tag popularity
        tag_popularity_metrics = db_tester.time_multiple_queries("""
            SELECT t.name, COUNT(*) as usage_count
            FROM tags t
            JOIN journal_entries j ON t.journal_id = j.id
            GROUP BY t.name
            ORDER BY usage_count DESC
            LIMIT 100
        """, [{}] * 10)  # Run 10 times
        
        # Test monthly journal statistics
        monthly_stats_metrics = db_tester.time_multiple_queries("""
            SELECT DATE_TRUNC('month', j.created_at) as month,
                   COUNT(*) as journal_count,
                   COUNT(DISTINCT j.user_id) as active_users
            FROM journal_entries j
            WHERE j.created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', j.created_at)
            ORDER BY month DESC
        """, [{}] * 10)  # Run 10 times
        
        # Assert performance requirements
        user_stats_metrics.assert_performance(max_average=0.100)  # 100ms average
        tag_popularity_metrics.assert_performance(max_average=0.050)  # 50ms average
        monthly_stats_metrics.assert_performance(max_average=0.080)  # 80ms average
        
        # Print performance summaries
        print(f"\n=== Aggregation Performance ===")
        print(f"User statistics: {user_stats_metrics.get_summary()}")
        print(f"Tag popularity: {tag_popularity_metrics.get_summary()}")
        print(f"Monthly statistics: {monthly_stats_metrics.get_summary()}")
    
    def test_search_performance(self, db_tester, test_setup):
        """Test performance of search queries."""
        # Test journal title search
        search_terms = [f"Journal Entry {i}" for i in range(1, 21)]
        title_search_params = [{"search_term": f"%{term}%"} for term in search_terms]
        
        title_search_metrics = db_tester.time_multiple_queries("""
            SELECT * FROM journal_entries 
            WHERE title ILIKE :search_term
            ORDER BY created_at DESC
            LIMIT 50
        """, title_search_params)
        
        # Test journal content search
        content_search_params = [{"search_term": f"%content of journal entry {i}%"} for i in range(1, 21)]
        
        content_search_metrics = db_tester.time_multiple_queries("""
            SELECT * FROM journal_entries 
            WHERE content ILIKE :search_term
            ORDER BY created_at DESC
            LIMIT 50
        """, content_search_params)
        
        # Test user email search
        email_search_params = [{"search_term": f"user{i}@example.com"} for i in range(1, 21)]
        
        email_search_metrics = db_tester.time_multiple_queries("""
            SELECT * FROM users 
            WHERE email = :search_term
        """, email_search_params)
        
        # Assert performance requirements
        title_search_metrics.assert_performance(max_average=0.030)  # 30ms average
        content_search_metrics.assert_performance(max_average=0.100)  # 100ms average (content search is slower)
        email_search_metrics.assert_performance(max_average=0.010)  # 10ms average (indexed)
        
        # Print performance summaries
        print(f"\n=== Search Performance ===")
        print(f"Title search: {title_search_metrics.get_summary()}")
        print(f"Content search: {content_search_metrics.get_summary()}")
        print(f"Email search: {email_search_metrics.get_summary()}")
    
    def test_pagination_performance(self, db_tester, test_setup):
        """Test performance of paginated queries."""
        # Test paginated journal entries
        page_sizes = [10, 25, 50, 100]
        offsets = [0, 100, 500, 1000]
        
        pagination_metrics = PerformanceMetrics()
        
        for page_size in page_sizes:
            for offset in offsets:
                duration, _ = db_tester.time_query("""
                    SELECT * FROM journal_entries 
                    ORDER BY created_at DESC 
                    LIMIT :limit OFFSET :offset
                """, {"limit": page_size, "offset": offset})
                pagination_metrics.add_measurement(duration)
        
        # Test paginated search with offset
        search_pagination_metrics = PerformanceMetrics()
        
        for offset in [0, 50, 100, 200]:
            duration, _ = db_tester.time_query("""
                SELECT * FROM journal_entries 
                WHERE title ILIKE :search_term
                ORDER BY created_at DESC 
                LIMIT 25 OFFSET :offset
            """, {"search_term": "%Journal%", "offset": offset})
            search_pagination_metrics.add_measurement(duration)
        
        # Assert performance requirements
        pagination_metrics.assert_performance(max_average=0.020)  # 20ms average
        search_pagination_metrics.assert_performance(max_average=0.040)  # 40ms average
        
        # Print performance summaries
        print(f"\n=== Pagination Performance ===")
        print(f"Standard pagination: {pagination_metrics.get_summary()}")
        print(f"Search pagination: {search_pagination_metrics.get_summary()}")
    
    def test_query_plan_verification(self, db_tester, test_setup):
        """Verify that all critical queries use appropriate indexes."""
        test_cases = [
            {
                "name": "User primary key lookup",
                "query": "SELECT * FROM users WHERE id = :id",
                "params": {"id": random.choice(test_setup.test_data_ids["users"])},
                "expected_node_types": ["Index Scan", "Index Only Scan"]
            },
            {
                "name": "Journal foreign key lookup",
                "query": "SELECT * FROM journal_entries WHERE user_id = :user_id",
                "params": {"user_id": random.choice(test_setup.test_data_ids["users"])},
                "expected_node_types": ["Index Scan", "Bitmap Index Scan", "Index Only Scan"]
            },
            {
                "name": "Tag foreign key lookup",
                "query": "SELECT * FROM tags WHERE journal_id = :journal_id",
                "params": {"journal_id": random.choice(test_setup.test_data_ids["journals"])},
                "expected_node_types": ["Index Scan", "Bitmap Index Scan", "Index Only Scan"]
            },
            {
                "name": "Email lookup",
                "query": "SELECT * FROM users WHERE email = :email",
                "params": {"email": "user1@example.com"},
                "expected_node_types": ["Index Scan", "Index Only Scan"]
            }
        ]
        
        print(f"\n=== Query Plan Verification ===")
        
        for test_case in test_cases:
            query_plan = db_tester.get_query_plan(test_case["query"], test_case["params"])
            plan_json = query_plan[0][0][0]["Plan"]
            
            node_type = plan_json["Node Type"]
            
            assert any(expected in node_type for expected in test_case["expected_node_types"]), \
                f"{test_case['name']} should use one of {test_case['expected_node_types']}, got: {node_type}"
            
            print(f"{test_case['name']}: {node_type} ✓")
    
    def test_concurrent_read_performance(self, db_tester, test_setup):
        """Test performance under concurrent read scenarios."""
        # Test concurrent primary key lookups
        user_ids = random.sample(test_setup.test_data_ids["users"], 50)
        user_params = [{"user_id": user_id} for user_id in user_ids]
        
        concurrent_pk_metrics = db_tester.time_concurrent_queries(
            "SELECT * FROM users WHERE id = :user_id",
            user_params,
            max_workers=10
        )
        
        # Test concurrent foreign key lookups
        journal_ids = random.sample(test_setup.test_data_ids["journals"], 50)
        journal_params = [{"journal_id": journal_id} for journal_id in journal_ids]
        
        concurrent_fk_metrics = db_tester.time_concurrent_queries(
            "SELECT * FROM tags WHERE journal_id = :journal_id",
            journal_params,
            max_workers=10
        )
        
        # Test concurrent complex queries
        user_complex_params = [{"user_id": user_id} for user_id in user_ids[:20]]
        
        concurrent_complex_metrics = db_tester.time_concurrent_queries("""
            SELECT u.id, u.email, COUNT(j.id) as journal_count
            FROM users u
            LEFT JOIN journal_entries j ON u.id = j.user_id
            WHERE u.id = :user_id
            GROUP BY u.id, u.email
        """, user_complex_params, max_workers=10)
        
        # Assert performance requirements
        concurrent_pk_metrics.assert_performance(max_average=0.100)  # 100ms average under load
        concurrent_fk_metrics.assert_performance(max_average=0.100)  # 100ms average under load
        concurrent_complex_metrics.assert_performance(max_average=0.150)  # 150ms average under load
        
        # Print performance summaries
        print(f"\n=== Concurrent Read Performance ===")
        print(f"Concurrent primary key: {concurrent_pk_metrics.get_summary()}")
        print(f"Concurrent foreign key: {concurrent_fk_metrics.get_summary()}")
        print(f"Concurrent complex: {concurrent_complex_metrics.get_summary()}")


if __name__ == "__main__":
    # Run performance tests standalone
    pytest.main([__file__, "-v", "-s"]) 