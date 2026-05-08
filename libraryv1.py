
#libraryv1.py
import sqlite3
import os
import pandas as pd
import hashlib
import re
import random
import string

#current password: password

class DatabaseManager:
    def __init__(self, base_dir):
        self.db_path = os.path.join(base_dir, "library.db")
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False, isolation_level=None)
        self.cursor = self.conn.cursor()
        self.cursor.execute("PRAGMA foreign_keys = ON;")
        self.initialize_db()

    def initialize_db(self):
        self.cursor.execute("PRAGMA foreign_keys = ON")

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                password_hash TEXT NOT NULL
                )
            """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                system_date TEXT NOT NULL
                )
            """)

        self.cursor.execute("SELECT 1 FROM admin WHERE id = 1")
        if not self.cursor.fetchone():
            default_password = "admin123"
            default_hash = hashlib.sha256(default_password.encode()).hexdigest()

            self.cursor.execute(
                "INSERT INTO admin (id, password_hash) VALUES (1, ?)",
                    (default_hash,))

        self.cursor.execute("SELECT 1 FROM system_settings WHERE id = 1")
        if not self.cursor.fetchone():
            sys_date = pd.Timestamp.today().strftime("%Y-%m-%d")
            self.cursor.execute(
                    "INSERT INTO system_settings (id, system_date) VALUES (1, ?)",
                    (sys_date,))

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                UserID TEXT PRIMARY KEY,
                Name TEXT NOT NULL
            )
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS books (
                BookID TEXT PRIMARY KEY,
                Name TEXT NOT NULL,
                Current INTEGER NOT NULL,
                Max INTEGER NOT NULL
            )
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                UserID TEXT NOT NULL,
                BookID TEXT NOT NULL,
                IssueDate TEXT NOT NULL,
                DueDate TEXT NOT NULL,
                ReturnDate TEXT,
                FOREIGN KEY (UserID) REFERENCES students(UserID),
                FOREIGN KEY (BookID) REFERENCES books(BookID)
            )
        """)

        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS pending_requests (
                UserID TEXT PRIMARY KEY,
                Name TEXT NOT NULL,
                Year INTEGER NOT NULL,
                Roll INTEGER NOT NULL
            )
        """)

        self.conn.commit()

    def get_system_date(self):
        cur = self.conn.cursor()
        cur.execute("SELECT system_date FROM system_settings WHERE id = 1")
        row = cur.fetchone()
        return pd.to_datetime(row[0])

    def set_system_date(self, new_date):
        sql_date = new_date.strftime("%Y-%m-%d")

        cur = self.conn.cursor()
        cur.execute("INSERT OR REPLACE INTO system_settings (id, system_date) VALUES (1, ?)", (sql_date,))

        self.conn.commit()
        
    def get_reading_history(self, user_id):
        if not user_id:
            return {
            "success": False,
            "message": "User ID is required to fetch reading history."
            }
        try:
            self.cursor.execute("""
                SELECT 
                    t.UserID,
                    t.BookID,
                    b.Name,
                    t.IssueDate,
                    t.DueDate,
                    COALESCE(t.ReturnDate, 'Not Returned') AS ReturnDate
                FROM transactions t
                JOIN books b ON t.BookID = b.BookID
                WHERE t.UserID = ?
                ORDER BY t.IssueDate DESC
            """, (user_id,))

            rows = self.cursor.fetchall()

            if not rows:
                return {"success": True, "data": []}

            history = []
            for uid, book_id, name, issue, due, returned in rows:
                if returned and returned != "Not Returned":
                    rtn_date = pd.to_datetime(returned).strftime("%Y-%m-%d")
                else:
                    rtn_date = returned
                history.append({
                    "user_id": uid,
                    "book_id": book_id,
                    "book_name": name,
                    "issue_date": pd.to_datetime(issue).strftime("%Y-%m-%d"),
                    "due_date": pd.to_datetime(due).strftime("%Y-%m-%d"),
                    "return_date": rtn_date
                    })

            return {
                "success": True,
                "data": history
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to fetch reading history: {e}"
                }

class LogManager:
    def __init__(self, base_dir, db_manager):
        self.db = db_manager
        self.log_path = os.path.join(base_dir, "DailyLog.txt")
        self.initialize_file()

    def now(self):
        return self.db.get_system_date().strftime("%d-%m-%Y")

    def initialize_file(self):
        if not os.path.exists(self.log_path):
            self.clear()

    def write(self, msg):
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(msg + "\n")

    def clear(self):
        with open(self.log_path, "w", encoding="utf-8") as f:
            f.write(f"> > > > Daily Log : {self.now()} < < < <\n")

    def new_day(self):
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write("\n" + "-"*50 + "\n")
            f.write(f"\n> > > > Daily Log : {self.now()} < < < <\n")
            
    def read(self):
        with open(self.log_path, "r", encoding="utf-8") as f:
            return f.read()

class LibraryUser:
    LOAN_DAYS = 7

    def __init__(self, db_manager, log_manager):
        self.db = db_manager
        self.conn = db_manager.conn
        self.cursor = db_manager.conn.cursor()
        self.log = log_manager

    def write_log(self, msg):
        self.log.write(msg)

