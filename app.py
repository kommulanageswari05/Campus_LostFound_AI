import os
import re
import json
import sqlite3
from pathlib import Path
from datetime import datetime

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
from dotenv import load_dotenv


# ============================================================
# GEMINI
# ============================================================

try:
    from google import genai
except ImportError:
    genai = None


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

TEMPLATES_DIR = PROJECT_DIR / "templates"
STATIC_DIR = TEMPLATES_DIR / "static"

UPLOAD_DIR = BASE_DIR / "uploads"
DATABASE = BASE_DIR / "database.db"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# FLASK
# ============================================================

app = Flask(
    __name__,
    template_folder=str(TEMPLATES_DIR),
    static_folder=str(STATIC_DIR),
    static_url_path="/static"
)

app.secret_key = os.getenv(
    "FLASK_SECRET_KEY",
    "campusfind-development-secret-key"
)

CORS(app)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ============================================================
# GEMINI CONFIG
# ============================================================

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY",
    ""
).strip()

gemini_client = None

GEMINI_MODEL = "gemini-2.5-flash"


if genai is None:

    print()
    print("=" * 60)
    print("GEMINI ERROR")
    print("google-genai package is not installed.")
    print()
    print("Run:")
    print("pip install -U google-genai")
    print("=" * 60)
    print()

else:

    if not GEMINI_API_KEY:

        print()
        print("=" * 60)
        print("GEMINI AI: API KEY NOT FOUND")
        print("Check backend/.env")
        print("=" * 60)
        print()

    else:

        try:

            gemini_client = genai.Client(
                api_key=GEMINI_API_KEY
            )

            print()
            print("=" * 60)
            print("GEMINI AI: CONNECTED")
            print("Model:", GEMINI_MODEL)
            print("=" * 60)
            print()

        except Exception as e:

            print()
            print("=" * 60)
            print("GEMINI CONNECTION ERROR")
            print(str(e))
            print("=" * 60)
            print()

            gemini_client = None


# ============================================================
# DATABASE
# ============================================================

def get_db():

    conn = sqlite3.connect(
        DATABASE,
        timeout=15
    )

    conn.row_factory = sqlite3.Row

    conn.execute(
        "PRAGMA busy_timeout = 15000"
    )

    return conn


