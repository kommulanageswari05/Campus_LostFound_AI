# ============================================================
# CAMPUSFIND - LOST & FOUND AI
# COMPLETE FLASK + SQLITE BACKEND
# ============================================================

import os
import sqlite3
from pathlib import Path
from datetime import datetime
from functools import wraps

from flask import (
    Flask,
    request,
    jsonify,
    render_template,
    send_from_directory,
    session
)
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

TEMPLATE_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
UPLOAD_FOLDER = BASE_DIR / "uploads"

DATABASE = BASE_DIR / "database.db"
ENV_FILE = BASE_DIR / ".env"

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(ENV_FILE)

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "campusfind-secret-key"
)

ADMIN_EMAIL = os.getenv(
    "ADMIN_EMAIL",
    "admin@campusfind.ai"
).strip().lower()


# ============================================================
# FLASK APP
# ============================================================

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR)
)

app.secret_key = SECRET_KEY

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["UPLOAD_FOLDER"] = str(UPLOAD_FOLDER)

CORS(
    app,
    supports_credentials=True
)


# ============================================================
# IMAGE SETTINGS
# ============================================================

ALLOWED_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp"
}


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db():

    conn = sqlite3.connect(
        str(DATABASE),
        timeout=30
    )

    conn.row_factory = sqlite3.Row

    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")

    return conn


# ============================================================
# ADD COLUMN IF MISSING
# ============================================================

def add_column_if_missing(
    conn,
    table_name,
    column_name,
    column_definition
):

    columns = conn.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    existing_columns = {
        row["name"]
        for row in columns
    }

    if column_name not in existing_columns:

        conn.execute(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN {column_name} {column_definition}
            """
        )


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():

    conn = get_db()

    try:

        # ----------------------------------------------------
        # USERS TABLE
        # ----------------------------------------------------

        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                email TEXT NOT NULL UNIQUE,

                password TEXT NOT NULL,

                role TEXT DEFAULT 'student',

                phone TEXT,

                department TEXT,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP

            )
        """)

        # ----------------------------------------------------
        # REPORTS TABLE
        # ----------------------------------------------------

        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                user_id INTEGER,

                type TEXT NOT NULL,

                title TEXT NOT NULL,

                description TEXT,

                category TEXT,

                location TEXT,

                date TEXT,

                image TEXT,

                status TEXT DEFAULT 'pending',

                approval_status TEXT DEFAULT 'pending',

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE

            )
        """)

        # ----------------------------------------------------
        # CLAIMS TABLE
        # ----------------------------------------------------

        conn.execute("""
            CREATE TABLE IF NOT EXISTS claims (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                report_id INTEGER NOT NULL,

                user_id INTEGER NOT NULL,

                message TEXT,

                status TEXT DEFAULT 'pending',

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(report_id)
                    REFERENCES reports(id)
                    ON DELETE CASCADE,

                FOREIGN KEY(user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE

            )
        """)

        # ----------------------------------------------------
        # NOTIFICATIONS TABLE
        # ----------------------------------------------------

        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                user_id INTEGER NOT NULL,

                message TEXT NOT NULL,

                type TEXT DEFAULT 'info',

                is_read INTEGER DEFAULT 0,

                created_at TEXT DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY(user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE

            )
        """)

        # ----------------------------------------------------
        # MIGRATIONS TABLE
        # ----------------------------------------------------

        conn.execute("""
            CREATE TABLE IF NOT EXISTS migrations (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT UNIQUE NOT NULL,

                applied_at TEXT DEFAULT CURRENT_TIMESTAMP

            )
        """)

        # ----------------------------------------------------
        # EXISTING DATABASE MIGRATIONS
        # ----------------------------------------------------

        add_column_if_missing(
            conn,
            "users",
            "phone",
            "TEXT"
        )

        add_column_if_missing(
            conn,
            "users",
            "department",
            "TEXT"
        )

        add_column_if_missing(
            conn,
            "reports",
            "approval_status",
            "TEXT DEFAULT 'pending'"
        )

        # ----------------------------------------------------
        # UNIQUE CLAIM INDEX
        # ----------------------------------------------------

        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS
            idx_claim_user_report
            ON claims(report_id, user_id)
        """)

        # ----------------------------------------------------
        # ADMIN ACCOUNT
        # ----------------------------------------------------

        if ADMIN_EMAIL:

            conn.execute(
                """
                UPDATE users
                SET role = 'admin'
                WHERE LOWER(email) = ?
                """,
                (ADMIN_EMAIL,)
            )

        conn.commit()

        print("SQLite database initialized successfully.")
        print("Database:", DATABASE)

    except Exception:

        conn.rollback()

        raise

    finally:

        conn.close()


# ============================================================
# IMPORTANT
# DATABASE INITIALIZATION FOR RENDER / GUNICORN
# ============================================================

try:

    init_db()

except Exception as e:

    print(
        "STARTUP DATABASE ERROR:",
        repr(e)
    )


# ============================================================
# HELPER
# ============================================================

def normalize_report_type(value):

    value = str(
        value or ""
    ).strip().lower()

    if value in ("lost", "missing"):
        return "lost"

    if value in ("found", "recovered"):
        return "found"

    return value


def row_to_dict(row):

    if row is None:
        return None

    return dict(row)


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user():

    user_id = session.get("user_id")

    if not user_id:
        return None

    conn = get_db()

    try:

        user = conn.execute(
            """
            SELECT
                id,
                name,
                email,
                role,
                phone,
                department,
                created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

        return row_to_dict(user)

    finally:

        conn.close()


