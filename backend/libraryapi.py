
# libraryapi.py
import os
import sys
import uuid
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ------------------- Path Setup -------------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

BASE_DIR = os.path.join(CURRENT_DIR, "library_data")
os.makedirs(BASE_DIR, exist_ok=True)

sys.path.append(CURRENT_DIR)
FRONTEND_DIR = os.path.join(CURRENT_DIR, "frontend", "static")

from libraryv1 import ConsoleApp, Admin, Student, ConsoleAdminInterface, ConsoleStudentInterface

# ------------------- Flask App -------------------
app = Flask(__name__)
CORS(app)

# ------------------- Engine Bootstrap -------------------
console = ConsoleApp(base_dir=BASE_DIR)
db = console.db
log = console.log

# ------------------- Session Management -------------------
SESSION_FILE = os.path.join(BASE_DIR, "sessions.json")
SESSION_TIMEOUT = 60 * 60 * 24  # 24 hours

def save_sessions(sessions_dict):
    with open(SESSION_FILE, "w") as f:
        json.dump(sessions_dict, f)

def load_sessions():
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r") as f:
                data = json.load(f)
        except Exception:
            data = {}
    else:
        data = {}

    # Clean expired sessions and refresh active ones
    now = time.time()
    cleaned = {}
    for token, sess in data.items():
        if now - sess["created"] < SESSION_TIMEOUT:
            sess["created"] = now  # refresh timestamp
            cleaned[token] = sess
    save_sessions(cleaned)
    return cleaned

sessions = load_sessions()

def generate_token(role, user_id=None):
    token = str(uuid.uuid4())
    sessions[token] = {
        "role": role,
        "user_id": user_id,
        "created": time.time()
    }
    save_sessions(sessions)
    return token

def require_session():
    """Return interface and session or error response"""
    token = request.headers.get("Authorization")
    if not token:
        return None, None, jsonify({"success": False, "message": "Authorization token required"}), 401

    session = sessions.get(token)
    if not session:
        return None, None, jsonify({"success": False, "message": "Invalid or expired session"}), 401

    role = session.get("role")
    try:
        if role == "admin":
            admin = Admin(db, log)
            iface = ConsoleAdminInterface(db, log, admin)
        else:
            student = Student(db, log, session.get("user_id"))
            iface = ConsoleStudentInterface(db, log, student)
    except Exception as e:
        return None, None, jsonify({"success": False, "message": "Session restore failed", "error": str(e)}), 500

    # Refresh timestamp
    session["created"] = time.time()
    save_sessions(sessions)

    return iface, session, None, None

# ------------------- Static Files -------------------
@app.route('/')
def serve_home():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

# ------------------- Helper -------------------
def json_error(message, status=400, error=None):
    payload = {"success": False, "message": message}
    if error:
        payload["error"] = str(error)
    return jsonify(payload), status

# ------------------- ADMIN LOGIN -------------------
@app.route("/admin/login", methods=["POST"])
def admin_login():
    try:
        data = request.get_json(force=True)
        password = data.get("password")
        if not password:
            return json_error("Password required", 400)

        result = console._admin_login(password=password)
        if result.get("success"):
            token = generate_token(role="admin")
            return jsonify({"success": True, "message": result.get("message"), "token": token}), 200

        return jsonify(result), 401
    except Exception as e:
        return json_error("Server error during admin login", 500, e)

@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    iface, session, err, status = require_session()
    if err:
        return err, status
    token = request.headers.get("Authorization")
    sessions.pop(token, None)
    save_sessions(sessions)
    return jsonify({"success": True, "message": "Admin logged out."}), 200

# ------------------- ADMIN ENDPOINTS -------------------

@app.route("/admin/students", methods=["GET"])
def admin_view_students():
    iface, session, err, status = require_session()
    if err:
        return err, status
    return jsonify(iface._view_students()), 200


@app.route("/admin/students/delete", methods=["POST"])
def admin_delete_student():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    user_id = data.get("user_id")
    confirm = data.get("confirm", False)
    if not user_id:
        return json_error("user_id is required", 400)

    result = iface._delete_student(user_id=user_id, confirm=confirm)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/admin/pending-approvals", methods=["GET"])
def admin_pending_requests():
    iface, session, err, status = require_session()
    if err:
        return err, status
    return jsonify(iface._display_pending_requests()), 200


@app.route("/admin/pending-approvals/process", methods=["POST"])
def admin_process_pending():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    choice = data.get("choice")
    user_id = data.get("user_id")
    if choice is None or not user_id:
        return json_error("Both 'choice' and 'user_id' are required", 400)

    result = iface._process_pending_requests(choice=choice, user_id=user_id)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/admin/books", methods=["GET"])
def admin_view_books():
    iface, session, err, status = require_session()
    if err:
        return err, status
    return jsonify(iface._view_books()), 200


@app.route("/admin/books/add", methods=["POST"])
def admin_add_book():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    name = data.get("name")
    try:
        qty = int(data.get("qty", 0))
    except ValueError:
        return json_error("Quantity must be an integer", 400)

    if not name:
        return json_error("Book name is required", 400)

    result = iface._add_new_book(name=name, qty=qty)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/admin/books/modify", methods=["POST"])
def admin_modify_book():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    book_id = data.get("book_id")
    delta_type = data.get("type")
    try:
        qty = int(data.get("qty", 0))
    except ValueError:
        return json_error("Quantity must be an integer", 400)

    if not book_id or not delta_type:
        return json_error("'book_id' and 'type' are required", 400)

    result = iface._modify_book_stock(delta_type=delta_type, book_id=book_id, qty=qty)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/admin/books/delete", methods=["POST"])
def admin_delete_book():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    book_id = data.get("book_id")
    confirm = data.get("confirm", False)
    if not book_id:
        return json_error("book_id is required", 400)

    result = iface._delete_book(book_id=book_id, confirm=confirm)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/admin/logs", methods=["GET"])
def admin_logs():
    iface, session, err, status = require_session()
    if err:
        return err, status
    return jsonify(iface._show_log()), 200


@app.route("/admin/reading-history", methods=["POST"])
def admin_reading_history():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    user_id = data.get("user_id")
    if not user_id:
        return json_error("user_id is required", 400)

    return jsonify(iface._view_reading_history(user_id=user_id)), 200

@app.route("/admin/change-password", methods=["POST"])
def admin_change_password():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    old = data.get("old_password", "").strip()
    new = data.get("new_password", "").strip()
    confirm = data.get("confirm_password", "").strip()

    if not all([old, new, confirm]):
        return json_error("All password fields are required", 400)

    result = iface._change_password(old, new, confirm)

    if result.get("success"):
        token = request.headers.get("Authorization")
        if token in sessions:
            sessions.pop(token, None)
            save_sessions(sessions)

        return jsonify({
            "success": True,
            "message": "Password changed successfully. Please log in again."
        }), 200

    return jsonify(result), 400


@app.route("/admin/clear-data", methods=["POST"])
def admin_clear_data():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    option = data.get("option")
    admin_password = data.get("admin_password")
    if option is None or not admin_password:
        return json_error("Both 'option' and 'admin_password' are required", 400)

    result = iface._clear_data(option, admin_password)
    return jsonify(result), 200 if result.get("success") else 400

#------------SYSTEM DATE SETTINGS---------------

@app.route("/system/date", methods=["GET"])
def get_system_date():
    result = console._get_system_date()
    return jsonify(result), 200 if result.get("success") else 500

@app.route("/system/set-date", methods=["POST"])
def set_system_date():
    data = request.get_json(force=True)
    new_date_str = data.get("new_date")
    source = data.get("source", "MANUAL")

    if not new_date_str:
        return json_error("new_date field is required (DD-MM-YYYY)", 400)

    result = console._set_system_date(1, new_date_str, source=source)
    return jsonify(result), 200 if result.get("success") else 400

@app.route("/system/reset-date", methods=["POST"])
def reset_system_date():
    data = request.get_json(force=True)
    source = data.get("source", "AUTO")
    result = console._set_system_date(2, source=source)
    return jsonify(result), 200 if result.get("success") else 500

# ------------------- STUDENT LOGIN -------------------
@app.route("/student/login", methods=["POST"])
def student_login():
    try:
        data = request.get_json(force=True)
        user_id = data.get("user_id")
        if not user_id:
            return json_error("user_id is required", 400)

        result = console._student_signin(user_id=user_id)
        if result.get("success"):
            token = generate_token(role="student", user_id=user_id)
            return jsonify({"success": True, "message": result.get("message"), "token": token}), 200

        return jsonify(result), 401
    except Exception as e:
        return json_error("Server error during login", 500, e)

@app.route("/student/logout", methods=["POST"])
def student_logout():
    iface, session, err, status = require_session()
    if err:
        return err, status
    token = request.headers.get("Authorization")
    sessions.pop(token, None)
    save_sessions(sessions)
    return jsonify({"success": True, "message": "Student logged out."}), 200

# ------------------- STUDENT ENDPOINTS -------------------

@app.route("/student/signup", methods=["POST"])
def student_signup():
    try:
        data = request.get_json(force=True)
        name = data.get("name")
        year = data.get("year")
        roll = data.get("roll")
        if not all([name, year, roll]):
            return json_error("All signup fields required", 400)
        result = console._student_signup(name=name, year=year, roll_no=roll)
        return jsonify(result), 201 if result.get("success") else 400
    except Exception as e:
        return json_error("Server error during signup", 500, e)


@app.route("/student/available-books", methods=["GET"])
def student_available_books():
    iface, session, err, status = require_session()
    if err:
        return err, status
    return jsonify(iface._display_available_books()), 200


@app.route("/student/borrow-book", methods=["POST"])
def student_borrow_book():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    book_id = data.get("book_id")
    if not book_id:
        return json_error("book_id is required", 400)

    result = iface._borrow_book(book_id)
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/student/borrowed-books", methods=["GET"])
def student_borrowed_books():
    iface, session, err, status = require_session()
    if err:
        return err, status

    return jsonify(iface._display_borrowed_books()), 200


@app.route("/student/return-book", methods=["POST"])
def student_return_book():
    iface, session, err, status = require_session()
    if err:
        return err, status

    data = request.get_json(force=True)
    transaction_id = data.get("transaction_id")
    if not transaction_id:
        return json_error("transaction_id is required", 400)

    result = iface._return_book(
        transaction_id=transaction_id,
        confirm_fine=data.get("confirm_fine", False),
        payment_payload=data.get("payment_payload")
    )
    return jsonify(result), 200 if result.get("success") else 400


@app.route("/student/reading-history", methods=["GET"])
def student_reading_history():
    iface, session, err, status = require_session()
    if err:
        return err, status

    return jsonify(iface._view_my_reading_history()), 200

# ------------------- RUN APP -------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