def table_exists(conn, table_name):

    row = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = ?
        """,
        (table_name,)
    ).fetchone()

    return row is not None


def get_columns(conn, table_name):

    if not table_exists(conn, table_name):
        return []

    rows = conn.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    return [row["name"] for row in rows]


def add_column_if_missing(
    conn,
    table_name,
    column_name,
    column_definition
):

    columns = get_columns(
        conn,
        table_name
    )

    if column_name not in columns:

        conn.execute(
            f"""
            ALTER TABLE {table_name}
            ADD COLUMN {column_name}
            {column_definition}
            """
        )

        print(
            f"Added column {table_name}.{column_name}"
        )


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():

    conn = get_db()

    try:

        # ====================================================
        # USERS
        # ====================================================

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                username TEXT UNIQUE,

                password TEXT,

                name TEXT,

                email TEXT,

                created_at TEXT

            )
            """
        )

        add_column_if_missing(
            conn,
            "users",
            "username",
            "TEXT"
        )

        add_column_if_missing(
            conn,
            "users",
            "password",
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
            "email",
            "TEXT"
        )

        add_column_if_missing(
            conn,
            "users",
            "created_at",
            "TEXT"
        )

        # ====================================================
        # REPORTS
        # ====================================================

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                report_type TEXT,

                item_type TEXT,

                item_name TEXT,

                category TEXT,

                location TEXT,

                description TEXT,

                image TEXT,

                report_date TEXT,

                report_time TEXT,

                created_at TEXT

            )
            """
        )

        columns = [
            ("report_type", "TEXT"),
            ("item_type", "TEXT"),
            ("item_name", "TEXT"),
            ("category", "TEXT"),
            ("location", "TEXT"),
            ("description", "TEXT"),
            ("image", "TEXT"),
            ("report_date", "TEXT"),
            ("report_time", "TEXT"),
            ("created_at", "TEXT")
        ]

        for column_name, definition in columns:

            add_column_if_missing(
                conn,
                "reports",
                column_name,
                definition
            )

        # ====================================================
        # NORMALIZE REPORTS
        # ====================================================

        conn.execute(
            """
            UPDATE reports
            SET report_type = item_type
            WHERE
                (
                    report_type IS NULL
                    OR TRIM(report_type) = ''
                )
                AND item_type IS NOT NULL
                AND TRIM(item_type) != ''
            """
        )

        conn.execute(
            """
            UPDATE reports
            SET item_type = report_type
            WHERE
                (
                    item_type IS NULL
                    OR TRIM(item_type) = ''
                )
                AND report_type IS NOT NULL
                AND TRIM(report_type) != ''
            """
        )

        # ====================================================
        # USER DATE
        # ====================================================

        conn.execute(
            """
            UPDATE users
            SET created_at = ?
            WHERE
                created_at IS NULL
                OR TRIM(created_at) = ''
            """,
            (
                datetime.now().isoformat(
                    timespec="seconds"
                ),
            )
        )

        # ====================================================
        # INDEXES
        # ====================================================

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_reports_report_type
            ON reports(report_type)
            """
        )

        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_reports_item_name
            ON reports(item_name)
            """
        )

        conn.commit()

        print("DATABASE INITIALIZED SUCCESSFULLY")

    except Exception as e:

        conn.rollback()

        print(
            "DATABASE INITIALIZATION ERROR:",
            e
        )

        raise

    finally:

        conn.close()


# ============================================================
# TEXT HELPERS
# ============================================================

def clean_text(value):

    if value is None:
        return ""

    return str(value).strip()


def normalize(value):

    value = clean_text(value).lower()

    value = re.sub(
        r"[^a-z0-9\s]",
        " ",
        value
    )

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value.strip()


def common_words(text1, text2):

    a = set(
        normalize(text1).split()
    )

    b = set(
        normalize(text2).split()
    )

    ignored = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "is",
        "my",
        "this",
        "that",
        "with",
        "in",
        "on",
        "at",
        "of",
        "for"
    }

    a = {
        word
        for word in a
        if word not in ignored
    }

    b = {
        word
        for word in b
        if word not in ignored
    }

    return a & b


# ============================================================
# LOCAL MATCHING
# ============================================================

def fallback_match(lost, found):

    score = 0

    lost_name = normalize(
        lost.get("item_name")
    )

    found_name = normalize(
        found.get("item_name")
    )

    lost_category = normalize(
        lost.get("category")
    )

    found_category = normalize(
        found.get("category")
    )

    lost_location = normalize(
        lost.get("location")
    )

    found_location = normalize(
        found.get("location")
    )

    lost_description = normalize(
        lost.get("description")
    )

    found_description = normalize(
        found.get("description")
    )

    # ========================================================
    # ITEM NAME
    # ========================================================

    if lost_name and found_name:

        if lost_name == found_name:

            score += 40

        else:

            common = common_words(
                lost_name,
                found_name
            )

            if common:

                score += 25

                if len(common) >= 2:
                    score += 10

    # ========================================================
    # CATEGORY
    # ========================================================

    if lost_category and found_category:

        if lost_category == found_category:

            score += 25

    # ========================================================
    # LOCATION
    # ========================================================

    if lost_location and found_location:

        if lost_location == found_location:

            score += 20

        elif (
            lost_location in found_location
            or found_location in lost_location
        ):

            score += 12

    # ========================================================
    # DESCRIPTION
    # ========================================================

    if lost_description and found_description:

        common = common_words(
            lost_description,
            found_description
        )

        if common:

            score += min(
                15,
                len(common) * 3
            )

    return min(
        max(score, 0),
        100
    )


# ============================================================
# GEMINI MATCHING
# ============================================================

def gemini_match(lost, found):

    if gemini_client is None:

        print("GEMINI: Client unavailable")

        return None

    prompt = f"""
You are CampusFind AI, an intelligent college
lost-and-found matching system.

Compare the LOST report and FOUND report.

Determine whether they could represent the SAME
physical item.