# ============================================================
# LOGIN REQUIRED
# ============================================================

def login_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        user = get_current_user()

        if not user:

            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


# ============================================================
# ADMIN REQUIRED
# ============================================================

def admin_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        user = get_current_user()

        if not user:

            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        if user["role"] != "admin":

            return jsonify({
                "success": False,
                "message": "Admin access required."
            }), 403

        return function(*args, **kwargs)

    return wrapper


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return render_template("index.html")


# ============================================================
# UPLOAD IMAGE
# ============================================================

@app.route("/uploads/<path:filename>")
def uploads(filename):

    return send_from_directory(
        str(UPLOAD_FOLDER),
        filename
    )


# ============================================================
# REGISTER
# ============================================================

@app.route("/api/register", methods=["POST"])
def register():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        name = str(
            data.get("name", "")
        ).strip()

        email = str(
            data.get("email", "")
        ).strip().lower()

        password = str(
            data.get("password", "")
        )

        phone = str(
            data.get("phone", "")
        ).strip()

        department = str(
            data.get("department", "")
        ).strip()

        if not name:

            return jsonify({
                "success": False,
                "message": "Name is required."
            }), 400

        if not email:

            return jsonify({
                "success": False,
                "message": "Email is required."
            }), 400

        if not password:

            return jsonify({
                "success": False,
                "message": "Password is required."
            }), 400

        if len(password) < 4:

            return jsonify({
                "success": False,
                "message": "Password must contain at least 4 characters."
            }), 400

        conn = get_db()

        try:

            existing = conn.execute(
                """
                SELECT id
                FROM users
                WHERE LOWER(email) = ?
                """,
                (email,)
            ).fetchone()

            if existing:

                return jsonify({
                    "success": False,
                    "message": "Email already registered."
                }), 409

            role = "admin" if email == ADMIN_EMAIL else "student"

            password_hash = generate_password_hash(
                password
            )

            cursor = conn.execute(
                """
                INSERT INTO users
                (
                    name,
                    email,
                    password,
                    role,
                    phone,
                    department
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    email,
                    password_hash,
                    role,
                    phone,
                    department
                )
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Account created successfully.",
                "user": {
                    "id": cursor.lastrowid,
                    "name": name,
                    "email": email,
                    "role": role,
                    "phone": phone,
                    "department": department
                }
            }), 201

        finally:

            conn.close()

    except Exception as e:

        print(
            "REGISTER ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Registration failed.",
            "error": str(e)
        }), 500


# ============================================================
# LOGIN
# ============================================================

@app.route("/api/login", methods=["POST"])
def login():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        email = str(
            data.get("email", "")
        ).strip().lower()

        password = str(
            data.get("password", "")
        )

        if not email or not password:

            return jsonify({
                "success": False,
                "message": "Email and password are required."
            }), 400

        conn = get_db()

        try:

            user = conn.execute(
                """
                SELECT *
                FROM users
                WHERE LOWER(email) = ?
                """,
                (email,)
            ).fetchone()

            if not user:

                return jsonify({
                    "success": False,
                    "message": "Invalid email or password."
                }), 401

            if not check_password_hash(
                user["password"],
                password
            ):

                return jsonify({
                    "success": False,
                    "message": "Invalid email or password."
                }), 401

            session["user_id"] = user["id"]

            return jsonify({
                "success": True,
                "message": "Login successful.",
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"],
                    "phone": user["phone"],
                    "department": user["department"]
                }
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "LOGIN ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Login failed.",
            "error": str(e)
        }), 500


# ============================================================
# CURRENT USER
# ============================================================

@app.route("/api/me")
def me():

    user = get_current_user()

    return jsonify({
        "success": True,
        "logged_in": user is not None,
        "user": user
    })


# ============================================================
# LOGOUT
# ============================================================

@app.route("/api/logout", methods=["POST"])
def logout():

    print(
        "LOGOUT:",
        session.get("user_id")
    )

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


# ============================================================
# CREATE LOST / FOUND REPORT
# ============================================================

@app.route("/api/reports", methods=["POST"])
@login_required
def create_report():

    try:

        user = get_current_user()

        report_type = normalize_report_type(
            request.form.get("type")
            or request.form.get("report_type")
        )

        title = str(
            request.form.get("title", "")
        ).strip()

        description = str(
            request.form.get("description", "")
        ).strip()

        category = str(
            request.form.get("category", "")
        ).strip()

        location = str(
            request.form.get("location", "")
        ).strip()

        date = str(
            request.form.get("date", "")
        ).strip()

        if report_type not in (
            "lost",
            "found"
        ):

            return jsonify({
                "success": False,
                "message": "Type must be lost or found."
            }), 400

        if not title:

            return jsonify({
                "success": False,
                "message": "Item title is required."
            }), 400

        image_filename = None

        image = request.files.get("image")

        if image and image.filename:

            if not allowed_file(
                image.filename
            ):

                return jsonify({
                    "success": False,
                    "message": "Invalid image format."
                }), 400

            filename = secure_filename(
                image.filename
            )

            timestamp = datetime.now().strftime(
                "%Y%m%d%H%M%S%f"
            )

            image_filename = (
                f"{timestamp}_{filename}"
            )

            image.save(
                str(
                    UPLOAD_FOLDER /
                    image_filename
                )
            )

        conn = get_db()

        try:

            cursor = conn.execute(
                """
                INSERT INTO reports
                (
                    user_id,
                    type,
                    title,
                    description,
                    category,
                    location,
                    date,
                    image,
                    status,
                    approval_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user["id"],
                    report_type,
                    title,
                    description,
                    category,
                    location,
                    date,
                    image_filename,
                    "pending",
                    "pending"
                )
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Report submitted successfully.",
                "report_id": cursor.lastrowid
            }), 201

        finally:

            conn.close()

    except Exception as e:

        print(
            "REPORT ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not create report.",
            "error": str(e)
        }), 500


# ============================================================
# GET PUBLIC REPORTS
# ============================================================

@app.route("/api/reports", methods=["GET"])
def get_reports():

    try:

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT
                    r.*,
                    u.name AS user_name,
                    u.email AS user_email
                FROM reports r
                LEFT JOIN users u
                    ON r.user_id = u.id
                WHERE
                    r.approval_status = 'approved'
                    OR r.approval_status IS NULL
                ORDER BY r.id DESC
                """
            ).fetchall()

            reports = []

            for row in rows:

                item = dict(row)

                item["image_url"] = (
                    "/uploads/" + item["image"]
                    if item.get("image")
                    else None
                )

                reports.append(item)

            return jsonify({
                "success": True,
                "reports": reports
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "GET REPORTS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load reports.",
            "error": str(e)
        }), 500


# ============================================================
# ADMIN - ALL REPORTS
# ============================================================

@app.route("/api/admin/reports")
@admin_required
def admin_reports():

    try:

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT
                    r.*,
                    u.name AS user_name,
                    u.email AS user_email
                FROM reports r
                LEFT JOIN users u
                    ON r.user_id = u.id
                ORDER BY r.id DESC
                """
            ).fetchall()

            reports = []

            for row in rows:

                item = dict(row)

                item["image_url"] = (
                    "/uploads/" + item["image"]
                    if item.get("image")
                    else None
                )

                reports.append(item)

            return jsonify({
                "success": True,
                "reports": reports
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "ADMIN REPORT ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load admin reports.",
            "error": str(e)
        }), 500


# ============================================================
# ADMIN APPROVE / REJECT REPORT
# ============================================================

@app.route(
    "/api/admin/reports/<int:report_id>",
    methods=["PUT", "PATCH", "POST"]
)
@admin_required
def admin_update_report(report_id):

    try:

        data = request.get_json(
            silent=True
        ) or {}

        action = str(
            data.get("action")
            or data.get("status")
            or ""
        ).strip().lower()

        if action in (
            "approve",
            "approved"
        ):

            new_status = "approved"

        elif action in (
            "reject",
            "rejected"
        ):

            new_status = "rejected"

        else:

            return jsonify({
                "success": False,
                "message": "Action must be approve or reject."
            }), 400

        conn = get_db()

        try:

            report = conn.execute(
                """
                SELECT
                    id,
                    user_id,
                    title
                FROM reports
                WHERE id = ?
                """,
                (report_id,)
            ).fetchone()

            if not report:

                return jsonify({
                    "success": False,
                    "message": "Report not found."
                }), 404

            conn.execute(
                """
                UPDATE reports
                SET
                    status = ?,
                    approval_status = ?
                WHERE id = ?
                """,
                (
                    new_status,
                    new_status,
                    report_id
                )
            )

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    message,
                    type
                )
                VALUES (?, ?, ?)
                """,
                (
                    report["user_id"],
                    (
                        f"Your report "
                        f"'{report['title']}' "
                        f"was {new_status} by admin."
                    ),
                    new_status
                )
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": (
                    f"Report {new_status} successfully."
                )
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "ADMIN APPROVE/REJECT ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not update report.",
            "error": str(e)
        }), 500


# ============================================================
# REPORT STATUS
# ============================================================

@app.route(
    "/api/reports/<int:report_id>/status",
    methods=["PUT", "PATCH", "POST"]
)
@admin_required
def update_report_status(report_id):

    try:

        data = request.get_json(
            silent=True
        ) or {}

        status = str(
            data.get("status", "")
        ).strip().lower()

        allowed = {
            "pending",
            "approved",
            "rejected",
            "resolved",
            "claimed"
        }

        if status not in allowed:

            return jsonify({
                "success": False,
                "message": "Invalid status."
            }), 400

        conn = get_db()

        try:

            report = conn.execute(
                """
                SELECT
                    user_id,
                    title
                FROM reports
                WHERE id = ?
                """,
                (report_id,)
            ).fetchone()

            if not report:

                return jsonify({
                    "success": False,
                    "message": "Report not found."
                }), 404

            approval_status = (
                status
                if status in (
                    "approved",
                    "rejected"
                )
                else "approved"
            )

            conn.execute(
                """
                UPDATE reports
                SET
                    status = ?,
                    approval_status = ?
                WHERE id = ?
                """,
                (
                    status,
                    approval_status,
                    report_id
                )
            )

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    message,
                    type
                )
                VALUES (?, ?, ?)
                """,
                (
                    report["user_id"],
                    (
                        f"Your report "
                        f"'{report['title']}' "
                        f"has been {status}."
                    ),
                    status
                )
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Report status updated."
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "STATUS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not update status.",
            "error": str(e)
        }), 500


# ============================================================
# ADMIN USERS
# ============================================================

@app.route("/api/admin/users")
@admin_required
def admin_users():

    try:

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    role,
                    phone,
                    department,
                    created_at
                FROM users
                ORDER BY id DESC
                """
            ).fetchall()

            return jsonify({
                "success": True,
                "users": [
                    dict(row)
                    for row in rows
                ]
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "ADMIN USERS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load users.",
            "error": str(e)
        }), 500


# ============================================================
# USERS
# ============================================================

@app.route("/api/users")
@login_required
def get_users():

    try:

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    role,
                    phone,
                    department,
                    created_at
                FROM users
                ORDER BY id DESC
                """
            ).fetchall()

            return jsonify({
                "success": True,
                "users": [
                    dict(row)
                    for row in rows
                ]
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "USERS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load users.",
            "error": str(e)
        }), 500


# ============================================================
# ADMIN STATISTICS
# ============================================================

@app.route("/api/admin/stats")
@admin_required
def admin_stats():

    try:

        conn = get_db()

        try:

            total_users = conn.execute(
                "SELECT COUNT(*) AS count FROM users"
            ).fetchone()["count"]

            total_reports = conn.execute(
                "SELECT COUNT(*) AS count FROM reports"
            ).fetchone()["count"]

            lost_items = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM reports
                WHERE type = 'lost'
                """
            ).fetchone()["count"]

            found_items = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM reports
                WHERE type = 'found'
                """
            ).fetchone()["count"]

            pending_reports = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM reports
                WHERE approval_status = 'pending'
                """
            ).fetchone()["count"]

            approved_reports = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM reports
                WHERE approval_status = 'approved'
                """
            ).fetchone()["count"]

            rejected_reports = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM reports
                WHERE approval_status = 'rejected'
                """
            ).fetchone()["count"]

            total_claims = conn.execute(
                "SELECT COUNT(*) AS count FROM claims"
            ).fetchone()["count"]

            return jsonify({
                "success": True,
                "stats": {
                    "total_users": total_users,
                    "total_reports": total_reports,
                    "lost_items": lost_items,
                    "found_items": found_items,
                    "pending_reports": pending_reports,
                    "approved_reports": approved_reports,
                    "rejected_reports": rejected_reports,
                    "total_claims": total_claims
                }
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "STATS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load statistics.",
            "error": str(e)
        }), 500


# ============================================================
# CREATE CLAIM
# ============================================================

@app.route("/api/claims", methods=["POST"])
@login_required
def create_claim():

    try:

        user = get_current_user()

        data = request.get_json(
            silent=True
        ) or {}

        report_id = data.get("report_id")

        message = str(
            data.get("message", "")
        ).strip()

        if not report_id:

            return jsonify({
                "success": False,
                "message": "Report ID is required."
            }), 400

        conn = get_db()

        try:

            report = conn.execute(
                """
                SELECT *
                FROM reports
                WHERE id = ?
                """,
                (report_id,)
            ).fetchone()

            if not report:

                return jsonify({
                    "success": False,
                    "message": "Report not found."
                }), 404

            existing = conn.execute(
                """
                SELECT id
                FROM claims
                WHERE report_id = ?
                AND user_id = ?
                """,
                (
                    report_id,
                    user["id"]
                )
            ).fetchone()

            if existing:

                return jsonify({
                    "success": False,
                    "message": "You already submitted a claim."
                }), 409

            cursor = conn.execute(
                """
                INSERT INTO claims
                (
                    report_id,
                    user_id,
                    message,
                    status
                )
                VALUES (?, ?, ?, ?)
                """,
                (
                    report_id,
                    user["id"],
                    message,
                    "pending"
                )
            )

            admin = conn.execute(
                """
                SELECT id
                FROM users
                WHERE role = 'admin'
                LIMIT 1
                """
            ).fetchone()

            if admin:

                conn.execute(
                    """
                    INSERT INTO notifications
                    (
                        user_id,
                        message,
                        type
                    )
                    VALUES (?, ?, ?)
                    """,
                    (
                        admin["id"],
                        (
                            f"New claim submitted for "
                            f"'{report['title']}'."
                        ),
                        "claim"
                    )
                )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Claim submitted successfully.",
                "claim_id": cursor.lastrowid
            }), 201

        finally:

            conn.close()

    except Exception as e:

        print(
            "CLAIM ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not create claim.",
            "error": str(e)
        }), 500


# ============================================================
# ADMIN CLAIMS
# ============================================================

@app.route("/api/admin/claims")
@admin_required
def admin_claims():

    try:

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT
                    c.*,
                    r.title AS report_title,
                    r.type AS report_type,
                    u.name AS user_name,
                    u.email AS user_email
                FROM claims c
                LEFT JOIN reports r
                    ON c.report_id = r.id
                LEFT JOIN users u
                    ON c.user_id = u.id
                ORDER BY c.id DESC
                """
            ).fetchall()

            return jsonify({
                "success": True,
                "claims": [
                    dict(row)
                    for row in rows
                ]
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "ADMIN CLAIMS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load claims.",
            "error": str(e)
        }), 500


