#!/usr/bin/env python3
"""
Backend API Test Suite for Study Snap AI
Tests the async job pattern for POST /api/generate
"""
import requests
import time
import json
from typing import Dict, Any

# Base URL from .env: NEXT_PUBLIC_BASE_URL
BASE_URL = "https://quick-revision-ai-2.preview.emergentagent.com/api"

def test_root_endpoint():
    """Test 1: GET /api/root health check"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/root - Health Check")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/root", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print("❌ FAILED: Expected status 200")
            return False
        
        data = response.json()
        
        # Check for required fields
        if 'message' not in data:
            print("❌ FAILED: Missing 'message' field")
            return False
        
        if 'model' not in data:
            print("❌ FAILED: Missing 'model' field")
            return False
        
        if 'claude-sonnet-4-5' not in data['model']:
            print(f"❌ FAILED: Model should contain 'claude-sonnet-4-5', got: {data['model']}")
            return False
        
        print(f"✅ PASSED: Health check working")
        print(f"   Message: {data['message']}")
        print(f"   Model: {data['model']}")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return False


def test_generate_async_valid():
    """Test 2: POST /api/generate with valid data (async pattern)"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/generate - Valid Data (Async Pattern)")
    print("="*80)
    
    payload = {
        "degree": "B.Tech",
        "program": "Computer Science",
        "course": "2nd Year",
        "subject": "Data Structures",
        "topic": "Binary Search Trees basics",
        "length": "medium",
        "mode": "standard"
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        # Step 1: POST /api/generate should return 202 immediately
        print("\nStep 1: Sending POST request...")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=15)
        response_time = time.time() - start_time
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f}s")
        print(f"Response: {response.text}")
        
        if response.status_code != 202:
            print(f"❌ FAILED: Expected status 202, got {response.status_code}")
            return False, None
        
        data = response.json()
        
        if 'id' not in data:
            print("❌ FAILED: Missing 'id' field in response")
            return False, None
        
        if 'status' not in data:
            print("❌ FAILED: Missing 'status' field in response")
            return False, None
        
        if data['status'] != 'pending':
            print(f"❌ FAILED: Expected status 'pending', got '{data['status']}'")
            return False, None
        
        note_id = data['id']
        print(f"✅ Step 1 PASSED: Got 202 response with id={note_id}, status=pending")
        print(f"   Response time: {response_time:.2f}s (should be < 5s)")
        
        # Step 2: Poll GET /api/notes/{id} until status becomes 'done'
        print(f"\nStep 2: Polling GET /api/notes/{note_id} until status='done'...")
        max_wait_time = 180  # 3 minutes
        poll_interval = 2  # 2 seconds
        elapsed = 0
        
        while elapsed < max_wait_time:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            poll_response = requests.get(f"{BASE_URL}/notes/{note_id}", timeout=15)
            print(f"  [{elapsed}s] Status Code: {poll_response.status_code}", end="")
            
            if poll_response.status_code != 200:
                print(f" - ❌ Unexpected status code")
                continue
            
            poll_data = poll_response.json()
            current_status = poll_data.get('status', 'unknown')
            print(f" - Status: {current_status}")
            
            if current_status == 'done':
                print(f"✅ Step 2 PASSED: Note generation completed in {elapsed}s")
                
                # Step 3: Validate the content structure
                print("\nStep 3: Validating content structure...")
                if 'content' not in poll_data or poll_data['content'] is None:
                    print("❌ FAILED: Missing or null 'content' field")
                    return False, note_id
                
                content = poll_data['content']
                required_fields = [
                    'title', 'overview', 'short_notes', 'detailed_notes',
                    'key_concepts', 'important_definitions', 'formula_sheet',
                    'quick_revision', 'exam_summary', 'faqs', 'mcqs',
                    'mnemonics', 'likely_exam_questions'
                ]
                
                missing_fields = []
                for field in required_fields:
                    if field not in content:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"❌ FAILED: Missing content fields: {missing_fields}")
                    return False, note_id
                
                # Validate array fields are non-empty
                array_fields = {
                    'key_concepts': content.get('key_concepts', []),
                    'important_definitions': content.get('important_definitions', []),
                    'faqs': content.get('faqs', []),
                    'mcqs': content.get('mcqs', []),
                    'mnemonics': content.get('mnemonics', []),
                    'likely_exam_questions': content.get('likely_exam_questions', [])
                }
                
                empty_arrays = []
                for field_name, field_value in array_fields.items():
                    if not isinstance(field_value, list) or len(field_value) == 0:
                        empty_arrays.append(field_name)
                
                if empty_arrays:
                    print(f"❌ FAILED: Empty or invalid array fields: {empty_arrays}")
                    return False, note_id
                
                # Validate formula_sheet (should be non-empty for BST topic)
                if not isinstance(content.get('formula_sheet'), list):
                    print("❌ FAILED: formula_sheet should be an array")
                    return False, note_id
                
                # Validate ID is UUID format (not ObjectId)
                if '_id' in poll_data:
                    print("❌ FAILED: Response contains MongoDB '_id' field (should be excluded)")
                    return False, note_id
                
                print("✅ Step 3 PASSED: All content fields present and valid")
                print(f"   - title: {content['title'][:50]}...")
                print(f"   - key_concepts: {len(content['key_concepts'])} items")
                print(f"   - important_definitions: {len(content['important_definitions'])} items")
                print(f"   - formula_sheet: {len(content['formula_sheet'])} items")
                print(f"   - faqs: {len(content['faqs'])} items")
                print(f"   - mcqs: {len(content['mcqs'])} items")
                print(f"   - mnemonics: {len(content['mnemonics'])} items")
                print(f"   - likely_exam_questions: {len(content['likely_exam_questions'])} items")
                
                return True, note_id
            
            elif current_status == 'failed':
                error_msg = poll_data.get('error', 'Unknown error')
                print(f"❌ FAILED: Note generation failed with error: {error_msg}")
                return False, note_id
        
        print(f"❌ FAILED: Timeout after {max_wait_time}s - note still not done")
        return False, note_id
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None


