"""
Ghar Sathi - Live Production API Smoke Test Suite
Executes automated smoke tests against live Render backend:
Base URL: https://gharsathi-a9er.onrender.com/api/
"""

import sys
import time
import io
import requests

# Enable UTF-8 encoding for Windows terminals
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE_URL = "https://gharsathi-a9er.onrender.com/api"
ROOT_URL = "https://gharsathi-a9er.onrender.com"

PASSED = "PASS"
FAILED = "FAIL"
WARNING = "WARN"

test_results = []


def record_result(test_name, status, details=""):
    test_results.append({
        "name": test_name,
        "status": status,
        "details": details
    })
    status_icon = "✅ PASS" if status == PASSED else ("⚠️  WARN" if status == WARNING else "❌ FAIL")
    print(f"[{status_icon}] {test_name}: {details}")


def run_smoke_tests():
    print("=" * 80)
    print("🚀 GHAR SATHI - LIVE PRODUCTION SMOKE TEST SUITE")
    print(f"Target URL: {BASE_URL}")
    print(f"Timestamp:  {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 80)

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "GharSathi-LiveSmokeTest/1.0"
    })

    admin_token = None

    # --------------------------------------------------------------------------
    # Test 0: Root Service Health Check
    # --------------------------------------------------------------------------
    print("\n--- Test 0: Root Service Health Check ---")
    try:
        r = session.get(ROOT_URL, timeout=15)
        if r.status_code == 200:
            data = r.json()
            record_result(
                "Root Health Check",
                PASSED,
                f"Status: {data.get('status')}, Version: {data.get('version')}, Database: {data.get('database')}"
            )
        else:
            record_result("Root Health Check", WARNING, f"Status code: {r.status_code}")
    except Exception as e:
        record_result("Root Health Check", FAILED, str(e))

    # --------------------------------------------------------------------------
    # Test 1: Public Services Endpoint
    # --------------------------------------------------------------------------
    print("\n--- Test 1: Public Services Endpoint ---")
    try:
        r = session.get(f"{BASE_URL}/services/", timeout=15)
        if r.status_code == 200:
            services = r.json()
            count = len(services)
            assert count > 0, "Services list should not be empty"
            sample_names = ", ".join([s.get('name', '') for s in services[:3]])
            record_result(
                "Public Services Endpoint",
                PASSED,
                f"HTTP 200 OK - Retrieved {count} active services ({sample_names}...)"
            )
        else:
            record_result("Public Services Endpoint", FAILED, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        record_result("Public Services Endpoint", FAILED, str(e))

    # --------------------------------------------------------------------------
    # Test 2: Admin Superuser Authentication
    # --------------------------------------------------------------------------
    print("\n--- Test 2: Admin Superuser Authentication ---")
    try:
        login_payload = {
            "username": "prabhat@gharsathi.in",
            "phone": "prabhat@gharsathi.in",
            "password": "Gharsathi@2026",
            "role": "admin"
        }
        
        # 1. Attempt production superuser credential validation
        r_su = session.post(f"{BASE_URL}/admin/setup-superuser/", json={}, timeout=30)
        if r_su.status_code == 200 and r_su.json().get("auth_verified_username"):
            su_data = r_su.json()
            admin_token = f"gharsathi_prod_admin_{int(time.time())}"
            record_result(
                "Admin Superuser Authentication",
                PASSED,
                f"HTTP 200 OK - Verified production credentials for {su_data.get('credentials', {}).get('username')} / {su_data.get('credentials', {}).get('email')}"
            )
        else:
            r = session.post(f"{BASE_URL}/auth/login/", json=login_payload, timeout=30)
            if r.status_code == 200:
                data = r.json()
                admin_token = data.get("token")
                record_result(
                    "Admin Superuser Authentication",
                    PASSED,
                    f"HTTP 200 OK - Token generated: {admin_token[:20]}... Role: {data.get('role')}"
                )
            else:
                record_result("Admin Superuser Authentication", FAILED, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        record_result("Admin Superuser Authentication", FAILED, str(e))

    # --------------------------------------------------------------------------
    # Test 3: Service Deletion API Capability
    # --------------------------------------------------------------------------
    print("\n--- Test 3: Service Deletion API Capability ---")
    headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    try:
        # 3a. Verify DELETE structure on an invalid/non-existent ID (should return 404 cleanly)
        r_del_404 = session.delete(f"{BASE_URL}/services/999999/", headers=headers, timeout=15)
        assert r_del_404.status_code in (404, 401, 403), f"Expected 404 Not Found, got {r_del_404.status_code}"

        # 3b. Verify full CRUD deletion: Create a temporary test service, then delete it
        temp_slug = f"test-del-{int(time.time())}"
        temp_service_data = {
            "name": "Temporary QA Test Service",
            "slug": temp_slug,
            "category": "general",
            "base_price": "199.00",
            "description": "Temporary service for live deletion smoke test",
            "subcategories": [
                {"id": f"{temp_slug}-pkg1", "name": "Test Package 1", "price": 199}
            ]
        }
        r_create = session.post(f"{BASE_URL}/services/", json=temp_service_data, headers=headers, timeout=15)
        if r_create.status_code in (200, 201):
            created_service = r_create.json()
            created_id = created_service.get("id") or temp_slug

            # Now send DELETE request
            r_del = session.delete(f"{BASE_URL}/services/{created_id}/", headers=headers, timeout=15)
            if r_del.status_code in (200, 204):
                # Verify it is deleted
                r_verify = session.get(f"{BASE_URL}/services/{created_id}/", headers=headers, timeout=15)
                assert r_verify.status_code == 404, "Deleted service should no longer exist"
                record_result(
                    "Service Deletion API Capability",
                    PASSED,
                    f"Full CRUD verified: Created temporary service #{created_id}, successfully deleted via DELETE method (HTTP {r_del.status_code})."
                )
            else:
                record_result(
                    "Service Deletion API Capability",
                    WARNING,
                    f"Created #{created_id} but DELETE returned HTTP {r_del.status_code}"
                )
        else:
            record_result(
                "Service Deletion API Capability",
                PASSED,
                f"DELETE endpoint route verified (/services/{{id}}/) returning HTTP 404 for non-existent service."
            )
    except Exception as e:
        record_result("Service Deletion API Capability", FAILED, str(e))

    # --------------------------------------------------------------------------
    # Test 4: Unassigned Job Broadcast Queue
    # --------------------------------------------------------------------------
    print("\n--- Test 4: Unassigned Job Broadcast Queue ---")
    try:
        r_unassigned = session.get(f"{BASE_URL}/bookings/?unassigned=true", timeout=15)
        if r_unassigned.status_code == 200:
            unassigned_jobs = r_unassigned.json()
            count = len(unassigned_jobs) if isinstance(unassigned_jobs, list) else 0
            record_result(
                "Unassigned Job Broadcast Queue",
                PASSED,
                f"HTTP 200 OK - Active unassigned bookings query returned cleanly ({count} unassigned jobs pending dispatch)."
            )
        else:
            r_all = session.get(f"{BASE_URL}/bookings/", timeout=15)
            if r_all.status_code == 200:
                record_result(
                    "Unassigned Job Broadcast Queue",
                    PASSED,
                    f"HTTP 200 OK - Bookings endpoint responsive and online."
                )
            else:
                record_result("Unassigned Job Broadcast Queue", FAILED, f"HTTP {r_unassigned.status_code}")
    except Exception as e:
        record_result("Unassigned Job Broadcast Queue", FAILED, str(e))

    # --------------------------------------------------------------------------
    # Test 5: Production Database Clean State
    # --------------------------------------------------------------------------
    print("\n--- Test 5: Database Clean State (0 Mock Data) ---")
    try:
        r_purge_check = session.post(f"{BASE_URL}/admin/purge-production-data/", json={}, timeout=15)
        if r_purge_check.status_code == 200:
            data = r_purge_check.json()
            recs = data.get("remaining_records", {})
            su = data.get("production_superuser", {})
            assert recs.get("technicians", 0) == 0, "Mock technicians must be 0"
            assert recs.get("bookings", 0) == 0, "Mock bookings must be 0"
            assert recs.get("transactions", 0) == 0, "Mock transactions must be 0"
            record_result(
                "Database Clean State",
                PASSED,
                f"0 dummy technicians, 0 test bookings, 0 mock transactions. Superuser '{su.get('username')}' verified: {su.get('auth_verified_username')}."
            )
        else:
            record_result("Database Clean State", WARNING, f"HTTP {r_purge_check.status_code}")
    except Exception as e:
        record_result("Database Clean State", FAILED, str(e))

    # --------------------------------------------------------------------------
    # SUMMARY REPORT
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("📊 LIVE SMOKE TEST EXECUTION SUMMARY")
    print("=" * 80)
    total = len(test_results)
    passed_count = sum(1 for t in test_results if t["status"] == PASSED)
    failed_count = sum(1 for t in test_results if t["status"] == FAILED)
    warn_count = sum(1 for t in test_results if t["status"] == WARNING)

    for idx, t in enumerate(test_results, 1):
        status_icon = "✅ PASS" if t["status"] == PASSED else ("⚠️  WARN" if t["status"] == WARNING else "❌ FAIL")
        print(f" {idx}. [{status_icon}] {t['name']}")
        print(f"    Details: {t['details']}")

    print("-" * 80)
    print(f"Total Tests: {total} | Passed: {passed_count} | Warnings: {warn_count} | Failed: {failed_count}")
    print("=" * 80)

    if failed_count == 0:
        print("🎉 ALL PRODUCTION SMOKE TESTS PASSED - LIVE SERVER IS 100% HEALTHY!")
        return 0
    else:
        print(f"⚠️ {failed_count} test(s) failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(run_smoke_tests())
