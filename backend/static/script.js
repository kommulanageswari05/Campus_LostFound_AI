/* ============================================================
   CAMPUSFIND - LOST & FOUND AI
   COMPLETE SCRIPT.JS

   Modules:
   - Login
   - Register
   - Logout
   - Dashboard
   - Lost Items
   - Found Items
   - Report Item
   - Image Preview
   - AI Match
   - Claim Item
   - Notifications
   - Admin Panel
   - Admin Report Approve / Reject
   - Admin Claim Approve / Reject
   - Admin Users
============================================================ */

"use strict";


/* ============================================================
   GLOBAL VARIABLES
============================================================ */

const API_BASE = "/api";

let currentUser = null;

let allReports = [];

let allMatches = [];

let allNotifications = [];

let allAdminClaims = [];

let allAdminUsers = [];

let currentAdminFilter = "all";

let isLoggingOut = false;


/* ============================================================
   DOM READY
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    console.log("CampusFind script loaded.");

    updateDateTime();

    setInterval(updateDateTime, 1000);

    setupReportForm();

    setupImagePreview();

    setupLoginForm();

    setupRegisterForm();

    setupClaimForm();

    loadUser();

});


/* ============================================================
   SAFE ELEMENT
============================================================ */

function getElement(id) {

    return document.getElementById(id);

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    if (value === null || value === undefined) {
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
   CAPITALIZE
============================================================ */

function capitalize(value) {

    if (!value) return "";

    const text = String(value);

    return text.charAt(0).toUpperCase() +
           text.slice(1);

}


/* ============================================================
   API REQUEST
============================================================ */

async function apiRequest(
    endpoint,
    options = {}
) {

    const config = {
        credentials: "include",
        ...options
    };

    if (
        config.body &&
        !(config.body instanceof FormData) &&
        typeof config.body !== "string"
    ) {

        config.headers = {
            ...(config.headers || {}),
            "Content-Type": "application/json"
        };

        config.body =
            JSON.stringify(config.body);

    }

    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            config
        );

    let data = null;

    const contentType =
        response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {

        data = await response.json();

    } else {

        const text =
            await response.text();

        data = {
            success: response.ok,
            message: text
        };

    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            `Request failed with status ${response.status}`
        );

    }

    return data;

}


/* ============================================================
   DATE / TIME
============================================================ */

function updateDateTime() {

    const element =
        getElement("currentDateTime");

    if (!element) return;

    const now = new Date();

    element.textContent =
        now.toLocaleString(
            "en-IN",
            {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

}


/* ============================================================
   LOAD CURRENT USER
============================================================ */

async function loadUser() {

    try {

        const data =
            await apiRequest(
                "/me",
                {
                    method: "GET"
                }
            );

        if (
            data &&
            data.success &&
            data.user
        ) {

            currentUser =
                data.user;

            localStorage.setItem(
                "campusfindUser",
                JSON.stringify(currentUser)
            );

            showLoggedInUI();

            await loadApplicationData();

            return;

        }

    } catch (error) {

        console.log(
            "No active server session.",
            error.message
        );

    }

    currentUser = null;

    showLoggedOutUI();

}


/* ============================================================
   SHOW LOGGED-IN UI
============================================================ */

function showLoggedInUI() {

    const loginScreen =
        getElement("loginFirstScreen");

    if (loginScreen) {

        loginScreen.style.display =
            "none";

    }

    updateUserUI();

    if (isAdminUser()) {

        showAdminMenu();

    } else {

        hideAdminMenu();

    }

}


/* ============================================================
   SHOW LOGGED-OUT UI
============================================================ */

function showLoggedOutUI() {

    currentUser = null;

    const loginScreen =
        getElement("loginFirstScreen");

    if (loginScreen) {

        loginScreen.style.display =
            "flex";

    }

    hideAdminMenu();

}


/* ============================================================
   LOAD APPLICATION DATA
============================================================ */

async function loadApplicationData() {

    await Promise.allSettled([

        loadReports(),

        loadMatches(),

        loadNotifications()

    ]);

    if (isAdminUser()) {

        await Promise.allSettled([

            loadAdminReports(),

            loadAdminClaims(),

            loadAdminUsers(),

            refreshAdminStats()

        ]);

    }

}


/* ============================================================
   USER UI
============================================================ */

function updateUserUI() {

    if (!currentUser) return;

    const name =
        currentUser.name ||
        currentUser.username ||
        currentUser.email ||
        "User";

    const role =
        currentUser.role ||
        currentUser.user_role ||
        "student";

    const avatar =
        getElement("userAvatar");

    const nameElement =
        getElement("sidebarUserName");

    const roleElement =
        getElement("sidebarUserRole");

    if (avatar) {

        avatar.textContent =
            name.charAt(0).toUpperCase();

    }

    if (nameElement) {

        nameElement.textContent =
            name;

    }

    if (roleElement) {

        roleElement.textContent =
            capitalize(role);

    }

}


/* ============================================================
   ADMIN CHECK
============================================================ */

function isAdminUser() {

    if (!currentUser) {

        return false;

    }

    const role =
        String(
            currentUser.role ||
            currentUser.user_role ||
            ""
        ).toLowerCase();

    const email =
        String(
            currentUser.email ||
            ""
        ).toLowerCase();

    return (
        role === "admin" ||
        role === "administrator" ||
        email === "admin@campusfind.com"
    );

}


/* ============================================================
   ADMIN MENU
============================================================ */

function showAdminMenu() {

    document
        .querySelectorAll(".admin-only")
        .forEach(element => {

            element.style.display =
                "flex";

        });

}


function hideAdminMenu() {

    document
        .querySelectorAll(".admin-only")
        .forEach(element => {

            element.style.display =
                "none";

        });

}


/* ============================================================
   SECTION NAVIGATION
============================================================ */

function showSection(sectionName) {

    if (!currentUser) {

        showLogin();

        showToast(
            "Please login first.",
            "error"
        );

        return;

    }

    if (
        sectionName === "admin" &&
        !isAdminUser()
    ) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    document
        .querySelectorAll(".section")
        .forEach(section => {

            section.classList.remove("active");

            section.style.display =
                "none";

        });

    const section =
        getElement(sectionName);

    if (!section) return;

    section.classList.add("active");

    section.style.display =
        "block";

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.remove("active");

        });

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            const onclick =
                button.getAttribute("onclick") || "";

            if (
                onclick.includes(
                    `showSection('${sectionName}')`
                )
            ) {

                button.classList.add("active");

            }

        });


    /* Section-specific refresh */

    if (sectionName === "dashboard") {

        loadReports();

    }

    if (sectionName === "lost") {

        loadReports();

    }

    if (sectionName === "found") {

        loadReports();

    }

    if (sectionName === "ai") {

        loadMatches();

    }

    if (sectionName === "notifications") {

        loadNotifications();

    }

    if (sectionName === "admin") {

        if (!isAdminUser()) return;

        loadAdminReports();

        loadAdminClaims();

        loadAdminUsers();

        refreshAdminStats();

    }

}