LOST REPORT
-----------
Item name: {clean_text(lost.get("item_name"))}
Category: {clean_text(lost.get("category"))}
Location: {clean_text(lost.get("location"))}
Description: {clean_text(lost.get("description"))}
Date: {clean_text(lost.get("report_date"))}
Time: {clean_text(lost.get("report_time"))}

FOUND REPORT
------------
Item name: {clean_text(found.get("item_name"))}
Category: {clean_text(found.get("category"))}
Location: {clean_text(found.get("location"))}
Description: {clean_text(found.get("description"))}
Date: {clean_text(found.get("report_date"))}
Time: {clean_text(found.get("report_time"))}

Consider:

1. Item name similarity
2. Synonyms
3. Category
4. Location
5. Description
6. Color
7. Brand
8. Model
9. Size
10. Other identifying information

Do NOT require exact wording.

Examples:

"black bottle"
and
"Milton black water bottle"
can be a strong match.

"mobile"
and
"Samsung Galaxy phone"
can be a possible match.

"black backpack"
and
"black school bag"
can be a possible match.

"red wallet"
and
"blue notebook"
should be very unlikely.

Percentage:

90-100 = almost certainly same
75-89 = strong match
60-74 = good possible match
40-59 = moderate possibility
20-39 = weak possibility
0-19 = very unlikely

Return ONLY JSON:

{{
    "percentage": 0,
    "reason": "short explanation"
}}
"""

    try:

        print()
        print("-" * 60)
        print("GEMINI MATCH")
        print(
            "LOST:",
            lost.get("item_name")
        )
        print(
            "FOUND:",
            found.get("item_name")
        )
        print("-" * 60)

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        )

        text = clean_text(
            getattr(
                response,
                "text",
                ""
            )
        )

        print(
            "GEMINI RESPONSE:",
            text
        )

        if not text:

            return None

        text = text.replace(
            "```json",
            ""
        )

        text = text.replace(
            "```",
            ""
        )

        text = text.strip()

        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1:

            text = text[
                start:end + 1
            ]

        result = json.loads(text)

        percentage = int(
            result.get(
                "percentage",
                0
            )
        )

        percentage = max(
            0,
            min(
                100,
                percentage
            )
        )

        reason = clean_text(
            result.get(
                "reason",
                "Gemini compared the item details."
            )
        )

        return {
            "percentage": percentage,
            "reason": reason,
            "method": "Gemini AI"
        }

    except Exception as e:

        print()
        print("=" * 60)
        print("GEMINI MATCH ERROR")
        print(str(e))
        print("=" * 60)
        print()

        return None


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return render_template(
        "index.html"
    )


# ============================================================
# GET REPORTS
# ============================================================

@app.route(
    "/api/reports",
    methods=["GET"]
)
def get_reports():

    conn = None

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT
                id,
                report_type,
                item_type,
                item_name,
                category,
                location,
                description,
                image,
                report_date,
                report_time,
                created_at
            FROM reports
            ORDER BY id DESC
            """
        ).fetchall()

        reports = []

        for row in rows:

            item = dict(row)

            if not item.get("report_type"):

                item["report_type"] = (
                    item.get("item_type")
                    or ""
                )

            if not item.get("item_type"):

                item["item_type"] = (
                    item.get("report_type")
                    or ""
                )

            reports.append(item)

        return jsonify(reports)

    except Exception as e:

        print(
            "REPORTS GET ERROR:",
            e
        )

        return jsonify({
            "success": False,
            "message": str(e),
            "reports": []
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# ADD REPORT
# ============================================================

@app.route(
    "/api/reports",
    methods=["POST"]
)
def add_report():

    conn = None

    try:

        report_type = clean_text(
            request.form.get("report_type")
        )

        item_type = clean_text(
            request.form.get("item_type")
        )

        item_name = clean_text(
            request.form.get("item_name")
        )

        category = clean_text(
            request.form.get("category")
        )

        location = clean_text(
            request.form.get("location")
        )

        description = clean_text(
            request.form.get("description")
        )

        # ====================================================
        # FRONTEND COMPATIBILITY
        # ====================================================

        if not report_type:

            report_type = clean_text(
                request.form.get("type")
            )

        if not report_type:

            report_type = clean_text(
                request.form.get("item_status")
            )

        if not report_type and item_type:

            report_type = item_type

        if not item_type and report_type:

            item_type = report_type

        # ====================================================
        # VALIDATION
        # ====================================================

        if report_type.lower() not in [
            "lost",
            "found"
        ]:

            return jsonify({
                "success": False,
                "message": "Report type must be Lost or Found."
            }), 400

        if not item_name:

            return jsonify({
                "success": False,
                "message": "Item name is required."
            }), 400

        # ====================================================
        # IMAGE
        # ====================================================

        image_filename = ""

        image = request.files.get("image")

        if image and image.filename:

            original_name = secure_filename(
                image.filename
            )

            if original_name:

                timestamp = datetime.now().strftime(
                    "%Y%m%d_%H%M%S_%f"
                )

                image_filename = (
                    f"{timestamp}_{original_name}"
                )

                image_path = (
                    UPLOAD_DIR /
                    image_filename
                )

                image.save(image_path)

        # ====================================================
        # DATE / TIME
        # ====================================================

        now = datetime.now()

        report_date = now.strftime(
            "%d %b %Y"
        )

        report_time = now.strftime(
            "%I:%M %p"
        )

        created_at = now.isoformat(
            timespec="seconds"
        )

        # ====================================================
        # INSERT
        # ====================================================

        conn = get_db()

        cursor = conn.execute(
            """
            INSERT INTO reports
            (
                report_type,
                item_type,
                item_name,
                category,
                location,
                description,
                image,
                report_date,
                report_time,
                created_at
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_type,
                item_type,
                item_name,
                category,
                location,
                description,
                image_filename,
                report_date,
                report_time,
                created_at
            )
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Report submitted successfully.",
            "id": cursor.lastrowid,
            "report_type": report_type,
            "item_name": item_name,
            "image": image_filename,
            "report_date": report_date,
            "report_time": report_time
        })

    except sqlite3.Error as e:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": "Database error: " + str(e)
        }), 500

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# UPLOADS
# ============================================================

@app.route(
    "/uploads/<path:filename>"
)
def uploaded_file(filename):

    return send_from_directory(
        UPLOAD_DIR,
        filename
    )


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/api/login",
    methods=["POST"]
)
def login():

    conn = None

    try:

        data = request.get_json(
            silent=True
        ) or {}

        username = clean_text(
            data.get("username")
        )

        password = clean_text(
            data.get("password")
        )

        name = clean_text(
            data.get("name")
        )

        email = clean_text(
            data.get("email")
        )

        if not username or not password:

            return jsonify({
                "success": False,
                "message": "Username and password are required."
            }), 400

        conn = get_db()

        user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE username = ?
            LIMIT 1
            """,
            (username,)
        ).fetchone()

        # ====================================================
        # EXISTING USER
        # ====================================================

        if user:

            stored_password = clean_text(
                user["password"]
            )

            if stored_password != password:

                return jsonify({
                    "success": False,
                    "message": "Incorrect password."
                }), 401

            session["user_id"] = user["id"]
            session["username"] = username

            return jsonify({
                "success": True,
                "message": "Login successful.",
                "username": username,
                "user_id": user["id"]
            })

        # ====================================================
        # NEW USER
        # ====================================================

        if not name:
            name = username

        if not email:
            email = username + "@campusfind.local"

        created_at = datetime.now().isoformat(
            timespec="seconds"
        )

        conn.execute(
            """
            INSERT INTO users
            (
                username,
                password,
                name,
                email,
                created_at
            )
            VALUES
            (?, ?, ?, ?, ?)
            """,
            (
                username,
                password,
                name,
                email,
                created_at
            )
        )

        conn.commit()

        user = conn.execute(
            """
            SELECT id
            FROM users
            WHERE username = ?
            LIMIT 1
            """,
            (username,)
        ).fetchone()

        session["user_id"] = (
            user["id"]
            if user
            else None
        )

        session["username"] = username

        return jsonify({
            "success": True,
            "message": "Account created and login successful.",
            "username": username,
            "user_id": (
                user["id"]
                if user
                else None
            )
        })

    except sqlite3.IntegrityError:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": "Username already exists."
        }), 409

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# LOGOUT
# ============================================================

