/* ============================================================
   CAMPUSFIND - LOST & FOUND AI
   COMPLETE JAVASCRIPT
   Includes:
   - Lost / Found Reports
   - AI Matching
   - Claim Found Item
   - Claim Details
   - Admin Claim Requests
   - AI Match Percentage for Claims
   - Admin Approve / Reject Claims
   - Notifications
============================================================ */

"use strict";


/* ============================================================
   GLOBAL VARIABLES
============================================================ */

const API_BASE = "/api";

let currentUser = null;
let allReports = [];
let adminReports = [];
let adminClaims = [];

let currentAdminFilter = "all";


/* ============================================================
   DOM READY
============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    console.log("CampusFind JavaScript loaded successfully.");

    updateDateTime();

    setInterval(updateDateTime, 1000);

    setupImagePreview();

    setupReportForm();

    setupLoginForm();

    setupRegisterForm();

    setupClaimForm();

    loadUser();

});


/* ============================================================
   DATE & TIME
============================================================ */

function updateDateTime() {

    const element =
        document.getElementById("currentDateTime");

    if (!element) return;

    const now = new Date();

    const options = {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    };

    element.textContent =
        now.toLocaleDateString("en-IN", options);
}


/* ============================================================
   USER
============================================================ */

async function loadUser() {

    try {

        const response = await fetch(
            `${API_BASE}/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (response.ok) {

            const data =
                await response.json();

            if (data.success && data.user) {

                currentUser = data.user;

                localStorage.setItem(
                    "campusfindUser",
                    JSON.stringify(currentUser)
                );

                updateUserUI();

                await loadReports();

                await loadNotifications();

                if (isAdmin()) {

                    showAdminMenu();

                    await loadAdminReports();

                    await refreshAdminStats();

                    await loadAdminClaims();

                }

                return;
            }
        }

    } catch (error) {

        console.warn(
            "Could not load user from server:",
            error
        );

    }


    /* ========================================================
       FALLBACK LOCAL STORAGE
    ======================================================== */

    try {

        const savedUser =
            localStorage.getItem("campusfindUser");

        if (savedUser) {

            currentUser =
                JSON.parse(savedUser);

            updateUserUI();

            await loadReports();

            await loadNotifications();

            if (isAdmin()) {

                showAdminMenu();

                await loadAdminReports();

                await refreshAdminStats();

                await loadAdminClaims();

            }

        } else {

            updateUserUI();

        }

    } catch (error) {

        console.error(
            "User loading error:",
            error
        );

        currentUser = null;

        updateUserUI();

    }
}


/* ============================================================
   CHECK ADMIN
============================================================ */

function isAdmin() {

    if (!currentUser) return false;

    const role = String(
        currentUser.role ||
        currentUser.user_role ||
        ""
    ).toLowerCase();

    return (
        role === "admin" ||
        role === "administrator"
    );
}


/* ============================================================
   UPDATE USER UI
============================================================ */

function updateUserUI() {

    const avatar =
        document.getElementById("userAvatar");

    const nameElement =
        document.getElementById("sidebarUserName");

    const roleElement =
        document.getElementById("sidebarUserRole");


    if (!currentUser) {

        if (avatar)
            avatar.textContent = "U";

        if (nameElement)
            nameElement.textContent = "Guest";

        if (roleElement)
            roleElement.textContent = "Student";

        return;
    }


    const name =
        currentUser.name ||
        currentUser.full_name ||
        currentUser.username ||
        "User";


    const role =
        currentUser.role ||
        currentUser.user_role ||
        "Student";


    if (avatar) {

        avatar.textContent =
            name.charAt(0).toUpperCase();

    }


    if (nameElement) {

        nameElement.textContent = name;

    }


    if (roleElement) {

        roleElement.textContent = role;

    }


    if (isAdmin()) {

        showAdminMenu();

    } else {

        hideAdminMenu();

    }
}


/* ============================================================
   ADMIN MENU
============================================================ */

function showAdminMenu() {

    const adminButton =
        document.querySelector(
            '[onclick="showSection(\'admin\')"]'
        );

    if (adminButton) {

        adminButton.style.display = "";

    }
}


function hideAdminMenu() {

    const adminButton =
        document.querySelector(
            '[onclick="showSection(\'admin\')"]'
        );

    if (adminButton) {

        adminButton.style.display = "none";

    }
}


/* ============================================================
   SECTION NAVIGATION
============================================================ */

function showSection(sectionName) {

    const sections =
        document.querySelectorAll(".section");


    sections.forEach(function (section) {

        section.style.display = "none";

    });


    const target =
        document.getElementById(sectionName);


    if (target) {

        target.style.display = "block";

    }


    if (sectionName === "dashboard") {

        loadReports();

    }


    if (
        sectionName === "lost" ||
        sectionName === "found"
    ) {

        loadReports();

    }


    if (sectionName === "ai") {

        loadMatches();

    }


    if (sectionName === "notifications") {

        loadNotifications();

    }


    if (sectionName === "admin") {

        if (!isAdmin()) {

            showToast(
                "Admin access required.",
                "error"
            );

            return;
        }


        loadAdminReports();

        refreshAdminStats();

        loadAdminClaims();

    }
}


/* ============================================================
   OPEN REPORT
============================================================ */

function openReport(type) {

    showSection("report");


    const itemType =
        document.getElementById("item_type");


    if (itemType) {

        itemType.value = type;

    }
}


/* ============================================================
   REPORT FORM
============================================================ */

function setupReportForm() {

    const form =
        document.getElementById("reportForm");

    if (!form) return;


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (!currentUser) {

                showToast(
                    "Please login first.",
                    "error"
                );

                showLogin();

                return;
            }


            const imageInput =
                document.getElementById("image");


            if (
                imageInput &&
                imageInput.files.length > 0
            ) {

                const file =
                    imageInput.files[0];


                if (
                    file.size >
                    10 * 1024 * 1024
                ) {

                    showToast(
                        "Image must be less than 10 MB.",
                        "error"
                    );

                    return;
                }
            }


            const formData =
                new FormData(form);


            try {

                showToast(
                    "Submitting report...",
                    "info"
                );


                const response =
                    await fetch(
                        `${API_BASE}/reports`,
                        {
                            method: "POST",
                            body: formData,
                            credentials: "include"
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(function () {
                            return {};
                        });


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        `Server error: ${response.status}`
                    );

                }


                showToast(
                    "Report submitted successfully!",
                    "success"
                );


                form.reset();


                const preview =
                    document.getElementById(
                        "imagePreview"
                    );


                if (preview) {

                    preview.style.display =
                        "none";

                    preview.src = "";

                }


                await loadReports();

                await loadNotifications();


                showSection("dashboard");


            } catch (error) {

                console.error(
                    "Report submission error:",
                    error
                );


                showToast(
                    error.message ||
                    "Failed to submit report.",
                    "error"
                );

            }

        }
    );
}


/* ============================================================
   IMAGE PREVIEW
============================================================ */

function setupImagePreview() {

    const imageInput =
        document.getElementById("image");

    const preview =
        document.getElementById("imagePreview");


    if (!imageInput || !preview)
        return;


    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files[0];


            if (!file) {

                preview.style.display = "none";

                preview.src = "";

                return;
            }


            if (!file.type.startsWith("image/")) {

                showToast(
                    "Please select a valid image.",
                    "error"
                );

                this.value = "";

                preview.style.display = "none";

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    preview.src =
                        event.target.result;

                    preview.style.display =
                        "block";

                };


            reader.readAsDataURL(file);

        }
    );
}


/* ============================================================
   LOAD REPORTS
============================================================ */

async function loadReports() {

    try {

        const response =
            await fetch(
                `${API_BASE}/reports`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        if (Array.isArray(data)) {

            allReports = data;

        } else if (
            Array.isArray(data.reports)
        ) {

            allReports = data.reports;

        } else if (
            Array.isArray(data.data)
        ) {

            allReports = data.data;

        } else {

            allReports = [];

        }


        renderRecentReports();

        renderLostReports();

        renderFoundReports();

        updateDashboardStats();


    } catch (error) {

        console.error(
            "Load reports error:",
            error
        );


        allReports = [];


        renderRecentReports();

        renderLostReports();

        renderFoundReports();

    }
}


/* ============================================================
   NORMALIZE REPORT
============================================================ */

function normalizeReport(report) {

    if (!report)
        return {};


    return {

        id:
            report.id ||
            report.report_id ||
            report._id ||
            "",


        item_type:
            String(
                report.item_type ||
                report.type ||
                report.report_type ||
                ""
            ).toLowerCase(),


        item_name:
            report.item_name ||
            report.name ||
            report.title ||
            "Unknown Item",


        category:
            report.category ||
            "Other",


        location:
            report.location ||
            "Unknown",


        item_date:
            report.item_date ||
            report.date ||
            report.report_date ||
            "",


        item_time:
            report.item_time ||
            report.time ||
            report.report_time ||
            "",


        description:
            report.description ||
            "",


        image:
            report.image ||
            report.image_url ||
            report.imageUrl ||
            "",


        status:
            String(
                report.status ||
                "pending"
            ).toLowerCase(),


        created_at:
            report.created_at ||
            report.createdAt ||
            ""

    };
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
        allReports
            .map(normalizeReport)
            .slice(0, 6);


    if (reports.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>No reports available.</p>
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
   LOST REPORTS
============================================================ */

function renderLostReports() {

    const container =
        document.getElementById(
            "lostReports"
        );


    if (!container) return;


    const reports =
        allReports
            .map(normalizeReport)
            .filter(function (report) {

                return report.item_type === "lost";

            });


    if (reports.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>No lost items found.</p>
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
   FOUND REPORTS
============================================================ */

function renderFoundReports() {

    const container =
        document.getElementById(
            "foundReports"
        );


    if (!container) return;


    const reports =
        allReports
            .map(normalizeReport)
            .filter(function (report) {

                return report.item_type === "found";

            });


    if (reports.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <p>No found items available.</p>
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
   REPORT CARD
   CLAIM BUTTON IS ADDED HERE
============================================================ */

function createReportCard(report) {

    const type =
        report.item_type || "item";


    const typeClass =
        type === "lost"
            ? "lost"
            : "found";


    const status =
        report.status || "pending";


    const imageHTML =
        report.image

            ? `
                <img
                    src="${escapeHTML(report.image)}"
                    alt="${escapeHTML(report.item_name)}"
                    class="report-image"
                    onerror="this.style.display='none';"
                >
            `

            : "";


    /* ========================================================
       CLAIM BUTTON
    ======================================================== */

    let claimButton = "";


    if (
        type === "found" &&
        report.id
    ) {

        claimButton = `

            <button
                type="button"
                class="claim-btn"
                onclick="openClaimModal('${escapeHTML(report.id)}')"
            >

                📦 Claim This Item

            </button>

        `;

    }


    return `

        <div class="report-card">

            ${imageHTML}


            <div class="report-card-content">


                <div class="report-card-header">

                    <h3>
                        ${escapeHTML(
                            report.item_name
                        )}
                    </h3>


                    <span
                        class="report-type ${typeClass}"
                    >

                        ${escapeHTML(
                            type.toUpperCase()
                        )}

                    </span>

                </div>


                <p>

                    <strong>
                        Category:
                    </strong>

                    ${escapeHTML(
                        report.category
                    )}

                </p>


                <p>

                    <strong>
                        Location:
                    </strong>

                    ${escapeHTML(
                        report.location
                    )}

                </p>


                ${
                    report.item_date

                        ? `
                            <p>

                                <strong>
                                    Date:
                                </strong>

                                ${escapeHTML(
                                    report.item_date
                                )}

                            </p>
                        `

                        : ""
                }


                ${
                    report.description

                        ? `
                            <p class="report-description">

                                ${escapeHTML(
                                    report.description
                                )}

                            </p>
                        `

                        : ""
                }


                <span
                    class="status-badge status-${escapeHTML(
                        status
                    )}"
                >

                    ${escapeHTML(
                        capitalize(status)
                    )}

                </span>


                ${claimButton}


            </div>

        </div>

    `;
}


/* ============================================================
   DASHBOARD STATS
============================================================ */

function updateDashboardStats() {

    const lostCount =
        allReports.filter(function (report) {

            return (
                normalizeReport(report)
                    .item_type === "lost"
            );

        }).length;


    const foundCount =
        allReports.filter(function (report) {

            return (
                normalizeReport(report)
                    .item_type === "found"
            );

        }).length;


    const lostElement =
        document.getElementById(
            "lostCount"
        );


    const foundElement =
        document.getElementById(
            "foundCount"
        );


    if (lostElement) {

        lostElement.textContent =
            lostCount;

    }


    if (foundElement) {

        foundElement.textContent =
            foundCount;

    }
}


/* ============================================================
   CLAIM MODAL
============================================================ */

function openClaimModal(reportId) {

    if (!currentUser) {

        showToast(
            "Please login first to claim an item.",
            "error"
        );

        showLogin();

        return;
    }


    const report =
        allReports
            .map(normalizeReport)
            .find(function (item) {

                return String(item.id) ===
                    String(reportId);

            });


    if (!report) {

        showToast(
            "Found item details could not be loaded.",
            "error"
        );

        return;
    }


    if (report.item_type !== "found") {

        showToast(
            "Only found items can be claimed.",
            "error"
        );

        return;
    }


    const modal =
        document.getElementById(
            "claimModal"
        );


    const reportIdInput =
        document.getElementById(
            "claimReportId"
        );


    const itemNameInput =
        document.getElementById(
            "claimItemName"
        );


    const claimantName =
        document.getElementById(
            "claimantName"
        );


    const claimantEmail =
        document.getElementById(
            "claimantEmail"
        );


    const claimantMobile =
        document.getElementById(
            "claimantMobile"
        );


    if (reportIdInput) {

        reportIdInput.value =
            report.id;

    }


    if (itemNameInput) {

        itemNameInput.value =
            report.item_name;

    }


    if (claimantName) {

        claimantName.value =
            currentUser.name ||
            currentUser.full_name ||
            currentUser.username ||
            "";

    }


    if (claimantEmail) {

        claimantEmail.value =
            currentUser.email ||
            "";

    }


    if (claimantMobile) {

        claimantMobile.value =
            currentUser.mobile ||
            currentUser.phone ||
            "";

    }


    const message =
        document.getElementById(
            "claimMessage"
        );


    if (message) {

        message.value = "";

    }


    const lostLocation =
        document.getElementById(
            "claimLostLocation"
        );


    if (lostLocation) {

        lostLocation.value = "";

    }


    const itemDetails =
        document.getElementById(
            "claimItemDetails"
        );


    if (itemDetails) {

        itemDetails.value = "";

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
        document.getElementById(
            "claimModal"
        );


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
        document.getElementById(
            "claimForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (!currentUser) {

                showToast(
                    "Please login first.",
                    "error"
                );

                return;
            }


            const reportId =
                document.getElementById(
                    "claimReportId"
                )?.value;


            const claimantName =
                document.getElementById(
                    "claimantName"
                )?.value.trim();


            const claimantEmail =
                document.getElementById(
                    "claimantEmail"
                )?.value.trim();


            const claimantMobile =
                document.getElementById(
                    "claimantMobile"
                )?.value.trim();


            const lostLocation =
                document.getElementById(
                    "claimLostLocation"
                )?.value.trim();


            const itemDetails =
                document.getElementById(
                    "claimItemDetails"
                )?.value.trim();


            const claimMessage =
                document.getElementById(
                    "claimMessage"
                )?.value.trim();


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
                !lostLocation ||
                !itemDetails ||
                !claimMessage
            ) {

                showToast(
                    "Please fill all claim details.",
                    "error"
                );

                return;
            }


            /*
             * Backend currently stores the main
             * claim information in the `message`
             * field.
             *
             * So we combine the details into one message.
             */

            const combinedMessage = `

Claimant Name:
${claimantName}

Claimant Email:
${claimantEmail}

Claimant Mobile:
${claimantMobile}

Where the item was lost:
${lostLocation}

Unique identifying details:
${itemDetails}

Why this item belongs to me:
${claimMessage}

            `.trim();


            try {

                showToast(
                    "Submitting claim request...",
                    "info"
                );


                const response =
                    await fetch(
                        `${API_BASE}/claims`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials: "include",

                            body: JSON.stringify({

                                report_id:
                                    Number(reportId),

                                message:
                                    combinedMessage

                            })
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(function () {
                            return {};
                        });


                if (
                    !response.ok ||
                    data.success === false
                ) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        `Server error: ${response.status}`
                    );

                }


                showToast(
                    "Claim request submitted successfully!",
                    "success"
                );


                form.reset();


                closeClaimModal();


                await loadNotifications();


                if (isAdmin()) {

                    await loadAdminClaims();

                }


            } catch (error) {

                console.error(
                    "Claim submission error:",
                    error
                );


                showToast(
                    error.message ||
                    "Failed to submit claim.",
                    "error"
                );

            }

        }
    );
}


/* ============================================================
   AI MATCHES
============================================================ */

async function loadMatches() {

    const container =
        document.getElementById(
            "aiMatches"
        );


    if (!container) {

        console.warn(
            "AI matches container #aiMatches not found."
        );

        return;
    }


    container.innerHTML = `

        <div class="loading-state">

            <p>
                🤖 CampusFind AI is analyzing possible matches...
            </p>

        </div>

    `;


    try {

        const response =
            await fetch(
                `${API_BASE}/matches`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        console.log(
            "AI MATCH API RESPONSE:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        const matches =
            Array.isArray(data.matches)
                ? data.matches
                : [];


        if (matches.length === 0) {

            container.innerHTML = `

                <div class="empty-state">

                    <h3>
                        No Possible Matches Yet
                    </h3>

                    <p>
                        CampusFind AI could not find a matching
                        lost and found item yet.
                    </p>

                    <p>
                        Try adding more detailed item names,
                        categories, locations and descriptions.
                    </p>

                </div>

            `;

            return;
        }


        container.innerHTML =
            matches
                .map(function (match) {

                    const lost =
                        match.lost || {};


                    const found =
                        match.found || {};


                    const score =
                        Number(
                            match.match_score ??
                            match.score ??
                            match.confidence ??
                            0
                        );


                    const confidence =
                        match.confidence &&
                        typeof match.confidence === "string"

                            ? match.confidence

                            : (
                                score >= 70
                                    ? "High"
                                    : score >= 40
                                        ? "Medium"
                                        : "Possible"
                            );


                    const lostName =
                        lost.item_name ||
                        lost.name ||
                        "Lost Item";


                    const foundName =
                        found.item_name ||
                        found.name ||
                        "Found Item";


                    const lostCategory =
                        lost.category ||
                        "Other";


                    const foundCategory =
                        found.category ||
                        "Other";


                    const lostLocation =
                        lost.location ||
                        "Unknown";


                    const foundLocation =
                        found.location ||
                        "Unknown";


                    const lostDescription =
                        lost.description ||
                        "No description provided.";


                    const foundDescription =
                        found.description ||
                        "No description provided.";


                    const lostImage =
                        lost.image_url ||
                        lost.image ||
                        "";


                    const foundImage =
                        found.image_url ||
                        found.image ||
                        "";


                    return `

                        <div class="match-card">

                            <div class="match-header">

                                <div>

                                    <h3>
                                        🤖 Possible Match
                                    </h3>

                                    <span class="match-confidence">

                                        ${escapeHTML(
                                            confidence
                                        )}
                                        Confidence

                                    </span>

                                </div>


                                <div class="match-score">

                                    ${escapeHTML(
                                        score
                                    )}%

                                </div>

                            </div>


                            <div class="match-items">


                                <!-- LOST ITEM -->

                                <div class="match-item lost-match">

                                    ${
                                        lostImage

                                            ? `
                                                <img
                                                    src="${escapeHTML(
                                                        lostImage
                                                    )}"
                                                    alt="${escapeHTML(
                                                        lostName
                                                    )}"
                                                    class="match-image"
                                                    onerror="this.style.display='none';"
                                                >
                                            `

                                            : ""
                                    }


                                    <span class="match-label lost-label">

                                        LOST ITEM

                                    </span>


                                    <h4>

                                        ${escapeHTML(
                                            lostName
                                        )}

                                    </h4>


                                    <p>

                                        <strong>
                                            Category:
                                        </strong>

                                        ${escapeHTML(
                                            lostCategory
                                        )}

                                    </p>


                                    <p>

                                        <strong>
                                            Location:
                                        </strong>

                                        ${escapeHTML(
                                            lostLocation
                                        )}

                                    </p>


                                    <p>

                                        <strong>
                                            Description:
                                        </strong>

                                        ${escapeHTML(
                                            lostDescription
                                        )}

                                    </p>

                                </div>


                                <div class="match-arrow">
                                    ⇄
                                </div>


                                <!-- FOUND ITEM -->

                                <div class="match-item found-match">

                                    ${
                                        foundImage

                                            ? `
                                                <img
                                                    src="${escapeHTML(
                                                        foundImage
                                                    )}"
                                                    alt="${escapeHTML(
                                                        foundName
                                                    )}"
                                                    class="match-image"
                                                    onerror="this.style.display='none';"
                                                >
                                            `

                                            : ""
                                    }


                                    <span class="match-label found-label">

                                        FOUND ITEM

                                    </span>


                                    <h4>

                                        ${escapeHTML(
                                            foundName
                                        )}

                                    </h4>


                                    <p>

                                        <strong>
                                            Category:
                                        </strong>

                                        ${escapeHTML(
                                            foundCategory
                                        )}

                                    </p>


                                    <p>

                                        <strong>
                                            Location:
                                        </strong>

                                        ${escapeHTML(
                                            foundLocation
                                        )}

                                    </p>


                                    <p>

                                        <strong>
                                            Description:
                                        </strong>

                                        ${escapeHTML(
                                            foundDescription
                                        )}

                                    </p>


                                    ${
                                        found.id

                                            ? `

                                                <button
                                                    type="button"
                                                    class="claim-btn"
                                                    onclick="openClaimModal('${escapeHTML(
                                                        found.id
                                                    )}')"
                                                >

                                                    📦 Claim This Item

                                                </button>

                                            `

                                            : ""
                                    }

                                </div>

                            </div>


                            <div class="match-footer">

                                <span>

                                    🤖 AI Match Score:

                                    <strong>
                                        ${escapeHTML(
                                            score
                                        )}%
                                    </strong>

                                </span>


                                <span>

                                    ${escapeHTML(
                                        confidence
                                    )}

                                </span>

                            </div>

                        </div>

                    `;

                })
                .join("");


    } catch (error) {

        console.error(
            "AI match error:",
            error
        );


        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    AI Matching Unavailable
                </h3>

                <p>
                    Unable to analyze possible matches right now.
                </p>

                <p>
                    Please try again after submitting lost
                    and found reports.
                </p>

            </div>

        `;

    }
}


/* ============================================================
   ADMIN - LOAD REPORTS
============================================================ */

async function loadAdminReports() {

    const container =
        document.getElementById(
            "adminReports"
        );


    if (!container) return;


    if (!isAdmin()) {

        container.innerHTML = `

            <div class="empty-state">

                <p>
                    Admin access required.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="loading-state">

            <p>
                Loading reports...
            </p>

        </div>

    `;


    try {

        const response =
            await fetch(
                `${API_BASE}/reports`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        if (Array.isArray(data)) {

            adminReports = data;

        } else if (
            Array.isArray(data.reports)
        ) {

            adminReports =
                data.reports;

        } else if (
            Array.isArray(data.data)
        ) {

            adminReports =
                data.data;

        } else {

            adminReports = [];

        }


        renderAdminReports();


    } catch (error) {

        console.error(
            "Admin reports error:",
            error
        );


        adminReports = [];


        container.innerHTML = `

            <div class="empty-state">

                <p>
                    Unable to load admin reports.
                </p>

            </div>

        `;

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
        String(
            filter || "all"
        ).toLowerCase();


    document
        .querySelectorAll(
            ".admin-filter"
        )
        .forEach(function (btn) {

            btn.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    }


    renderAdminReports();
}


/* ============================================================
   RENDER ADMIN REPORTS
============================================================ */

function renderAdminReports() {

    const container =
        document.getElementById(
            "adminReports"
        );


    if (!container) return;


    let reports =
        adminReports
            .map(normalizeReport);


    if (
        currentAdminFilter !==
        "all"
    ) {

        reports =
            reports.filter(
                function (report) {

                    return (
                        report.status ===
                        currentAdminFilter
                    );

                }
            );

    }


    if (reports.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <p>
                    No ${escapeHTML(
                        currentAdminFilter
                    )} reports found.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        reports
            .map(createAdminReportCard)
            .join("");
}


/* ============================================================
   ADMIN REPORT CARD
============================================================ */

function createAdminReportCard(
    report
) {

    const status =
        report.status ||
        "pending";


    const imageHTML =
        report.image

            ? `
                <img
                    src="${escapeHTML(
                        report.image
                    )}"
                    alt="${escapeHTML(
                        report.item_name
                    )}"
                    class="admin-report-image"
                    onerror="this.style.display='none';"
                >
            `

            : `

                <div class="admin-no-image">

                    No Image

                </div>

            `;


    let actionButtons = "";


    if (status === "pending") {

        actionButtons = `

            <div class="admin-actions">


                <button
                    type="button"
                    class="approve-btn"
                    onclick="updateReportStatus(
                        '${escapeHTML(report.id)}',
                        'approved'
                    )"
                >

                    ✓ Approve

                </button>


                <button
                    type="button"
                    class="reject-btn"
                    onclick="updateReportStatus(
                        '${escapeHTML(report.id)}',
                        'rejected'
                    )"
                >

                    ✕ Reject

                </button>


            </div>

        `;

    } else if (
        status === "approved"
    ) {

        actionButtons = `

            <div class="admin-actions">

                <span class="approved-label">

                    ✓ Approved

                </span>


                <button
                    type="button"
                    class="reject-btn"
                    onclick="updateReportStatus(
                        '${escapeHTML(report.id)}',
                        'rejected'
                    )"
                >

                    Reject

                </button>

            </div>

        `;

    } else if (
        status === "rejected"
    ) {

        actionButtons = `

            <div class="admin-actions">

                <span class="rejected-label">

                    ✕ Rejected

                </span>


                <button
                    type="button"
                    class="approve-btn"
                    onclick="updateReportStatus(
                        '${escapeHTML(report.id)}',
                        'approved'
                    )"
                >

                    Approve

                </button>

            </div>

        `;
    }


    return `

        <div class="admin-report-card">


            <div class="admin-report-image-wrapper">

                ${imageHTML}

            </div>


            <div class="admin-report-details">


                <div class="admin-report-title-row">

                    <h3>

                        ${escapeHTML(
                            report.item_name
                        )}

                    </h3>


                    <span
                        class="status-badge status-${escapeHTML(
                            status
                        )}"
                    >

                        ${escapeHTML(
                            capitalize(status)
                        )}

                    </span>

                </div>


                <p>

                    <strong>
                        Type:
                    </strong>

                    ${escapeHTML(
                        report.item_type
                    )}

                </p>


                <p>

                    <strong>
                        Category:
                    </strong>

                    ${escapeHTML(
                        report.category
                    )}

                </p>


                <p>

                    <strong>
                        Location:
                    </strong>

                    ${escapeHTML(
                        report.location
                    )}

                </p>


                ${
                    report.item_date

                        ? `
                            <p>

                                <strong>
                                    Date:
                                </strong>

                                ${escapeHTML(
                                    report.item_date
                                )}

                            </p>
                        `

                        : ""
                }


                ${
                    report.item_time

                        ? `
                            <p>

                                <strong>
                                    Time:
                                </strong>

                                ${escapeHTML(
                                    report.item_time
                                )}

                            </p>
                        `

                        : ""
                }


                ${
                    report.description

                        ? `
                            <p>

                                <strong>
                                    Description:
                                </strong>

                                ${escapeHTML(
                                    report.description
                                )}

                            </p>
                        `

                        : ""
                }


                ${actionButtons}


            </div>

        </div>

    `;
}


/* ============================================================
   APPROVE / REJECT REPORT
============================================================ */

async function updateReportStatus(
    reportId,
    newStatus
) {

    if (!isAdmin()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    if (!reportId) {

        showToast(
            "Invalid report ID.",
            "error"
        );

        return;
    }


    newStatus =
        String(
            newStatus
        ).toLowerCase();


    if (
        newStatus !== "approved" &&
        newStatus !== "rejected"
    ) {

        showToast(
            "Invalid status.",
            "error"
        );

        return;
    }


    const actionText =
        newStatus === "approved"
            ? "approve"
            : "reject";


    const confirmed =
        confirm(
            `Are you sure you want to ${actionText} this report?`
        );


    if (!confirmed) return;


    try {

        showToast(
            `${capitalize(
                actionText
            )}ing report...`,
            "info"
        );


        const response =
            await fetch(
                `${API_BASE}/reports/${encodeURIComponent(
                    reportId
                )}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        status:
                            newStatus
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (
            !response.ok ||
            data.success === false
        ) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        showToast(
            `Report ${newStatus} successfully.`,
            "success"
        );


        await loadAdminReports();

        await loadReports();

        await refreshAdminStats();

        await loadNotifications();


    } catch (error) {

        console.error(
            "Approve/Reject error:",
            error
        );


        showToast(
            error.message ||
            "Failed to update report status.",
            "error"
        );

    }
}


/* ============================================================
   ADMIN CLAIMS
============================================================ */

async function loadAdminClaims() {

    const container =
        document.getElementById(
            "adminClaims"
        );


    if (!container) return;


    if (!isAdmin()) {

        container.innerHTML = `

            <div class="empty-state">

                <p>
                    Admin access required.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML = `

        <div class="loading-state">

            <p>
                Loading claim requests...
            </p>

        </div>

    `;


    try {

        const response =
            await fetch(
                `${API_BASE}/admin/claims`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        console.log(
            "ADMIN CLAIMS RESPONSE:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        if (Array.isArray(data)) {

            adminClaims = data;

        } else if (
            Array.isArray(data.claims)
        ) {

            adminClaims =
                data.claims;

        } else if (
            Array.isArray(data.data)
        ) {

            adminClaims =
                data.data;

        } else {

            adminClaims = [];

        }


        renderAdminClaims();


    } catch (error) {

        console.error(
            "Admin claims error:",
            error
        );


        adminClaims = [];


        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    Claim Requests Unavailable
                </h3>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Unable to load claim requests."
                    )}
                </p>

            </div>

        `;

    }
}


/* ============================================================
   RENDER ADMIN CLAIMS
============================================================ */

function renderAdminClaims() {

    const container =
        document.getElementById(
            "adminClaims"
        );


    if (!container) return;


    if (adminClaims.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    No Claim Requests
                </h3>

                <p>
                    No students have claimed a found item yet.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        adminClaims
            .map(
                createAdminClaimCard
            )
            .join("");
}


/* ============================================================
   CREATE ADMIN CLAIM CARD
============================================================ */

function createAdminClaimCard(
    claim
) {

    const claimId =
        claim.id ||
        claim.claim_id ||
        "";


    const reportId =
        claim.report_id ||
        claim.item_id ||
        "";


    const status =
        String(
            claim.status ||
            "pending"
        ).toLowerCase();


    const itemName =
        claim.item_name ||
        claim.report_item_name ||
        claim.title ||
        "Found Item";


    const claimantName =
        claim.claimant_name ||
        claim.name ||
        claim.user_name ||
        claim.full_name ||
        "Unknown";


    const claimantEmail =
        claim.claimant_email ||
        claim.email ||
        "Not provided";


    const claimantMobile =
        claim.claimant_mobile ||
        claim.mobile ||
        claim.phone ||
        "Not provided";


    const message =
        claim.message ||
        claim.claim_message ||
        "No claim message provided.";


    const createdAt =
        claim.created_at ||
        claim.createdAt ||
        "";


    /*
     * Find AI score for this found report.
     *
     * adminClaims may contain the report ID,
     * while /api/matches returns lost/found objects.
     */

    const aiScore =
        findClaimAIScore(
            reportId
        );


    let aiScoreHTML = `

        <div class="claim-ai-score">

            🤖 AI Match Percentage:

            <strong>
                ${escapeHTML(
                    aiScore
                )}%
            </strong>

        </div>

    `;


    let actionHTML = "";


    if (status === "pending") {

        actionHTML = `

            <div class="claim-actions">


                <button
                    type="button"
                    class="claim-approve-btn"
                    onclick="updateClaimStatus(
                        '${escapeHTML(
                            claimId
                        )}',
                        'approved'
                    )"
                >

                    ✓ Approve Claim

                </button>


                <button
                    type="button"
                    class="claim-reject-btn"
                    onclick="updateClaimStatus(
                        '${escapeHTML(
                            claimId
                        )}',
                        'rejected'
                    )"
                >

                    ✕ Reject Claim

                </button>


            </div>

        `;

    } else if (
        status === "approved"
    ) {

        actionHTML = `

            <div class="claim-actions">

                <span class="approved-label">

                    ✓ Claim Approved

                </span>

            </div>

        `;

    } else if (
        status === "rejected"
    ) {

        actionHTML = `

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
                        ${escapeHTML(
                            itemName
                        )}

                    </h3>


                    <small>

                        Claim ID:
                        ${escapeHTML(
                            claimId
                        )}

                    </small>

                </div>


                <span
                    class="admin-claim-status ${escapeHTML(
                        status
                    )}"
                >

                    ${escapeHTML(
                        capitalize(status)
                    )}

                </span>

            </div>



            <!-- CLAIMANT DETAILS -->

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



            <!-- CLAIM MESSAGE -->

            <div class="claim-message">

                <strong>
                    Claim Details
                </strong>

                <p>

                    ${escapeHTML(
                        message
                    ).replace(
                        /\n/g,
                        "<br>"
                    )}

                </p>

            </div>



            <!-- AI SCORE -->

            ${aiScoreHTML}



            <!-- ACTIONS -->

            ${actionHTML}


        </div>

    `;
}


/* ============================================================
   FIND AI SCORE FOR CLAIM
============================================================ */

function findClaimAIScore(
    reportId
) {

    /*
     * Default value.
     */

    let bestScore = 0;


    /*
     * If matches have not been loaded,
     * return 0.
     *
     * We fetch them synchronously through
     * cache only if available later.
     */

    if (
        !window.campusFindMatches ||
        !Array.isArray(
            window.campusFindMatches
        )
    ) {

        return bestScore;

    }


    const matches =
        window.campusFindMatches;


    matches.forEach(function (match) {

        const found =
            match.found || {};


        const foundId =
            found.id ||
            found.report_id ||
            found._id ||
            "";


        if (
            String(foundId) ===
            String(reportId)
        ) {

            const score =
                Number(
                    match.match_score ??
                    match.score ??
                    0
                );


            if (score > bestScore) {

                bestScore =
                    score;

            }

        }

    });


    return Math.round(
        bestScore
    );
}


/* ============================================================
   UPDATE CLAIM STATUS
============================================================ */

async function updateClaimStatus(
    claimId,
    newStatus
) {

    if (!isAdmin()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    if (!claimId) {

        showToast(
            "Invalid claim ID.",
            "error"
        );

        return;
    }


    newStatus =
        String(
            newStatus
        ).toLowerCase();


    if (
        newStatus !== "approved" &&
        newStatus !== "rejected"
    ) {

        showToast(
            "Invalid claim status.",
            "error"
        );

        return;
    }


    const action =
        newStatus === "approved"
            ? "approve"
            : "reject";


    const confirmed =
        confirm(
            `Are you sure you want to ${action} this claim?`
        );


    if (!confirmed) return;


    try {

        showToast(
            `${capitalize(
                action
            )}ing claim...`,
            "info"
        );


        const response =
            await fetch(
                `${API_BASE}/admin/claims/${encodeURIComponent(
                    claimId
                )}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        status:
                            newStatus
                    })
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (
            !response.ok ||
            data.success === false
        ) {

            throw new Error(
                data.message ||
                data.error ||
                `Server error: ${response.status}`
            );

        }


        showToast(
            `Claim ${newStatus} successfully.`,
            "success"
        );


        await loadAdminClaims();

        await loadNotifications();


    } catch (error) {

        console.error(
            "Claim status error:",
            error
        );


        showToast(
            error.message ||
            "Unable to update claim status.",
            "error"
        );

    }
}


/* ============================================================
   ADMIN STATS
============================================================ */

async function refreshAdminStats() {

    if (!isAdmin()) return;


    try {

        let reports =
            adminReports;


        if (
            !reports ||
            reports.length === 0
        ) {

            const response =
                await fetch(
                    `${API_BASE}/reports`,
                    {
                        method: "GET",
                        credentials: "include"
                    }
                );


            const data =
                await response
                    .json()
                    .catch(function () {
                        return {};
                    });


            if (Array.isArray(data)) {

                reports = data;

            } else if (
                Array.isArray(data.reports)
            ) {

                reports =
                    data.reports;

            } else {

                reports = [];

            }


            adminReports =
                reports;

        }


        const normalized =
            reports.map(
                normalizeReport
            );


        const total =
            normalized.length;


        const lost =
            normalized.filter(
                function (report) {

                    return (
                        report.item_type ===
                        "lost"
                    );

                }
            ).length;


        const found =
            normalized.filter(
                function (report) {

                    return (
                        report.item_type ===
                        "found"
                    );

                }
            ).length;


        const totalElement =
            document.getElementById(
                "adminTotalReports"
            );


        const lostElement =
            document.getElementById(
                "adminLostCount"
            );


        const foundElement =
            document.getElementById(
                "adminFoundCount"
            );


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


        await loadAdminUserCount();


    } catch (error) {

        console.error(
            "Admin stats error:",
            error
        );

    }
}