/* ============================================================
   OPEN REPORT
============================================================ */

function openReport(type) {

    if (!currentUser) {

        showLogin();

        return;

    }

    const itemType =
        getElement("item_type");

    if (itemType) {

        itemType.value =
            type;

    }

    showSection("report");

}


/* ============================================================
   REPORT FORM
============================================================ */

function setupReportForm() {

    const form =
        getElement("reportForm");

    if (!form) return;

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                showLogin();

                return;

            }

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Submitting...";

            }

            try {

                const formData =
                    new FormData(form);

                const itemType =
                    getElement("item_type")?.value
                    || "";

                formData.set(
                    "report_type",
                    itemType
                );

                const result =
                    await apiRequest(
                        "/reports",
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                if (
                    !result ||
                    result.success === false
                ) {

                    throw new Error(
                        result?.message ||
                        "Could not submit report."
                    );

                }

                showToast(
                    result.message ||
                    "Report submitted successfully.",
                    "success"
                );

                form.reset();

                const preview =
                    getElement("imagePreview");

                if (preview) {

                    preview.innerHTML = "";

                }

                await loadReports();

                await loadMatches();

                await loadNotifications();

                showSection("dashboard");

            } catch (error) {

                console.error(
                    "Report submit error:",
                    error
                );

                showToast(
                    error.message ||
                    "Failed to submit report.",
                    "error"
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "Submit Report";

                }

            }

        }
    );

}


/* ============================================================
   IMAGE PREVIEW
============================================================ */

function setupImagePreview() {

    const input =
        getElement("image");

    const preview =
        getElement("imagePreview");

    if (!input || !preview) return;

    input.addEventListener(
        "change",
        function () {

            preview.innerHTML = "";

            const file =
                input.files?.[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {

                showToast(
                    "Please select an image file.",
                    "error"
                );

                input.value = "";

                return;

            }

            if (
                file.size >
                10 * 1024 * 1024
            ) {

                showToast(
                    "Image must be smaller than 10 MB.",
                    "error"
                );

                input.value = "";

                return;

            }

            const reader =
                new FileReader();

            reader.onload =
                function (event) {

                    const img =
                        document.createElement("img");

                    img.src =
                        event.target.result;

                    img.alt =
                        "Selected item image";

                    img.style.maxWidth =
                        "100%";

                    img.style.maxHeight =
                        "260px";

                    img.style.objectFit =
                        "contain";

                    preview.appendChild(img);

                };

            reader.readAsDataURL(file);

        }
    );

}


/* ============================================================
   IMAGE URL
============================================================ */

function getImageUrl(image) {

    if (!image) return "";

    image =
        String(image).trim();

    if (!image) return "";

    if (
        /^https?:\/\//i.test(image)
    ) {

        return image;

    }

    if (
        image.startsWith("/uploads/")
    ) {

        return image;

    }

    if (
        image.startsWith("/")
    ) {

        return image;

    }

    return `/uploads/${image}`;

}


/* ============================================================
   NORMALIZE REPORT
============================================================ */

function normalizeReport(report) {

    if (!report) return null;

    const type =
        String(
            report.report_type ||
            report.item_type ||
            report.type ||
            ""
        ).toLowerCase();

    return {

        ...report,

        id:
            report.id ??
            report.report_id,

        report_type:
            type,

        item_type:
            type,

        item_name:
            report.item_name ||
            "Unnamed Item",

        category:
            report.category ||
            "Other",

        location:
            report.location ||
            "Unknown",

        description:
            report.description ||
            "",

        image:
            report.image ||
            "",

        report_date:
            report.report_date ||
            report.date ||
            "",

        report_time:
            report.report_time ||
            report.time ||
            "",

        user_id:
            report.user_id ??
            report.owner_id

    };

}


/* ============================================================
   LOAD REPORTS
============================================================ */

async function loadReports() {

    try {

        const data =
            await apiRequest(
                "/reports",
                {
                    method: "GET"
                }
            );

        let reports = [];

        if (Array.isArray(data)) {

            reports = data;

        } else if (
            Array.isArray(data?.reports)
        ) {

            reports =
                data.reports;

        } else if (
            Array.isArray(data?.data)
        ) {

            reports =
                data.data;

        }

        allReports =
            reports
                .map(normalizeReport)
                .filter(Boolean);

        renderRecentReports();

        renderLostReports();

        renderFoundReports();

        updateDashboardStats();

        return allReports;

    } catch (error) {

        console.error(
            "Load reports error:",
            error
        );

        allReports = [];

        renderRecentReports();

        renderLostReports();

        renderFoundReports();

        return [];

    }

}


/* ============================================================
   CREATE REPORT CARD
============================================================ */

function createReportCard(report) {

    const type =
        String(
            report.report_type ||
            report.item_type ||
            ""
        ).toLowerCase();

    const isFound =
        type === "found";

    const imageUrl =
        getImageUrl(report.image);

    const imageHTML =
        imageUrl
            ? `
                <div class="report-image">
                    <img
                        src="${escapeHTML(imageUrl)}"
                        alt="${escapeHTML(report.item_name)}"
                        loading="lazy"
                        onerror="this.parentElement.style.display='none';">
                </div>
              `
            : `
                <div class="report-image report-no-image">
                    ${isFound ? "📦" : "🔍"}
                </div>
              `;

    const ownReport =
        currentUser &&
        String(report.user_id) ===
        String(
            currentUser.id ||
            currentUser.user_id
        );

    const claimButton =
        isFound &&
        !ownReport
            ? `
                <button
                    type="button"
                    class="claim-btn"
                    onclick="openClaimModal(${Number(report.id)})">
                    📦 Claim This Item
                </button>
              `
            : "";

    return `

        <div class="report-card">

            ${imageHTML}

            <div class="report-card-content">

                <div class="report-card-top">

                    <span class="report-type ${isFound ? "found" : "lost"}">

                        ${isFound ? "📦 Found" : "🔍 Lost"}

                    </span>

                    <span class="report-category">

                        ${escapeHTML(
                            capitalize(report.category)
                        )}

                    </span>

                </div>


                <h3>

                    ${escapeHTML(
                        report.item_name
                    )}

                </h3>


                <p class="report-location">

                    📍
                    ${escapeHTML(
                        report.location
                    )}

                </p>


                <p class="report-description">

                    ${escapeHTML(
                        report.description ||
                        "No description provided."
                    )}

                </p>


                <div class="report-meta">

                    <span>
                        📅
                        ${escapeHTML(
                            report.report_date
                        )}
                    </span>

                    ${
                        report.report_time
                            ? `
                                <span>
                                    🕐
                                    ${escapeHTML(
                                        report.report_time
                                    )}
                                </span>
                              `
                            : ""
                    }

                </div>


                ${claimButton}

            </div>

        </div>

    `;

}


/* ============================================================
   RENDER RECENT
============================================================ */

function renderRecentReports() {

    const container =
        getElement("recentReports");

    if (!container) return;

    const reports =
        allReports.slice(0, 6);

    if (!reports.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    No reports yet
                </h3>

                <p>
                    Reports will appear here.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   RENDER LOST
============================================================ */

function renderLostReports() {

    const container =
        getElement("lostReports");

    if (!container) return;

    const reports =
        allReports.filter(
            report =>
                String(
                    report.report_type
                ).toLowerCase() === "lost"
        );

    if (!reports.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🔍
                </div>

                <h3>
                    No lost items
                </h3>

                <p>
                    Lost item reports will appear here.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   RENDER FOUND
============================================================ */

function renderFoundReports() {

    const container =
        getElement("foundReports");

    if (!container) return;

    const reports =
        allReports.filter(
            report =>
                String(
                    report.report_type
                ).toLowerCase() === "found"
        );

    if (!reports.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📦
                </div>

                <h3>
                    No found items
                </h3>

                <p>
                    Found item reports will appear here.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        reports
            .map(createReportCard)
            .join("");

}


/* ============================================================
   DASHBOARD STATISTICS
============================================================ */

function updateDashboardStats() {

    /*
     * Your current HTML does not have dashboard
     * statistic elements, so this function intentionally
     * only keeps the data available.
     */

    window.campusFindReports =
        allReports;

}


/* ============================================================
   CLAIM MODAL
============================================================ */

function openClaimModal(
    reportId,
    lostReportId = null
) {

    if (!currentUser) {

        showLogin();

        showToast(
            "Please login to claim an item.",
            "error"
        );

        return;

    }

    const foundReport =
        allReports.find(
            report =>
                String(report.id) ===
                String(reportId)
        );

    if (!foundReport) {

        showToast(
            "Found item could not be found.",
            "error"
        );

        return;

    }

    const type =
        String(
            foundReport.report_type ||
            foundReport.item_type ||
            ""
        ).toLowerCase();

    if (type !== "found") {

        showToast(
            "Only found items can be claimed.",
            "error"
        );

        return;

    }

    const modal =
        getElement("claimModal");

    const reportInput =
        getElement("claimReportId");

    const itemName =
        getElement("claimItemName");

    const name =
        getElement("claimantName");

    const email =
        getElement("claimantEmail");

    const mobile =
        getElement("claimantMobile");

    const location =
        getElement("claimLocation");

    const details =
        getElement("claimItemDetails");

    const message =
        getElement("claimMessage");

    if (reportInput) {

        reportInput.value =
            reportId;

    }

    if (itemName) {

        itemName.value =
            foundReport.item_name || "";

    }

    if (name) {

        name.value =
            currentUser.name ||
            "";

    }

    if (email) {

        email.value =
            currentUser.email ||
            "";

    }

    if (mobile) {

        mobile.value =
            currentUser.mobile ||
            "";

    }

    /*
     * Find the user's lost report related to
     * this found item.
     */

    let matchingLost = null;

    if (lostReportId) {

        matchingLost =
            allReports.find(
                report =>
                    String(report.id) ===
                    String(lostReportId)
            );

    }

    if (!matchingLost) {

        const possibleMatch =
            allMatches.find(
                match =>
                    String(match.found_id) ===
                    String(reportId)
            );

        if (possibleMatch) {

            matchingLost =
                allReports.find(
                    report =>
                        String(report.id) ===
                        String(
                            possibleMatch.lost_id
                        )
                );

        }

    }

    /*
     * Only use the lost report location as a
     * suggestion. The claimant can edit it.
     */

    if (location) {

        location.value =
            matchingLost?.location ||
            "";

    }

    if (details) {

        details.value = "";

    }

    if (message) {

        message.value = "";

    }

    if (modal) {

        modal.style.display =
            "flex";

    }

}


/* ============================================================
   CLOSE CLAIM MODAL
============================================================ */

function closeClaimModal() {

    const modal =
        getElement("claimModal");

    if (modal) {

        modal.style.display =
            "none";

    }

}


/* ============================================================
   CLAIM FORM
============================================================ */

function setupClaimForm() {

    const form =
        getElement("claimForm");

    if (!form) return;

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                showLogin();

                return;

            }

            const reportId =
                getElement("claimReportId")?.value;

            const claimantName =
                getElement("claimantName")?.value.trim();

            const claimantEmail =
                getElement("claimantEmail")?.value.trim();

            const claimantMobile =
                getElement("claimantMobile")?.value.trim();

            const lostLocation =
                getElement("claimLocation")?.value.trim();

            const itemDetails =
                getElement("claimItemDetails")?.value.trim();

            const claimMessage =
                getElement("claimMessage")?.value.trim();

            if (!reportId) {

                showToast(
                    "Invalid item.",
                    "error"
                );

                return;

            }

            if (
                !claimantName ||
                !claimantEmail ||
                !claimantMobile ||
                !itemDetails ||
                !claimMessage
            ) {

                showToast(
                    "Please fill all required claim details.",
                    "error"
                );

                return;

            }

            const combinedReason = `

Claimant Name:
${claimantName}

Claimant Email:
${claimantEmail}

Claimant Mobile:
${claimantMobile}

Where the item was lost:
${lostLocation || "Not provided"}

Unique identifying details:
${itemDetails}

Why this is my item:
${claimMessage}

            `.trim();

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Submitting...";

            }

            try {

                /*
                 * IMPORTANT:
                 * The backend expects:
                 * reason + proof.
                 *
                 * Additional fields are also sent
                 * for newer backend versions.
                 */

                const result =
                    await apiRequest(
                        "/claims",
                        {
                            method: "POST",

                            body: {

                                report_id:
                                    Number(reportId),

                                reason:
                                    combinedReason,

                                proof:
                                    itemDetails,

                                claim_lost_location:
                                    lostLocation,

                                claim_item_details:
                                    itemDetails,

                                claim_reason:
                                    claimMessage,

                                message:
                                    claimMessage,

                                claimant_name:
                                    claimantName,

                                claimant_email:
                                    claimantEmail,

                                claimant_mobile:
                                    claimantMobile

                            }

                        }
                    );

                if (
                    result.success === false
                ) {

                    throw new Error(
                        result.message ||
                        "Claim submission failed."
                    );

                }

                showToast(
                    result.message ||
                    "Claim submitted successfully.",
                    "success"
                );

                closeClaimModal();

                form.reset();

                await loadNotifications();

            } catch (error) {

                console.error(
                    "Claim error:",
                    error
                );

                showToast(
                    error.message ||
                    "Failed to submit claim.",
                    "error"
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "📤 Submit Claim";

                }

            }

        }
    );

}


/* ============================================================
   LOAD AI MATCHES
============================================================ */

async function loadMatches() {

    try {

        const data =
            await apiRequest(
                "/matches",
                {
                    method: "GET"
                }
            );

        if (
            Array.isArray(data)
        ) {

            allMatches =
                data;

        } else {

            allMatches =
                data?.matches ||
                data?.data ||
                [];

        }

        if (!Array.isArray(allMatches)) {

            allMatches = [];

        }

        window.campusFindMatches =
            allMatches;

        renderAIMatches();

        return allMatches;

    } catch (error) {

        console.error(
            "AI match error:",
            error
        );

        allMatches = [];

        window.campusFindMatches =
            [];

        renderAIMatches();

        return [];

    }

}


/* ============================================================
   AI SCORE
============================================================ */

function getMatchPercentage(match) {

    const values = [

        match?.percentage,

        match?.match_percentage,

        match?.ai_match_score,

        match?.score,

        match?.match_score

    ];

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {

            const number =
                Number(
                    String(value)
                        .replace("%", "")
                        .trim()
                );

            if (!Number.isNaN(number)) {

                return Math.max(
                    0,
                    Math.min(100, number)
                );

            }

        }

    }

    return 0;

}


/* ============================================================
   FIND AI SCORE FOR CLAIM
============================================================ */

function findClaimAIScore(reportId) {

    const match =
        allMatches.find(
            item =>
                String(
                    item.found_id
                ) ===
                String(reportId)
        );

    if (!match) {

        return 0;

    }

    return getMatchPercentage(match);

}


/* ============================================================
   RENDER AI MATCHES
============================================================ */

function renderAIMatches() {

    const container =
        getElement("aiMatches");

    if (!container) return;

    if (!allMatches.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🤖
                </div>

                <h3>
                    No AI matches yet
                </h3>

                <p>
                    Create both lost and found reports
                    to generate possible matches.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        allMatches
            .map(
                createMatchCard
            )
            .join("");

}


/* ============================================================
   CREATE AI MATCH CARD
   FIXED - SUPPORTS NESTED LOST / FOUND OBJECTS
============================================================ */

function createMatchCard(match) {

    /* ========================================================
       GET LOST / FOUND OBJECTS
    ======================================================== */

    const lost =
        match?.lost ||
        match?.lost_report ||
        {};

    const found =
        match?.found ||
        match?.found_report ||
        {};


    /* ========================================================
       MATCH PERCENTAGE
    ======================================================== */

    const percentage =
        getMatchPercentage(match);


    /* ========================================================
       ITEM NAMES
    ======================================================== */

    const lostItem =
        match?.lost_item ||
        match?.lost_item_name ||
        lost?.item_name ||
        lost?.item ||
        "Lost Item";


    const foundItem =
        match?.found_item ||
        match?.found_item_name ||
        found?.item_name ||
        found?.item ||
        "Found Item";


    /* ========================================================
       LOCATIONS
    ======================================================== */

    const lostLocation =
        match?.lost_location ||
        match?.lost_item_location ||
        lost?.location ||
        "Unknown location";


    const foundLocation =
        match?.found_location ||
        match?.found_item_location ||
        found?.location ||
        "Unknown location";


    /* ========================================================
       CATEGORIES
    ======================================================== */

    const lostCategory =
        match?.lost_category ||
        lost?.category ||
        "Other";


    const foundCategory =
        match?.found_category ||
        found?.category ||
        "Other";


    /* ========================================================
       DESCRIPTIONS
    ======================================================== */

    const lostDescription =
        match?.lost_description ||
        match?.lost_item_description ||
        lost?.description ||
        "No description provided.";


    const foundDescription =
        match?.found_description ||
        match?.found_item_description ||
        found?.description ||
        "No description provided.";


    /* ========================================================
       IMAGES
    ======================================================== */

    const lostImage =
        getImageUrl(
            match?.lost_image ||
            lost?.image ||
            ""
        );


    const foundImage =
        getImageUrl(
            match?.found_image ||
            found?.image ||
            ""
        );


    /* ========================================================
       REPORT IDS
    ======================================================== */

    const lostId =
        match?.lost_id ||
        match?.lost_report_id ||
        lost?.id ||
        "";


    const foundId =
        match?.found_id ||
        match?.found_report_id ||
        found?.id ||
        match?.report_id ||
        "";


    /* ========================================================
       MATCH LABEL
    ======================================================== */

    let scoreLabel = "Possible Match";

    if (percentage >= 80) {

        scoreLabel = "High Match";

    } else if (percentage >= 50) {

        scoreLabel = "Good Match";

    } else if (percentage >= 30) {

        scoreLabel = "Possible Match";

    } else {

        scoreLabel = "Low Match";

    }


    /* ========================================================
       LOST IMAGE
    ======================================================== */

    const lostImageHTML =
        lostImage
            ? `
                <img
                    src="${escapeHTML(lostImage)}"
                    alt="${escapeHTML(lostItem)}"
                    loading="lazy"
                    onerror="this.style.display='none';">
              `
            : `
                <div class="match-no-image">
                    🔍
                </div>
              `;


    /* ========================================================
       FOUND IMAGE
    ======================================================== */

    const foundImageHTML =
        foundImage
            ? `
                <img
                    src="${escapeHTML(foundImage)}"
                    alt="${escapeHTML(foundItem)}"
                    loading="lazy"
                    onerror="this.style.display='none';">
              `
            : `
                <div class="match-no-image">
                    📦
                </div>
              `;


    /* ========================================================
       AI REASON
    ======================================================== */

    let reason =
        match?.reason ||
        match?.match_reason ||
        "";


    if (!reason) {

        const reasons = [];

        if (
            String(lostItem).toLowerCase() ===
            String(foundItem).toLowerCase()
        ) {

            reasons.push(
                "The item names are the same."
            );

        }

        if (
            String(lostCategory).toLowerCase() ===
            String(foundCategory).toLowerCase()
        ) {

            reasons.push(
                "Both items belong to the same category."
            );

        }

        if (
            String(lostLocation).toLowerCase() ===
            String(foundLocation).toLowerCase()
        ) {

            reasons.push(
                "The reported locations are similar."
            );

        }

        reason =
            reasons.length
                ? reasons.join(" ")
                : "The AI found similarities between the lost and found reports.";

    }


    /* ========================================================
       RETURN MATCH CARD
    ======================================================== */

    return `

        <div class="match-card">


            <!-- ==================================================
                 AI SCORE
            ================================================== -->

            <div class="match-score">

                <div class="match-score-title">
                    🤖 AI Match Percentage
                </div>

                <div class="match-percentage">
                    ${percentage}%
                </div>

                <div class="match-score-label">
                    ${escapeHTML(scoreLabel)}
                </div>

                <div class="match-progress">

                    <div
                        class="match-progress-fill"
                        style="width:${percentage}%;">
                    </div>

                </div>

            </div>


            <!-- ==================================================
                 TWO MATCHED ITEMS
            ================================================== -->

            <div class="match-items">


                <!-- ================= LOST ITEM ================= -->

                <div class="match-item">

                    <div class="match-image">

                        ${lostImageHTML}

                    </div>

                    <span class="match-label">
                        🔍 YOUR LOST ITEM
                    </span>

                    <h3>
                        ${escapeHTML(lostItem)}
                    </h3>

                    <p>
                        📍
                        ${escapeHTML(lostLocation)}
                    </p>

                    <p>
                        🏷️
                        ${escapeHTML(
                            capitalize(lostCategory)
                        )}
                    </p>

                    <small>
                        ${escapeHTML(lostDescription)}
                    </small>

                </div>


                <!-- ================= ARROW ================= -->

                <div class="match-arrow">
                    ↔
                </div>


                <!-- ================= FOUND ITEM ================= -->

                <div class="match-item">

                    <div class="match-image">

                        ${foundImageHTML}

                    </div>

                    <span class="match-label">
                        📦 MATCHED FOUND ITEM
                    </span>

                    <h3>
                        ${escapeHTML(foundItem)}
                    </h3>

                    <p>
                        📍
                        ${escapeHTML(foundLocation)}
                    </p>

                    <p>
                        🏷️
                        ${escapeHTML(
                            capitalize(foundCategory)
                        )}
                    </p>

                    <small>
                        ${escapeHTML(foundDescription)}
                    </small>

                </div>


            </div>


            <!-- ==================================================
                 AI REASON
            ================================================== -->

            <div class="match-reason">

                <strong>
                    🤖 Why AI thinks they may match:
                </strong>

                <p>
                    ${escapeHTML(reason)}
                </p>

            </div>


            <!-- ==================================================
                 CLAIM BUTTON
            ================================================== -->

            ${
                foundId
                    ? `
                        <button
                            type="button"
                            class="claim-btn"
                            onclick="openClaimModal(
                                ${Number(foundId)},
                                ${Number(lostId || 0)}
                            )">

                            📦 Claim Matched Found Item

                        </button>
                      `
                    : ""
            }


        </div>

    `;

}

/* ============================================================
   ADMIN REPORTS
============================================================ */

async function loadAdminReports() {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    try {

        const data =
            await apiRequest(
                "/reports",
                {
                    method: "GET"
                }
            );

        let reports = [];

        if (Array.isArray(data)) {

            reports = data;

        } else {

            reports =
                data?.reports ||
                data?.data ||
                [];

        }

        allReports =
            reports
                .map(normalizeReport)
                .filter(Boolean);

        renderAdminReports();

        return allReports;

    } catch (error) {

        console.error(
            "Admin reports error:",
            error
        );

        showToast(
            error.message ||
            "Could not load reports.",
            "error"
        );

    }

}


/* ============================================================
   ADMIN FILTER
============================================================ */

function setAdminFilter(
    filter,
    button
) {

    currentAdminFilter =
        String(filter).toLowerCase();

    document
        .querySelectorAll(".admin-filter")
        .forEach(
            item =>
                item.classList.remove("active")
        );

    if (button) {

        button.classList.add("active");

    } else {

        const matching =
            document.querySelector(
                `.admin-filter[data-filter="${CSS.escape(currentAdminFilter)}"]`
            );

        if (matching) {

            matching.classList.add("active");

        }

    }

    renderAdminReports();

}


/* ============================================================
   REPORT STATUS
============================================================ */

function getReportStatus(report) {

    return String(
        report.status ||
        report.approval_status ||
        "pending"
    ).toLowerCase();

}


/* ============================================================
   RENDER ADMIN REPORTS
============================================================ */

function renderAdminReports() {

    const container =
        getElement("adminReports");

    if (!container) return;

    let reports =
        [...allReports];

    if (
        currentAdminFilter !== "all"
    ) {

        reports =
            reports.filter(
                report =>
                    getReportStatus(report) ===
                    currentAdminFilter
            );

    }

    if (!reports.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    No reports found
                </h3>

                <p>
                    There are no reports in this filter.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        reports
            .map(
                createAdminReportCard
            )
            .join("");

}


/* ============================================================
   ADMIN REPORT CARD
============================================================ */

function createAdminReportCard(report) {

    const status =
        getReportStatus(report);

    const type =
        String(
            report.report_type ||
            report.item_type ||
            ""
        ).toLowerCase();

    const image =
        getImageUrl(
            report.image
        );

    const imageHTML =
        image
            ? `
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(report.item_name)}"
                    loading="lazy"
                    style="max-width:100%;max-height:220px;object-fit:contain;"
                    onerror="this.style.display='none';">
              `
            : "";

    let actions = "";

    if (
        status === "pending"
    ) {

        actions = `

            <div class="claim-actions">

                <button
                    type="button"
                    class="claim-approve-btn"
                    onclick="updateReportStatus(${Number(report.id)}, 'approved')">
                    ✓ Approve
                </button>

                <button
                    type="button"
                    class="claim-reject-btn"
                    onclick="updateReportStatus(${Number(report.id)}, 'rejected')">
                    ✕ Reject
                </button>

            </div>

        `;

    } else if (
        status === "approved"
    ) {

        actions = `

            <div class="claim-actions">

                <span class="approved-label">
                    ✓ Approved
                </span>

            </div>

        `;

    } else {

        actions = `

            <div class="claim-actions">

                <span class="rejected-label">
                    ✕ Rejected
                </span>

            </div>

        `;

    }

    return `

        <div class="admin-claim-card">

            <div class="admin-claim-header">

                <div>

                    <h3 class="admin-claim-title">

                        ${
                            type === "found"
                                ? "📦"
                                : "🔍"
                        }

                        ${escapeHTML(
                            report.item_name
                        )}

                    </h3>

                    <small>
                        Report ID:
                        ${escapeHTML(report.id)}
                    </small>

                </div>


                <span
                    class="admin-claim-status ${escapeHTML(status)}">

                    ${escapeHTML(
                        capitalize(status)
                    )}

                </span>

            </div>


            ${
                imageHTML
                    ? `
                        <div style="margin:10px 0;">
                            ${imageHTML}
                        </div>
                      `
                    : ""
            }


            <div class="claimant-info">

                <div>

                    <strong>
                        Type
                    </strong>

                    ${escapeHTML(
                        capitalize(type)
                    )}

                </div>


                <div>

                    <strong>
                        Category
                    </strong>

                    ${escapeHTML(
                        report.category ||
                        "Other"
                    )}

                </div>


                <div>

                    <strong>
                        Location
                    </strong>

                    ${escapeHTML(
                        report.location ||
                        "Unknown"
                    )}

                </div>


                <div>

                    <strong>
                        Date
                    </strong>

                    ${escapeHTML(
                        report.report_date ||
                        ""
                    )}

                </div>

            </div>


            <div class="claim-message">

                <strong>
                    Description
                </strong>

                <p>
                    ${escapeHTML(
                        report.description ||
                        "No description provided."
                    )}
                </p>

            </div>


            ${actions}

        </div>

    `;

}


/* ============================================================
   UPDATE REPORT STATUS
============================================================ */

async function updateReportStatus(
    reportId,
    newStatus
) {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    if (
        newStatus !== "approved" &&
        newStatus !== "rejected"
    ) {

        return;

    }

    const action =
        newStatus === "approved"
            ? "approve"
            : "reject";

    if (
        !confirm(
            `Are you sure you want to ${action} this report?`
        )
    ) {

        return;

    }

    try {

        showToast(
            `${capitalize(action)}ing report...`,
            "info"
        );

        const result =
            await apiRequest(
                `/reports/${encodeURIComponent(reportId)}/status`,
                {
                    method: "PUT",

                    body: {
                        status: newStatus
                    }
                }
            );

        if (
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Status update failed."
            );

        }

        showToast(
            result.message ||
            `Report ${newStatus}.`,
            "success"
        );

        await loadAdminReports();

        await refreshAdminStats();

        await loadReports();

    } catch (error) {

        console.error(
            "Report status error:",
            error
        );

        showToast(
            error.message ||
            "Could not update report status.",
            "error"
        );

    }

}


/* ============================================================
   ADMIN CLAIMS
============================================================ */

async function loadAdminClaims() {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    try {

        const data =
            await apiRequest(
                "/admin/claims",
                {
                    method: "GET"
                }
            );

        allAdminClaims =
            data?.claims ||
            data?.data ||
            [];

        if (!Array.isArray(allAdminClaims)) {

            allAdminClaims = [];

        }

        renderAdminClaims();

    } catch (error) {

        console.error(
            "Admin claims error:",
            error
        );

        showToast(
            error.message ||
            "Could not load claims.",
            "error"
        );

    }

}


/* ============================================================
   CREATE ADMIN CLAIM CARD
============================================================ */

function createAdminClaimCard(claim) {

    const claimId =
        claim.id ||
        claim.claim_id;

    const reportId =
        claim.report_id;

    const status =
        String(
            claim.status ||
            "pending"
        ).toLowerCase();

    const itemName =
        claim.item_name ||
        "Unknown Item";

    const claimantName =
        claim.name ||
        claim.claimant_name ||
        "Unknown";

    const claimantEmail =
        claim.email ||
        claim.claimant_email ||
        "Not provided";

    const claimantMobile =
        claim.mobile ||
        claim.claimant_mobile ||
        "Not provided";

    const reason =
        claim.reason ||
        claim.claim_reason ||
        claim.message ||
        "No claim details provided.";

    const proof =
        claim.proof ||
        claim.claim_item_details ||
        "Not provided.";

    const createdAt =
        claim.created_at ||
        "";

    const aiScore =
        findClaimAIScore(reportId);

    let actions = "";

    if (status === "pending") {

        actions = `

            <div class="claim-actions">

                <button
                    type="button"
                    class="claim-approve-btn"
                    onclick="updateClaimStatus(${Number(claimId)}, 'approved')">

                    ✓ Approve Claim

                </button>


                <button
                    type="button"
                    class="claim-reject-btn"
                    onclick="updateClaimStatus(${Number(claimId)}, 'rejected')">

                    ✕ Reject Claim

                </button>

            </div>

        `;

    } else if (status === "approved") {

        actions = `

            <div class="claim-actions">

                <span class="approved-label">
                    ✓ Claim Approved
                </span>

            </div>

        `;

    } else if (status === "rejected") {

        actions = `

            <div class="claim-actions">

                <span class="rejected-label">
                    ✕ Claim Rejected
                </span>

            </div>

        `;

    }

    return `

        <div class="admin-claim-card">


            <div class="admin-claim-header">

                <div>

                    <h3 class="admin-claim-title">

                        📦
                        ${escapeHTML(itemName)}

                    </h3>

                    <small>

                        Claim ID:
                        ${escapeHTML(claimId)}

                    </small>

                </div>


                <span
                    class="admin-claim-status ${escapeHTML(status)}">

                    ${escapeHTML(
                        capitalize(status)
                    )}

                </span>

            </div>


            <div class="claimant-info">


                <div>

                    <strong>
                        Claimant Name
                    </strong>

                    ${escapeHTML(
                        claimantName
                    )}

                </div>


                <div>

                    <strong>
                        Email
                    </strong>

                    ${escapeHTML(
                        claimantEmail
                    )}

                </div>


                <div>

                    <strong>
                        Mobile
                    </strong>

                    ${escapeHTML(
                        claimantMobile
                    )}

                </div>


                <div>

                    <strong>
                        Claim Date
                    </strong>

                    ${escapeHTML(
                        createdAt
                    )}

                </div>


            </div>


            <div class="claim-ai-score">

                🤖 AI Match Percentage:

                <strong>
                    ${aiScore}%
                </strong>

            </div>


            <div class="claim-message">

                <strong>
                    Unique Item Details
                </strong>

                <p>
                    ${escapeHTML(proof)}
                </p>

            </div>


            <div class="claim-message">

                <strong>
                    Claim Explanation
                </strong>

                <p>
                    ${escapeHTML(reason)}
                </p>

            </div>


            ${actions}

        </div>

    `;

}


/* ============================================================
   RENDER ADMIN CLAIMS
============================================================ */

function renderAdminClaims() {

    const container =
        getElement("adminClaims");

    if (!container) return;

    if (!allAdminClaims.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    No claim requests
                </h3>

                <p>
                    No claim requests are available.
                </p>

            </div>

        `;

        return;

    }

    container.innerHTML =
        allAdminClaims
            .map(createAdminClaimCard)
            .join("");

}


/* ============================================================
   UPDATE CLAIM STATUS
============================================================ */

async function updateClaimStatus(
    claimId,
    status
) {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    if (
        status !== "approved" &&
        status !== "rejected"
    ) {

        return;

    }

    const action =
        status === "approved"
            ? "approve"
            : "reject";

    if (
        !confirm(
            `Are you sure you want to ${action} this claim?`
        )
    ) {

        return;

    }

    try {

        const result =
            await apiRequest(
                `/admin/claims/${encodeURIComponent(claimId)}`,
                {
                    method: "PUT",

                    body: {
                        status: status
                    }
                }
            );

        if (
            result.success === false
        ) {

            throw new Error(
                result.message ||
                "Claim status update failed."
            );

        }

        showToast(
            result.message ||
            `Claim ${status}.`,
            "success"
        );

        await loadAdminClaims();

        await refreshAdminStats();

        await loadNotifications();

    } catch (error) {

        console.error(
            "Claim status error:",
            error
        );

        showToast(
            error.message ||
            "Could not update claim.",
            "error"
        );

    }

}


/* ============================================================
   ADMIN STATS
============================================================ */

async function refreshAdminStats() {

    if (!isAdminUser()) return;

    try {

        const data =
            await apiRequest(
                "/admin/stats",
                {
                    method: "GET"
                }
            );

        if (!data) return;

        const total =
            data.total_reports ??
            data.total ??
            0;

        const lost =
            data.lost ??
            data.lost_count ??
            0;

        const found =
            data.found ??
            data.found_count ??
            0;

        const users =
            data.users ??
            data.user_count ??
            0;

        const totalElement =
            getElement("adminTotalReports");

        const lostElement =
            getElement("adminLostCount");

        const foundElement =
            getElement("adminFoundCount");

        const usersElement =
            getElement("adminUserCount");

        if (totalElement) {

            totalElement.textContent =
                total;

        }

        if (lostElement) {

            lostElement.textContent =
                lost;

        }

        if (foundElement) {

            foundElement.textContent =
                found;

        }

        if (usersElement) {

            usersElement.textContent =
                users;

        }

    } catch (error) {

        console.error(
            "Admin stats error:",
            error
        );

    }

}


/* ============================================================
   ADMIN USERS
============================================================ */

async function loadAdminUsers() {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;

    }

    const container =
        getElement("adminUsers");

    if (!container) return;

    try {

        const data =
            await apiRequest(
                "/admin/users",
                {
                    method: "GET"
                }
            );

        allAdminUsers =
            data?.users ||
            data?.data ||
            [];

        if (!Array.isArray(allAdminUsers)) {

            allAdminUsers = [];

        }

        if (!allAdminUsers.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        👥
                    </div>

                    <h3>
                        No users found
                    </h3>

                </div>

            `;

            return;

        }

        container.innerHTML = `

            <div class="admin-users-table">

                ${allAdminUsers.map(user => `

                    <div class="admin-user-row">

                        <strong>
                            ${escapeHTML(
                                user.name ||
                                user.username ||
                                "User"
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                user.email ||
                                ""
                            )}
                        </span>

                        <span>
                            ${escapeHTML(
                                capitalize(
                                    user.role ||
                                    "student"
                                )
                            )}
                        </span>

                    </div>

                `).join("")}

            </div>

        `;

    } catch (error) {

        console.error(
            "Admin users error:",
            error
        );

        showToast(
            error.message ||
            "Could not load users.",
            "error"
        );

    }

}


/* ============================================================
   LOGIN FORM
============================================================ */

function setupLoginForm() {

    const form =
        getElement("loginForm");

    if (!form) return;

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const email =
                getElement("loginEmail")?.value.trim();

            const password =
                getElement("loginPassword")?.value;

            if (!email || !password) {

                showToast(
                    "Enter email and password.",
                    "error"
                );

                return;

            }

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Logging in...";

            }

            try {

                const result =
                    await apiRequest(
                        "/login",
                        {
                            method: "POST",

                            body: {

                                email:
                                    email,

                                username:
                                    email,

                                password:
                                    password

                            }
                        }
                    );

                if (
                    result.success === false
                ) {

                    throw new Error(
                        result.message ||
                        "Login failed."
                    );

                }

                currentUser =
                    result.user ||
                    {
                        id:
                            result.user_id,

                        user_id:
                            result.user_id,

                        name:
                            result.name ||
                            email.split("@")[0],

                        email:
                            result.email ||
                            email,

                        role:
                            result.role ||
                            "student"
                    };

                localStorage.setItem(
                    "campusfindUser",
                    JSON.stringify(currentUser)
                );

                showLoggedInUI();

                closeLogin();

                form.reset();

                showToast(
                    result.message ||
                    "Login successful.",
                    "success"
                );

                await loadApplicationData();

                showSection("dashboard");

            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );

                showToast(
                    error.message ||
                    "Login failed.",
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Login";

                }

            }

        }
    );

}


/* ============================================================
   REGISTER FORM
============================================================ */

function setupRegisterForm() {

    const form =
        getElement("registerForm");

    if (!form) return;

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const name =
                getElement("registerName")?.value.trim();

            const email =
                getElement("registerEmail")?.value.trim();

            const role =
                getElement("registerRole")?.value ||
                "student";

            const password =
                getElement("registerPassword")?.value;

            if (
                !name ||
                !email ||
                !password
            ) {

                showToast(
                    "Please fill all required fields.",
                    "error"
                );

                return;

            }

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "Creating...";

            }

            try {

                const result =
                    await apiRequest(
                        "/register",
                        {
                            method: "POST",

                            body: {

                                name:
                                    name,

                                email:
                                    email,

                                role:
                                    role,

                                password:
                                    password

                            }
                        }
                    );

                if (
                    result.success === false
                ) {

                    throw new Error(
                        result.message ||
                        "Registration failed."
                    );

                }

                showToast(
                    result.message ||
                    "Account created successfully.",
                    "success"
                );

                form.reset();

                showLogin();

                const loginEmail =
                    getElement("loginEmail");

                if (loginEmail) {

                    loginEmail.value =
                        email;

                }

            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );

                showToast(
                    error.message ||
                    "Registration failed.",
                    "error"
                );

            } finally {

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Create Account";

                }

            }

        }
    );

}


/* ============================================================
   LOGIN MODAL
============================================================ */

function showLogin() {

    const loginModal =
        getElement("loginModal");

    const registerModal =
        getElement("registerModal");

    if (registerModal) {

        registerModal.style.display =
            "none";

    }

    if (loginModal) {

        loginModal.style.display =
            "flex";

    }

}


function showRegister() {

    const loginModal =
        getElement("loginModal");

    const registerModal =
        getElement("registerModal");

    if (loginModal) {

        loginModal.style.display =
            "none";

    }

    if (registerModal) {

        registerModal.style.display =
            "flex";

    }

}


function closeLogin() {

    const loginModal =
        getElement("loginModal");

    const registerModal =
        getElement("registerModal");

    if (loginModal) {

        loginModal.style.display =
            "none";

    }

    if (registerModal) {

        registerModal.style.display =
            "none";

    }

}


function closeModal(id) {

    const modal =
        getElement(id);

    if (modal) {

        modal.style.display =
            "none";

    }

}


/* ============================================================
   PASSWORD TOGGLE
============================================================ */

function togglePassword(inputId) {

    const input =
        getElement(inputId);

    if (!input) return;

    input.type =
        input.type === "password"
            ? "text"
            : "password";

}


function toggleRegisterPassword() {

    const input =
        getElement("registerPassword");

    if (!input) return;

    input.type =
        input.type === "password"
            ? "text"
            : "password";

}


/* ============================================================
   LOGOUT
============================================================ */

async function logoutUser() {

    if (isLoggingOut) return;

    isLoggingOut = true;

    try {

        await apiRequest(
            "/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    }

    currentUser = null;

    allReports = [];

    allMatches = [];

    allNotifications = [];

    allAdminClaims = [];

    allAdminUsers = [];

    localStorage.removeItem(
        "campusfindUser"
    );

    hideAdminMenu();

    showLoggedOutUI();

    showToast(
        "Logged out successfully.",
        "success"
    );

    isLoggingOut = false;

}


/* ============================================================
   NOTIFICATIONS
============================================================ */

async function openNotifications() {

    if (!currentUser) {

        showLogin();

        return;

    }

    const panel =
        getElement("notificationPanel");

    if (panel) {

        panel.style.display =
            "block";

    }

    await loadNotifications();

}


function closeNotifications() {

    const panel =
        getElement("notificationPanel");

    if (panel) {

        panel.style.display =
            "none";

    }

}


function closeNotificationPanel() {

    closeNotifications();

}


/* ============================================================
   LOAD NOTIFICATIONS
============================================================ */

async function loadNotifications() {

    if (!currentUser) return;

    try {

        const data =
            await apiRequest(
                "/notifications",
                {
                    method: "GET"
                }
            );

        if (Array.isArray(data)) {

            allNotifications =
                data;

        } else {

            allNotifications =
                data?.notifications ||
                data?.data ||
                [];

        }

        if (!Array.isArray(allNotifications)) {

            allNotifications = [];

        }

        renderNotifications();

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        allNotifications = [];

        renderNotifications();

    }

}


/* ============================================================
   RENDER NOTIFICATIONS
============================================================ */

function renderNotifications() {

    const sectionList =
        getElement("notificationList");

    const panelList =
        getElement("notificationsList");

    if (!allNotifications.length) {

        const emptyHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🔔
                </div>

                <h3>
                    No notifications
                </h3>

                <p>
                    You're all caught up.
                </p>

            </div>

        `;

        if (sectionList) {

            sectionList.innerHTML =
                emptyHTML;

        }

        if (panelList) {

            panelList.innerHTML =
                emptyHTML;

        }

        return;

    }

    const html =
        allNotifications
            .map(
                notification => {

                    const title =
                        notification.title ||
                        notification.type ||
                        "Notification";

                    const message =
                        notification.message ||
                        notification.description ||
                        "";

                    const created =
                        notification.created_at ||
                        notification.time ||
                        "";

                    return `

                        <div class="notification-item">

                            <div class="notification-icon">
                                🔔
                            </div>

                            <div>

                                <strong>
                                    ${escapeHTML(title)}
                                </strong>

                                <p>
                                    ${escapeHTML(message)}
                                </p>

                                <small>
                                    ${escapeHTML(created)}
                                </small>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

    if (sectionList) {

        sectionList.innerHTML =
            html;

    }

    if (panelList) {

        panelList.innerHTML =
            html;

    }

}


/* ============================================================
   CLEAR NOTIFICATIONS
============================================================ */

async function clearNotifications() {

    if (!currentUser) return;

    try {

        /*
         * Try DELETE first.
         */

        let result;

        try {

            result =
                await apiRequest(
                    "/notifications",
                    {
                        method: "DELETE"
                    }
                );

        } catch (deleteError) {

            /*
             * Some backend versions use POST
             * for clearing notifications.
             */

            result =
                await apiRequest(
                    "/notifications/clear",
                    {
                        method: "POST"
                    }
                );

        }

        allNotifications = [];

        renderNotifications();

        showToast(
            result?.message ||
            "Notifications cleared.",
            "success"
        );

    } catch (error) {

        console.error(
            "Clear notifications error:",
            error
        );

        /*
         * If backend doesn't provide clear endpoint,
         * don't break the page.
         */

        showToast(
            "Notifications could not be cleared.",
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
        getElement("toast");

    const icon =
        getElement("toastIcon");

    const messageElement =
        getElement("toastMessage");

    if (!toast) return;

    if (messageElement) {

        messageElement.textContent =
            message;

    }

    if (icon) {

        if (type === "error") {

            icon.textContent =
                "✕";

        } else if (type === "info") {

            icon.textContent =
                "ℹ";

        } else {

            icon.textContent =
                "✓";

        }

    }

    toast.classList.remove(
        "success",
        "error",
        "info",
        "show"
    );

    toast.classList.add(
        type,
        "show"
    );

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
   CLOSE MODALS WHEN CLICKING OUTSIDE
============================================================ */

window.addEventListener(
    "click",
    function (event) {

        const loginModal =
            getElement("loginModal");

        const registerModal =
            getElement("registerModal");

        const claimModal =
            getElement("claimModal");

        if (
            event.target ===
            loginModal
        ) {

            closeLogin();

        }

        if (
            event.target ===
            registerModal
        ) {

            closeLogin();

        }

        if (
            event.target ===
            claimModal
        ) {

            closeClaimModal();

        }

    }
);


/* ============================================================
   ESC KEY
============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Escape") {
            return;
        }

        closeLogin();

        closeClaimModal();

        closeNotifications();

    }
);


/* ============================================================
   MAKE FUNCTIONS AVAILABLE TO INLINE HTML
============================================================ */

window.showSection =
    showSection;

window.openReport =
    openReport;

window.showLogin =
    showLogin;

window.showRegister =
    showRegister;

window.closeLogin =
    closeLogin;

window.closeModal =
    closeModal;

window.togglePassword =
    togglePassword;

window.toggleRegisterPassword =
    toggleRegisterPassword;

window.logoutUser =
    logoutUser;

window.openNotifications =
    openNotifications;

window.closeNotifications =
    closeNotifications;

window.closeNotificationPanel =
    closeNotificationPanel;

window.clearNotifications =
    clearNotifications;

window.openClaimModal =
    openClaimModal;

window.closeClaimModal =
    closeClaimModal;

window.setAdminFilter =
    setAdminFilter;

window.loadAdminReports =
    loadAdminReports;

window.loadAdminClaims =
    loadAdminClaims;

window.loadAdminUsers =
    loadAdminUsers;

window.refreshAdminStats =
    refreshAdminStats;

window.updateReportStatus =
    updateReportStatus;

window.updateClaimStatus =
    updateClaimStatus;


/* ============================================================
   INITIAL SECTION STATE
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        document
            .querySelectorAll(".section")
            .forEach(
                section => {

                    if (
                        section.id ===
                        "dashboard"
                    ) {

                        section.style.display =
                            "block";

                    } else {

                        section.style.display =
                            "none";

                    }

                }
            );

    }
);