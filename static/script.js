"use strict";

/* ============================================================
   CAMPUSFIND - COMPLETE JAVASCRIPT
   Lost & Found + AI Matching + Login + Admin
============================================================ */

let allReports = [];
let currentUser = null;
let toastTimer = null;


/* ============================================================
   PAGE LOAD
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    initializeDateTime();
    initializeDateTimeInputs();
    initializeImagePreview();
    initializeReportForm();
    initializeLogin();

    loadUser();
    loadReports();

});


/* ============================================================
   DATE & TIME
============================================================ */

function initializeDateTime() {

    updateLiveDate();

    setInterval(updateLiveDate, 1000);

}


function updateLiveDate() {

    const element = document.getElementById("liveDate");

    if (!element) return;

    const now = new Date();

    const date = now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const time = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    element.textContent = `${date} • ${time}`;

}


function initializeDateTimeInputs() {

    const dateInput = document.getElementById("itemDate");
    const timeInput = document.getElementById("itemTime");

    const now = new Date();

    if (dateInput && !dateInput.value) {

        const year = now.getFullYear();

        const month = String(
            now.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            now.getDate()
        ).padStart(2, "0");

        dateInput.value =
            `${year}-${month}-${day}`;
    }


    if (timeInput && !timeInput.value) {

        const hours = String(
            now.getHours()
        ).padStart(2, "0");

        const minutes = String(
            now.getMinutes()
        ).padStart(2, "0");

        timeInput.value =
            `${hours}:${minutes}`;
    }

}


/* ============================================================
   NAVIGATION
============================================================ */