/* ============================================================
   ADMIN USER COUNT
============================================================ */

async function loadAdminUserCount() {

    const element =
        document.getElementById(
            "adminUserCount"
        );


    if (!element) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/users`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (!response.ok) return;


        const data =
            await response.json();


        let users = [];


        if (Array.isArray(data)) {

            users = data;

        } else if (
            Array.isArray(data.users)
        ) {

            users =
                data.users;

        }


        element.textContent =
            users.length;


    } catch (error) {

        console.warn(
            "User count unavailable:",
            error
        );

    }
}


/* ============================================================
   LOAD ADMIN USERS
============================================================ */

async function loadAdminUsers() {

    if (!isAdmin()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/users`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to load users."
            );

        }


        const users =
            Array.isArray(data)
                ? data
                : Array.isArray(data.users)
                    ? data.users
                    : [];


        const element =
            document.getElementById(
                "adminUserCount"
            );


        if (element) {

            element.textContent =
                users.length;

        }


        const usersContainer =
            document.getElementById(
                "adminUsers"
            );


        if (
            usersContainer
        ) {

            if (users.length === 0) {

                usersContainer.innerHTML = `

                    <div class="empty-state">

                        <p>
                            No users found.
                        </p>

                    </div>

                `;

            } else {

                usersContainer.innerHTML =
                    users
                        .map(
                            function (user) {

                                return `

                                    <div class="admin-user-card">

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
                                                user.role ||
                                                "student"
                                            )}

                                        </span>

                                    </div>

                                `;

                            }
                        )
                        .join("");

            }

        }


    } catch (error) {

        console.error(
            "Admin users error:",
            error
        );


        showToast(
            "User information is unavailable.",
            "error"
        );

    }
}