class Admin(LibraryUser):
    def __init__(self, db_manager, log_manager):
        super().__init__(db_manager, log_manager)

    def _hash(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def authenticate(self, password: str) -> bool:
        cur = self.conn.cursor()
        cur.execute("SELECT password_hash FROM admin WHERE id = 1")
        row = cur.fetchone()
        return row and self._hash(password) == row[0]

    def change_password(self, old_password: str, new_password: str) -> bool:
        if not self.authenticate(old_password):
            return False

        new_hash = self._hash(new_password)
        with self.conn:
            cur = self.conn.cursor()
            cur.execute("UPDATE admin SET password_hash=? WHERE id=1", (new_hash,))
        return True

class Student(LibraryUser):
    MAX_PENDING_BOOKS = 3

    def __init__(self, db_manager, log_manager, user_id):
        super().__init__(db_manager, log_manager)
        self.user_id = user_id.upper()
        cur = self.conn.cursor()
        cur.execute("SELECT Name FROM students WHERE UserID=?", (self.user_id,))
        row = cur.fetchone()
        self.name = row[0] if row else "Unknown"

    def valid_user(self) -> bool:
        cur = self.conn.execute("SELECT 1 FROM students WHERE UserID=?", (self.user_id,))
        return cur.fetchone() is not None
    
    def has_pending_book(self, book_id):
        cur = self.conn.cursor()
        cur.execute("""
            SELECT 1 FROM transactions
            WHERE UserID=? AND BookID=? AND ReturnDate IS NULL
        """, (self.user_id, book_id))
        return cur.fetchone() is not None

class ConsoleAdminInterface:
    def __init__(self, db_manager, log_manager, admin):
        self.db = db_manager
        self.log = log_manager
        self.admin = admin

    def _change_password(self, old_password, new_password, confirm_password):
        if not old_password or not new_password or not confirm_password:
            return {"success": False, "message": "All fields are required."}

        if new_password != confirm_password:
            return {"success": False, "message": "New passwords do not match."}

        if old_password == new_password:
            return {"success": False, "message": "New password cannot be the same as old password."}

        if len(new_password) < 8:
            return {"success": False, "message": "Password must be at least 8 characters long."}

        if self.admin.change_password(old_password, new_password):
            self.log.write("[ADMIN] Password changed successfully.")
            return {"success": True, "message": "Admin password changed successfully!"}
        else:
            return {"success": False, "message": "Incorrect current password."}

    def _generate_next_book_id(self):
        self.db.cursor.execute("SELECT BookID FROM books ORDER BY BookID DESC LIMIT 1")
        row = self.db.cursor.fetchone()

        if not row:
            return "BK-A000"

        last_id = row[0]  # e.g. BK-C017
        match = re.match(r"BK-([A-Z])(\d{3})", last_id)
        if not match:
            return "BK-A000"

        letter = match.group(1)
        num = int(match.group(2))

        if num < 999:
            num += 1
        else:
            num = 0
            if ord(letter) >= 90 :
                return None  # ID limit reached
            letter = chr(ord(letter) + 1)

        return f"BK-{letter}{num:03d}"

    def _display_books(self, books):
        if not books:
            return {"success": True, "data": []}

        formatted = []
        for book_id, name, current, max_qty in books:
            formatted.append({
                "book_id": book_id,
                "name": name,
                "current": current,
                "max": max_qty
            })

        return {"success": True, "data": formatted}

    def _view_books(self):
        self.db.cursor.execute("SELECT BookID, Name, Current, Max FROM books")
        books = self.db.cursor.fetchall()
        return self._display_books(books)

    def _add_new_book(self, name, qty):
        name = name.strip()
        if not name:
            return {"success": False, "message": "Book name cannot be empty."}

        self.db.cursor.execute("SELECT 1 FROM books WHERE LOWER(Name) = LOWER(?)", (name,))
        
        if self.db.cursor.fetchone():
            return {
                "success": False,
                "message": f"A book with name '{name}' already exists. Consider modifying its stock."
            }

        if not isinstance(qty, int) or not (1 <= qty <= 99):
            return {"success": False, "message": "Quantity must be between 1 and 99."}

        book_id = self._generate_next_book_id()
        if not book_id:
            return {"success": False, "message": "Book ID limit reached. Cannot generate new BookID."}

        try:
            with self.db.conn:
                self.db.cursor.execute(
                    "INSERT INTO books (BookID, Name, Current, Max) VALUES (?, ?, ?, ?)",
                    (book_id, name, qty, qty)
                )

            self.log.write(f"[ADMIN] Added new book '{name}' (ID: {book_id}) with initial quantity {qty}.")

            return {
                "success": True,
                "message": f"Book '{name}' added successfully.",
                "book": {
                    "book_id": book_id,
                    "name": name,
                    "current": qty,
                    "max": qty
                }
            }

        except Exception as e:
            return {"success": False, "message": f"Error adding book: {e}"}

    def _modify_book_stock(self, delta_type, book_id, qty):
        book_id = book_id.strip().upper()
        if not book_id:
            return {"success": False, "message": "Book ID cannot be empty."}
        
        try:
            qty = int(qty)
            if qty<=0:
                return {"success": False, "message": "Quantity must be a positive integer."}
        except:
            return {"success": False, "message": "Quantity must be an integer."}

        self.db.cursor.execute(
            "SELECT Name, Current, Max FROM books WHERE BookID = ?",
            (book_id,)
        )
        book_data = self.db.cursor.fetchone()
        if not book_data:
            return {"success": False, "message": f"Book with ID '{book_id}' not found."}

        book_name, current_qty, max_qty = book_data

        new_current = current_qty
        new_max = max_qty

        if delta_type == "add":
            new_current += qty
            new_max += qty
            if new_max > 99:
                return {"success": False, "message": "Cannot add stock; max quantity is 99."}
        elif delta_type == "reduce":
            new_current -= qty
            new_max -= qty
            if new_current < 0:
                return {"success": False, "message": "Cannot reduce stock; current quantity would be negative."}
            if new_max <= 0:
                return {"success": False, "message": "Cannot reduce total stock to zero or less. Consider deleting the book instead."}
        else:
            return {"success": False, "message": "Invalid delta_type; must be 'add' or 'reduce'."}

        try:
            with self.db.conn:
                self.db.cursor.execute(
                    "UPDATE books SET Current = ?, Max = ? WHERE BookID = ?",
                    (new_current, new_max, book_id)
                )

            self.log.write(
                f"[ADMIN] {delta_type.capitalize()}ed stock for '{book_name}' (ID: {book_id}) by {qty}. "
                f"New stock: Current={new_current}, Max={new_max}."
            )

            return {
                "success": True,
                "message": f"Stock for '{book_name}' updated successfully.",
                "book": {
                    "book_id": book_id,
                    "name": book_name,
                    "current": new_current,
                    "max": new_max
                }
            }
        except Exception as e:
            return {"success": False, "message": f"Error modifying stock: {e}"}

    def _delete_book(self, book_id, confirm=False):
        book_id = book_id.strip().upper()
        if not book_id:
            return {"success": False, "message": "Book ID cannot be empty."}

        self.db.cursor.execute(
            "SELECT Name, Current, Max FROM books WHERE BookID = ?",
            (book_id,)
        )
        book_data = self.db.cursor.fetchone()
        if not book_data:
            return {"success": False, "message": f"Book with ID '{book_id}' not found."}

        book_name, current_qty, max_qty = book_data

        if current_qty != max_qty:
            return {"success": False, "message": "Cannot delete book; some copies are currently borrowed."}

        if not confirm:
            return {"success": False, "message": f"Deletion of '{book_name}' requires confirmation."}

        try:
            with self.db.conn:
                self.db.cursor.execute("DELETE FROM transactions WHERE BookID = ?", (book_id,))
                self.db.cursor.execute("DELETE FROM books WHERE BookID = ?", (book_id,))

            self.log.write(f"[ADMIN] Deleted book '{book_name}' (ID: {book_id}).")

            return {"success": True, "message": f"Book '{book_name}' deleted successfully."}
        except Exception as e:
            return {"success": False, "message": f"Error deleting book: {e}"}

    def _manage_stock(self, choice, **kwargs):
        if choice in [1, '1']:
            return self._view_books()  
        
        elif choice in [2, '2']:
            name = kwargs.get("name")
            qty = kwargs.get("qty")
            try: 
                qty = int(qty)
            except: 
                return {"success": False, "message": "Quantity must be an integer"}
            if name is None or qty is None:
                return {"success": False, "message": "Book name and quantity required for adding new book."}
            return self._add_new_book(name, qty)
        
        elif choice in [3, '3']:
            book_id = kwargs.get("book_id")
            qty = kwargs.get("qty")
            if book_id is None or qty is None:
                return {"success": False, "message": "Book ID and quantity required to increase stock."}
            return self._modify_book_stock(delta_type="add", book_id=book_id, qty=qty)
        
        elif choice in [4, '4']:
            book_id = kwargs.get("book_id")
            qty = kwargs.get("qty")
            if book_id is None or qty is None:
                return {"success": False, "message": "Book ID and quantity required to reduce stock."}
            return self._modify_book_stock(delta_type="reduce", book_id=book_id, qty=qty)
        
        elif choice in [5, '5']:
            book_id = kwargs.get("book_id")
            confirm = kwargs.get("confirm", False)
            if book_id is None:
                return {"success": False, "message": "Book ID required to delete book."}
            return self._delete_book(book_id=book_id, confirm=confirm)
        
        elif choice in [6, '6']:
            return {"success": True, "message": "Returning to Admin Dashboard."}
        
        else:
            return {"success": False, "message": "Invalid choice."}

    def _display_students(self, students):
        if not students:
            return {"success": True, "data": []}

        student_list = []
        for user_id, name, pending_books, total_borrowed in students:
            student_list.append({
                "user_id": user_id,
                "name": name,
                "pending_books": pending_books,
                "total_borrowed": total_borrowed
            })
        return {"success": True, "data": student_list}

    def _view_students(self):
        self.db.cursor.execute("""
            SELECT
                s.UserID,
                s.Name,
            COUNT(CASE WHEN t.id IS NOT NULL AND t.ReturnDate IS NULL THEN 1 ELSE NULL END) AS Pending,
            COUNT(t.id) AS Total
            FROM students s
            LEFT JOIN transactions t ON s.UserID = t.UserID
            GROUP BY s.UserID, s.Name
            ORDER BY s.UserID
            """)
        students = self.db.cursor.fetchall()
        return self._display_students(students)

    def _delete_student(self, user_id=None, confirm=False):
        if not user_id:
            return {"success": False, "message": "User ID is required to delete a student."}

        user_id = user_id.strip().upper()

        self.db.cursor.execute("SELECT Name FROM students WHERE UserID = ?", (user_id,))
        student_name_row = self.db.cursor.fetchone()

        if not student_name_row:
            return {"success": False, "message": f"Student with User ID '{user_id}' not found."}

        student_name = student_name_row[0]

        self.db.cursor.execute("SELECT COUNT(*) FROM transactions WHERE UserID = ? AND ReturnDate IS NULL", (user_id,))
        pending_books_count = self.db.cursor.fetchone()[0]

        if pending_books_count > 0:
            return {
                "success": False,
                "message": (
                    f"Cannot delete '{student_name}' ({user_id}). "
                    f"This student has {pending_books_count} pending borrowed book(s). "
                    "Ensure all books are returned before deleting."
                    )
                }

        if not confirm:
            return {
                "success": False,
                "message": f"Deletion not confirmed for '{student_name}' ({user_id})."
                }
        
        try:
            with self.db.conn:
                self.db.cursor.execute("DELETE FROM transactions WHERE UserID = ?", (user_id,))
                self.db.cursor.execute("DELETE FROM students WHERE UserID = ?", (user_id,))
                self.log.write(f"[ADMIN] Deleted student '{student_name}' (User ID: {user_id}).")
                return {"success": True, "message": f"Student '{student_name}' ({user_id}) deleted successfully."}
        except Exception as e:
            return {"success": False, "message": f"Error deleting student: {e}"}

    def _view_reading_history(self, user_id):
        result = self.db.get_reading_history(user_id=user_id)

        if not result["success"]:
            return result

        return {
            "success": True,
            "user_id": user_id,
            "history": result["data"]
            }

    def _manage_students(self, choice, **kwargs):
        if choice in [1, '1']:
            return self._view_students()
        
        elif choice in [2, '2']:
            user_id = kwargs.get("user_id")
            if not user_id:
                return {"success": False, "message": "User ID is required to view history."}
            return self._view_reading_history(user_id=user_id)

        elif choice in [3, '3']:
            user_id = kwargs.get("user_id")
            confirm = kwargs.get("confirm", False)
            return self._delete_student(user_id=user_id, confirm=confirm)

        elif choice in [4, '4']:
            return {"success": True, "message": "Returning to Admin Dashboard."}

        else:
            return {"success": False, "message": "Invalid choice."}

    def _display_pending_requests(self):
        self.db.cursor.execute("SELECT UserID, Name, Year, Roll FROM pending_requests")
        requests = self.db.cursor.fetchall()

        if not requests:
            return {"success": True, "data": []}

        request_list = []
        for user_id, name, year, roll in requests:
            request_list.append({
                "user_id": user_id,
                "name": name,
                "year": year,
                "roll": roll
                })

        return {"success": True, "data": request_list}

    def _process_pending_requests(self, choice, **kwargs):
        user_id = kwargs.get("user_id")
        if user_id:
            user_id = user_id.strip().upper()
        else:
            return {"success": False, "message": "User ID required to process a request."}
        
        if choice in [1, '1']:
            return self._process_request(user_id, action="approve")

        elif choice in [2, '2']:
            return self._process_request(user_id, action="reject")

        elif choice in [3, '3']:
            return {"success": True, "message": "Returning to Admin Dashboard."}

        else:
            return {"success": False, "message": "Invalid choice."}

    def _process_request(self, user_id, action):
        self.db.cursor.execute("SELECT UserID, Name FROM pending_requests WHERE UserID=?", (user_id,))
        request = self.db.cursor.fetchone()

        if not request:
            return {"success": False, "message": f"No pending request found for User ID {user_id}."}

        usr_id, name = request

        try:
            with self.db.conn:
                if action == "approve":
                    self.db.cursor.execute("SELECT 1 FROM students WHERE UserID=?", (usr_id,))
                    if self.db.cursor.fetchone():
                        self.db.cursor.execute("DELETE FROM pending_requests WHERE UserID=?", (usr_id,))
                        self.log.write(f"[ADMIN] Removed existing student request for {name} ({usr_id}) from pending.")
                        return {
                            "success": True,
                            "message": f"Student {name} ({usr_id}) already exists. Pending request removed."
                            }

                    self.db.cursor.execute("INSERT INTO students (UserID, Name) VALUES (?, ?)", (usr_id, name))
                    self.db.cursor.execute("DELETE FROM pending_requests WHERE UserID=?", (usr_id,))
                    self.log.write(f"[ADMIN] Approved student {name} (User ID: {usr_id}).")
                    return {
                        "success": True,
                        "message": f"Student {name} ({usr_id}) approved and added to students list."
                        }

                elif action == "reject":
                    self.db.cursor.execute("DELETE FROM pending_requests WHERE UserID=?", (usr_id,))
                    self.log.write(f"[ADMIN] Rejected student request for {name} (User ID: {usr_id}).")
                    return {
                        "success": True,
                        "message": f"Request for {name} ({usr_id}) rejected and removed from pending requests."
                        }
                
                else:
                    return {"success": False, "message": "Invalid action. Must be 'approve' or 'reject'."}

        except Exception as e:
            return {"success": False, "message": f"Error processing request for {usr_id}: {e}"}

    def _show_log(self):
        try:
            content = self.log.read()
            return {"success": True, "log": content}
        except FileNotFoundError:
            return {"success": False, "message": "Log file not found."}
        except Exception as e:
            return {"success": False, "message": f"Error reading log: {e}"}

    def _clear_data(self, option, admin_password):
        if not self.admin.authenticate(admin_password):
            return {"success": False, "message": "Invalid admin password"}
        
        cur = self.db.conn.cursor()

        try:
            cur.execute("PRAGMA foreign_keys = OFF")
            if option in ['1', 1]:
                cur.execute("DELETE FROM transactions")
                msg = "All transactions cleared"

            elif option in ['2', 2]:
                cur.execute("DELETE FROM books")
                msg = "All books cleared"

            elif option in ['3', 3]:
                cur.execute("DELETE FROM students")
                msg = "All students cleared"

            elif option in ['4', 4]:
                cur.execute("DELETE FROM pending_requests")
                msg = "All pending requests cleared"

            elif option in ['5', 5]:
                self.log.clear()
                msg = "All logs cleared"

            elif option in ['6', 6]:
                cur.execute("DELETE FROM transactions")
                cur.execute("DELETE FROM books")
                cur.execute("DELETE FROM students")
                cur.execute("DELETE FROM pending_requests")
                self.log.clear()
                msg = "All tables cleared"

            elif option in ['7', 7]:
                return {"success": True, "message": "Returning to Admin Dashboard."}

            else:
                return {"success": False, "message": "Invalid option"}

            self.db.conn.commit()
            self.log.write(f"[ADMIN] {msg}")
            return {"success": True, "message": msg}

        except Exception as e:
            self.db.conn.rollback()
            return {"success": False, "message": f"Failed to clear data: {e}"}
        
        finally:
            cur.execute("PRAGMA foreign_keys = ON")

    def run(self, choice, **kwargs):
        try:

            if choice in [1, '1']:
                old_password = kwargs.get("old_password")
                new_password = kwargs.get("new_password")
                confirm_password = kwargs.get("confirm_password")
                if not all([old_password, new_password, confirm_password]):
                    return {"success": False, "message": "All password fields required."}
                return self._change_password(old_password, new_password, confirm_password)

            elif choice in [2, '2']:
                stock_choice = kwargs.get("stock_choice")
                return self._manage_stock(stock_choice, **kwargs)

            elif choice in [3, '3']:
                student_choice = kwargs.get("student_choice")
                return self._manage_students(student_choice, **kwargs)

            elif choice in [4, '4']:
                sub_choice = kwargs.get("request_choice")
                return self._process_pending_requests(sub_choice, **kwargs)

            elif choice in [5, '5']:
                return self._show_log()

            elif choice in [6, '6']:
                option = kwargs.get("clear_option")
                admin_password = kwargs.get("admin_password")
                if not admin_password or option is None:
                    return {"success": False, "message": "Admin password and option required to clear data."}
                return self._clear_data(option, admin_password)

            elif choice in [7, '7']:
                return {"success": True, "message": "Logging out from Admin Dashboard."}

            else:
                return {"success": False, "message": "Invalid choice."}

        except Exception as e:
            return {"success": False, "message": f"Admin dashboard error: {e}"}

class ConsoleStudentInterface:
    def __init__(self, db_manager, log_manager, student):
        self.db = db_manager
        self.log = log_manager
        self.student = student

    def _display_available_books(self):
        self.db.cursor.execute("SELECT BookID, Name, Current FROM books WHERE Current >= 0")
        available_books = self.db.cursor.fetchall()

        if not available_books:
            return {"success": True, "data": []}

        formatted = []
        for book_id, name, current in available_books:
            formatted.append({
                "book_id": book_id,
                "name": name,
                "available": current
            })

        return {"success": True, "data": formatted}

    def _borrow_book(self, book_id):
        if not book_id or not book_id.strip():
            return {"success": False, "message": "Book ID is required to borrow a book."}

        book_id = book_id.strip().upper()

        self.db.cursor.execute(
            "SELECT BookID, Name, Current FROM books WHERE BookID = ? AND Current > 0",
            (book_id,)
        )
        selected_book = self.db.cursor.fetchone()

        if not selected_book:
            return {"success": False, "message": f"Book '{book_id}' is not available for borrowing."}

        self.db.cursor.execute("""
            SELECT COUNT(*) FROM transactions
            WHERE UserID = ? AND ReturnDate IS NULL
        """, (self.student.user_id,))
        active_loans_count = self.db.cursor.fetchone()[0]

        if active_loans_count >= self.student.MAX_PENDING_BOOKS:
            return {
                "success": False,
                "message": f"Maximum limit of {self.student.MAX_PENDING_BOOKS} pending borrowed books reached."
            }

        if self.student.has_pending_book(book_id):
            return {
                "success": False,
                "message": f"You already have an active loan for '{selected_book[1]}' (ID: {book_id})."
            }

        try:
            sys_date = self.db.get_system_date()
            due_date = sys_date + pd.Timedelta(days=self.student.LOAN_DAYS)

            with self.db.conn:
                self.db.cursor.execute("""
                    INSERT INTO transactions (UserID, BookID, IssueDate, DueDate)
                    VALUES (?, ?, ?, ?)
                """, (
                    self.student.user_id,
                    selected_book[0],
                    sys_date.strftime("%Y-%m-%d"),
                    due_date.strftime("%Y-%m-%d")
                ))

                self.db.cursor.execute(
                    "UPDATE books SET Current = Current - 1 WHERE BookID = ?",
                    (selected_book[0],)
                )

            self.log.write(
                f"Student {self.student.name} (User ID: {self.student.user_id}) "
                f"borrowed '{selected_book[1]}' (ID: {selected_book[0]}). "
                f"Due: {due_date.strftime('%d-%m-%Y')}"
            )

            return {
                "success": True,
                "message": f"Successfully borrowed '{selected_book[1]}'.",
                "transaction": {
                    "user_id": self.student.user_id,
                    "book_id": selected_book[0],
                    "book_name": selected_book[1],
                    "issue_date": sys_date.strftime("%Y-%m-%d"),
                    "due_date": due_date.strftime("%Y-%m-%d")
                }
            }

        except Exception as e:
            return {"success": False, "message": f"Error borrowing book: {e}"}           

    def _calculate_fine(self, due_date, return_date):
        overdue_days = max(0, (return_date - due_date).days)

        fine = 0
        if overdue_days > 0:
            if overdue_days <= 7:          # Days 1–7 overdue
                fine = overdue_days * 1
            elif overdue_days <= 14:       # Days 8–14 overdue
                fine = (7 * 1) + ((overdue_days - 7) * 2)
            else:                          # More than 14 days overdue
                fine = (7 * 1) + (7 * 2) + ((overdue_days - 14) * 5)

        return fine

    def _display_borrowed_books(self):
        self.db.cursor.execute("""
            SELECT t.id, t.BookID, b.Name, t.IssueDate, t.DueDate
            FROM transactions t
            JOIN books b ON t.BookID = b.BookID
            WHERE t.UserID = ? AND t.ReturnDate IS NULL
            ORDER BY t.DueDate ASC
        """, (self.student.user_id,))
        borrowed_books = self.db.cursor.fetchall()

        if not borrowed_books:
            return {"success": True, "data": []}

        sys_date = self.db.get_system_date()

        formatted = []
        for trans_id, book_id, book_name, issue_date_str, due_date_str in borrowed_books:
            issue_date = pd.to_datetime(issue_date_str)
            due_date = pd.to_datetime(due_date_str)

            is_overdue = sys_date > due_date
            overdue_days = max(0, (sys_date - due_date).days)
            fine = self._calculate_fine(due_date, sys_date) if is_overdue else 0

            formatted.append({
                "transaction_id": trans_id,
                "book_id": book_id,
                "book_name": book_name,
                "issue_date": issue_date.strftime("%Y-%m-%d"),
                "due_date": due_date.strftime("%Y-%m-%d"),
                "status": "OVERDUE" if is_overdue else "OK",
                "overdue_days": overdue_days,
                "fine": fine
            })

        return {"success": True, "data": formatted}
    
    def _process_payment(self, method, amount, **kwargs):
        try:
            amount = int(amount)
            if amount <= 0:
                return {"success": False, "message": "Invalid payment amount."}
        except:
            return {"success": False, "message": "Payment amount must be an integer."}

        if not method:
            return {"success": False, "message": "Payment method is required."}

        method = method.strip().lower()

        if method == "card":
            card_number = kwargs.get("card_number")
            expiry = kwargs.get("expiry")  # MM/YY or MM/YYYY
            cvv = kwargs.get("cvv")

            if not card_number or not expiry or not cvv:
                return {
                    "success": False,
                    "message": "Missing credit card details."
                    }

            if not (card_number.isdigit() and len(card_number) == 16):
                return {
                    "success": False,
                    "message": "Invalid credit card number."
                    }

            if not (cvv.isdigit() and len(cvv) == 3):
                return {
                    "success": False,
                    "message": "Invalid CVV."
                    }

            try:
                if re.match(r"^\d{2}/\d{2}$", expiry):
                    month, year = expiry.split("/")
                    year = int("20" + year)
                elif re.match(r"^\d{2}/\d{4}$", expiry):
                    month, year = expiry.split("/")
                    year = int(year)
                else:
                    raise ValueError

                month = int(month)
                if not (1 <= month <= 12):
                    raise ValueError

                expiry_date = (pd.Timestamp(year=year, month=month, day=1) + pd.offsets.MonthEnd(1)).normalize()
                sys_date = self.db.get_system_date()

                if expiry_date < sys_date:
                    return {
                        "success": False,
                        "message": "Credit card has expired."
                        }

            except Exception:
                return {
                    "success": False,
                    "message": "Invalid expiry date format."
                    }

        elif method == "netbanking":
            account_no = kwargs.get("account_no")
            password = kwargs.get("password")

            if not account_no or not password:
                return {
                    "success": False,
                    "message": "Missing net banking credentials."
                    }

            if not (account_no.isdigit() and 9 <= len(account_no) <= 18):
                return {
                    "success": False,
                    "message": "Invalid account number."
                    }

            if len(password) < 6:
                return {
                    "success": False,
                    "message": "Invalid net banking password."
                    }

        elif method == "upi":
            upi_id = kwargs.get("upi_id")
            upi_pin = kwargs.get("upi_pin")

            if not upi_id or not upi_pin:
                return {
                    "success": False,
                    "message": "Missing UPI details."
                    }

            if "@" not in upi_id or upi_id.count("@") != 1:
                return {
                    "success": False,
                    "message": "Invalid UPI ID format."
                    }

            name, bank = upi_id.split("@")
            if not name or not bank:
                return {
                    "success": False,
                    "message": "Invalid UPI ID format."
                    }

            if not (upi_pin.isdigit() and len(upi_pin) in (4, 6)):
                return {
                    "success": False,
                    "message": "Invalid UPI PIN."
                    }

        else:
            return {
                "success": False,
                "message": f"Unsupported payment method: {method}"
                }

        transaction_id = ("PAY-" + self.db.get_system_date().strftime("%Y%m%d") 
                + "-" + "".join(random.choices(string.digits, k=6)))

        try:
            self.log.write(
                f"Payment successful | Method: {method} | Amount: {amount} | TxnID: {transaction_id}"
                )
        except Exception:
            pass  

        return {
            "success": True,
            "message": "Payment successful.",
            "payment": {
                "method": method,
                "amount": amount,
                "transaction_id": transaction_id
                }
            }

    def _return_book(self, transaction_id=None, confirm_fine=False, payment_payload=None):
        if not transaction_id:
            return {"success": False, "message": "Transaction ID is required to return a book."}

        self.db.cursor.execute("""
            SELECT t.id, t.BookID, b.Name, t.IssueDate, t.DueDate
            FROM transactions t
            JOIN books b ON t.BookID = b.BookID
            WHERE t.id = ? AND t.UserID = ? AND t.ReturnDate IS NULL
            """, (transaction_id, self.student.user_id))

        row = self.db.cursor.fetchone()
        if not row:
            return {
                "success": False,
                "message": "No active borrowed book found for this transaction ID."
                }

        trans_id, book_id, book_name, issue_date_str, due_date_str = row

        issue_date = pd.to_datetime(issue_date_str)
        due_date = pd.to_datetime(due_date_str)
        sys_date = self.db.get_system_date()

        if sys_date < issue_date:
            return {
                "success": False,
                "message": (
                    f"Return date ({sys_date.strftime('%d-%m-%Y')}) "
                    f"cannot be earlier than issue date ({issue_date.strftime('%d-%m-%Y')})."
                    )
                }

        fine = self._calculate_fine(due_date, sys_date)
        payment_result = None

        if fine > 0:
            if not confirm_fine:
                return {
                    "success": False,
                    "requires_confirmation": True,
                    "message": f"This book is overdue. Fine: Rs. {fine}. Confirm fine payment to proceed.",
                    "fine": fine,
                    "transaction_id": trans_id
                    }

            if not payment_payload:
                return {
                    "success": False,
                    "message": "Payment details are required to pay the fine.",
                    "fine": fine
                    }
            
            method = payment_payload.get("method")
            if not method:
                return {
                    "success": False,
                    "message": "Payment method is required.",
                    "fine": fine
                    }

            payload = payment_payload.copy()
            payload.pop("method", None)

            payment_result = self._process_payment(
                method=method,
                amount=fine,
                **payload
                )

            if not payment_result["success"]:
                return {
                    "success": False,
                    "message": "Payment failed.",
                    "payment_error": payment_result["message"]
                    }

        try:
            with self.db.conn:
                self.db.cursor.execute("""
                        UPDATE transactions
                        SET ReturnDate = ?
                        WHERE id = ?
                        """, (sys_date.strftime("%Y-%m-%d"), trans_id))

                self.db.cursor.execute("""
                        UPDATE books
                        SET Current = Current + 1
                        WHERE BookID = ?
                        """, (book_id,))
                                    
            payment_id = payment_result["payment"]["transaction_id"] if fine > 0 else "N/A"
            if fine > 0:
                self.log.write(
                    f"Student {self.student.name} (User ID: {self.student.user_id}) "
                    f"returned '{book_name}' (ID: {book_id}). Fine: {fine}. Payment ID: {payment_id}."
                    )
            else:
                self.log.write(
                    f"Student {self.student.name} (User ID: {self.student.user_id}) "
                    f"returned '{book_name}' (ID: {book_id})."
                    )

            return {
                "success": True,
                "message": f"Successfully returned '{book_name}' (ID: {book_id}).",
                "book": {
                    "transaction_id": trans_id,
                    "book_id": book_id,
                    "book_name": book_name,
                    "return_date": sys_date.strftime("%Y-%m-%d"),
                    "fine": fine
                    },
                "payment": payment_result
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"An error occurred while returning the book: {e}"
                }
        
    def _view_my_reading_history(self):
        result = self.db.get_reading_history(user_id=self.student.user_id)

        if not result["success"]:
            return result

        return {
            "success": True,
            "user_id": self.student.user_id,
            "history": result["data"]
            }

    def run(self, choice, **kwargs):
        try:
            if choice in [1, '1']:
                book_id = kwargs.get("book_id")
                if not book_id:
                    return {"success": False, "message": "Book ID is required to borrow a book."}
                return self._borrow_book(book_id=book_id)

            elif choice in [2, '2']:
                transaction_id = kwargs.get("transaction_id")
                confirm_fine = kwargs.get("confirm_fine", False)
                payment_payload = kwargs.get("payment_payload")
                return self._return_book(
                    transaction_id=transaction_id,
                    confirm_fine=confirm_fine,
                    payment_payload=payment_payload
                    )
            
            elif choice in [3, '3']:
                return self._view_my_reading_history()

            elif choice in [4, '4']:
                return {"success": True, "message": "Logging out from Student Dashboard."}

            else:
                return {"success": False, "message": "Invalid choice."}

        except Exception as e:
            return {"success": False, "message": f"Student dashboard error: {e}"}

class ConsoleApp:
    def __init__(self, base_dir="./library_data"):
        self.BASE_DIR = base_dir
        os.makedirs(self.BASE_DIR, exist_ok=True)
        self.db = DatabaseManager(self.BASE_DIR)
        self.log = LogManager(self.BASE_DIR, self.db)

    def _admin_login(self, password=None):
        if not password:
            return {"success": False, "message": "Admin password is required."}

        admin = Admin(self.db, self.log)

        if admin.authenticate(password):
            self.log.write("[ADMIN] Logged in successfully.")
            admin_interface = ConsoleAdminInterface(self.db, self.log, admin)

            return {
                "success": True,
                "message": "Admin login successful.",
                "session": {
                    "role": "admin",
                    "interface": admin_interface
                }
            }

        return {"success": False, "message": "Incorrect admin password."}

    def _student_signin(self, user_id=None):
        if not user_id:
            return {"success": False, "message": "User ID is required."}

        user_id = user_id.strip().upper()
        student = Student(self.db, self.log, user_id)

        if student.valid_user():
            self.log.write(f"Student {student.name} (User ID: {user_id}) signed in.")

            student_interface = ConsoleStudentInterface(self.db, self.log, student)

            return {
                "success": True,
                "message": f"Welcome, {student.name}!",
                "session": {
                    "role": "student",
                    "user_id": user_id,
                    "interface": student_interface
                }
            }

        return {"success": False, "message": "Invalid or unapproved User ID."}

    def _student_signup(self, name=None, year=None, roll_no=None):
        if not name or year is None or roll_no is None:
            return {
                "success": False,
                "message": "Name, year, and roll number are required."
            }

        name = name.strip()

        if len(name) < 5:
            return {
                "success": False,
                "message": "Invalid name. Must be at least 5 characters long."
            }

        try:
            year = int(year)
            roll_no = int(roll_no)
        except ValueError:
            return {
                "success": False,
                "message": "Year and roll number must be valid integers."
            }

        if not (1 <= year <= 4):
            return {"success": False, "message": "Year must be between 1 and 4."}

        if not (1 <= roll_no <= 999):
            return {"success": False, "message": "Roll number must be between 1 and 999."}

        user_id = f"{year:02d}/{roll_no:03d}"

        self.db.cursor.execute("SELECT 1 FROM students WHERE UserID=?", (user_id,))
        if self.db.cursor.fetchone():
            return {
                "success": False,
                "message": f"Student with User ID {user_id} is already registered."
            }

        self.db.cursor.execute("SELECT 1 FROM pending_requests WHERE UserID=?", (user_id,))
        if self.db.cursor.fetchone():
            return {
                "success": False,
                "message": f"Signup request for User ID {user_id} is already pending approval."
            }

        try:
            with self.db.conn:
                self.db.cursor.execute(
                    "INSERT INTO pending_requests (UserID, Name, Year, Roll) VALUES (?, ?, ?, ?)",
                    (user_id, name, year, roll_no)
                )

            self.log.write(f"Student signup request submitted: {name} (User ID: {user_id})")

            return {
                "success": True,
                "message": "Signup request submitted and awaiting admin approval.",
                "user": {
                    "user_id": user_id,
                    "name": name,
                    "year": year,
                    "roll_no": roll_no
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to submit signup request: {e}"
            }
        
    def _get_system_date(self):
        try:
            system_date = self.db.get_system_date()

            return {
                "success": True,
                "date": system_date.strftime("%Y-%m-%d"),
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to fetch system date: {e}"
            }
        
    def _set_system_date(self, choice, new_date_str=None, source="MANUAL"):
        wrd = "automatically" if source == "AUTO" else "manually"
        try:
            if choice in ['1', 1]:
                if not new_date_str:
                    return {"success": False, "message": "Date string is required to set new date."}
                try:
                    new_date = pd.to_datetime(new_date_str, format="%d-%m-%Y", errors="raise")
                except Exception:
                    return {"success": False, "message": "Invalid date format. Use DD-MM-YYYY."}

                old_date = self.db.get_system_date()
                self.db.set_system_date(new_date)
                if old_date != new_date:
                    self.log.new_day()
                    self.log.write(f"[SYSTEM][{source}] System date {wrd} set to {new_date.strftime('%d-%m-%Y')}")
                    return {
                        "success": True,
                        "message": f"System date {wrd} set to {new_date.strftime('%d-%m-%Y')}",
                        "date": new_date.strftime("%Y-%m-%d")
                        }
                else:
                    return {
                        "success": True,
                        "message": f"System date remains unchanged at {new_date.strftime('%d-%m-%Y')}",
                        "date": new_date.strftime("%Y-%m-%d")
                        }

            elif choice in ['2', 2]:
                today = pd.Timestamp.today().normalize()
                old_date = self.db.get_system_date()
                self.db.set_system_date(today)
                if old_date != today:
                    self.log.new_day()
                    if today - old_date == pd.Timedelta(days=1) and source == "AUTO":
                        self.log.write(f"[SYSTEM][{source}] System date {wrd} advanced to {today.strftime('%d-%m-%Y')}")
                    else:
                        self.log.write(f"[SYSTEM][{source}] System date {wrd} reset to {today.strftime('%d-%m-%Y')}")
                    return {
                        "success": True,
                        "message": f"System date {wrd} reset to {today.strftime('%d-%m-%Y')}",
                        "date": today.strftime("%Y-%m-%d")
                        }
                else:
                    return {
                        "success": True,
                        "message": f"System date remains unchanged at {today.strftime('%d-%m-%Y')}",
                        "date": today.strftime("%Y-%m-%d")
                        }

            elif choice in ['3', 3]:
                return {"success": True, "message": "Returning to Admin Dashboard."}

            else:
                return {"success": False, "message": "Invalid option."}

        except Exception as e:
            return {"success": False, "message": f"Failed to set system date: {e}"}

    def run(self, choice, **kwargs):
        try:
            if choice in [1, "1"]:
                password = kwargs.get("password")
                return self._admin_login(password=password)

            elif choice in [2, "2"]:
                student_choice = kwargs.get("student_choice")

                if student_choice in [1, "1"]:
                    return self._student_signin(user_id=kwargs.get("user_id"))

                elif student_choice in [2, "2"]:
                    return self._student_signup(
                        name=kwargs.get("name"),
                        year=kwargs.get("year"),
                        roll_no=kwargs.get("roll_no")
                    )

                elif student_choice in [3, "3"]:
                    return {"success": True, "message": "Returning to Main Menu."}

                else:
                    return {"success": False, "message": "Invalid student portal choice."}

            elif choice in [3, "3"]:
                return {"success": True, "message": "Exiting application."}

            else:
                return {"success": False, "message": "Invalid main menu choice."}

        except Exception as e:
            return {
                "success": False,
                "message": f"Application error: {e}"
            }