function showSection(sectionId, button = null) {

    document
        .querySelectorAll(".section")
        .forEach(section => {

            section.classList.remove(
                "active-section"
            );

        });


    const target =
        document.getElementById(sectionId);


    if (target) {

        target.classList.add(
            "active-section"
        );

    }


    document
        .querySelectorAll(".nav-item")
        .forEach(item => {

            item.classList.remove("active");

        });


    if (button) {

        button.classList.add("active");

    }


    if (sectionId === "dashboard") {
        loadReports();
    }

    if (sectionId === "lost") {
        renderLostReports();
    }

    if (sectionId === "found") {
        renderFoundReports();
    }

    if (sectionId === "ai") {
        loadMatches();
    }

    if (sectionId === "admin") {
        refreshAdminStats();
        loadAdminReports();
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


function showSectionById(sectionId) {

    showSection(sectionId, null);

}


function openReport(type) {

    showSectionById("report");

    const itemType =
        document.getElementById("itemType");

    if (itemType) {

        itemType.value =
            String(type || "").toLowerCase();

    }

}


/* ============================================================
   IMAGE PREVIEW
============================================================ */

function initializeImagePreview() {

    const input =
        document.getElementById("imageInput");

    const preview =
        document.getElementById("imagePreview");

    if (!input || !preview) return;


    input.addEventListener("change", () => {

        preview.innerHTML = "";

        const file = input.files[0];

        if (!file) return;


        if (!file.type.startsWith("image/")) {

            showToast(
                "Please select an image.",
                "error"
            );

            input.value = "";

            return;
        }


        if (file.size > 10 * 1024 * 1024) {

            showToast(
                "Image must be smaller than 10 MB.",
                "error"
            );

            input.value = "";

            return;
        }


        const reader = new FileReader();


        reader.onload = event => {

            preview.innerHTML = `
                <img
                    src="${event.target.result}"
                    class="preview-image"
                    alt="Selected item"
                >
            `;

        };


        reader.readAsDataURL(file);

    });

}


/* ============================================================
   REPORT FORM
============================================================ */

function initializeReportForm() {

    const reportForm =
        document.getElementById("reportForm");

    if (!reportForm) return;


    reportForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const formData =
                new FormData(reportForm);


            const button =
                reportForm.querySelector(
                    "button[type='submit']"
                );


            if (button) {

                button.disabled = true;

                button.textContent =
                    "Submitting...";

            }


            try {

                const response =
                    await fetch(
                        "/api/reports",
                        {
                            method: "POST",
                            body: formData
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok ||
                    !data.success) {

                    throw new Error(
                        data.message ||
                        "Report submission failed."
                    );

                }


                showToast(
                    "Report submitted successfully!",
                    "success"
                );


                reportForm.reset();


                initializeDateTimeInputs();


                const preview =
                    document.getElementById(
                        "imagePreview"
                    );


                if (preview) {

                    preview.innerHTML = "";

                }


                await loadReports();


                /*
                 * AI matching is triggered
                 * after the new report is saved.
                 */

                setTimeout(() => {

                    loadMatches();

                }, 500);


                showSectionById("dashboard");


            } catch (error) {

                console.error(
                    "Report submission error:",
                    error
                );


                showToast(
                    error.message ||
                    "Unable to submit report.",
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled = false;

                    button.innerHTML =
                        "🚀 Submit Report";

                }

            }

        }
    );

}


/* ============================================================
   LOAD REPORTS
============================================================ */

async function loadReports() {

    try {

        const response =
            await fetch("/api/reports");


        if (!response.ok) {

            throw new Error(
                "Unable to load reports."
            );

        }


        const data =
            await response.json();


        if (Array.isArray(data)) {

            allReports = data;

        } else if (
            data &&
            Array.isArray(data.reports)
        ) {

            allReports = data.reports;

        } else {

            allReports = [];

        }


        console.log(
            "CampusFind reports:",
            allReports
        );


        renderRecentReports();
        renderLostReports();
        renderFoundReports();

        updateAdminNumbers();


    } catch (error) {

        console.error(
            "Reports loading error:",
            error
        );


        allReports = [];


        renderRecentReports();
        renderLostReports();
        renderFoundReports();

    }

}


/* ============================================================
   IMAGE URL
============================================================ */

function getImageUrl(image) {

    if (!image) return "";

    image = String(image).trim();

    if (!image) return "";


    if (
        image.startsWith("http://") ||
        image.startsWith("https://")
    ) {

        return image;

    }


    if (image.startsWith("/")) {

        return image;

    }


    return "/uploads/" +
        encodeURIComponent(image);

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ============================================================
   REPORT TYPE
============================================================ */

function getReportType(report) {

    return String(
        report.report_type ||
        report.item_type ||
        ""
    ).trim().toLowerCase();

}


/* ============================================================
   REPORT DATE
============================================================ */

function getReportDate(report) {

    return (
        report.report_date ||
        report.item_date ||
        report.date ||
        "Unknown date"
    );

}


/* ============================================================
   REPORT TIME
============================================================ */

function getReportTime(report) {

    return (
        report.report_time ||
        report.item_time ||
        report.time ||
        "Unknown time"
    );

}


/* ============================================================
   REPORT CARD
============================================================ */

function createReportCard(report) {

    const type =
        getReportType(report);


    const image =
        getImageUrl(report.image);


    const itemName =
        report.item_name ||
        "Unknown Item";


    const category =
        report.category ||
        "Other";


    const location =
        report.location ||
        "Location not specified";


    const description =
        report.description ||
        "No description provided.";


    const date =
        getReportDate(report);


    const time =
        getReportTime(report);


    const imageHTML = image
        ? `
            <img
                src="${escapeHtml(image)}"
                class="report-image"
                alt="${escapeHtml(itemName)}"
                onerror="this.style.display='none';"
            >
          `
        : `
            <div class="report-image-placeholder">
                ${
                    type === "lost"
                        ? "🔴"
                        : "🟢"
                }
            </div>
          `;


    return `
        <div class="report-card">

            <div class="report-card-image">

                ${imageHTML}

                <span class="report-type ${
                    type === "lost"
                        ? "lost"
                        : "found"
                }">

                    ${
                        type === "lost"
                            ? "LOST"
                            : "FOUND"
                    }

                </span>

            </div>


            <div class="report-card-content">

                <h3>
                    ${escapeHtml(itemName)}
                </h3>


                <p class="report-category">
                    ${escapeHtml(category)}
                </p>


                <p class="report-description">
                    ${escapeHtml(description)}
                </p>


                <div class="report-details">

                    <span>
                        📍
                        ${escapeHtml(location)}
                    </span>


                    <span>
                        📅
                        ${escapeHtml(date)}
                    </span>


                    <span>
                        🕐
                        ${escapeHtml(time)}
                    </span>

                </div>

            </div>

        </div>
    `;

}


/* ============================================================
   RECENT REPORTS
============================================================ */

function renderRecentReports() {

    const container =
        document.getElementById(
            "recentReports"
        );


    if (!container) return;


    const reports =
        allReports.slice(0, 6);


    if (!reports.length) {

        container.innerHTML =
            emptyState(
                "No reports yet",
                "Reports will appear here."
            );

        return;

    }


    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   LOST REPORTS
============================================================ */

function renderLostReports() {

    const container =
        document.getElementById(
            "lostReports"
        );


    if (!container) return;


    const reports =
        allReports.filter(
            report =>
                getReportType(report) === "lost"
        );


    if (!reports.length) {

        container.innerHTML =
            emptyState(
                "No lost items",
                "No lost items reported yet."
            );

        return;

    }


    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   FOUND REPORTS
============================================================ */

function renderFoundReports() {

    const container =
        document.getElementById(
            "foundReports"
        );


    if (!container) return;


    const reports =
        allReports.filter(
            report =>
                getReportType(report) === "found"
        );


    if (!reports.length) {

        container.innerHTML =
            emptyState(
                "No found items",
                "No found items reported yet."
            );

        return;

    }


    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   EMPTY STATE
============================================================ */

function emptyState(title, message) {

    return `
        <div class="empty-state">

            <div class="empty-icon">
                📦
            </div>

            <h3>
                ${escapeHtml(title)}
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>
    `;

}


/* ============================================================
   LOGIN
============================================================ */

function initializeLogin() {

    const loginForm =
        document.getElementById(
            "loginForm"
        );


    if (!loginForm) return;


    loginForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const usernameElement =
                document.getElementById(
                    "username"
                );


            const passwordElement =
                document.getElementById(
                    "password"
                );


            const username =
                usernameElement
                    ? usernameElement.value.trim()
                    : "";


            const password =
                passwordElement
                    ? passwordElement.value.trim()
                    : "";


            if (!username || !password) {

                showToast(
                    "Enter username and password.",
                    "error"
                );

                return;

            }


            const button =
                loginForm.querySelector(
                    "button[type='submit']"
                );


            if (button) {

                button.disabled = true;

                button.textContent =
                    "Logging in...";

            }


            try {

                const response =
                    await fetch(
                        "/api/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                username,
                                password
                            })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok ||
                    !data.success) {

                    throw new Error(
                        data.message ||
                        "Login failed."
                    );

                }


                currentUser = {

                    username:
                        data.username ||
                        username,

                    name:
                        data.name ||
                        data.username ||
                        username,

                    user_id:
                        data.user_id || null

                };


                localStorage.setItem(
                    "campusfindUser",
                    JSON.stringify(
                        currentUser
                    )
                );


                updateProfile();

                closeLogin();


                showToast(
                    data.message ||
                    "Login successful!",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                showToast(
                    error.message ||
                    "Unable to connect to server.",
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled = false;

                    button.innerHTML =
                        "🔐 Login";

                }

            }

        }
    );

}


/* ============================================================
   LOAD USER
============================================================ */

async function loadUser() {

    try {

        const response =
            await fetch("/api/me");


        const serverUser =
            await response.json();


        if (
            serverUser &&
            serverUser.logged_in
        ) {

            currentUser = {

                username:
                    serverUser.username,

                name:
                    serverUser.username,

                user_id:
                    serverUser.user_id

            };


            localStorage.setItem(
                "campusfindUser",
                JSON.stringify(
                    currentUser
                )
            );


            updateProfile();

            return;

        }

    } catch (error) {

        console.log(
            "Session check failed:",
            error
        );

    }


    const saved =
        localStorage.getItem(
            "campusfindUser"
        );


    if (!saved) {

        setTimeout(
            openLogin,
            300
        );

        return;

    }


    try {

        currentUser =
            JSON.parse(saved);

        updateProfile();

    } catch (error) {

        localStorage.removeItem(
            "campusfindUser"
        );

        openLogin();

    }

}


/* ============================================================
   PROFILE
============================================================ */

function updateProfile() {

    if (!currentUser) return;


    const name =
        currentUser.name ||
        currentUser.username ||
        "Student";


    const profileName =
        document.getElementById(
            "profileName"
        );


    const avatar =
        document.getElementById(
            "profileAvatar"
        );


    if (profileName) {

        profileName.textContent =
            name;

    }


    if (avatar) {

        avatar.textContent =
            name
                .charAt(0)
                .toUpperCase();

    }

}


/* ============================================================
   LOGIN MODAL
============================================================ */

function openLogin() {

    const modal =
        document.getElementById(
            "loginModal"
        );


    if (modal) {

        modal.classList.add("show");

    }

}


function closeLogin() {

    const modal =
        document.getElementById(
            "loginModal"
        );


    if (modal) {

        modal.classList.remove("show");

    }

}


function togglePassword() {

    const password =
        document.getElementById(
            "password"
        );


    if (!password) return;


    password.type =
        password.type === "password"
            ? "text"
            : "password";

}


/* ============================================================
   LOGOUT
============================================================ */

async function logoutUser() {

    try {

        await fetch(
            "/api/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.log(
            "Logout request error:",
            error
        );

    }


    localStorage.removeItem(
        "campusfindUser"
    );


    currentUser = null;


    showToast(
        "Logged out successfully.",
        "success"
    );


    setTimeout(
        openLogin,
        500
    );

}


/* ============================================================
   NOTIFICATIONS
============================================================ */

function openNotifications() {

    const panel =
        document.getElementById(
            "notificationPanel"
        );


    if (panel) {

        panel.classList.add("show");

    }

}


function closeNotifications() {

    const panel =
        document.getElementById(
            "notificationPanel"
        );


    if (panel) {

        panel.classList.remove("show");

    }

}


function clearNotifications() {

    const count =
        document.getElementById(
            "notificationCount"
        );


    const badge =
        document.querySelector(
            ".nav-badge"
        );


    if (count) {

        count.textContent = "0";

    }


    if (badge) {

        badge.textContent = "0";

    }


    showToast(
        "Notifications marked as read.",
        "success"
    );

}


/* ============================================================
   AI MATCHING
============================================================ */

async function loadMatches() {

    const container =
        document.getElementById(
            "aiMatches"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="empty-state">

            <div class="empty-icon">
                🤖
            </div>

            <h3>
                CampusFind AI is analyzing...
            </h3>

            <p>
                Comparing lost and found reports.
            </p>

        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/matches",
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const data =
            await response.json();


        console.log(
            "CAMPUSFIND AI RESPONSE:",
            data
        );


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "AI matching unavailable."
            );

        }


        if (
            data.ai_connected === true
        ) {

            console.log(
                "Gemini AI is connected."
            );

        } else {

            console.warn(
                "Gemini unavailable. Local matching is being used."
            );

        }


        const matches =
            Array.isArray(data.matches)
                ? data.matches
                : [];


        if (!matches.length) {

            container.innerHTML =
                emptyState(
                    "No possible matches",
                    "CampusFind could not find a matching lost and found item yet."
                );

            return;

        }


        container.innerHTML =
            matches
                .map(createMatchCard)
                .join("");


    } catch (error) {

        console.error(
            "AI matching error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    AI Match unavailable
                </h3>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>
        `;

    }

}


/* ============================================================
   MATCH SCORE
============================================================ */

function getScore(match) {

    let score =
        match.percentage ??
        match.score ??
        match.match_score ??
        match.overall_score ??
        0;


    score = Number(score);


    if (!Number.isFinite(score)) {

        score = 0;

    }


    if (
        score > 0 &&
        score <= 1
    ) {

        score *= 100;

    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    return Math.round(score);

}


/* ============================================================
   MATCH LABEL
============================================================ */

function getMatchLabel(score) {

    if (score >= 90) {

        return "VERY STRONG MATCH";

    }


    if (score >= 75) {

        return "STRONG MATCH";

    }


    if (score >= 60) {

        return "GOOD POSSIBLE MATCH";

    }


    if (score >= 40) {

        return "MODERATE MATCH";

    }


    return "WEAK MATCH";

}


/* ============================================================
   COMPONENT SCORE
============================================================ */

function getComponentScore(match, names) {

    for (const name of names) {

        if (
            match[name] !== undefined &&
            match[name] !== null
        ) {

            let value =
                Number(match[name]);


            if (
                Number.isFinite(value)
            ) {

                if (
                    value > 0 &&
                    value <= 1
                ) {

                    value *= 100;

                }


                return Math.round(
                    Math.max(
                        0,
                        Math.min(
                            100,
                            value
                        )
                    )
                );

            }

        }

    }


    return 0;

}


/* ============================================================
   LOCAL COMPONENT SCORE ESTIMATION
   ============================================================ */

function estimateComponentScores(match) {

    const lostName =
        String(
            match.lost_item || ""
        ).toLowerCase();


    const foundName =
        String(
            match.found_item || ""
        ).toLowerCase();


    const lostCategory =
        String(
            match.lost_category || ""
        ).toLowerCase();


    const foundCategory =
        String(
            match.found_category || ""
        ).toLowerCase();


    const lostLocation =
        String(
            match.lost_location || ""
        ).toLowerCase();


    const foundLocation =
        String(
            match.found_location || ""
        ).toLowerCase();


    const lostDescription =
        String(
            match.lost_description || ""
        ).toLowerCase();


    const foundDescription =
        String(
            match.found_description || ""
        ).toLowerCase();


    const overall =
        getScore(match);


    let categoryScore = 0;
    let locationScore = 0;
    let descriptionScore = 0;
    let imageScore = 0;


    /* CATEGORY */

    if (
        lostCategory &&
        foundCategory
    ) {

        if (
            lostCategory === foundCategory
        ) {

            categoryScore = 100;

        } else {

            categoryScore = 20;

        }

    }


    /* LOCATION */

    if (
        lostLocation &&
        foundLocation
    ) {

        if (
            lostLocation === foundLocation
        ) {

            locationScore = 100;

        } else if (
            lostLocation.includes(foundLocation) ||
            foundLocation.includes(lostLocation)
        ) {

            locationScore = 75;

        } else {

            locationScore = 10;

        }

    }


    /* DESCRIPTION */

    if (
        lostDescription &&
        foundDescription
    ) {

        const lostWords =
            new Set(
                lostDescription
                    .split(/\s+/)
                    .filter(Boolean)
            );


        const foundWords =
            new Set(
                foundDescription
                    .split(/\s+/)
                    .filter(Boolean)
            );


        let common = 0;


        lostWords.forEach(word => {

            if (
                word.length > 2 &&
                foundWords.has(word)
            ) {

                common++;

            }

        });


        if (common >= 5) {

            descriptionScore = 90;

        } else if (common >= 3) {

            descriptionScore = 70;

        } else if (common >= 1) {

            descriptionScore = 40;

        }

    }


    /* IMAGE */

    /*
     * Your current Python backend does not send
     * an image similarity score.
     *
     * Therefore we don't pretend that an image
     * was analyzed.
     */

    imageScore = 0;


    /*
     * If Gemini gives an overall score but no
     * component scores, use the overall score
     * as a visual fallback only for the UI.
     *
     * This is NOT called actual image similarity.
     */

    if (
        !match.image_score &&
        overall >= 80 &&
        lostName &&
        foundName
    ) {

        imageScore = 0;

    }


    return {

        imageScore,
        categoryScore,
        locationScore,
        descriptionScore

    };

}


/* ============================================================
   AI MATCH CARD
============================================================ */

function createMatchCard(match) {

    /*
     * IMPORTANT:
     *
     * Backend returns:
     *
     * lost_item
     * found_item
     * lost_category
     * found_category
     * lost_location
     * found_location
     * lost_description
     * found_description
     * lost_image
     * found_image
     * lost_date
     * found_date
     * lost_time
     * found_time
     *
     * So we build objects here.
     */


    const lost = {

        item_name:
            match.lost_item || "Lost Item",

        category:
            match.lost_category || "Other",

        location:
            match.lost_location || "Unknown location",

        description:
            match.lost_description || "",

        image:
            match.lost_image || "",

        report_date:
            match.lost_date || "Unknown date",

        report_time:
            match.lost_time || "Unknown time"

    };


    const found = {

        item_name:
            match.found_item || "Found Item",

        category:
            match.found_category || "Other",

        location:
            match.found_location || "Unknown location",

        description:
            match.found_description || "",

        image:
            match.found_image || "",

        report_date:
            match.found_date || "Unknown date",

        report_time:
            match.found_time || "Unknown time"

    };


    const score =
        getScore(match);


    const estimated =
        estimateComponentScores(match);


    const imageScore =
        getComponentScore(
            match,
            [
                "image_score",
                "image_similarity",
                "image_match",
                "visual_score"
            ]
        ) ||
        estimated.imageScore;


    const categoryScore =
        getComponentScore(
            match,
            [
                "category_score",
                "category_similarity"
            ]
        ) ||
        estimated.categoryScore;


    const locationScore =
        getComponentScore(
            match,
            [
                "location_score",
                "location_similarity"
            ]
        ) ||
        estimated.locationScore;


    const descriptionScore =
        getComponentScore(
            match,
            [
                "description_score",
                "description_similarity",
                "text_score"
            ]
        ) ||
        estimated.descriptionScore;


    const label =
        getMatchLabel(score);


    const lostImage =
        getImageUrl(
            lost.image
        );


    const foundImage =
        getImageUrl(
            found.image
        );


    return `
        <div class="ai-match-card">

            <!-- =================================================
                 MATCH HEADER
            ================================================== -->

            <div class="match-header">

                <div>

                    <span class="match-label">
                        🤖 ${label}
                    </span>

                    <h3>
                        ${escapeHtml(
                            lost.item_name
                        )}
                    </h3>

                </div>


                <div class="match-score">

                    ${score}%

                    <small>
                        AI Match
                    </small>

                </div>

            </div>


            <!-- =================================================
                 LOST + FOUND
            ================================================== -->

            <div class="match-items">

                <!-- LOST -->

                <div class="match-item">

                    ${
                        lostImage
                            ? `
                                <img
                                    src="${escapeHtml(lostImage)}"
                                    alt="Lost item"
                                    onerror="this.style.display='none';"
                                >
                              `
                            : `
                                <div class="match-placeholder">
                                    🔴
                                </div>
                              `
                    }


                    <strong>
                        🔴 LOST
                    </strong>


                    <p>
                        ${escapeHtml(
                            lost.item_name
                        )}
                    </p>


                    <small>
                        🏷️
                        ${escapeHtml(
                            lost.category
                        )}
                    </small>


                    <small>
                        📍
                        ${escapeHtml(
                            lost.location
                        )}
                    </small>


                    <small>
                        📅
                        ${escapeHtml(
                            lost.report_date
                        )}
                    </small>


                    <small>
                        🕐
                        ${escapeHtml(
                            lost.report_time
                        )}
                    </small>

                </div>


                <!-- MATCH ARROW -->

                <div class="match-arrow">

                    ↔

                    <span>
                        ${score}%
                    </span>

                </div>


                <!-- FOUND -->

                <div class="match-item">

                    ${
                        foundImage
                            ? `
                                <img
                                    src="${escapeHtml(foundImage)}"
                                    alt="Found item"
                                    onerror="this.style.display='none';"
                                >
                              `
                            : `
                                <div class="match-placeholder">
                                    🟢
                                </div>
                              `
                    }


                    <strong>
                        🟢 FOUND
                    </strong>


                    <p>
                        ${escapeHtml(
                            found.item_name
                        )}
                    </p>


                    <small>
                        🏷️
                        ${escapeHtml(
                            found.category
                        )}
                    </small>


                    <small>
                        📍
                        ${escapeHtml(
                            found.location
                        )}
                    </small>


                    <small>
                        📅
                        ${escapeHtml(
                            found.report_date
                        )}
                    </small>


                    <small>
                        🕐
                        ${escapeHtml(
                            found.report_time
                        )}
                    </small>

                </div>

            </div>


            <!-- =================================================
                 AI ANALYSIS
            ================================================== -->

            <div class="match-analysis">

                <h3>
                    🤖 AI Match Analysis
                </h3>


                <div class="analysis-row">

                    <span>
                        📷 Image Similarity
                    </span>

                    <strong>
                        ${imageScore}%
                    </strong>

                </div>


                <div class="analysis-row">

                    <span>
                        🏷️ Category Similarity
                    </span>

                    <strong>
                        ${categoryScore}%
                    </strong>

                </div>


                <div class="analysis-row">

                    <span>
                        📍 Location Similarity
                    </span>

                    <strong>
                        ${locationScore}%
                    </strong>

                </div>


                <div class="analysis-row">

                    <span>
                        📝 Description Similarity
                    </span>

                    <strong>
                        ${descriptionScore}%
                    </strong>

                </div>


                <div class="overall-match">

                    🎯 Overall AI Match

                    <strong>
                        ${score}%
                    </strong>

                </div>

            </div>


            <!-- =================================================
                 REASON
            ================================================== -->

            <div class="match-reason">

                <h3>
                    💡 Why AI matched these items?
                </h3>

                <p>
                    ${escapeHtml(
                        match.reason ||
                        "CampusFind AI compared the item name, category, location and description."
                    )}
                </p>

                <small class="match-method">

                    ${
                        match.method === "Gemini AI"
                            ? "✨ Analyzed by Gemini AI"
                            : "⚙️ Local matching used"
                    }

                </small>

            </div>

        </div>
    `;

}


/* ============================================================
   ADMIN STATISTICS
============================================================ */

async function refreshAdminStats() {

    try {

        const response =
            await fetch(
                "/api/admin/stats"
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "Statistics unavailable."
            );

        }


        setText(
            "adminTotalReports",
            data.total_reports ??
            data.total ??
            0
        );


        setText(
            "adminLostCount",
            data.lost ??
            data.lost_count ??
            0
        );


        setText(
            "adminFoundCount",
            data.found ??
            data.found_count ??
            0
        );


        setText(
            "adminUserCount",
            data.users ??
            data.user_count ??
            0
        );


    } catch (error) {

        console.error(
            "Admin stats error:",
            error
        );


        updateAdminNumbers();

    }

}


/* ============================================================
   UPDATE ADMIN NUMBERS
============================================================ */

function updateAdminNumbers() {

    const lost =
        allReports.filter(
            report =>
                getReportType(report) === "lost"
        ).length;


    const found =
        allReports.filter(
            report =>
                getReportType(report) === "found"
        ).length;


    setText(
        "adminTotalReports",
        allReports.length
    );


    setText(
        "adminLostCount",
        lost
    );


    setText(
        "adminFoundCount",
        found
    );

}


/* ============================================================
   ADMIN REPORTS
============================================================ */

function loadAdminReports() {

    const container =
        document.getElementById(
            "adminReports"
        );


    if (!container) return;


    if (!allReports.length) {

        container.innerHTML =
            emptyState(
                "No reports",
                "There are no reports yet."
            );

        return;

    }


    container.innerHTML =
        allReports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   ADMIN USERS
============================================================ */

async function loadAdminUsers() {

    try {

        const response =
            await fetch(
                "/api/admin/users/count"
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "Unable to load users."
            );

        }


        setText(
            "adminUserCount",
            data.count
        );


        showToast(
            `Registered users: ${data.count}`,
            "success"
        );


    } catch (error) {

        console.error(
            "Admin users error:",
            error
        );


        showToast(
            "Unable to load users.",
            "error"
        );

    }

}


/* ============================================================
   TEST GEMINI
============================================================ */

async function testAI() {

    try {

        const response =
            await fetch(
                "/api/test-ai"
            );


        const data =
            await response.json();


        console.log(
            "Gemini test:",
            data
        );


        if (
            data.success &&
            data.result
        ) {

            showToast(
                `Gemini AI working: ${data.result.percentage}% match`,
                "success"
            );

        } else {

            showToast(
                data.message ||
                "Gemini AI test failed.",
                "error"
            );

        }


        return data;

    } catch (error) {

        console.error(
            "Gemini test error:",
            error
        );


        showToast(
            "Unable to test Gemini AI.",
            "error"
        );

    }

}


/* ============================================================
   TOAST
============================================================ */

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        alert(message);

        return;

    }


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


/* ============================================================
   SET TEXT
============================================================ */

function setText(id, value) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value ?? 0;

    }

}


/* ============================================================
   GLOBAL FUNCTIONS
============================================================ */

window.showSection =
    showSection;

window.showSectionById =
    showSectionById;

window.openReport =
    openReport;

window.openLogin =
    openLogin;

window.closeLogin =
    closeLogin;

window.togglePassword =
    togglePassword;

window.logoutUser =
    logoutUser;

window.openNotifications =
    openNotifications;

window.closeNotifications =
    closeNotifications;

window.clearNotifications =
    clearNotifications;

window.loadAdminReports =
    loadAdminReports;

window.loadAdminUsers =
    loadAdminUsers;

window.refreshAdminStats =
    refreshAdminStats;

window.loadMatches =
    loadMatches;

window.testAI =
    testAI;