/* ============================================================
   LOGIN
============================================================ */

function setupLoginForm() {

    const form =
        document.getElementById(
            "loginForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const emailElement =
                document.getElementById(
                    "loginEmail"
                );


            const passwordElement =
                document.getElementById(
                    "loginPassword"
                );


            if (
                !emailElement ||
                !passwordElement
            ) {

                return;

            }


            const email =
                emailElement.value.trim();


            const password =
                passwordElement.value;


            if (!email || !password) {

                showToast(
                    "Please enter email and password.",
                    "error"
                );

                return;
            }


            try {

                const response =
                    await fetch(
                        `${API_BASE}/login`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials: "include",

                            body: JSON.stringify({
                                email:
                                    email,

                                password:
                                    password
                            })
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(function () {
                            return {};
                        });


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        "Invalid login details."
                    );

                }


                currentUser =
                    data.user ||
                    data.data ||
                    null;


                if (!currentUser) {

                    throw new Error(
                        "Login succeeded but user information was not returned."
                    );

                }


                localStorage.setItem(
                    "campusfindUser",
                    JSON.stringify(
                        currentUser
                    )
                );


                updateUserUI();


                closeModal(
                    "loginModal"
                );


                showToast(
                    "Login successful!",
                    "success"
                );


                await loadReports();

                await loadNotifications();


                if (isAdmin()) {

                    showAdminMenu();

                    await loadAdminReports();

                    await refreshAdminStats();

                    await loadAdminClaims();

                }


                showSection(
                    "dashboard"
                );


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

            }

        }
    );
}


/* ============================================================
   REGISTER
============================================================ */

function setupRegisterForm() {

    const form =
        document.getElementById(
            "registerForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const nameElement =
                document.getElementById(
                    "registerName"
                );


            const emailElement =
                document.getElementById(
                    "registerEmail"
                );


            const roleElement =
                document.getElementById(
                    "registerRole"
                );


            const passwordElement =
                document.getElementById(
                    "registerPassword"
                );


            if (
                !nameElement ||
                !emailElement ||
                !roleElement ||
                !passwordElement
            ) {

                return;

            }


            const name =
                nameElement.value.trim();


            const email =
                emailElement.value.trim();


            const role =
                roleElement.value;


            const password =
                passwordElement.value;


            if (
                !name ||
                !email ||
                !role ||
                !password
            ) {

                showToast(
                    "Please fill all required fields.",
                    "error"
                );

                return;
            }


            try {

                const response =
                    await fetch(
                        `${API_BASE}/register`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            credentials: "include",

                            body: JSON.stringify({
                                name:
                                    name,

                                email:
                                    email,

                                role:
                                    role,

                                password:
                                    password
                            })
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(function () {
                            return {};
                        });


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        data.error ||
                        "Registration failed."
                    );

                }


                showToast(
                    "Account created successfully!",
                    "success"
                );


                form.reset();


                closeModal(
                    "registerModal"
                );


                showLogin();


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

            }

        }
    );
}


/* ============================================================
   LOGOUT
============================================================ */

async function logoutUser() {

    try {

        await fetch(
            `${API_BASE}/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    }


    currentUser = null;


    localStorage.removeItem(
        "campusfindUser"
    );


    hideAdminMenu();


    updateUserUI();


    showToast(
        "Logged out successfully.",
        "success"
    );


    showLogin();
}


/* ============================================================
   LOGIN MODAL
============================================================ */

function showLogin() {

    closeModal(
        "registerModal"
    );


    const modal =
        document.getElementById(
            "loginModal"
        );


    if (modal) {

        modal.style.display =
            "flex";

    }
}


/* ============================================================
   REGISTER MODAL
============================================================ */

function showRegister() {

    closeModal(
        "loginModal"
    );


    const modal =
        document.getElementById(
            "registerModal"
        );


    if (modal) {

        modal.style.display =
            "flex";

    }
}


/* ============================================================
   CLOSE MODAL
============================================================ */

function closeModal(id) {

    const modal =
        document.getElementById(id);


    if (modal) {

        modal.style.display =
            "none";

    }
}


/* ============================================================
   PASSWORD TOGGLE
============================================================ */

function togglePassword(
    inputId
) {

    const input =
        document.getElementById(
            inputId
        );


    if (!input) return;


    input.type =
        input.type === "password"
            ? "text"
            : "password";
}


function toggleRegisterPassword() {

    togglePassword(
        "registerPassword"
    );

}


/* ============================================================
   NOTIFICATIONS
============================================================ */

async function openNotifications() {

    const panel =
        document.getElementById(
            "notificationPanel"
        );


    if (panel) {

        panel.style.display =
            panel.style.display === "none" ||
            panel.style.display === ""

                ? "block"

                : "none";

    }


    await loadNotifications();
}


/* ============================================================
   CLOSE NOTIFICATIONS
============================================================ */

function closeNotifications() {

    const panel =
        document.getElementById(
            "notificationPanel"
        );


    if (panel) {

        panel.style.display =
            "none";

    }
}


/* ============================================================
   LOAD NOTIFICATIONS
============================================================ */

async function loadNotifications() {

    const panelList =
        document.getElementById(
            "notificationsList"
        );


    const mainList =
        document.getElementById(
            "notificationList"
        );


    const list =
        panelList ||
        mainList;


    if (!list) return;


    try {

        const response =
            await fetch(
                `${API_BASE}/notifications`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Notifications unavailable."
            );

        }


        const data =
            await response.json();


        const notifications =
            Array.isArray(data)

                ? data

                : Array.isArray(
                    data.notifications
                )

                    ? data.notifications

                    : [];


        if (
            notifications.length === 0
        ) {

            list.innerHTML = `

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

            return;
        }


        list.innerHTML =
            notifications
                .map(
                    function (
                        notification
                    ) {

                        return `

                            <div class="notification-item">

                                <strong>

                                    ${escapeHTML(
                                        notification.title ||
                                        "CampusFind"
                                    )}

                                </strong>


                                <p>

                                    ${escapeHTML(
                                        notification.message ||
                                        ""
                                    )}

                                </p>

                            </div>

                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.warn(
            "Notifications unavailable:",
            error
        );


        list.innerHTML = `

            <div class="empty-state">

                <p>
                    No notifications available.
                </p>

            </div>

        `;

    }
}


/* ============================================================
   CLEAR NOTIFICATIONS
============================================================ */

async function clearNotifications() {

    try {

        const response =
            await fetch(
                `${API_BASE}/notifications/clear`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to clear notifications."
            );

        }


        showToast(
            "Notifications cleared.",
            "success"
        );


        await loadNotifications();


    } catch (error) {

        console.warn(
            "Clear notifications error:",
            error
        );


        showToast(
            "Unable to clear notifications.",
            "error"
        );

    }
}


/* ============================================================
   TOAST
============================================================ */

function showToast(
    message,
    type
) {

    const toast =
        document.getElementById(
            "toast"
        );


    const toastMessage =
        document.getElementById(
            "toastMessage"
        );


    const toastIcon =
        document.getElementById(
            "toastIcon"
        );


    if (!toast) {

        console.log(message);

        return;
    }


    if (toastMessage) {

        toastMessage.textContent =
            message;

    }


    if (toastIcon) {

        if (type === "success") {

            toastIcon.textContent =
                "✓";

        } else if (
            type === "error"
        ) {

            toastIcon.textContent =
                "✕";

        } else {

            toastIcon.textContent =
                "ℹ";

        }

    }


    toast.className =
        "toast";


    if (type) {

        toast.classList.add(
            type
        );

    }


    toast.style.display =
        "flex";


    clearTimeout(
        window.campusFindToastTimer
    );


    window.campusFindToastTimer =
        setTimeout(
            function () {

                toast.style.display =
                    "none";

            },
            3000
        );
}


/* ============================================================
   HELPER - CAPITALIZE
============================================================ */

function capitalize(value) {

    if (!value) return "";


    const text =
        String(value);


    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


/* ============================================================
   HELPER - ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* ============================================================
   CLOSE MODALS WHEN CLICKING OUTSIDE
============================================================ */

window.addEventListener(
    "click",
    function (event) {

        const loginModal =
            document.getElementById(
                "loginModal"
            );


        const registerModal =
            document.getElementById(
                "registerModal"
            );


        const claimModal =
            document.getElementById(
                "claimModal"
            );


        if (
            loginModal &&
            event.target === loginModal
        ) {

            closeModal(
                "loginModal"
            );

        }


        if (
            registerModal &&
            event.target === registerModal
        ) {

            closeModal(
                "registerModal"
            );

        }


        if (
            claimModal &&
            event.target === claimModal
        ) {

            closeClaimModal();

        }

    }
);


/* ============================================================
   STORE AI MATCHES
   Used by Admin Claim AI percentage
============================================================ */

async function loadMatchesAndStore() {

    try {

        const response =
            await fetch(
                `${API_BASE}/matches`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );


        const data =
            await response
                .json()
                .catch(function () {
                    return {};
                });


        window.campusFindMatches =
            Array.isArray(data.matches)
                ? data.matches
                : [];


        return window.campusFindMatches;


    } catch (error) {

        console.warn(
            "Unable to load AI matches:",
            error
        );


        window.campusFindMatches =
            [];


        return [];

    }
}


/* ============================================================
   UPDATE ORIGINAL LOAD MATCHES TO ALSO STORE MATCHES
============================================================ */

const originalLoadMatches =
    loadMatches;


/*
 * Wrapper:
 * First fetch/store AI matches,
 * then render the AI section.
 */

loadMatches = async function () {

    await loadMatchesAndStore();

    return originalLoadMatches();

};


/* ============================================================
   MAKE FUNCTIONS AVAILABLE TO HTML ONCLICK
============================================================ */

window.showSection =
    showSection;


window.openReport =
    openReport;


window.loadReports =
    loadReports;


window.loadMatches =
    loadMatches;


window.loadAdminReports =
    loadAdminReports;


window.loadAdminClaims =
    loadAdminClaims;


window.loadAdminUsers =
    loadAdminUsers;


window.refreshAdminStats =
    refreshAdminStats;


window.setAdminFilter =
    setAdminFilter;


window.updateReportStatus =
    updateReportStatus;


window.openClaimModal =
    openClaimModal;


window.closeClaimModal =
    closeClaimModal;


window.updateClaimStatus =
    updateClaimStatus;


window.showLogin =
    showLogin;


window.showRegister =
    showRegister;


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


window.clearNotifications =
    clearNotifications;


window.showToast =
    showToast;


console.log(
    "CampusFind script.js initialized successfully."
);