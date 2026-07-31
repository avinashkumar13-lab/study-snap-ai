#!/usr/bin/env python3
"""
Backend API Tests for Study Snap AI
Tests all backend endpoints with proper validation
"""

import requests
import json
import re
from typing import Dict, Any

# Base URL from .env
BASE_URL = "https://quick-revision-ai-2.preview.emergentagent.com/api"

# Test results tracking
test_results = []
generated_note_id = None

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if details:
        result += f"\n    Details: {details}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "details": details})

def is_valid_uuid(uuid_string: str) -> bool:
    """Check if string is valid UUID v4"""
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.I)
    return bool(uuid_pattern.match(uuid_string))

def test_root_endpoint():
    """Test 1: GET /api/root"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/root - Health check endpoint")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/root", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/root - Status Code", False, f"Expected 200, got {response.status_code}")
            return False
        
        log_test("GET /api/root - Status Code", True, "200 OK")
        
        data = response.json()
        
        # Check for required fields
        if "message" not in data:
            log_test("GET /api/root - Response has 'message'", False, "Missing 'message' field")
            return False
        log_test("GET /api/root - Response has 'message'", True, f"message: {data['message']}")
        
        if "model" not in data:
            log_test("GET /api/root - Response has 'model'", False, "Missing 'model' field")
            return False
        
        # Check if model contains "claude-sonnet-4-5"
        if "claude-sonnet-4-5" not in data["model"]:
            log_test("GET /api/root - Model contains 'claude-sonnet-4-5'", False, f"Model is: {data['model']}")
            return False
        
        log_test("GET /api/root - Model contains 'claude-sonnet-4-5'", True, f"model: {data['model']}")
        
        return True
        
    except Exception as e:
        log_test("GET /api/root", False, f"Exception: {str(e)}")
        return False

def test_generate_valid():
    """Test 2: POST /api/generate with valid payload"""
    global generated_note_id
    
    print("\n" + "="*80)
    print("TEST 2: POST /api/generate - Valid payload (B.Tech CS Data Structures)")
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
    print("⏳ Calling LLM... This may take 30-90 seconds...")
    
    try:
        # CRITICAL: Use 150s timeout for LLM calls
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=150)
        
        if response.status_code != 200:
            log_test("POST /api/generate - Status Code", False, f"Expected 200, got {response.status_code}. Response: {response.text[:500]}")
            return False
        
        log_test("POST /api/generate - Status Code", True, "200 OK")
        
        data = response.json()
        
        # Check for id field (UUID v4)
        if "id" not in data:
            log_test("POST /api/generate - Has 'id' field", False, "Missing 'id' field")
            return False
        
        if not isinstance(data["id"], str) or not is_valid_uuid(data["id"]):
            log_test("POST /api/generate - ID is valid UUID v4", False, f"ID is not valid UUID v4: {data['id']}")
            return False
        
        generated_note_id = data["id"]
        log_test("POST /api/generate - ID is valid UUID v4", True, f"id: {generated_note_id}")
        
        # Check metadata fields
        required_meta_fields = ["degree", "program", "course", "subject", "topic", "mode", "model", "createdAt"]
        for field in required_meta_fields:
            if field not in data:
                log_test(f"POST /api/generate - Has '{field}' field", False, f"Missing '{field}' field")
                return False
        log_test("POST /api/generate - All metadata fields present", True, "degree, program, course, subject, topic, mode, model, createdAt")
        
        # Check content object exists
        if "content" not in data:
            log_test("POST /api/generate - Has 'content' object", False, "Missing 'content' object")
            return False
        
        content = data["content"]
        if not isinstance(content, dict):
            log_test("POST /api/generate - 'content' is object", False, f"content is not an object: {type(content)}")
            return False
        
        log_test("POST /api/generate - Has 'content' object", True)
        
        # Check all required content fields
        required_content_fields = {
            "title": str,
            "overview": str,
            "short_notes": str,
            "detailed_notes": str,
            "key_concepts": list,
            "important_definitions": list,
            "formula_sheet": list,
            "quick_revision": str,
            "exam_summary": str,
            "faqs": list,
            "mcqs": list,
            "mnemonics": list,
            "likely_exam_questions": list
        }
        
        missing_fields = []
        for field, expected_type in required_content_fields.items():
            if field not in content:
                missing_fields.append(field)
            elif not isinstance(content[field], expected_type):
                log_test(f"POST /api/generate - content.{field} type", False, f"Expected {expected_type.__name__}, got {type(content[field]).__name__}")
                return False
        
        if missing_fields:
            log_test("POST /api/generate - All content fields present", False, f"Missing fields: {', '.join(missing_fields)}")
            return False
        
        log_test("POST /api/generate - All content fields present", True, "All 13 required fields exist")
        
        # Validate non-empty arrays
        array_fields_must_be_nonempty = ["key_concepts", "important_definitions", "faqs", "mcqs", "likely_exam_questions"]
        for field in array_fields_must_be_nonempty:
            if len(content[field]) == 0:
                log_test(f"POST /api/generate - content.{field} non-empty", False, f"{field} is empty array")
                return False
        
        log_test("POST /api/generate - Required arrays non-empty", True, "key_concepts, important_definitions, faqs, mcqs, likely_exam_questions all have items")
        
        # Validate key_concepts structure
        if len(content["key_concepts"]) > 0:
            kc = content["key_concepts"][0]
            if not isinstance(kc, dict) or "concept" not in kc or "explanation" not in kc:
                log_test("POST /api/generate - key_concepts structure", False, f"Invalid structure: {kc}")
                return False
        log_test("POST /api/generate - key_concepts structure valid", True, f"{len(content['key_concepts'])} concepts with concept+explanation")
        
        # Validate mcqs structure
        if len(content["mcqs"]) > 0:
            mcq = content["mcqs"][0]
            required_mcq_fields = ["question", "options", "answer", "explanation"]
            for f in required_mcq_fields:
                if f not in mcq:
                    log_test("POST /api/generate - mcqs structure", False, f"MCQ missing field: {f}")
                    return False
            if not isinstance(mcq["options"], list) or len(mcq["options"]) < 2:
                log_test("POST /api/generate - mcqs options", False, "MCQ options must be array with at least 2 items")
                return False
        log_test("POST /api/generate - mcqs structure valid", True, f"{len(content['mcqs'])} MCQs with question, options, answer, explanation")
        
        # Validate faqs structure
        if len(content["faqs"]) > 0:
            faq = content["faqs"][0]
            if not isinstance(faq, dict) or "question" not in faq or "answer" not in faq:
                log_test("POST /api/generate - faqs structure", False, f"Invalid FAQ structure: {faq}")
                return False
        log_test("POST /api/generate - faqs structure valid", True, f"{len(content['faqs'])} FAQs with question+answer")
        
        # Formula sheet can be empty for non-formula topics, but should be array
        log_test("POST /api/generate - formula_sheet is array", True, f"{len(content['formula_sheet'])} formulas (can be empty for non-formula topics)")
        
        print(f"\n✅ Note generated successfully with ID: {generated_note_id}")
        return True
        
    except requests.Timeout:
        log_test("POST /api/generate", False, "Request timed out after 150 seconds")
        return False
    except Exception as e:
        log_test("POST /api/generate", False, f"Exception: {str(e)}")
        return False

def test_generate_invalid():
    """Test 3: POST /api/generate with missing required fields"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/generate - Invalid payload (missing required fields)")
    print("="*80)
    
    payload = {"topic": "only"}
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=30)
        
        if response.status_code != 400:
            log_test("POST /api/generate (invalid) - Status Code", False, f"Expected 400, got {response.status_code}")
            return False
        
        log_test("POST /api/generate (invalid) - Status Code", True, "400 Bad Request")
        
        data = response.json()
        if "error" not in data:
            log_test("POST /api/generate (invalid) - Has error message", False, "Missing 'error' field in response")
            return False
        
        log_test("POST /api/generate (invalid) - Has error message", True, f"error: {data['error']}")
        return True
        
    except Exception as e:
        log_test("POST /api/generate (invalid)", False, f"Exception: {str(e)}")
        return False

def test_list_notes():
    """Test 4: GET /api/notes - List recent notes"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/notes - List recent notes")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/notes", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/notes - Status Code", False, f"Expected 200, got {response.status_code}")
            return False
        
        log_test("GET /api/notes - Status Code", True, "200 OK")
        
        data = response.json()
        
        if not isinstance(data, list):
            log_test("GET /api/notes - Response is array", False, f"Expected array, got {type(data)}")
            return False
        
        log_test("GET /api/notes - Response is array", True, f"Array with {len(data)} notes")
        
        # Check if our generated note is in the list
        if generated_note_id:
            found = False
            note_with_content = None
            for note in data:
                if note.get("id") == generated_note_id:
                    found = True
                    # Check that content field is NOT included (projection excludes it)
                    if "content" in note:
                        note_with_content = note
                    break
            
            if not found:
                log_test("GET /api/notes - Contains generated note", False, f"Note with id {generated_note_id} not found in list")
                return False
            
            log_test("GET /api/notes - Contains generated note", True, f"Found note with id {generated_note_id}")
            
            if note_with_content:
                log_test("GET /api/notes - Excludes 'content' field", False, "content field should be excluded but is present")
                return False
            
            log_test("GET /api/notes - Excludes 'content' field", True, "content field properly excluded from list")
        
        return True
        
    except Exception as e:
        log_test("GET /api/notes", False, f"Exception: {str(e)}")
        return False

def test_get_single_note():
    """Test 5: GET /api/notes/{id} - Get single note by ID"""
    print("\n" + "="*80)
    print(f"TEST 5: GET /api/notes/{generated_note_id} - Get single note")
    print("="*80)
    
    if not generated_note_id:
        log_test("GET /api/notes/{id}", False, "No generated note ID available from previous test")
        return False
    
    try:
        response = requests.get(f"{BASE_URL}/notes/{generated_note_id}", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/notes/{id} - Status Code", False, f"Expected 200, got {response.status_code}")
            return False
        
        log_test("GET /api/notes/{id} - Status Code", True, "200 OK")
        
        data = response.json()
        
        # Check that content field IS included
        if "content" not in data:
            log_test("GET /api/notes/{id} - Includes 'content' field", False, "content field missing")
            return False
        
        log_test("GET /api/notes/{id} - Includes 'content' field", True, "Full note with content returned")
        
        # Verify it's the correct note
        if data.get("id") != generated_note_id:
            log_test("GET /api/notes/{id} - Correct note ID", False, f"Expected {generated_note_id}, got {data.get('id')}")
            return False
        
        log_test("GET /api/notes/{id} - Correct note ID", True, f"id: {generated_note_id}")
        
        return True
        
    except Exception as e:
        log_test("GET /api/notes/{id}", False, f"Exception: {str(e)}")
        return False

def test_delete_note():
    """Test 6: DELETE /api/notes/{id} - Delete note"""
    print("\n" + "="*80)
    print(f"TEST 6: DELETE /api/notes/{generated_note_id} - Delete note")
    print("="*80)
    
    if not generated_note_id:
        log_test("DELETE /api/notes/{id}", False, "No generated note ID available from previous test")
        return False
    
    try:
        # Delete the note
        response = requests.delete(f"{BASE_URL}/notes/{generated_note_id}", timeout=10)
        
        if response.status_code != 200:
            log_test("DELETE /api/notes/{id} - Status Code", False, f"Expected 200, got {response.status_code}")
            return False
        
        log_test("DELETE /api/notes/{id} - Status Code", True, "200 OK")
        
        data = response.json()
        if not data.get("ok"):
            log_test("DELETE /api/notes/{id} - Response {ok:true}", False, f"Expected {{ok:true}}, got {data}")
            return False
        
        log_test("DELETE /api/notes/{id} - Response {ok:true}", True, "Note deleted successfully")
        
        # Verify note is gone - GET should return 404
        print(f"\nVerifying deletion: GET /api/notes/{generated_note_id}")
        get_response = requests.get(f"{BASE_URL}/notes/{generated_note_id}", timeout=10)
        
        if get_response.status_code != 404:
            log_test("DELETE /api/notes/{id} - Verify deletion (404)", False, f"Expected 404 after deletion, got {get_response.status_code}")
            return False
        
        log_test("DELETE /api/notes/{id} - Verify deletion (404)", True, "GET after DELETE returns 404")
        
        return True
        
    except Exception as e:
        log_test("DELETE /api/notes/{id}", False, f"Exception: {str(e)}")
        return False

def test_exam_tomorrow_mode():
    """Test 7: POST /api/generate with exam_tomorrow mode"""
    print("\n" + "="*80)
    print("TEST 7: POST /api/generate - exam_tomorrow mode")
    print("="*80)
    
    payload = {
        "degree": "Class 10 (NCERT/CBSE)",
        "subject": "Mathematics",
        "topic": "Pythagoras theorem",
        "mode": "exam_tomorrow",
        "length": "short"
    }
    
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("⏳ Calling LLM... This may take 30-90 seconds...")
    
    try:
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=150)
        
        if response.status_code != 200:
            log_test("POST /api/generate (exam_tomorrow) - Status Code", False, f"Expected 200, got {response.status_code}. Response: {response.text[:500]}")
            return False
        
        log_test("POST /api/generate (exam_tomorrow) - Status Code", True, "200 OK")
        
        data = response.json()
        
        # Check mode field
        if data.get("mode") != "exam_tomorrow":
            log_test("POST /api/generate (exam_tomorrow) - Mode field", False, f"Expected mode='exam_tomorrow', got '{data.get('mode')}'")
            return False
        
        log_test("POST /api/generate (exam_tomorrow) - Mode field", True, "mode: exam_tomorrow")
        
        # Check that note was generated with content
        if "content" not in data or not isinstance(data["content"], dict):
            log_test("POST /api/generate (exam_tomorrow) - Has content", False, "Missing or invalid content object")
            return False
        
        log_test("POST /api/generate (exam_tomorrow) - Has content", True, f"Note generated with id: {data.get('id')}")
        
        # Clean up - delete this test note
        if data.get("id"):
            requests.delete(f"{BASE_URL}/notes/{data['id']}", timeout=10)
            print(f"✓ Cleaned up test note: {data['id']}")
        
        return True
        
    except requests.Timeout:
        log_test("POST /api/generate (exam_tomorrow)", False, "Request timed out after 150 seconds")
        return False
    except Exception as e:
        log_test("POST /api/generate (exam_tomorrow)", False, f"Exception: {str(e)}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    
    if failed > 0:
        print("\nFailed Tests:")
        for result in test_results:
            if not result["passed"]:
                print(f"  ❌ {result['test']}")
                if result["details"]:
                    print(f"     {result['details']}")
    
    print("\n" + "="*80)
    
    return failed == 0

def main():
    """Run all tests"""
    print("="*80)
    print("STUDY SNAP AI - BACKEND API TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Run tests in order
    test_root_endpoint()
    test_generate_valid()
    test_generate_invalid()
    test_list_notes()
    test_get_single_note()
    test_delete_note()
    test_exam_tomorrow_mode()
    
    # Print summary
    all_passed = print_summary()
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED! 🎉\n")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED ⚠️\n")
        return 1

if __name__ == "__main__":
    exit(main())