def test_generate_invalid_data():
    """Test 3: POST /api/generate with invalid data (missing required fields)"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/generate - Invalid Data (Missing Required Fields)")
    print("="*80)
    
    payload = {"topic": "only"}
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected status 400, got {response.status_code}")
            return False
        
        data = response.json()
        if 'error' not in data:
            print("❌ FAILED: Expected 'error' field in response")
            return False
        
        print(f"✅ PASSED: Validation working correctly")
        print(f"   Error message: {data['error']}")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return False


def test_list_notes(expected_note_id=None):
    """Test 4: GET /api/notes - List recent notes"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/notes - List Recent Notes")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/notes", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not isinstance(data, list):
            print(f"❌ FAILED: Expected array response, got {type(data)}")
            return False
        
        print(f"✅ PASSED: Got array with {len(data)} notes")
        
        # Check that content field is excluded
        for note in data:
            if 'content' in note:
                print(f"❌ FAILED: Note {note.get('id')} contains 'content' field (should be excluded)")
                return False
            if '_id' in note:
                print(f"❌ FAILED: Note {note.get('id')} contains '_id' field (should be excluded)")
                return False
        
        print("✅ PASSED: All notes correctly exclude 'content' and '_id' fields")
        
        # Check if expected note is in the list
        if expected_note_id:
            note_ids = [n.get('id') for n in data]
            if expected_note_id in note_ids:
                print(f"✅ PASSED: Expected note {expected_note_id} found in list")
            else:
                print(f"❌ FAILED: Expected note {expected_note_id} NOT found in list")
                return False
        
        # Verify no pending notes are returned
        for note in data:
            if note.get('status') == 'pending':
                print(f"❌ FAILED: Pending note {note.get('id')} should not be in list")
                return False
        
        print("✅ PASSED: No pending notes in list (as expected)")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return False


def test_delete_note(note_id):
    """Test 5: DELETE /api/notes/{id} and verify 404 afterwards"""
    print("\n" + "="*80)
    print(f"TEST 5: DELETE /api/notes/{note_id}")
    print("="*80)
    
    try:
        # Step 1: Delete the note
        print(f"Step 1: Deleting note {note_id}...")
        response = requests.delete(f"{BASE_URL}/notes/{note_id}", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('ok') != True:
            print(f"❌ FAILED: Expected {{ok: true}}, got {data}")
            return False
        
        print("✅ Step 1 PASSED: Note deleted successfully")
        
        # Step 2: Verify note is gone (404)
        print(f"\nStep 2: Verifying note {note_id} returns 404...")
        response = requests.get(f"{BASE_URL}/notes/{note_id}", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 404:
            print(f"❌ FAILED: Expected status 404, got {response.status_code}")
            return False
        
        print("✅ Step 2 PASSED: Note correctly returns 404 after deletion")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return False


def test_exam_tomorrow_mode():
    """Test 6: POST /api/generate with exam_tomorrow mode"""
    print("\n" + "="*80)
    print("TEST 6: POST /api/generate - Exam Tomorrow Mode")
    print("="*80)
    
    payload = {
        "degree": "Class 10 (NCERT/CBSE)",
        "subject": "Mathematics",
        "topic": "Pythagoras theorem",
        "mode": "exam_tomorrow",
        "length": "short"
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        # Step 1: POST /api/generate
        print("\nStep 1: Sending POST request...")
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=15)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 202:
            print(f"❌ FAILED: Expected status 202, got {response.status_code}")
            return False, None
        
        data = response.json()
        note_id = data.get('id')
        
        if not note_id or data.get('status') != 'pending':
            print("❌ FAILED: Invalid response structure")
            return False, None
        
        print(f"✅ Step 1 PASSED: Got 202 response with id={note_id}")
        
        # Step 2: Poll until done
        print(f"\nStep 2: Polling until status='done'...")
        max_wait_time = 180
        poll_interval = 2
        elapsed = 0
        
        while elapsed < max_wait_time:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            poll_response = requests.get(f"{BASE_URL}/notes/{note_id}", timeout=15)
            print(f"  [{elapsed}s] Status Code: {poll_response.status_code}", end="")
            
            if poll_response.status_code != 200:
                print(f" - ❌ Unexpected status code")
                continue
            
            poll_data = poll_response.json()
            current_status = poll_data.get('status', 'unknown')
            print(f" - Status: {current_status}")
            
            if current_status == 'done':
                print(f"✅ Step 2 PASSED: Note generation completed in {elapsed}s")
                
                # Step 3: Validate mode and content
                print("\nStep 3: Validating exam_tomorrow mode...")
                
                if poll_data.get('mode') != 'exam_tomorrow':
                    print(f"❌ FAILED: Expected mode='exam_tomorrow', got '{poll_data.get('mode')}'")
                    return False, note_id
                
                if 'content' not in poll_data or poll_data['content'] is None:
                    print("❌ FAILED: Missing or null 'content' field")
                    return False, note_id
                
                print("✅ Step 3 PASSED: Mode is 'exam_tomorrow' and content is present")
                print(f"   - mode: {poll_data['mode']}")
                print(f"   - topic: {poll_data['topic']}")
                print(f"   - content.title: {poll_data['content'].get('title', 'N/A')}")
                
                return True, note_id
            
            elif current_status == 'failed':
                error_msg = poll_data.get('error', 'Unknown error')
                print(f"❌ FAILED: Note generation failed with error: {error_msg}")
                return False, note_id
        
        print(f"❌ FAILED: Timeout after {max_wait_time}s")
        return False, note_id
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None


def main():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("STUDY SNAP AI - BACKEND API TEST SUITE")
    print("Testing against PUBLIC URL (Cloudflare-fronted)")
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    note_id_for_cleanup = None
    exam_note_id = None
    
    # Test 1: Health check
    results['test_root'] = test_root_endpoint()
    
    # Test 2: Generate with valid data (async)
    results['test_generate_valid'], note_id_for_cleanup = test_generate_async_valid()
    
    # Test 3: Generate with invalid data
    results['test_generate_invalid'] = test_generate_invalid_data()
    
    # Test 4: List notes
    if note_id_for_cleanup:
        results['test_list_notes'] = test_list_notes(expected_note_id=note_id_for_cleanup)
    else:
        results['test_list_notes'] = test_list_notes()
    
    # Test 5: Delete note
    if note_id_for_cleanup:
        results['test_delete'] = test_delete_note(note_id_for_cleanup)
    else:
        print("\n⚠️ SKIPPING TEST 5: No note ID available for deletion test")
        results['test_delete'] = None
    
    # Test 6: Exam tomorrow mode
    results['test_exam_tomorrow'], exam_note_id = test_exam_tomorrow_mode()
    
    # Cleanup exam note if created
    if exam_note_id:
        print(f"\n🧹 Cleaning up exam_tomorrow note {exam_note_id}...")
        requests.delete(f"{BASE_URL}/notes/{exam_note_id}", timeout=10)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result is True else "❌ FAILED" if result is False else "⚠️ SKIPPED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {total} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    
    if failed == 0 and skipped == 0:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    elif failed == 0:
        print(f"\n⚠️ ALL RUNNABLE TESTS PASSED ({skipped} skipped)")
        return 0
    else:
        print(f"\n❌ {failed} TEST(S) FAILED")
        return 1


if __name__ == "__main__":
    exit(main())