@app.route(
    "/api/logout",
    methods=["POST"]
)
def logout():

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


# ============================================================
# CURRENT USER
# ============================================================

@app.route(
    "/api/me",
    methods=["GET"]
)
def current_user():

    if "username" not in session:

        return jsonify({
            "logged_in": False
        })

    return jsonify({
        "logged_in": True,
        "username": session.get("username"),
        "user_id": session.get("user_id")
    })


# ============================================================
# AI MATCH CENTER
# ============================================================

@app.route(
    "/api/matches",
    methods=["GET"]
)
def get_matches():

    conn = None

    try:

        conn = get_db()

        rows = conn.execute(
            """
            SELECT *
            FROM reports
            ORDER BY id DESC
            """
        ).fetchall()

        reports = [
            dict(row)
            for row in rows
        ]

        # ====================================================
        # NORMALIZE TYPES
        # ====================================================

        for report in reports:

            if not report.get("report_type"):

                report["report_type"] = (
                    report.get("item_type")
                    or ""
                )

            if not report.get("item_type"):

                report["item_type"] = (
                    report.get("report_type")
                    or ""
                )

        # ====================================================
        # LOST
        # ====================================================

        lost_items = [
            report
            for report in reports
            if normalize(
                report.get("report_type")
            ) == "lost"
        ]

        # ====================================================
        # FOUND
        # ====================================================

        found_items = [
            report
            for report in reports
            if normalize(
                report.get("report_type")
            ) == "found"
        ]

        print()
        print("=" * 60)
        print("CAMPUSFIND AI MATCH CENTER")
        print("LOST ITEMS:", len(lost_items))
        print("FOUND ITEMS:", len(found_items))
        print("=" * 60)

        matches = []

        # ====================================================
        # COMPARE
        # ====================================================

        for lost in lost_items:

            for found in found_items:

                # ------------------------------------------------
                # LOCAL SCORE
                # ------------------------------------------------

                local_score = fallback_match(
                    lost,
                    found
                )

                print(
                    "LOCAL SCORE:",
                    local_score
                )

                # ------------------------------------------------
                # GEMINI
                # ------------------------------------------------

                ai_result = gemini_match(
                    lost,
                    found
                )

                if ai_result:

                    percentage = ai_result[
                        "percentage"
                    ]

                    reason = ai_result[
                        "reason"
                    ]

                    method = "Gemini AI"

                else:

                    percentage = local_score

                    reason = (
                        "Gemini AI was unavailable. "
                        "CampusFind used local matching "
                        "based on item name, category, "
                        "location and description."
                    )

                    method = "Local AI Fallback"

                # ------------------------------------------------
                # MATCH RESULT
                # ------------------------------------------------

                if percentage >= 20:

                    matches.append({

                        "lost_id":
                            lost.get("id"),

                        "found_id":
                            found.get("id"),

                        "lost_item":
                            lost.get("item_name", ""),

                        "found_item":
                            found.get("item_name", ""),

                        "lost_category":
                            lost.get("category", ""),

                        "found_category":
                            found.get("category", ""),

                        "lost_location":
                            lost.get("location", ""),

                        "found_location":
                            found.get("location", ""),

                        "lost_description":
                            lost.get("description", ""),

                        "found_description":
                            found.get("description", ""),

                        "lost_image":
                            lost.get("image", ""),

                        "found_image":
                            found.get("image", ""),

                        "lost_date":
                            lost.get("report_date", ""),

                        "found_date":
                            found.get("report_date", ""),

                        "lost_time":
                            lost.get("report_time", ""),

                        "found_time":
                            found.get("report_time", ""),

                        "percentage":
                            percentage,

                        "reason":
                            reason,

                        "method":
                            method
                    })

        # ====================================================
        # SORT
        # ====================================================

        matches.sort(
            key=lambda item:
                item["percentage"],
            reverse=True
        )

        print(
            "TOTAL MATCHES:",
            len(matches)
        )

        return jsonify({

            "success": True,

            "ai_connected":
                gemini_client is not None,

            "lost_count":
                len(lost_items),

            "found_count":
                len(found_items),

            "match_count":
                len(matches),

            "matches":
                matches
        })

    except Exception as e:

        print(
            "MATCH CENTER ERROR:",
            str(e)
        )

        return jsonify({

            "success": False,

            "ai_connected":
                gemini_client is not None,

            "matches": [],

            "message":
                str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# AI TEST
# ============================================================

@app.route(
    "/api/test-ai",
    methods=["GET"]
)
def test_ai():

    if gemini_client is None:

        return jsonify({

            "success": False,

            "ai_connected": False,

            "message":
                "Gemini client is not connected."
        })

    test_lost = {

        "item_name":
            "black water bottle",

        "category":
            "Bottle",

        "location":
            "College Library",

        "description":
            "Black Milton bottle with silver cap.",

        "report_date":
            "23 Aug 2026",

        "report_time":
            "10:00 AM"
    }

    test_found = {

        "item_name":
            "Milton black bottle",

        "category":
            "Bottle",

        "location":
            "Library",

        "description":
            "Black water bottle with silver cap.",

        "report_date":
            "23 Aug 2026",

        "report_time":
            "11:00 AM"
    }

    result = gemini_match(
        test_lost,
        test_found
    )

    if result:

        return jsonify({

            "success": True,

            "ai_connected": True,

            "result": result
        })

    return jsonify({

        "success": False,

        "ai_connected": True,

        "message":
            "Gemini connected but matching request failed."
    })


# ============================================================
# ADMIN STATS
# ============================================================

@app.route(
    "/api/admin/stats",
    methods=["GET"]
)
def admin_stats():

    conn = None

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
            WHERE LOWER(
                COALESCE(
                    report_type,
                    item_type,
                    ''
                )
            ) = 'lost'
            """
        ).fetchone()["count"]

        found_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM reports
            WHERE LOWER(
                COALESCE(
                    report_type,
                    item_type,
                    ''
                )
            ) = 'found'
            """
        ).fetchone()["count"]

        user_count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM users
            """
        ).fetchone()["count"]

        return jsonify({

            "success": True,

            "total_reports":
                total_reports,

            "lost":
                lost_count,

            "found":
                found_count,

            "users":
                user_count,

            "ai":
                (
                    "Connected"
                    if gemini_client
                    else "Unavailable"
                )
        })

    except Exception as e:

        return jsonify({

            "success": False,

            "message":
                str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# USER COUNT
# ============================================================

@app.route(
    "/api/admin/users/count",
    methods=["GET"]
)
def admin_user_count():

    conn = None

    try:

        conn = get_db()

        count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM users
            """
        ).fetchone()["count"]

        return jsonify({

            "success": True,

            "count": count
        })

    except Exception as e:

        return jsonify({

            "success": False,

            "count": 0,

            "message":
                str(e)
        }), 500

    finally:

        if conn:
            conn.close()


# ============================================================
# HEALTH
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "success": True,

        "application":
            "CampusFind",

        "database":
            DATABASE.exists(),

        "gemini":
            gemini_client is not None,

        "gemini_key_found":
            bool(GEMINI_API_KEY),

        "model":
            GEMINI_MODEL
    })


# ============================================================
# FILE TOO LARGE
# ============================================================

@app.errorhandler(413)
def file_too_large(error):

    return jsonify({

        "success": False,

        "message":
            "Image is too large. Maximum size is 10 MB."
    }), 413


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    init_db()

    print()
    print("=" * 60)
    print("                 CAMPUSFIND")
    print("=" * 60)

    print(
        "Server   : http://127.0.0.1:5000"
    )

    print(
        "Templates:",
        TEMPLATES_DIR
    )

    print(
        "Static   :",
        STATIC_DIR
    )

    print(
        "Uploads  :",
        UPLOAD_DIR
    )

    print(
        "Database :",
        DATABASE
    )

    print(
        "AI       :",
        (
            "Gemini Connected"
            if gemini_client
            else "Gemini Not Connected"
        )
    )

    print("=" * 60)
    print()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        threaded=True
    )