# ============================================================
# CLAIM STATUS
# ============================================================

@app.route(
    "/api/admin/claims/<int:claim_id>/status",
    methods=["PUT", "PATCH", "POST"]
)
@admin_required
def update_claim_status(claim_id):

    try:

        data = request.get_json(
            silent=True
        ) or {}

        status = str(
            data.get("status", "")
        ).strip().lower()

        allowed = {
            "pending",
            "approved",
            "rejected",
            "resolved"
        }

        if status not in allowed:

            return jsonify({
                "success": False,
                "message": "Invalid claim status."
            }), 400

        conn = get_db()

        try:

            claim = conn.execute(
                """
                SELECT *
                FROM claims
                WHERE id = ?
                """,
                (claim_id,)
            ).fetchone()

            if not claim:

                return jsonify({
                    "success": False,
                    "message": "Claim not found."
                }), 404

            conn.execute(
                """
                UPDATE claims
                SET status = ?
                WHERE id = ?
                """,
                (
                    status,
                    claim_id
                )
            )

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    message,
                    type
                )
                VALUES (?, ?, ?)
                """,
                (
                    claim["user_id"],
                    (
                        f"Your claim #{claim_id} "
                        f"has been {status}."
                    ),
                    "claim"
                )
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Claim status updated."
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "CLAIM STATUS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not update claim.",
            "error": str(e)
        }), 500


# ============================================================
# NOTIFICATIONS
# ============================================================

@app.route("/api/notifications")
@login_required
def get_notifications():

    try:

        user = get_current_user()

        conn = get_db()

        try:

            rows = conn.execute(
                """
                SELECT *
                FROM notifications
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT 100
                """,
                (user["id"],)
            ).fetchall()

            return jsonify({
                "success": True,
                "notifications": [
                    dict(row)
                    for row in rows
                ]
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "NOTIFICATION ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not load notifications.",
            "error": str(e)
        }), 500


# ============================================================
# CLEAR NOTIFICATIONS
# ============================================================

@app.route(
    "/api/notifications/clear",
    methods=["POST", "DELETE"]
)
@login_required
def clear_notifications():

    try:

        user = get_current_user()

        conn = get_db()

        try:

            conn.execute(
                """
                UPDATE notifications
                SET is_read = 1
                WHERE user_id = ?
                """,
                (user["id"],)
            )

            conn.commit()

            return jsonify({
                "success": True,
                "message": "Notifications cleared."
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "CLEAR NOTIFICATIONS ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Could not clear notifications.",
            "error": str(e)
        }), 500


# ============================================================
# SIMPLE AI MATCHING
# ============================================================

def fallback_match(
    source_report,
    other_reports
):

    matches = []

    source_text = " ".join([
        str(source_report.get("title", "")),
        str(source_report.get("description", "")),
        str(source_report.get("category", "")),
        str(source_report.get("location", ""))
    ]).lower()

    source_words = {
        word.strip(".,!?")
        for word in source_text.split()
        if len(word.strip(".,!?")) >= 3
    }

    for report in other_reports:

        target_text = " ".join([
            str(report.get("title", "")),
            str(report.get("description", "")),
            str(report.get("category", "")),
            str(report.get("location", ""))
        ]).lower()

        target_words = {
            word.strip(".,!?")
            for word in target_text.split()
            if len(word.strip(".,!?")) >= 3
        }

        common_words = (
            source_words & target_words
        )

        score = len(common_words)

        if (
            source_report.get("category")
            and report.get("category")
            and
            str(
                source_report["category"]
            ).lower()
            ==
            str(
                report["category"]
            ).lower()
        ):

            score += 2

        if (
            source_report.get("location")
            and report.get("location")
            and
            str(
                source_report["location"]
            ).lower()
            ==
            str(
                report["location"]
            ).lower()
        ):

            score += 2

        if score > 0:

            matches.append({
                "report": report,
                "score": score,
                "match_reason":
                    "Similar item details, "
                    "category or location."
            })

    matches.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    return matches[:10]


# ============================================================
# MATCH API
# ============================================================

@app.route(
    "/api/matches",
    methods=["GET", "POST"]
)
@login_required
def get_matches():

    try:

        conn = get_db()

        try:

            if request.method == "POST":

                data = request.get_json(
                    silent=True
                ) or {}

                report_id = data.get(
                    "report_id"
                )

            else:

                report_id = request.args.get(
                    "report_id"
                )

            if report_id:

                source = conn.execute(
                    """
                    SELECT *
                    FROM reports
                    WHERE id = ?
                    """,
                    (report_id,)
                ).fetchone()

            else:

                user = get_current_user()

                source = conn.execute(
                    """
                    SELECT *
                    FROM reports
                    WHERE user_id = ?
                    AND type = 'lost'
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (user["id"],)
                ).fetchone()

            if not source:

                return jsonify({
                    "success": True,
                    "ai_connected": False,
                    "matches": []
                })

            source_dict = dict(source)

            opposite_type = (
                "found"
                if source_dict["type"] == "lost"
                else "lost"
            )

            rows = conn.execute(
                """
                SELECT
                    r.*,
                    u.name AS user_name
                FROM reports r
                LEFT JOIN users u
                    ON r.user_id = u.id
                WHERE r.type = ?
                AND (
                    r.approval_status = 'approved'
                    OR r.approval_status IS NULL
                )
                ORDER BY r.id DESC
                """,
                (opposite_type,)
            ).fetchall()

            other_reports = [
                dict(row)
                for row in rows
            ]

            matches = fallback_match(
                source_dict,
                other_reports
            )

            return jsonify({
                "success": True,
                "ai_connected": False,
                "matches": matches
            })

        finally:

            conn.close()

    except Exception as e:

        print(
            "MATCH ERROR:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "ai_connected": False,
            "matches": [],
            "message": "Matching failed.",
            "error": str(e)
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health")
def health():

    try:

        conn = get_db()

        try:

            conn.execute(
                "SELECT 1"
            ).fetchone()

            return jsonify({
                "success": True,
                "status": "healthy",
                "database": "SQLite",
                "database_file": str(DATABASE)
            })

        finally:

            conn.close()

    except Exception as e:

        return jsonify({
            "success": False,
            "status": "unhealthy",
            "database": "SQLite",
            "error": str(e)
        }), 500


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({
        "success": False,
        "message": "File too large. Maximum size is 10 MB."
    }), 413


@app.errorhandler(404)
def page_not_found(error):

    if request.path.startswith("/api/"):

        return jsonify({
            "success": False,
            "message": "API endpoint not found."
        }), 404

    return render_template(
        "index.html"
    )


@app.errorhandler(500)
def internal_server_error(error):

    print(
        "INTERNAL SERVER ERROR:",
        repr(error)
    )

    return jsonify({
        "success": False,
        "message": "Internal server error."
    }), 500


# ============================================================
# LOCAL RUN
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 60)
    print("          CAMPUSFIND - LOST & FOUND AI")
    print("=" * 60)
    print()
    print("Database :", DATABASE)
    print("Uploads  :", UPLOAD_FOLDER)
    print()

    init_db()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )