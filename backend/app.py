import os
import sqlite3
from pathlib import Path
from datetime import datetime
from functools import wraps

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
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

ENV_FILE = BASE_DIR / ".env"

TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "uploads"

DATABASE = BASE_DIR / "database.db"


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv(ENV_FILE)

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "campusfind-secret-key-2026"
)

ADMIN_EMAIL = os.getenv(
    "ADMIN_EMAIL",
    "admin@campusfind.com"
).strip().lower()


# ============================================================
# FLASK APP
# ============================================================

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR)
)

app.secret_key = SECRET_KEY

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

CORS(
    app,
    supports_credentials=True
)


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# ALLOWED IMAGE TYPES
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
# DATABASE
# ============================================================

def get_db():

    conn = sqlite3.connect(
        str(DATABASE),
        timeout=30
    )

    conn.row_factory = sqlite3.Row

    conn.execute(
        "PRAGMA foreign_keys = ON"
    )

    conn.execute(
        "PRAGMA busy_timeout = 30000"
    )

    return conn


# ============================================================
# DATABASE MIGRATION
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

    existing_columns = [
        column["name"]
        for column in columns
    ]

    if column_name not in existing_columns:

        conn.execute(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN {column_name} {column_definition}
            """
        )

        print(
            f"Added column {column_name} "
            f"to {table_name}"
        )


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():

    conn = get_db()

    # ========================================================
    # USERS
    # ========================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            username TEXT UNIQUE NOT NULL,

            password TEXT NOT NULL,

            name TEXT,

            email TEXT,

            mobile TEXT,

            role TEXT DEFAULT 'student',

            created_at TEXT

        )
    """)

    add_column_if_missing(
        conn,
        "users",
        "email",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "users",
        "name",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "users",
        "mobile",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "users",
        "role",
        "TEXT DEFAULT 'student'"
    )

    # ========================================================
    # REPORTS
    # ========================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER,

            report_type TEXT NOT NULL,

            item_type TEXT,

            item_name TEXT NOT NULL,

            category TEXT,

            location TEXT,

            description TEXT,

            image TEXT,

            report_date TEXT,

            report_time TEXT,

            status TEXT DEFAULT 'pending',

            created_at TEXT,

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE SET NULL

        )
    """)

    add_column_if_missing(
        conn,
        "reports",
        "user_id",
        "INTEGER"
    )

    add_column_if_missing(
        conn,
        "reports",
        "status",
        "TEXT DEFAULT 'pending'"
    )

    add_column_if_missing(
        conn,
        "reports",
        "item_type",
        "TEXT"
    )

    # ========================================================
    # CLAIMS
    # ========================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS claims (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            report_id INTEGER NOT NULL,

            user_id INTEGER NOT NULL,

            claim_lost_location TEXT,

            claim_item_details TEXT,

            claim_reason TEXT,

            message TEXT,

            ai_match_score REAL DEFAULT 0,

            status TEXT DEFAULT 'pending',

            created_at TEXT,

            FOREIGN KEY(report_id)
                REFERENCES reports(id)
                ON DELETE CASCADE,

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE

        )
    """)

    # --------------------------------------------------------
    # CLAIM MIGRATION
    # --------------------------------------------------------

    add_column_if_missing(
        conn,
        "claims",
        "claim_lost_location",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "claims",
        "claim_item_details",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "claims",
        "claim_reason",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "claims",
        "message",
        "TEXT"
    )

    add_column_if_missing(
        conn,
        "claims",
        "ai_match_score",
        "REAL DEFAULT 0"
    )

    add_column_if_missing(
        conn,
        "claims",
        "status",
        "TEXT DEFAULT 'pending'"
    )

    add_column_if_missing(
        conn,
        "claims",
        "created_at",
        "TEXT"
    )

    # --------------------------------------------------------
    # ONE CLAIM PER USER PER ITEM
    # --------------------------------------------------------

    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_claim_user_report
        ON claims(report_id, user_id)
    """)

    # ========================================================
    # NOTIFICATIONS
    # ========================================================

    conn.execute("""
        CREATE TABLE IF NOT EXISTS notifications (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL,

            title TEXT,

            message TEXT,

            is_read INTEGER DEFAULT 0,

            created_at TEXT,

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE

        )
    """)

    conn.commit()

    # ========================================================
    # ADMIN SECURITY
    # ========================================================

    conn.execute(
        """
        UPDATE users
        SET role = 'student'
        WHERE LOWER(TRIM(COALESCE(email, ''))) != ?
        """,
        (ADMIN_EMAIL,)
    )

    conn.execute(
        """
        UPDATE users
        SET role = 'admin'
        WHERE LOWER(TRIM(COALESCE(email, ''))) = ?
        """,
        (ADMIN_EMAIL,)
    )

    conn.commit()

    conn.close()

    print(
        "DATABASE INITIALIZED:",
        DATABASE
    )

    print(
        "AUTHORIZED ADMIN EMAIL:",
        ADMIN_EMAIL
    )


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user():

    user_id = session.get("user_id")

    if not user_id:
        return None

    conn = get_db()

    user = conn.execute(
        """
        SELECT
            id,
            username,
            name,
            email,
            mobile,
            role,
            created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()

    if not user:
        return None

    return dict(user)


# ============================================================
# LOGIN REQUIRED
# ============================================================

def login_required(fn):

    @wraps(fn)
    def wrapper(*args, **kwargs):

        if not session.get("logged_in"):

            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        user = get_current_user()

        if not user:

            session.clear()

            return jsonify({
                "success": False,
                "message": "Invalid user session."
            }), 401

        return fn(*args, **kwargs)

    return wrapper


# ============================================================
# ADMIN REQUIRED
# ============================================================

def admin_required(fn):

    @wraps(fn)
    def wrapper(*args, **kwargs):

        if not session.get("logged_in"):

            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        user = get_current_user()

        if not user:

            session.clear()

            return jsonify({
                "success": False,
                "message": "Invalid user session."
            }), 401

        user_role = str(
            user.get("role", "student")
        ).strip().lower()

        user_email = str(
            user.get("email", "")
        ).strip().lower()

        if (
            user_role != "admin"
            or user_email != ADMIN_EMAIL
        ):

            return jsonify({
                "success": False,
                "message": "Admin access required."
            }), 403

        return fn(*args, **kwargs)

    return wrapper


# ============================================================
# NORMALIZE REPORT TYPE
# ============================================================

def normalize_report_type(value):

    value = str(
        value or ""
    ).strip().lower()

    if value in [
        "lost",
        "missing"
    ]:
        return "lost"

    if value in [
        "found",
        "recovered"
    ]:
        return "found"

    return value


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return render_template(
        "index.html"
    )


# ============================================================
# UPLOADS
# ============================================================

@app.route(
    "/uploads/<path:filename>"
)
def uploaded_file(filename):

    return send_from_directory(
        str(UPLOAD_DIR),
        filename
    )


# ============================================================
# REGISTER
# ============================================================

@app.route(
    "/api/register",
    methods=["POST"]
)
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

        role = "student"

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
                "message":
                    "Password must contain at least 4 characters."
            }), 400

        conn = get_db()

        existing = conn.execute(
            """
            SELECT id
            FROM users
            WHERE LOWER(email) = ?
            """,
            (email,)
        ).fetchone()

        if existing:

            conn.close()

            return jsonify({
                "success": False,
                "message":
                    "An account with this email already exists."
            }), 409

        base_username = (
            email.split("@")[0]
            .strip()
            .replace(" ", "_")
        )

        if not base_username:
            base_username = "user"

        username = base_username
        counter = 1

        while True:

            existing_username = conn.execute(
                """
                SELECT id
                FROM users
                WHERE username = ?
                """,
                (username,)
            ).fetchone()

            if not existing_username:
                break

            username = (
                f"{base_username}{counter}"
            )

            counter += 1

        password_hash = generate_password_hash(
            password
        )

        created_at = datetime.now().isoformat(
            timespec="seconds"
        )

        cursor = conn.execute(
            """
            INSERT INTO users
            (
                username,
                password,
                name,
                email,
                mobile,
                role,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                password_hash,
                name,
                email,
                "",
                role,
                created_at
            )
        )

        user_id = cursor.lastrowid

        conn.commit()
        conn.close()

        print(
            "NEW STUDENT:",
            email,
            "USERNAME:",
            username
        )

        return jsonify({

            "success": True,

            "message":
                "Account created successfully.",

            "user_id":
                user_id

        }), 201

    except Exception as e:

        print(
            "REGISTER ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Registration failed.",

            "error":
                str(e)

        }), 500


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/api/login",
    methods=["POST"]
)
def login():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        email = str(
            data.get(
                "email",
                ""
            )
        ).strip().lower()

        username = str(
            data.get(
                "username",
                ""
            )
        ).strip()

        password = str(
            data.get(
                "password",
                ""
            )
        )

        login_value = (
            email
            or username
        )

        if not login_value or not password:

            return jsonify({
                "success": False,
                "message":
                    "Email and password are required."
            }), 400

        conn = get_db()

        user = conn.execute(
            """
            SELECT
                id,
                username,
                password,
                name,
                email,
                mobile,
                role,
                created_at
            FROM users
            WHERE LOWER(email) = ?
               OR username = ?
            LIMIT 1
            """,
            (
                login_value.lower(),
                login_value
            )
        ).fetchone()

        if not user:

            conn.close()

            return jsonify({
                "success": False,
                "message":
                    "Invalid email or password."
            }), 401

        stored_password = user["password"]

        password_valid = False

        try:

            password_valid = check_password_hash(
                stored_password,
                password
            )

        except Exception:

            password_valid = (
                stored_password == password
            )

        if not password_valid:

            conn.close()

            return jsonify({
                "success": False,
                "message":
                    "Invalid email or password."
            }), 401

        user_email = str(
            user["email"] or ""
        ).strip().lower()

        if user_email == ADMIN_EMAIL:

            actual_role = "admin"

            conn.execute(
                """
                UPDATE users
                SET role = 'admin'
                WHERE id = ?
                """,
                (user["id"],)
            )

        else:

            actual_role = "student"

            conn.execute(
                """
                UPDATE users
                SET role = 'student'
                WHERE id = ?
                """,
                (user["id"],)
            )

        conn.commit()

        session.clear()

        session["logged_in"] = True
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["role"] = actual_role

        user_data = {

            "id":
                user["id"],

            "username":
                user["username"],

            "name":
                user["name"]
                or user["username"],

            "email":
                user["email"]
                or "",

            "mobile":
                user["mobile"]
                or "",

            "role":
                actual_role,

            "created_at":
                user["created_at"]
                or ""
        }

        conn.close()

        print(
            "LOGIN SUCCESS:",
            user_data["email"],
            "ROLE:",
            actual_role
        )

        return jsonify({

            "success": True,

            "logged_in": True,

            "message":
                "Login successful.",

            "user":
                user_data

        }), 200

    except Exception as e:

        print(
            "LOGIN ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Login failed.",

            "error":
                str(e)

        }), 500


# ============================================================
# CURRENT USER
# ============================================================

@app.route(
    "/api/me",
    methods=["GET"]
)
def me():

    try:

        user = get_current_user()

        if not user:

            return jsonify({

                "success": True,

                "logged_in": False,

                "user": None

            }), 200

        user_email = str(
            user.get("email", "")
        ).strip().lower()

        actual_role = (
            "admin"
            if user_email == ADMIN_EMAIL
            else "student"
        )

        return jsonify({

            "success": True,

            "logged_in": True,

            "user": {
                **user,
                "role": actual_role
            },

            "username":
                user["username"],

            "user_id":
                user["id"],

            "role":
                actual_role

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "message":
                str(e)

        }), 500


# ============================================================
# LOGOUT
# ============================================================

@app.route(
    "/api/logout",
    methods=["POST"]
)
def logout():

    username = session.get(
        "username"
    )

    session.clear()

    print(
        "LOGOUT:",
        username
    )

    return jsonify({

        "success": True,

        "message":
            "Logged out successfully."

    }), 200


# ============================================================
# CREATE REPORT
# ============================================================

@app.route(
    "/api/reports",
    methods=["POST"]
)
@login_required
def create_report():

    try:

        report_type = normalize_report_type(
            request.form.get(
                "report_type"
            )
            or request.form.get(
                "item_type"
            )
        )

        item_type = normalize_report_type(
            request.form.get(
                "item_type"
            )
        )

        item_name = str(
            request.form.get(
                "item_name",
                ""
            )
        ).strip()

        category = str(
            request.form.get(
                "category",
                ""
            )
        ).strip()

        location = str(
            request.form.get(
                "location",
                ""
            )
        ).strip()

        description = str(
            request.form.get(
                "description",
                ""
            )
        ).strip()

        report_date = str(
            request.form.get(
                "item_date",
                ""
            )
        ).strip()

        report_time = str(
            request.form.get(
                "item_time",
                ""
            )
        ).strip()

        if report_type not in {
            "lost",
            "found"
        }:

            return jsonify({

                "success": False,

                "message":
                    "Report type must be Lost or Found."

            }), 400

        if not item_name:

            return jsonify({

                "success": False,

                "message":
                    "Item name is required."

            }), 400

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------

        image_filename = ""

        image = request.files.get(
            "image"
        )

        if image and image.filename:

            if not allowed_file(
                image.filename
            ):

                return jsonify({

                    "success": False,

                    "message":
                        "Only PNG, JPG, JPEG, GIF and WEBP images are allowed."

                }), 400

            original_name = secure_filename(
                image.filename
            )

            timestamp = datetime.now().strftime(
                "%Y%m%d%H%M%S%f"
            )

            image_filename = (
                f"{timestamp}_"
                f"{session['user_id']}_"
                f"{original_name}"
            )

            image.save(
                str(
                    UPLOAD_DIR /
                    image_filename
                )
            )

        created_at = datetime.now().isoformat(
            timespec="seconds"
        )

        conn = get_db()

        cursor = conn.execute(
            """
            INSERT INTO reports
            (
                user_id,
                report_type,
                item_type,
                item_name,
                category,
                location,
                description,
                image,
                report_date,
                report_time,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["user_id"],
                report_type,
                item_type,
                item_name,
                category,
                location,
                description,
                image_filename,
                report_date,
                report_time,
                "pending",
                created_at
            )
        )

        report_id = cursor.lastrowid

        # ----------------------------------------------------
        # NOTIFY ADMIN
        # ----------------------------------------------------

        admin = conn.execute(
            """
            SELECT id
            FROM users
            WHERE LOWER(TRIM(email)) = ?
            LIMIT 1
            """,
            (ADMIN_EMAIL,)
        ).fetchone()

        if admin:

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    is_read,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    admin["id"],
                    "New Report Submitted",
                    (
                        f"New {report_type} report: "
                        f"{item_name}"
                    ),
                    0,
                    created_at
                )
            )

        conn.commit()
        conn.close()

        print(
            "NEW REPORT:",
            report_id
        )

        return jsonify({

            "success": True,

            "message":
                "Report submitted successfully.",

            "report_id":
                report_id

        }), 201

    except Exception as e:

        print(
            "CREATE REPORT ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Could not create report.",

            "error":
                str(e)

        }), 500


# ============================================================
# GET REPORTS
# ============================================================

@app.route(
    "/api/reports",
    methods=["GET"]
)
def get_reports():

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT
                r.id,
                r.user_id,
                r.report_type,
                r.item_type,
                r.item_name,
                r.category,
                r.location,
                r.description,
                r.image,
                r.report_date,
                r.report_time,
                r.status,
                r.created_at,

                u.name AS user_name,
                u.username AS username,
                u.email AS user_email

            FROM reports r

            LEFT JOIN users u
                ON u.id = r.user_id

            ORDER BY r.id DESC
            """
        ).fetchall()

        conn.close()

        reports = []

        for row in rows:

            report = dict(row)

            image_url = ""

            if report.get("image"):

                image_url = (
                    "/uploads/"
                    + report["image"]
                )

            report["image_url"] = image_url

            report["date"] = (
                report.get("report_date")
                or ""
            )

            report["time"] = (
                report.get("report_time")
                or ""
            )

            report["item_date"] = (
                report.get("report_date")
                or ""
            )

            report["item_time"] = (
                report.get("report_time")
                or ""
            )

            report["image"] = image_url

            reports.append(
                report
            )

        return jsonify({

            "success": True,

            "reports":
                reports

        }), 200

    except Exception as e:

        print(
            "GET REPORTS ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Could not load reports.",

            "reports": [],

            "error":
                str(e)

        }), 500


# ============================================================
# ADMIN REPORTS
# ============================================================

@app.route(
    "/api/admin/reports",
    methods=["GET"]
)
@admin_required
def get_admin_reports():

    return get_reports()


# ============================================================
# UPDATE REPORT STATUS
# ============================================================

@app.route(
    "/api/reports/<int:report_id>/status",
    methods=["PUT", "POST", "PATCH"]
)
@admin_required
def update_report_status(report_id):

    try:

        data = request.get_json(
            silent=True
        ) or {}

        status = str(
            data.get(
                "status",
                ""
            )
        ).strip().lower()

        allowed_statuses = {
            "pending",
            "approved",
            "rejected",
            "resolved"
        }

        if status not in allowed_statuses:

            return jsonify({

                "success": False,

                "message":
                    "Invalid report status."

            }), 400

        conn = get_db()

        report = conn.execute(
            """
            SELECT
                id,
                item_name,
                user_id,
                status
            FROM reports
            WHERE id = ?
            """,
            (report_id,)
        ).fetchone()

        if not report:

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "Report not found."

            }), 404

        old_status = report["status"]

        conn.execute(
            """
            UPDATE reports
            SET status = ?
            WHERE id = ?
            """,
            (
                status,
                report_id
            )
        )

        if report["user_id"]:

            created_at = datetime.now().isoformat(
                timespec="seconds"
            )

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    is_read,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    report["user_id"],
                    "Report Status Updated",
                    (
                        f"Your report "
                        f"'{report['item_name']}' "
                        f"is now {status}."
                    ),
                    0,
                    created_at
                )
            )

        conn.commit()
        conn.close()

        print(
            "REPORT STATUS UPDATED:",
            report_id,
            old_status,
            "->",
            status
        )

        return jsonify({

            "success": True,

            "message":
                f"Report {status} successfully.",

            "report_id":
                report_id,

            "status":
                status

        }), 200

    except Exception as e:

        print(
            "UPDATE REPORT ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Could not update report.",

            "error":
                str(e)

        }), 500


# ============================================================
# SECOND ADMIN REPORT URL
# ============================================================

@app.route(
    "/api/admin/reports/<int:report_id>",
    methods=["PUT", "POST", "PATCH"]
)
@admin_required
def update_admin_report_status(report_id):

    return update_report_status(
        report_id
    )


# ============================================================
# ADMIN USERS
# ============================================================

@app.route(
    "/api/admin/users",
    methods=["GET"]
)
@admin_required
def get_admin_users():

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT
                id,
                username,
                name,
                email,
                mobile,
                role,
                created_at
            FROM users
            ORDER BY id DESC
            """
        ).fetchall()

        conn.close()

        users = [
            dict(row)
            for row in rows
        ]

        return jsonify({

            "success": True,

            "users":
                users

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "users": [],

            "error":
                str(e)

        }), 500


# ============================================================
# USERS
# ============================================================

@app.route(
    "/api/users",
    methods=["GET"]
)
@admin_required
def get_users():

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT
                id,
                username,
                name,
                email,
                mobile,
                role,
                created_at
            FROM users
            ORDER BY id DESC
            """
        ).fetchall()

        conn.close()

        users = [
            dict(row)
            for row in rows
        ]

        return jsonify({

            "success": True,

            "users":
                users

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "users": [],

            "message":
                "Could not load users.",

            "error":
                str(e)

        }), 500


# ============================================================
# ADMIN STATS
# ============================================================

@app.route(
    "/api/admin/stats",
    methods=["GET"]
)
@admin_required
def admin_stats():

    try:

        conn = get_db()

        total_reports = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM reports
            """
        ).fetchone()["count"]

        lost_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM reports
            WHERE report_type = 'lost'
            """
        ).fetchone()["count"]

        found_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM reports
            WHERE report_type = 'found'
            """
        ).fetchone()["count"]

        user_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM users
            """
        ).fetchone()["count"]

        conn.close()

        return jsonify({

            "success": True,

            "total_reports":
                total_reports,

            "lost_count":
                lost_count,

            "found_count":
                found_count,

            "user_count":
                user_count

        }), 200

    except Exception as e:

        print(
            "ADMIN STATS ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "total_reports": 0,

            "lost_count": 0,

            "found_count": 0,

            "user_count": 0,

            "error":
                str(e)

        }), 500


# ============================================================
# CREATE CLAIM
# ============================================================

@app.route(
    "/api/claims",
    methods=["POST"]
)
@login_required
def create_claim():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        report_id = data.get(
            "report_id"
        )

        claim_lost_location = str(
            data.get(
                "claim_lost_location",
                ""
            )
        ).strip()

        claim_item_details = str(
            data.get(
                "claim_item_details",
                ""
            )
        ).strip()

        claim_reason = str(
            data.get(
                "claim_reason",
                ""
            )
        ).strip()

        if not report_id:

            return jsonify({

                "success": False,

                "message":
                    "Report ID is required."

            }), 400

        if not claim_lost_location:

            return jsonify({

                "success": False,

                "message":
                    "Please enter where you lost the item."

            }), 400

        if not claim_item_details:

            return jsonify({

                "success": False,

                "message":
                    "Please enter unique identifying details."

            }), 400

        if not claim_reason:

            return jsonify({

                "success": False,

                "message":
                    "Please explain why you think this is your item."

            }), 400

        conn = get_db()

        report = conn.execute(
            """
            SELECT
                id,
                user_id,
                item_name,
                item_type,
                report_type,
                category,
                location,
                description
            FROM reports
            WHERE id = ?
            """,
            (report_id,)
        ).fetchone()

        if not report:

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "Report not found."

            }), 404

        report_type = normalize_report_type(
            report["report_type"]
        )

        if report_type != "found":

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "Only found items can be claimed."

            }), 400

        if (
            report["user_id"]
            == session["user_id"]
        ):

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "You cannot claim your own report."

            }), 400

        existing = conn.execute(
            """
            SELECT
                id,
                status
            FROM claims
            WHERE report_id = ?
              AND user_id = ?
            """,
            (
                report_id,
                session["user_id"]
            )
        ).fetchone()

        if existing:

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "You already submitted a claim for this item."

            }), 409

        # ----------------------------------------------------
        # CLAIM AI MATCH
        # ----------------------------------------------------

        claim_text = (
            claim_lost_location
            + " "
            + claim_item_details
            + " "
            + claim_reason
        ).lower()

        found_text = (
            str(report["item_name"] or "")
            + " "
            + str(report["category"] or "")
            + " "
            + str(report["location"] or "")
            + " "
            + str(report["description"] or "")
        ).lower()

        claim_words = set(
            claim_text.split()
        )

        found_words = set(
            found_text.split()
        )

        ignored_words = {
            "the",
            "and",
            "or",
            "is",
            "my",
            "a",
            "an",
            "this",
            "that",
            "was",
            "in",
            "at",
            "to",
            "of",
            "on",
            "with",
            "for"
        }

        common_words = (
            claim_words
            & found_words
        )

        meaningful_common_words = {
            word
            for word in common_words
            if len(word) >= 3
            and word not in ignored_words
        }

        ai_score = min(
            len(meaningful_common_words) * 10,
            100
        )

        item_name = str(
            report["item_name"] or ""
        ).lower()

        category = str(
            report["category"] or ""
        ).lower()

        location = str(
            report["location"] or ""
        ).lower()

        if (
            item_name
            and item_name in claim_text
        ):
            ai_score += 30

        if (
            category
            and category in claim_text
        ):
            ai_score += 15

        if (
            location
            and location in claim_text
        ):
            ai_score += 15

        ai_score = min(
            ai_score,
            100
        )

        # ----------------------------------------------------
        # COMBINED MESSAGE
        # ----------------------------------------------------

        message = (
            "Where did you lose the item:\n"
            + claim_lost_location
            + "\n\n"
            "Unique Identifying Details:\n"
            + claim_item_details
            + "\n\n"
            "Why do you think this is your item:\n"
            + claim_reason
        )

        created_at = datetime.now().isoformat(
            timespec="seconds"
        )

        cursor = conn.execute(
            """
            INSERT INTO claims
            (
                report_id,
                user_id,
                claim_lost_location,
                claim_item_details,
                claim_reason,
                message,
                ai_match_score,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_id,
                session["user_id"],
                claim_lost_location,
                claim_item_details,
                claim_reason,
                message,
                ai_score,
                "pending",
                created_at
            )
        )

        claim_id = cursor.lastrowid

        # ----------------------------------------------------
        # FIND ADMIN
        # ----------------------------------------------------

        admin = conn.execute(
            """
            SELECT id
            FROM users
            WHERE LOWER(TRIM(email)) = ?
            LIMIT 1
            """,
            (ADMIN_EMAIL,)
        ).fetchone()

        # ----------------------------------------------------
        # ADMIN NOTIFICATION
        # ----------------------------------------------------

        if admin:

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    is_read,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    admin["id"],
                    "New Claim Request",
                    (
                        f"New claim submitted for "
                        f"'{report['item_name']}'. "
                        f"AI Match: {ai_score}%."
                    ),
                    0,
                    created_at
                )
            )

        conn.commit()
        conn.close()

        print(
            "NEW CLAIM:",
            claim_id,
            "REPORT:",
            report_id,
            "AI SCORE:",
            ai_score
        )

        return jsonify({

            "success": True,

            "message":
                "Claim submitted successfully.",

            "claim_id":
                claim_id,

            "ai_match_score":
                ai_score,

            "status":
                "pending"

        }), 201

    except Exception as e:

        print(
            "CREATE CLAIM ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Could not submit claim.",

            "error":
                str(e)

        }), 500


# ============================================================
# ADMIN - GET CLAIMS
# ============================================================

@app.route(
    "/api/admin/claims",
    methods=["GET"]
)
@admin_required
def get_admin_claims():

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT

                c.id AS claim_id,

                c.report_id,

                c.user_id,

                c.claim_lost_location,

                c.claim_item_details,

                c.claim_reason,

                c.message,

                c.ai_match_score,

                c.status AS claim_status,

                c.created_at AS claim_created_at,

                u.name AS claimant_name,

                u.email AS claimant_email,

                u.mobile AS claimant_mobile,

                u.username AS claimant_username,

                r.item_name,

                r.item_type,

                r.report_type,

                r.category,

                r.location AS found_location,

                r.description AS found_description,

                r.image,

                r.report_date,

                r.report_time,

                r.status AS report_status

            FROM claims c

            INNER JOIN users u
                ON u.id = c.user_id

            INNER JOIN reports r
                ON r.id = c.report_id

            ORDER BY
                c.created_at DESC,
                c.id DESC
            """
        ).fetchall()

        conn.close()

        claims = []

        for row in rows:

            claim = dict(row)

            if claim.get("image"):

                claim["image_url"] = (
                    "/uploads/"
                    + claim["image"]
                )

            else:

                claim["image_url"] = ""

            try:

                claim["ai_match_score"] = float(
                    claim.get(
                        "ai_match_score"
                    ) or 0
                )

            except Exception:

                claim["ai_match_score"] = 0

            claims.append(
                claim
            )

        return jsonify({

            "success": True,

            "claims":
                claims

        }), 200

    except Exception as e:

        print(
            "GET ADMIN CLAIMS ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "claims": [],

            "message":
                "Could not load claim requests.",

            "error":
                str(e)

        }), 500


# ============================================================
# ADMIN - APPROVE / REJECT CLAIM
# ============================================================

@app.route(
    "/api/admin/claims/<int:claim_id>/status",
    methods=["PUT", "POST", "PATCH"]
)
@admin_required
def update_claim_status(claim_id):

    try:

        data = request.get_json(
            silent=True
        ) or {}

        status = str(
            data.get(
                "status",
                ""
            )
        ).strip().lower()

        if status not in {
            "approved",
            "rejected"
        }:

            return jsonify({

                "success": False,

                "message":
                    "Claim status must be approved or rejected."

            }), 400

        conn = get_db()

        claim = conn.execute(
            """
            SELECT

                c.id,
                c.report_id,
                c.user_id,
                c.status,
                c.ai_match_score,

                r.item_name

            FROM claims c

            INNER JOIN reports r
                ON r.id = c.report_id

            WHERE c.id = ?

            LIMIT 1
            """,
            (claim_id,)
        ).fetchone()

        if not claim:

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    "Claim not found."

            }), 404

        if claim["status"] in {
            "approved",
            "rejected"
        }:

            conn.close()

            return jsonify({

                "success": False,

                "message":
                    f"This claim is already {claim['status']}."

            }), 409

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

        created_at = datetime.now().isoformat(
            timespec="seconds"
        )

        # ----------------------------------------------------
        # STUDENT NOTIFICATION
        # ----------------------------------------------------

        if claim["user_id"]:

            if status == "approved":

                title = "Claim Approved"

                message = (
                    f"Your claim for "
                    f"'{claim['item_name']}' "
                    f"has been approved by the administrator."
                )

            else:

                title = "Claim Rejected"

                message = (
                    f"Your claim for "
                    f"'{claim['item_name']}' "
                    f"has been rejected by the administrator."
                )

            conn.execute(
                """
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    is_read,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    claim["user_id"],
                    title,
                    message,
                    0,
                    created_at
                )
            )

        # ----------------------------------------------------
        # APPROVED ITEM = RESOLVED
        # ----------------------------------------------------

        if status == "approved":

            conn.execute(
                """
                UPDATE reports
                SET status = 'resolved'
                WHERE id = ?
                """,
                (
                    claim["report_id"],
                )
            )

        conn.commit()
        conn.close()

        print(
            "CLAIM STATUS UPDATED:",
            claim_id,
            "->",
            status
        )

        return jsonify({

            "success": True,

            "message":
                f"Claim {status} successfully.",

            "claim_id":
                claim_id,

            "status":
                status

        }), 200

    except Exception as e:

        print(
            "UPDATE CLAIM ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "message":
                "Could not update claim.",

            "error":
                str(e)

        }), 500


# ============================================================
# NOTIFICATIONS
# ============================================================

@app.route(
    "/api/notifications",
    methods=["GET"]
)
@login_required
def get_notifications():

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT
                id,
                title,
                message,
                is_read,
                created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 50
            """,
            (
                session["user_id"],
            )
        ).fetchall()

        conn.close()

        notifications = [
            dict(row)
            for row in rows
        ]

        return jsonify({

            "success": True,

            "notifications":
                notifications

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "notifications": [],

            "error":
                str(e)

        }), 500


# ============================================================
# CLEAR NOTIFICATIONS
# ============================================================

@app.route(
    "/api/notifications/clear",
    methods=["POST"]
)
@login_required
def clear_notifications():

    try:

        conn = get_db()

        conn.execute(
            """
            DELETE FROM notifications
            WHERE user_id = ?
            """,
            (
                session["user_id"],
            )
        )

        conn.commit()
        conn.close()

        return jsonify({

            "success": True,

            "message":
                "Notifications cleared."

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "message":
                "Could not clear notifications.",

            "error":
                str(e)

        }), 500


# ============================================================
# AI FALLBACK MATCH
# ============================================================

def fallback_match(
    lost_item,
    found_item
):

    score = 0

    lost_name = str(
        lost_item.get(
            "item_name",
            ""
        )
    ).lower()

    found_name = str(
        found_item.get(
            "item_name",
            ""
        )
    ).lower()

    lost_category = str(
        lost_item.get(
            "category",
            ""
        )
    ).lower()

    found_category = str(
        found_item.get(
            "category",
            ""
        )
    ).lower()

    lost_location = str(
        lost_item.get(
            "location",
            ""
        )
    ).lower()

    found_location = str(
        found_item.get(
            "location",
            ""
        )
    ).lower()

    # --------------------------------------------------------
    # NAME
    # --------------------------------------------------------

    if (
        set(lost_name.split())
        &
        set(found_name.split())
    ):
        score += 40

    # --------------------------------------------------------
    # CATEGORY
    # --------------------------------------------------------

    if (
        lost_category
        and found_category
        and lost_category == found_category
    ):
        score += 30

    # --------------------------------------------------------
    # LOCATION
    # --------------------------------------------------------

    if (
        lost_location
        and found_location
        and (
            lost_location in found_location
            or found_location in lost_location
        )
    ):
        score += 20

    # --------------------------------------------------------
    # DESCRIPTION
    # --------------------------------------------------------

    lost_description = str(
        lost_item.get(
            "description",
            ""
        )
    ).lower()

    found_description = str(
        found_item.get(
            "description",
            ""
        )
    ).lower()

    if (
        set(lost_description.split())
        &
        set(found_description.split())
    ):
        score += 10

    return min(
        score,
        100
    )


# ============================================================
# AI MATCHES
# ============================================================

@app.route(
    "/api/matches",
    methods=["GET"]
)
def get_matches():

    try:

        conn = get_db()

        lost_rows = conn.execute(
            """
            SELECT *
            FROM reports
            WHERE report_type = 'lost'
            AND status != 'rejected'
            ORDER BY id DESC
            """
        ).fetchall()

        found_rows = conn.execute(
            """
            SELECT *
            FROM reports
            WHERE report_type = 'found'
            AND status != 'rejected'
            ORDER BY id DESC
            """
        ).fetchall()

        conn.close()

        lost_items = [
            dict(row)
            for row in lost_rows
        ]

        found_items = [
            dict(row)
            for row in found_rows
        ]

        matches = []

        for lost in lost_items:

            for found in found_items:

                score = fallback_match(
                    lost,
                    found
                )

                if score >= 20:

                    matches.append({

                        "lost":
                            lost,

                        "found":
                            found,

                        "score":
                            score,

                        "match_score":
                            score,

                        "confidence":
                            f"{score}%"

                    })

        matches.sort(
            key=lambda x: x["score"],
            reverse=True
        )

        return jsonify({

            "success": True,

            "matches":
                matches

        }), 200

    except Exception as e:

        print(
            "MATCH ERROR:",
            repr(e)
        )

        return jsonify({

            "success": False,

            "matches": [],

            "message":
                "Could not calculate matches.",

            "error":
                str(e)

        }), 500


# ============================================================
# HEALTH
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    try:

        conn = get_db()

        conn.execute(
            "SELECT 1"
        ).fetchone()

        conn.close()

        return jsonify({

            "success": True,

            "status":
                "healthy",

            "database":
                "SQLite",

            "database_file":
                str(DATABASE),

            "timestamp":
                datetime.now().isoformat()

        }), 200

    except Exception as e:

        return jsonify({

            "success": False,

            "status":
                "error",

            "error":
                str(e)

        }), 500


# ============================================================
# 413 ERROR
# ============================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({

        "success": False,

        "message":
            "File is too large. Maximum size is 10 MB."

    }), 413


# ============================================================
# 404 ERROR
# ============================================================

@app.errorhandler(404)
def page_not_found(error):

    if request.path.startswith(
        "/api/"
    ):

        return jsonify({

            "success": False,

            "message":
                "API endpoint not found.",

            "path":
                request.path

        }), 404

    return (
        "Page not found.",
        404
    )


# ============================================================
# 500 ERROR
# ============================================================

@app.errorhandler(500)
def internal_server_error(error):

    return jsonify({

        "success": False,

        "message":
            "Internal server error."

    }), 500


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    print("=" * 60)

    print(
        "       CAMPUSFIND | LOST & FOUND AI"
    )

    print("=" * 60)

    print(
        "Database:",
        DATABASE
    )

    print(
        "Uploads:",
        UPLOAD_DIR
    )

    print(
        "Templates:",
        TEMPLATES_DIR
    )

    print(
        "Static:",
        STATIC_DIR
    )

    print(
        "Authorized Admin:",
        ADMIN_EMAIL
    )

    print("=" * 60)

    init_db()

    print(
        "Server running at:"
    )

    print(
        "http://127.0.0.1:5000"
    )

    print("=" * 60)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )