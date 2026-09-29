/* ============================================================
   CAMPUSFIND - LOST & FOUND AI
   COMPLETE JAVASCRIPT
   Login + Register + Dashboard + Reports + AI + Claims
   Notifications + Admin Approve/Reject + Admin Users
============================================================ */


/* ============================================================
   GLOBAL STATE
============================================================ */

let currentUser = null;

let allReports = [];
let allMatches = [];
let allNotifications = [];
let allAdminClaims = [];
let allAdminUsers = [];

let currentAdminFilter = "all";

let isLoggingOut = false;


/* ============================================================
   DOM HELPER
============================================================ */

function $(id) {
    return document.getElementById(id);
}


/* ============================================================
   ARRAY HELPER
============================================================ */

function getArray(data, keys = []) {

    if (Array.isArray(data)) {
        return data;
    }

    for (const key of keys) {

        if (Array.isArray(data?.[key])) {
            return data[key];
        }

    }

    return [];
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

    if (!value) {
        return "";
    }

    return String(value).charAt(0).toUpperCase() +
           String(value).slice(1);
}


/* ============================================================
   DATE FORMAT
============================================================ */

function formatDate(value) {

    if (!value) {
        return "N/A";
    }

    try {

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    } catch (error) {

        return value;
    }
}


/* ============================================================
   TIME FORMAT
============================================================ */

function formatTime(value) {

    if (!value) {
        return "";
    }

    return value;
}


/* ============================================================
   TOAST
============================================================ */

function showToast(message, type = "success") {

    const toast = $("toast");
    const toastMessage = $("toastMessage");
    const toastIcon = $("toastIcon");

    if (!toast || !toastMessage) {
        alert(message);
        return;
    }

    toastMessage.textContent = message;

    if (toastIcon) {

        if (type === "error") {
            toastIcon.textContent = "!";
            toastIcon.style.background = "#fef2f2";
            toastIcon.style.color = "#dc2626";
        }

        else if (type === "warning") {
            toastIcon.textContent = "!";
            toastIcon.style.background = "#fffbeb";
            toastIcon.style.color = "#d97706";
        }

        else {
            toastIcon.textContent = "✓";
            toastIcon.style.background = "#ecfdf3";
            toastIcon.style.color = "#16a34a";
        }
    }

    toast.classList.add("show");

    clearTimeout(window.campusFindToastTimer);

    window.campusFindToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


/* ============================================================
   API REQUEST
============================================================ */

async function apiRequest(url, options = {}) {

    const config = {
        credentials: "include",
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    if (
        config.body &&
        !(config.body instanceof FormData) &&
        typeof config.body === "object"
    ) {

        config.headers["Content-Type"] = "application/json";

        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);

    let data = {};

    try {
        data = await response.json();
    }

    catch (error) {

        data = {};
    }

    if (!response.ok) {

        const message =
            data.message ||
            data.error ||
            `Request failed (${response.status})`;

        throw new Error(message);
    }

    return data;
}


/* ============================================================
   ADMIN CHECK
============================================================ */

function isAdminUser() {

    if (!currentUser) {
        return false;
    }

    const role = String(
        currentUser.role ||
        currentUser.user_role ||
        ""
    ).toLowerCase();

    return role === "admin";
}


function isAdmin() {
    return isAdminUser();
}


/* ============================================================
   APP VISIBILITY
============================================================ */

function setAppVisible(visible) {

    const firstScreen = $("loginFirstScreen");

    const sidebar = document.querySelector(".sidebar");

    const mainContent = document.querySelector(".main-content");


    if (visible) {

        console.log("SHOWING APPLICATION");

        if (firstScreen) {

            firstScreen.classList.add("hidden");

            firstScreen.style.display = "none";

            firstScreen.style.pointerEvents = "none";

            firstScreen.style.visibility = "hidden";
        }

        if (sidebar) {

            sidebar.style.display = "";

            sidebar.style.pointerEvents = "auto";
        }

        if (mainContent) {

            mainContent.style.display = "";

            mainContent.style.pointerEvents = "auto";
        }
    }

    else {

        console.log("SHOWING LOGIN SCREEN");

        if (firstScreen) {

            firstScreen.classList.remove("hidden");

            firstScreen.style.display = "flex";

            firstScreen.style.pointerEvents = "auto";

            firstScreen.style.visibility = "visible";
        }

        if (sidebar) {

            sidebar.style.display = "none";
        }

        if (mainContent) {

            mainContent.style.display = "none";
        }
    }
}


/* ============================================================
   USER UI
============================================================ */

function updateUserUI() {

    if (!currentUser) {
        return;
    }


    const name =
        currentUser.name ||
        currentUser.username ||
        currentUser.email ||
        "User";


    const role =
        currentUser.role ||
        currentUser.user_role ||
        "student";


    /* USER NAME */

    const possibleNameElements = document.querySelectorAll(
        "#userName, .user-name, [data-user-name]"
    );

    possibleNameElements.forEach(element => {
        element.textContent = name;
    });


    /* USER ROLE */

    const possibleRoleElements = document.querySelectorAll(
        "#userRole, .user-role, [data-user-role]"
    );

    possibleRoleElements.forEach(element => {
        element.textContent = capitalize(role);
    });


    /* AVATAR */

    const avatarElements = document.querySelectorAll(
        "#userAvatar, .avatar"
    );

    avatarElements.forEach(element => {

        const firstLetter =
            String(name).trim().charAt(0).toUpperCase() || "U";

        element.textContent = firstLetter;
    });


    /* ADMIN NAVIGATION */

    document.querySelectorAll(".admin-only").forEach(element => {

        if (isAdminUser()) {

            element.style.display = "";

        }

        else {

            element.style.display = "none";
        }
    });


    /* ADMIN SECTION PROTECTION */

    const adminSection = $("admin");

    if (adminSection && !isAdminUser()) {

        adminSection.classList.remove("active");
    }
}


/* ============================================================
   CHECK CURRENT USER
============================================================ */

async function checkCurrentUser() {

    try {

        const response = await fetch("/api/me", {
            method: "GET",
            credentials: "include"
        });


        const data = await response.json();


        console.log("API ME RESPONSE:", data);


        let user = null;


        if (data.user) {

            user = data.user;
        }

        else if (
            data.data &&
            data.data.user
        ) {

            user = data.data.user;
        }

        else if (
            data.authenticated === true &&
            data.email
        ) {

            user = data;
        }

        else if (
            data.logged_in === true &&
            data.email
        ) {

            user = data;
        }

        else if (
            data.is_authenticated === true &&
            data.email
        ) {

            user = data;
        }


        if (user) {

            currentUser = user;

            setAppVisible(true);

            updateUserUI();

            await loadApplicationData();

            return true;
        }


        currentUser = null;

        setAppVisible(false);

        return false;

    }

    catch (error) {

        console.error("API ME ERROR:", error);

        currentUser = null;

        setAppVisible(false);

        return false;
    }
}


/* ============================================================
   LOGIN MODAL
============================================================ */

function showLogin() {

    const registerModal = $("registerModal");
    const loginModal = $("loginModal");

    if (registerModal) {
        registerModal.classList.remove("active", "show");
        registerModal.style.display = "none";
    }

    if (loginModal) {

        loginModal.classList.add("active");

        loginModal.style.display = "flex";

        setTimeout(() => {

            const email = $("loginEmail");

            if (email) {
                email.focus();
            }

        }, 100);
    }
}


/* ============================================================
   REGISTER MODAL
============================================================ */

function showRegister() {

    const loginModal = $("loginModal");
    const registerModal = $("registerModal");

    if (loginModal) {

        loginModal.classList.remove("active", "show");

        loginModal.style.display = "none";
    }

    if (registerModal) {

        registerModal.classList.add("active");

        registerModal.style.display = "flex";

        setTimeout(() => {

            const name = $("registerName");

            if (name) {
                name.focus();
            }

        }, 100);
    }
}


/* ============================================================
   CLOSE MODAL
============================================================ */

function closeModal(modalId) {

    const modal = $(modalId);

    if (!modal) {
        return;
    }

    modal.classList.remove("active", "show");

    modal.style.display = "none";
}


/* ============================================================
   PASSWORD TOGGLE
============================================================ */

function togglePassword(inputId) {

    const input = $(inputId);

    if (!input) {
        return;
    }

    input.type =
        input.type === "password"
            ? "text"
            : "password";
}


function toggleRegisterPassword() {

    togglePassword("registerPassword");
}


/* ============================================================
   LOGIN
============================================================ */

async function handleLogin(event) {

    if (event) {
        event.preventDefault();
    }


    const emailInput = $("loginEmail");

    const passwordInput = $("loginPassword");


    if (!emailInput || !passwordInput) {

        showToast(
            "Login form not found.",
            "error"
        );

        return;
    }


    const email = emailInput.value.trim();

    const password = passwordInput.value;


    if (!email || !password) {

        showToast(
            "Please enter email and password.",
            "warning"
        );

        return;
    }


    const submitButton =
        document.querySelector("#loginForm button[type='submit']");


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.dataset.oldText =
            submitButton.textContent;

        submitButton.textContent = "Logging in...";
    }


    try {

        const data = await apiRequest(
            "/api/login",
            {
                method: "POST",
                body: {
                    email: email,
                    password: password
                }
            }
        );


        console.log("LOGIN RESPONSE:", data);


        let user =
            data.user ||
            data.data?.user ||
            null;


        if (!user && data.email) {
            user = data;
        }


        if (!user) {

            /*
               Some backends return only success=true.
               In that case /api/me gives the actual user.
            */

            await checkCurrentUser();

            if (!currentUser) {

                throw new Error(
                    data.message ||
                    "Login failed."
                );
            }
        }

        else {

            currentUser = user;

            setAppVisible(true);

            updateUserUI();

            await loadApplicationData();
        }


        closeModal("loginModal");


        if (emailInput) {
            emailInput.value = "";
        }

        if (passwordInput) {
            passwordInput.value = "";
        }


        showToast(
            data.message || "Login successful!",
            "success"
        );


        showSection("dashboard");


    }

    catch (error) {

        console.error("LOGIN ERROR:", error);

        showToast(
            error.message || "Login failed.",
            "error"
        );
    }


    finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.oldText ||
                "Login";
        }
    }
}


/* ============================================================
   REGISTER
============================================================ */

async function handleRegister(event) {

    if (event) {
        event.preventDefault();
    }


    const nameInput = $("registerName");
    const emailInput = $("registerEmail");
    const roleInput = $("registerRole");
    const passwordInput = $("registerPassword");


    if (
        !nameInput ||
        !emailInput ||
        !passwordInput
    ) {

        showToast(
            "Registration form not found.",
            "error"
        );

        return;
    }


    const name = nameInput.value.trim();

    const email = emailInput.value.trim();

    const role =
        roleInput?.value ||
        "student";

    const password =
        passwordInput.value;


    if (!name || !email || !password) {

        showToast(
            "Please fill all required fields.",
            "warning"
        );

        return;
    }


    if (password.length < 6) {

        showToast(
            "Password must contain at least 6 characters.",
            "warning"
        );

        return;
    }


    const submitButton =
        document.querySelector(
            "#registerForm button[type='submit']"
        );


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.dataset.oldText =
            submitButton.textContent;

        submitButton.textContent =
            "Creating account...";
    }


    try {

        const data = await apiRequest(
            "/api/register",
            {
                method: "POST",

                body: {
                    name: name,
                    email: email,
                    role: role,
                    password: password
                }
            }
        );


        console.log(
            "REGISTER RESPONSE:",
            data
        );


        showToast(
            data.message ||
            "Registration successful. Please login.",
            "success"
        );


        closeModal("registerModal");

        showLogin();


        if ($("loginEmail")) {
            $("loginEmail").value = email;
        }


    }

    catch (error) {

        console.error(
            "REGISTER ERROR:",
            error
        );

        showToast(
            error.message ||
            "Registration failed.",
            "error"
        );
    }


    finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.oldText ||
                "Register";
        }
    }
}


/* ============================================================
   LOGOUT
============================================================ */

async function logoutUser() {

    if (isLoggingOut) {
        return;
    }

    isLoggingOut = true;


    try {

        await apiRequest(
            "/api/logout",
            {
                method: "POST"
            }
        );

    }

    catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );
    }


    currentUser = null;

    allReports = [];
    allMatches = [];
    allNotifications = [];
    allAdminClaims = [];
    allAdminUsers = [];


    setAppVisible(false);


    showToast(
        "Logged out successfully.",
        "success"
    );


    isLoggingOut = false;
}


/* ============================================================
   SHOW SECTION
============================================================ */

function showSection(sectionId) {

    console.log(
        "Opening section:",
        sectionId
    );


    if (!currentUser) {

        showLogin();

        return;
    }


    if (
        sectionId === "admin" &&
        !isAdminUser()
    ) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    document.querySelectorAll(".section").forEach(section => {

        section.classList.remove("active");

    });


    const target = $(sectionId);


    if (!target) {

        console.error(
            "Section not found:",
            sectionId
        );

        return;
    }


    target.classList.add("active");


    document.querySelectorAll(".nav-item").forEach(item => {

        item.classList.remove("active");

    });


    const navButton =
        document.querySelector(
            `.nav-item[data-section="${sectionId}"]`
        );


    if (navButton) {

        navButton.classList.add("active");
    }


    if (sectionId === "dashboard") {

        loadReports();
    }

    else if (sectionId === "lost") {

        loadLostReports();
    }

    else if (sectionId === "found") {

        loadFoundReports();
    }

    else if (sectionId === "ai") {

        loadAIMatches();
    }

    else if (sectionId === "notifications") {

        loadNotifications();
    }

    else if (sectionId === "admin") {

        loadAdminPanel();
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ============================================================
   OPEN REPORT
============================================================ */

function openReport(type) {

    showSection("report");


    const itemType = $("item_type");


    if (itemType) {

        itemType.value = type || "lost";
    }


    const reportHeading =
        document.querySelector(
            "#report .page-heading h1"
        );


    if (reportHeading) {

        reportHeading.textContent =
            type === "found"
                ? "Report Found Item"
                : "Report Lost Item";
    }
}


/* ============================================================
   IMAGE PREVIEW
============================================================ */

function previewImage(event) {

    const file =
        event?.target?.files?.[0];

    const preview =
        $("imagePreview");


    if (!preview) {
        return;
    }


    if (!file) {

        preview.innerHTML = "";

        return;
    }


    if (!file.type.startsWith("image/")) {

        preview.innerHTML = "";

        showToast(
            "Please select an image file.",
            "error"
        );

        event.target.value = "";

        return;
    }


    if (file.size > 10 * 1024 * 1024) {

        preview.innerHTML = "";

        showToast(
            "Image size must be below 10 MB.",
            "error"
        );

        event.target.value = "";

        return;
    }


    const reader = new FileReader();


    reader.onload = function(e) {

        preview.innerHTML = `
            <img
                src="${e.target.result}"
                alt="Selected image"
            >
        `;
    };


    reader.readAsDataURL(file);
}


/* ============================================================
   SUBMIT REPORT
============================================================ */

async function handleReportSubmit(event) {

    if (event) {
        event.preventDefault();
    }


    if (!currentUser) {

        showLogin();

        return;
    }


    const form = $("reportForm");


    if (!form) {
        return;
    }


    const formData =
        new FormData(form);


    const imageInput = $("image");


    if (
        imageInput &&
        imageInput.files &&
        imageInput.files[0]
    ) {

        const file =
            imageInput.files[0];

        if (file.size > 10 * 1024 * 1024) {

            showToast(
                "Image must be below 10 MB.",
                "error"
            );

            return;
        }
    }


    const submitButton =
        form.querySelector(
            "button[type='submit']"
        );


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.dataset.oldText =
            submitButton.textContent;

        submitButton.textContent =
            "Submitting...";
    }


    try {

        const response =
            await fetch(
                "/api/reports",
                {
                    method: "POST",

                    credentials: "include",

                    body: formData
                }
            );


        let data = {};

        try {
            data = await response.json();
        }

        catch (error) {
            data = {};
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to submit report."
            );
        }


        showToast(
            data.message ||
            "Report submitted successfully!",
            "success"
        );


        form.reset();


        const preview =
            $("imagePreview");

        if (preview) {
            preview.innerHTML = "";
        }


        await loadReports();


        showSection("dashboard");


    }

    catch (error) {

        console.error(
            "REPORT SUBMIT ERROR:",
            error
        );

        showToast(
            error.message ||
            "Failed to submit report.",
            "error"
        );
    }


    finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.oldText ||
                "Submit Report";
        }
    }
}


/* ============================================================
   LOAD REPORTS
============================================================ */

async function loadReports() {

    try {

        const data =
            await apiRequest(
                "/api/reports",
                {
                    method: "GET"
                }
            );


        allReports = getArray(
            data,
            [
                "reports",
                "data",
                "items"
            ]
        );


        renderReports(
            $("recentReports"),
            allReports
        );


        renderReports(
            $("lostReports"),
            allReports.filter(
                report =>
                    String(
                        report.report_type ||
                        report.type ||
                        report.item_type ||
                        ""
                    ).toLowerCase() === "lost"
            )
        );


        renderReports(
            $("foundReports"),
            allReports.filter(
                report =>
                    String(
                        report.report_type ||
                        report.type ||
                        report.item_type ||
                        ""
                    ).toLowerCase() === "found"
            )
        );


        updateDashboardCounts();


    }

    catch (error) {

        console.error(
            "LOAD REPORTS ERROR:",
            error
        );


        allReports = [];


        renderReports(
            $("recentReports"),
            []
        );

        renderReports(
            $("lostReports"),
            []
        );

        renderReports(
            $("foundReports"),
            []
        );
    }
}


/* ============================================================
   LOAD LOST
============================================================ */

async function loadLostReports() {

    await loadReports();

    showSectionWithoutReload("lost");
}


/* ============================================================
   LOAD FOUND
============================================================ */

async function loadFoundReports() {

    await loadReports();

    showSectionWithoutReload("found");
}


/* ============================================================
   SHOW SECTION WITHOUT RELOAD
============================================================ */

function showSectionWithoutReload(sectionId) {

    document.querySelectorAll(".section").forEach(section => {

        section.classList.remove("active");

    });


    const target = $(sectionId);

    if (target) {
        target.classList.add("active");
    }
}


/* ============================================================
   UPDATE DASHBOARD COUNTS
============================================================ */

function updateDashboardCounts() {

    const lostCount =
        allReports.filter(
            report =>
                String(
                    report.report_type ||
                    report.type ||
                    report.item_type ||
                    ""
                ).toLowerCase() === "lost"
        ).length;


    const foundCount =
        allReports.filter(
            report =>
                String(
                    report.report_type ||
                    report.type ||
                    report.item_type ||
                    ""
                ).toLowerCase() === "found"
        ).length;


    const totalElements =
        document.querySelectorAll(
            "[data-report-count]"
        );


    totalElements.forEach(element => {

        const type =
            element.dataset.reportCount;

        if (type === "lost") {
            element.textContent = lostCount;
        }

        else if (type === "found") {
            element.textContent = foundCount;
        }

        else {
            element.textContent =
                allReports.length;
        }
    });
}


/* ============================================================
   RENDER REPORTS
============================================================ */

function renderReports(container, reports) {

    if (!container) {
        return;
    }


    if (!reports || reports.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No items found</h3>
                <p>There are no reports to display.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        reports
            .map(report => createReportCard(report))
            .join("");
}


/* ============================================================
   GET REPORT IMAGE
============================================================ */

function getReportImage(report) {

    const image =
        report.image ||
        report.image_url ||
        report.photo ||
        "";


    if (!image) {
        return "";
    }


    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {

        return image;
    }


    if (image.startsWith("/")) {

        return image;
    }


    return `/uploads/${image}`;
}


/* ============================================================
   CREATE REPORT CARD
============================================================ */

function createReportCard(report) {

    const id =
        report.id ||
        report.report_id;


    const type =
        String(
            report.report_type ||
            report.type ||
            report.item_type ||
            "lost"
        ).toLowerCase();


    const itemName =
        report.item_name ||
        report.name ||
        report.title ||
        "Unnamed Item";


    const category =
        report.category ||
        "Other";


    const location =
        report.location ||
        "Unknown location";


    const description =
        report.description ||
        "No description provided.";


    const date =
        report.report_date ||
        report.item_date ||
        report.date;


    const time =
        report.report_time ||
        report.item_time ||
        report.time;


    const status =
        report.status ||
        "pending";


    const image =
        getReportImage(report);


    const isOwn =
        currentUser &&
        (
            String(
                report.user_id ||
                ""
            ) === String(
                currentUser.id ||
                ""
            )
        );


    const canClaim =
        type === "found" &&
        !isOwn;


    return `
        <article class="report-card">

            <div class="report-card-image">

                ${
                    image
                    ?
                    `
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(itemName)}"
                        loading="lazy"
                        onerror="this.style.display='none';"
                    >
                    `
                    :
                    `
                    <div class="report-no-image">
                        📦
                    </div>
                    `
                }

            </div>


            <div class="report-card-body">

                <span class="report-type ${type}">
                    ${capitalize(type)}
                </span>


                <div class="report-card-header">

                    <h3 class="report-card-title">
                        ${escapeHTML(itemName)}
                    </h3>

                    <span class="status-badge ${escapeHTML(status)}">
                        ${escapeHTML(status)}
                    </span>

                </div>


                <div class="report-meta">

                    <span>
                        📁 ${escapeHTML(category)}
                    </span>

                    <span>
                        📍 ${escapeHTML(location)}
                    </span>

                </div>


                <p class="report-card-description">
                    ${escapeHTML(description)}
                </p>


                ${
                    date
                    ?
                    `
                    <div class="report-meta">

                        <span>
                            📅 ${escapeHTML(
                                formatDate(date)
                            )}
                        </span>

                        ${
                            time
                            ?
                            `
                            <span>
                                🕐 ${escapeHTML(
                                    formatTime(time)
                                )}
                            </span>
                            `
                            :
                            ""
                        }

                    </div>
                    `
                    :
                    ""
                }


                ${
                    canClaim
                    ?
                    `
                    <button
                        class="claim-btn"
                        type="button"
                        onclick="openClaimModal(${Number(id)})"
                    >
                        Claim Item
                    </button>
                    `
                    :
                    ""
                }

            </div>

        </article>
    `;
}
/* ============================================================
   AI MATCHING
   CampusFind Lost & Found AI
============================================================ */

async function loadAIMatches() {

    const container = $("aiMatches");

    if (!container) {
        console.error("AI matches container #aiMatches not found.");
        return;
    }

    container.innerHTML = `
        <div class="loading-state ai-loading">
            <div class="ai-loading-icon">🤖</div>
            <h3>CampusFind AI is analyzing...</h3>
            <p>Comparing lost and found items</p>
        </div>
    `;

    try {

        console.log("AI MATCH: Sending request to /api/matches");

        const data = await apiRequest(
            "/api/matches",
            {
                method: "GET",
                cache: "no-store"
            }
        );

        console.log("AI MATCH API RESPONSE:", data);

        const matches = getArray(
            data,
            [
                "matches",
                "data",
                "results"
            ]
        );

        allMatches = matches;

        window.campusFindMatches = matches;

        console.log(
            "AI MATCHES FOUND:",
            matches.length
        );

        renderAIMatches(matches);

    }

    catch (error) {

        console.error(
            "AI MATCH ERROR:",
            error
        );

        allMatches = [];

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    AI Matching Unavailable
                </h3>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Unable to analyze possible matches."
                    )}
                </p>

                <button
                    type="button"
                    onclick="loadAIMatches()"
                    class="retry-ai-button"
                >
                    🔄 Try Again
                </button>

            </div>
        `;
    }
}


/* ============================================================
   RENDER AI MATCHES
============================================================ */

function renderAIMatches(matches) {

    const container = $("aiMatches");

    if (!container) {
        return;
    }

    if (!matches || matches.length === 0) {

        container.innerHTML = `
            <div class="empty-state ai-empty-state">

                <div class="empty-icon">
                    🤖
                </div>

                <h3>
                    No Possible Matches Yet
                </h3>

                <p>
                    CampusFind AI could not find a
                    possible match yet.
                </p>

                <div class="ai-tip-box">

                    <strong>
                        💡 For better matching
                    </strong>

                    <ul>
                        <li>Add the correct item name</li>
                        <li>Select the correct category</li>
                        <li>Enter the exact location</li>
                        <li>Add useful item details</li>
                        <li>Upload a clear item image</li>
                    </ul>

                </div>

            </div>
        `;

        return;
    }


    container.innerHTML = matches.map(
        (match, index) => {

            const lost =
                match.lost || {};

            const found =
                match.found || {};


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


            const score = Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        match.match_score ??
                        match.score ??
                        match.confidence ??
                        0
                    )
                )
            );


            let matchLevel =
                "Possible Match";

            if (score >= 80) {

                matchLevel =
                    "Strong Match";

            }

            else if (score >= 50) {

                matchLevel =
                    "Good Match";
            }


            /* =========================
               IMAGE
            ========================= */

            const lostImage =
                getReportImage(lost);


            const foundImage =
                getReportImage(found);


            const lostImageHTML =
                lostImage

                ? `
                    <div class="ai-image-wrapper">

                        <img
                            src="${escapeHTML(
                                lostImage
                            )}"
                            alt="${escapeHTML(
                                lostName
                            )}"
                            class="ai-match-image"
                            onerror="
                                this.style.display='none';
                            "
                        >

                    </div>
                `

                : `
                    <div class="ai-image-wrapper no-image">
                        📦
                        <span>No Image</span>
                    </div>
                `;


            const foundImageHTML =
                foundImage

                ? `
                    <div class="ai-image-wrapper">

                        <img
                            src="${escapeHTML(
                                foundImage
                            )}"
                            alt="${escapeHTML(
                                foundName
                            )}"
                            class="ai-match-image"
                            onerror="
                                this.style.display='none';
                            "
                        >

                    </div>
                `

                : `
                    <div class="ai-image-wrapper no-image">
                        📦
                        <span>No Image</span>
                    </div>
                `;


            /* =========================
               MATCH REASONS
            ========================= */

            const reasons = [];


            if (
                String(lostCategory).toLowerCase() ===
                String(foundCategory).toLowerCase()
            ) {

                reasons.push(
                    "Same category"
                );
            }


            if (
                lostLocation &&
                foundLocation &&
                (
                    String(lostLocation)
                        .toLowerCase()
                        .includes(
                            String(foundLocation)
                                .toLowerCase()
                        ) ||
                    String(foundLocation)
                        .toLowerCase()
                        .includes(
                            String(lostLocation)
                                .toLowerCase()
                        )
                )
            ) {

                reasons.push(
                    "Similar location"
                );
            }


            const lostWords =
                String(lostName)
                    .toLowerCase()
                    .split(/\s+/);


            const foundWords =
                String(foundName)
                    .toLowerCase()
                    .split(/\s+/);


            if (
                lostWords.some(
                    word =>
                        word.length > 2 &&
                        foundWords.includes(word)
                )
            ) {

                reasons.push(
                    "Similar item name"
                );
            }


            if (
                lostDescription &&
                foundDescription
            ) {

                reasons.push(
                    "Description analyzed"
                );
            }


            if (
                lostImage &&
                foundImage
            ) {

                reasons.push(
                    "Both items have images"
                );
            }


            if (reasons.length === 0) {

                reasons.push(
                    "Multiple item details analyzed"
                );
            }


            const reasonsHTML =
                reasons
                    .map(
                        reason => `
                            <span class="match-reason">
                                ✓
                                ${escapeHTML(
                                    reason
                                )}
                            </span>
                        `
                    )
                    .join("");


            /* =========================
               FOUND ITEM ID
            ========================= */

            const foundId =
                found.id ||
                found.report_id ||
                "";


            const claimButton =
                foundId

                ? `
                    <button
                        type="button"
                        class="ai-claim-button"
                        onclick="openClaimModal(${Number(foundId)})"
                    >
                        📦 Claim This Item
                    </button>
                `

                : "";


            /* =========================
               CARD
            ========================= */

            return `

                <div class="ai-match-card">

                    <div class="ai-match-top">

                        <div>

                            <span class="ai-match-badge">
                                🤖 AI POSSIBLE MATCH
                            </span>

                            <h3>
                                ${escapeHTML(
                                    lostName
                                )}
                                ↔
                                ${escapeHTML(
                                    foundName
                                )}
                            </h3>

                            <p class="ai-confidence">
                                ${matchLevel} Confidence
                            </p>

                        </div>


                        <div class="ai-score-circle">

                            <strong>
                                ${score}%
                            </strong>

                            <span>
                                Match
                            </span>

                        </div>

                    </div>


                    <div class="ai-comparison">


                        <!-- LOST -->

                        <div class="ai-item-card lost-item-card">

                            <div class="ai-item-title">
                                🔴 LOST ITEM
                            </div>

                            ${lostImageHTML}

                            <h4>
                                ${escapeHTML(
                                    lostName
                                )}
                            </h4>

                            <div class="ai-detail">
                                📂
                                <strong>Category</strong>
                                <span>
                                    ${escapeHTML(
                                        lostCategory
                                    )}
                                </span>
                            </div>

                            <div class="ai-detail">
                                📍
                                <strong>Location</strong>
                                <span>
                                    ${escapeHTML(
                                        lostLocation
                                    )}
                                </span>
                            </div>

                            <div class="ai-description">

                                <strong>
                                    📝 Description
                                </strong>

                                <p>
                                    ${escapeHTML(
                                        lostDescription
                                    )}
                                </p>

                            </div>

                        </div>


                        <!-- AI CONNECTOR -->

                        <div class="ai-match-connector">

                            <div class="connector-line"></div>

                            <div class="connector-icon">
                                🤖
                            </div>

                            <span>
                                AI
                            </span>

                            <div class="connector-line"></div>

                        </div>


                        <!-- FOUND -->

                        <div class="ai-item-card found-item-card">

                            <div class="ai-item-title">
                                🟢 FOUND ITEM
                            </div>

                            ${foundImageHTML}

                            <h4>
                                ${escapeHTML(
                                    foundName
                                )}
                            </h4>

                            <div class="ai-detail">
                                📂
                                <strong>Category</strong>
                                <span>
                                    ${escapeHTML(
                                        foundCategory
                                    )}
                                </span>
                            </div>

                            <div class="ai-detail">
                                📍
                                <strong>Location</strong>
                                <span>
                                    ${escapeHTML(
                                        foundLocation
                                    )}
                                </span>
                            </div>

                            <div class="ai-description">

                                <strong>
                                    📝 Description
                                </strong>

                                <p>
                                    ${escapeHTML(
                                        foundDescription
                                    )}
                                </p>

                            </div>

                            ${claimButton}

                        </div>

                    </div>


                    <div class="ai-match-reasons">

                        <h4>
                            🔍 Why AI thinks this may match
                        </h4>

                        <div class="match-reasons-list">

                            ${reasonsHTML}

                        </div>

                    </div>


                    <div class="ai-match-footer">

                        <div>

                            <span>
                                🤖 AI Match Score
                            </span>

                            <strong>
                                ${score}%
                            </strong>

                        </div>

                        <div class="ai-progress">

                            <div
                                class="ai-progress-bar"
                                style="width:${score}%"
                            ></div>

                        </div>

                    </div>

                </div>

            `;
        }
    ).join("");
}

// ============================================================
// RENDER AI MATCHES
// ============================================================

function renderAIMatches(matches) {

    const container = document.getElementById("aiMatches");

    if (!container) return;

    if (!matches || matches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size:45px;">🤖</div>

                <h3>No AI Matches Found</h3>

                <p>
                    No strong match was found between the
                    reported lost and found items yet.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = matches.map((match, index) => {

        // ----------------------------------------------------
        // BACKEND STRUCTURE
        // match.lost
        // match.found
        // match.score
        // ----------------------------------------------------

        const lost = match.lost || {};
        const found = match.found || {};

        const lostName =
            lost.item_name ||
            "Unknown Lost Item";

        const foundName =
            found.item_name ||
            "Unknown Found Item";

        const lostCategory =
            lost.category ||
            "Not specified";

        const foundCategory =
            found.category ||
            "Not specified";

        const lostLocation =
            lost.location ||
            "Not specified";

        const foundLocation =
            found.location ||
            "Not specified";

        const lostDescription =
            lost.description ||
            "No description provided.";

        const foundDescription =
            found.description ||
            "No description provided.";

        const score = Number(
            match.score ??
            match.match_score ??
            0
        );

        const lostImage =
            lost.image_url ||
            lost.image ||
            "";

        const foundImage =
            found.image_url ||
            found.image ||
            "";

        // ----------------------------------------------------
        // MATCH LEVEL
        // ----------------------------------------------------

        let matchLevel = "Possible Match";

        if (score >= 80) {
            matchLevel = "Strong Match";
        } else if (score >= 50) {
            matchLevel = "Good Match";
        } else if (score >= 20) {
            matchLevel = "Possible Match";
        }

        // ----------------------------------------------------
        // IMAGE HTML
        // ----------------------------------------------------

        const lostImageHTML = lostImage
            ? `
                <img
                    src="${escapeHTML(lostImage)}"
                    alt="${escapeHTML(lostName)}"
                    class="ai-match-image"
                    onerror="this.style.display='none';"
                >
              `
            : `
                <div class="ai-no-image">
                    📦
                </div>
              `;

        const foundImageHTML = foundImage
            ? `
                <img
                    src="${escapeHTML(foundImage)}"
                    alt="${escapeHTML(foundName)}"
                    class="ai-match-image"
                    onerror="this.style.display='none';"
                >
              `
            : `
                <div class="ai-no-image">
                    📦
                </div>
              `;

        // ----------------------------------------------------
        // RETURN CARD
        // ----------------------------------------------------

        return `
            <div class="ai-match-card">

                <!-- HEADER -->
                <div class="ai-match-header">

                    <div>
                        <span class="ai-match-number">
                            Match ${index + 1}
                        </span>

                        <h3>
                            🤖 ${escapeHTML(matchLevel)}
                        </h3>
                    </div>

                    <div class="ai-score">
                        AI Match: ${score}%
                    </div>

                </div>


                <!-- ITEMS -->
                <div class="ai-match-items">

                    <!-- LOST ITEM -->
                    <div class="ai-item-box">

                        <div class="ai-item-title">
                            🔴 Lost Item
                        </div>

                        ${lostImageHTML}

                        <h3>
                            ${escapeHTML(lostName)}
                        </h3>

                        <p>
                            <strong>Category:</strong>
                            ${escapeHTML(lostCategory)}
                        </p>

                        <p>
                            <strong>Location:</strong>
                            ${escapeHTML(lostLocation)}
                        </p>

                        <p>
                            <strong>Description:</strong>
                            ${escapeHTML(lostDescription)}
                        </p>

                    </div>


                    <!-- MATCH ARROW -->
                    <div class="ai-match-arrow">
                        <div>🤖</div>
                        <span>Match</span>
                        <strong>${score}%</strong>
                    </div>


                    <!-- FOUND ITEM -->
                    <div class="ai-item-box">

                        <div class="ai-item-title">
                            🟢 Found Item
                        </div>

                        ${foundImageHTML}

                        <h3>
                            ${escapeHTML(foundName)}
                        </h3>

                        <p>
                            <strong>Category:</strong>
                            ${escapeHTML(foundCategory)}
                        </p>

                        <p>
                            <strong>Location:</strong>
                            ${escapeHTML(foundLocation)}
                        </p>

                        <p>
                            <strong>Description:</strong>
                            ${escapeHTML(foundDescription)}
                        </p>

                    </div>

                </div>

            </div>
        `;

    }).join("");
}
/* ============================================================
   CLAIM MODAL
============================================================ */

function openClaimModal(reportId) {

    if (!currentUser) {

        showLogin();

        return;
    }


    const modal =
        $("claimModal");


    if (!modal) {

        showToast(
            "Claim form not found.",
            "error"
        );

        return;
    }


    const report =
        allReports.find(
            item =>
                String(
                    item.id ||
                    item.report_id
                ) === String(reportId)
        );


    if (!report) {

        showToast(
            "Report not found.",
            "error"
        );

        return;
    }


    if ($("claimReportId")) {

        $("claimReportId").value =
            reportId;
    }


    if ($("claimItemName")) {

        $("claimItemName").value =
            report.item_name ||
            report.name ||
            "";
    }


    if ($("claimantName")) {

        $("claimantName").value =
            currentUser.name ||
            currentUser.username ||
            "";
    }


    if ($("claimantEmail")) {

        $("claimantEmail").value =
            currentUser.email ||
            "";
    }


    if ($("claimantMobile")) {

        $("claimantMobile").value =
            currentUser.mobile ||
            "";
    }


    modal.classList.add("active");

    modal.style.display = "flex";
}


/* ============================================================
   CLOSE CLAIM MODAL
============================================================ */

function closeClaimModal() {

    closeModal("claimModal");
}


/* ============================================================
   SUBMIT CLAIM
============================================================ */

async function handleClaimSubmit(event) {

    if (event) {
        event.preventDefault();
    }


    if (!currentUser) {

        showLogin();

        return;
    }


    const form =
        $("claimForm");


    if (!form) {
        return;
    }


    const formData =
        new FormData(form);


    const data = {};


    formData.forEach(
        (value, key) => {
            data[key] = value;
        }
    );


    try {

        const response =
            await apiRequest(
                "/api/claims",
                {
                    method: "POST",
                    body: data
                }
            );


        showToast(
            response.message ||
            "Claim submitted successfully.",
            "success"
        );


        form.reset();

        closeClaimModal();


        await loadNotifications();


    }

    catch (error) {

        console.error(
            "CLAIM ERROR:",
            error
        );

        showToast(
            error.message ||
            "Unable to submit claim.",
            "error"
        );
    }
}

/* ============================================================
   NOTIFICATIONS
============================================================ */

function openNotifications() {
    const panel = document.getElementById("notificationPanel");

    if (!panel) {
        console.error("Notification panel not found");
        return;
    }

    // Close other sections/panels if needed
    panel.style.display = "block";
    panel.classList.add("active");
    panel.classList.add("show");

    loadNotifications();
}


function closeNotifications() {
    const panel = document.getElementById("notificationPanel");

    if (!panel) {
        console.error("Notification panel not found");
        return;
    }

    // Force close
    panel.style.display = "none";
    panel.classList.remove("active");
    panel.classList.remove("show");
}


/* ============================================================
   LOAD NOTIFICATIONS
============================================================ */

async function loadNotifications() {
    const list = document.getElementById("notificationsList");
    const sectionList = document.getElementById("notificationList");

    try {
        const response = await apiRequest("/api/notifications");

        if (!response.ok) {
            throw new Error("Failed to load notifications");
        }

        const data = await response.json();

        const notifications =
            data.notifications ||
            data.data ||
            data ||
            [];

        allNotifications = Array.isArray(notifications)
            ? notifications
            : [];

        renderNotifications();

    } catch (error) {
        console.error("Notification error:", error);

        if (list) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>You're all caught up.</p>
                </div>
            `;
        }

        if (sectionList) {
            sectionList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <h3>No notifications</h3>
                    <p>You're all caught up.</p>
                </div>
            `;
        }
    }
}


/* ============================================================
   RENDER NOTIFICATIONS
============================================================ */

function renderNotifications() {

    const panelList = document.getElementById("notificationsList");
    const sectionList = document.getElementById("notificationList");

    if (!allNotifications || allNotifications.length === 0) {

        const emptyHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>No notifications</h3>
                <p>You're all caught up.</p>
            </div>
        `;

        if (panelList) {
            panelList.innerHTML = emptyHTML;
        }

        if (sectionList) {
            sectionList.innerHTML = emptyHTML;
        }

        return;
    }

    const html = allNotifications.map(notification => {

        const title =
            notification.title ||
            notification.message ||
            "CampusFind Notification";

        const message =
            notification.message ||
            notification.description ||
            "";

        return `
            <div class="notification-item">

                <div class="notification-icon">
                    🔔
                </div>

                <div class="notification-content">

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <p>
                        ${escapeHTML(message)}
                    </p>

                </div>

            </div>
        `;

    }).join("");

    if (panelList) {
        panelList.innerHTML = html;
    }

    if (sectionList) {
        sectionList.innerHTML = html;
    }
}


/* ============================================================
   CLEAR NOTIFICATIONS
============================================================ */

async function clearNotifications() {

    try {

        const response = await apiRequest(
            "/api/notifications/clear",
            {
                method: "POST"
            }
        );

        if (!response.ok) {
            throw new Error("Failed to clear notifications");
        }

        allNotifications = [];

        renderNotifications();

        showToast(
            "success",
            "Notifications cleared successfully"
        );

    } catch (error) {

        console.error(
            "Clear notifications error:",
            error
        );

        showToast(
            "error",
            "Unable to clear notifications"
        );
    }
}

/* ============================================================
   ADMIN PANEL
============================================================ */

async function loadAdminPanel() {

    if (!isAdminUser()) {

        showToast(
            "Admin access required.",
            "error"
        );

        return;
    }


    await Promise.all([
        refreshAdminStats(),
        loadAdminReports(),
        loadAdminClaims(),
        loadAdminUsers()
    ]);
}


/* ============================================================
   ADMIN FILTER
============================================================ */

function setAdminFilter(filter, button) {

    currentAdminFilter =
        filter || "all";


    document.querySelectorAll(
        ".admin-filter"
    ).forEach(item => {

        item.classList.remove("active");

    });


    if (button) {

        button.classList.add("active");

    }


    else {

        const target =
            document.querySelector(
                `.admin-filter[data-filter="${filter}"]`
            );

        if (target) {
            target.classList.add("active");
        }
    }


    renderAdminReports(
        $("adminReports"),
        allReports
    );
}


/* ============================================================
   LOAD ADMIN REPORTS
============================================================ */

async function loadAdminReports() {

    if (!isAdminUser()) {
        return;
    }


    const container =
        $("adminReports");


    if (container) {

        container.innerHTML = `
            <div class="loading">
                Loading reports...
            </div>
        `;
    }


    try {

        const data =
            await apiRequest(
                "/api/reports",
                {
                    method: "GET"
                }
            );


        allReports =
            getArray(
                data,
                [
                    "reports",
                    "data",
                    "items"
                ]
            );


        renderAdminReports(
            container,
            allReports
        );


    }

    catch (error) {

        console.error(
            "ADMIN REPORT ERROR:",
            error
        );


        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    <h3>Unable to load reports</h3>
                    <p>
                        ${escapeHTML(error.message)}
                    </p>
                </div>
            `;
        }
    }
}


/* ============================================================
   RENDER ADMIN REPORTS
============================================================ */

function renderAdminReports(
    container,
    reports
) {

    if (!container) {
        return;
    }


    let filteredReports =
        Array.isArray(reports)
            ? [...reports]
            : [];


    if (
        currentAdminFilter &&
        currentAdminFilter !== "all"
    ) {

        filteredReports =
            filteredReports.filter(
                report =>
                    String(
                        report.status ||
                        "pending"
                    ).toLowerCase() ===
                    String(
                        currentAdminFilter
                    ).toLowerCase()
            );
    }


    if (filteredReports.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    📋
                </div>

                <h3>
                    No ${escapeHTML(
                        currentAdminFilter === "all"
                            ? ""
                            : currentAdminFilter + " "
                    )}reports
                </h3>

                <p>
                    There are no reports in this category.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        filteredReports
            .map(report =>
                createAdminReportCard(report)
            )
            .join("");
}


/* ============================================================
   CREATE ADMIN REPORT CARD
============================================================ */

function createAdminReportCard(report) {

    const id =
        report.id ||
        report.report_id;


    const type =
        String(
            report.report_type ||
            report.type ||
            report.item_type ||
            "lost"
        ).toLowerCase();


    const name =
        report.item_name ||
        report.name ||
        report.title ||
        "Unnamed Item";


    const category =
        report.category ||
        "Other";


    const location =
        report.location ||
        "Unknown";


    const description =
        report.description ||
        "No description";


    const status =
        String(
            report.status ||
            "pending"
        ).toLowerCase();


    const image =
        getReportImage(report);


    return `
        <div class="admin-report-card">

            ${
                image
                ?
                `
                <img
                    class="admin-report-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(name)}"
                    loading="lazy"
                >
                `
                :
                `
                <div
                    class="admin-report-image"
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:28px;
                    "
                >
                    📦
                </div>
                `
            }


            <div class="admin-report-info">

                <span class="report-type ${type}">
                    ${capitalize(type)}
                </span>


                <span class="status-badge ${status}">
                    ${capitalize(status)}
                </span>


                <h3>
                    ${escapeHTML(name)}
                </h3>


                <p>
                    <strong>Category:</strong>
                    ${escapeHTML(category)}
                </p>


                <p>
                    <strong>Location:</strong>
                    ${escapeHTML(location)}
                </p>


                <p>
                    <strong>Description:</strong>
                    ${escapeHTML(description)}
                </p>


                ${
                    report.created_at
                    ?
                    `
                    <p>
                        <strong>Submitted:</strong>
                        ${escapeHTML(
                            formatDate(
                                report.created_at
                            )
                        )}
                    </p>
                    `
                    :
                    ""
                }


                <div class="admin-report-actions">

                    ${
                        status !== "approved"
                        ?
                        `
                        <button
                            type="button"
                            class="approve-btn"
                            onclick="updateReportStatus(${Number(id)}, 'approved')"
                        >
                            ✓ Approve
                        </button>
                        `
                        :
                        ""
                    }


                    ${
                        status !== "rejected"
                        ?
                        `
                        <button
                            type="button"
                            class="reject-btn"
                            onclick="updateReportStatus(${Number(id)}, 'rejected')"
                        >
                            ✕ Reject
                        </button>
                        `
                        :
                        ""
                    }

                </div>

            </div>

        </div>
    `;
}


/* ============================================================
   UPDATE REPORT STATUS
============================================================ */

async function updateReportStatus(
    reportId,
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
        !reportId ||
        !status
    ) {

        return;
    }


    try {

        const data =
            await apiRequest(
                `/api/reports/${reportId}/status`,
                {
                    method: "PUT",

                    body: {
                        status: status
                    }
                }
            );


        showToast(
            data.message ||
            `Report ${status}.`,
            "success"
        );


        await loadAdminReports();

        await refreshAdminStats();

        await loadNotifications();


    }

    catch (error) {

        console.error(
            "UPDATE REPORT STATUS ERROR:",
            error
        );

        showToast(
            error.message ||
            "Unable to update report status.",
            "error"
        );
    }
}


/* ============================================================
   ADMIN CLAIMS
============================================================ */

async function loadAdminClaims() {

    if (!isAdminUser()) {
        return;
    }


    const container =
        $("adminClaims");


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading">
            Loading claims...
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/api/admin/claims",
                {
                    method: "GET"
                }
            );


        allAdminClaims =
            getArray(
                data,
                [
                    "claims",
                    "data",
                    "items"
                ]
            );


        renderAdminClaims(
            container,
            allAdminClaims
        );


    }

    catch (error) {

        console.error(
            "ADMIN CLAIM ERROR:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                <h3>
                    Unable to load claims
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>
            </div>
        `;
    }
}


/* ============================================================
   RENDER ADMIN CLAIMS
============================================================ */

function renderAdminClaims(
    container,
    claims
) {

    if (!claims || claims.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    📑
                </div>

                <h3>
                    No claims
                </h3>

                <p>
                    There are no item claims yet.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        claims
            .map(claim => {

                const id =
                    claim.id ||
                    claim.claim_id;


                const itemName =
                    claim.item_name ||
                    claim.report_item_name ||
                    "Unknown Item";


                const claimant =
                    claim.claimant_name ||
                    claim.name ||
                    "Unknown User";


                const email =
                    claim.claimant_email ||
                    claim.email ||
                    "";


                const mobile =
                    claim.claimant_mobile ||
                    claim.mobile ||
                    "";


                const message =
                    claim.message ||
                    claim.claim_message ||
                    "No message provided.";


                const score =
                    claim.ai_match_score;


                const status =
                    String(
                        claim.status ||
                        "pending"
                    ).toLowerCase();


                return `
                    <div class="admin-claim-card">

                        <div class="admin-claim-header">

                            <div>

                                <h3 class="admin-claim-title">
                                    ${escapeHTML(itemName)}
                                </h3>

                                <p>
                                    Claim by
                                    <strong>
                                        ${escapeHTML(claimant)}
                                    </strong>
                                </p>

                            </div>


                            <span class="admin-claim-status ${status}">
                                ${escapeHTML(status)}
                            </span>

                        </div>


                        <div class="claimant-info">

                            <div>
                                <strong>
                                    Name
                                </strong>

                                ${escapeHTML(claimant)}
                            </div>


                            <div>
                                <strong>
                                    Email
                                </strong>

                                ${escapeHTML(email)}
                            </div>


                            <div>
                                <strong>
                                    Mobile
                                </strong>

                                ${escapeHTML(mobile)}
                            </div>

                        </div>


                        ${
                            score !== undefined &&
                            score !== null
                            ?
                            `
                            <div class="claim-ai-score">
                                🤖 AI Match Score:
                                ${escapeHTML(score)}%
                            </div>
                            `
                            :
                            ""
                        }


                        <div class="claim-message">

                            <strong>
                                Claim Details
                            </strong>

                            <p>
                                ${escapeHTML(message)}
                            </p>

                        </div>


                        ${
                            status === "pending"
                            ?
                            `
                            <div class="claim-actions">

                                <button
                                    type="button"
                                    class="claim-approve-btn"
                                    onclick="updateClaimStatus(${Number(id)}, 'approved')"
                                >
                                    ✓ Approve Claim
                                </button>


                                <button
                                    type="button"
                                    class="claim-reject-btn"
                                    onclick="updateClaimStatus(${Number(id)}, 'rejected')"
                                >
                                    ✕ Reject Claim
                                </button>

                            </div>
                            `
                            :
                            ""
                        }

                    </div>
                `;

            })
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


    try {

        const data =
            await apiRequest(
                `/api/admin/claims/${claimId}/status`,
                {
                    method: "PUT",

                    body: {
                        status: status
                    }
                }
            );


        showToast(
            data.message ||
            `Claim ${status}.`,
            "success"
        );


        await loadAdminClaims();

        await loadNotifications();


    }

    catch (error) {

        console.error(
            "CLAIM STATUS ERROR:",
            error
        );

        showToast(
            error.message ||
            "Unable to update claim.",
            "error"
        );
    }
}


/* ============================================================
   ADMIN USERS
============================================================ */

async function loadAdminUsers() {

    if (!isAdminUser()) {
        return;
    }


    const container =
        $("adminUsers");


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading">
            Loading users...
        </div>
    `;


    try {

        const data =
            await apiRequest(
                "/api/users",
                {
                    method: "GET"
                }
            );


        allAdminUsers =
            getArray(
                data,
                [
                    "users",
                    "data"
                ]
            );


        renderAdminUsers(
            container,
            allAdminUsers
        );


    }

    catch (error) {

        console.error(
            "ADMIN USERS ERROR:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    Unable to load users
                </h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;
    }
}


/* ============================================================
   RENDER ADMIN USERS
============================================================ */

function renderAdminUsers(
    container,
    users
) {

    if (!users || users.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    👥
                </div>

                <h3>
                    No users found
                </h3>

                <p>
                    There are no registered users.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        users
            .map(user => {

                const name =
                    user.name ||
                    user.username ||
                    "User";


                const email =
                    user.email ||
                    "";


                const role =
                    user.role ||
                    "student";


                return `
                    <div class="admin-user-card">

                        <div>

                            <h3>
                                ${escapeHTML(name)}
                            </h3>

                            <p>
                                ${escapeHTML(email)}
                            </p>

                        </div>


                        <span class="status-badge ${
                            String(role).toLowerCase()
                        }">
                            ${escapeHTML(
                                capitalize(role)
                            )}
                        </span>

                    </div>
                `;

            })
            .join("");
}


/* ============================================================
   ADMIN STATS
============================================================ */

async function refreshAdminStats() {

    if (!isAdminUser()) {
        return;
    }


    try {

        const data =
            await apiRequest(
                "/api/reports",
                {
                    method: "GET"
                }
            );


        const reports =
            getArray(
                data,
                [
                    "reports",
                    "data",
                    "items"
                ]
            );


        allReports = reports;


        const total =
            reports.length;


        const lost =
            reports.filter(
                report =>
                    String(
                        report.report_type ||
                        report.type ||
                        report.item_type ||
                        ""
                    ).toLowerCase() === "lost"
            ).length;


        const found =
            reports.filter(
                report =>
                    String(
                        report.report_type ||
                        report.type ||
                        report.item_type ||
                        ""
                    ).toLowerCase() === "found"
            ).length;


        if ($("adminTotalReports")) {
            $("adminTotalReports").textContent =
                total;
        }


        if ($("adminLostCount")) {
            $("adminLostCount").textContent =
                lost;
        }


        if ($("adminFoundCount")) {
            $("adminFoundCount").textContent =
                found;
        }


        /*
           User count is loaded separately.
        */

        try {

            const userData =
                await apiRequest(
                    "/api/users",
                    {
                        method: "GET"
                    }
                );


            const users =
                getArray(
                    userData,
                    [
                        "users",
                        "data"
                    ]
                );


            if ($("adminUserCount")) {

                $("adminUserCount").textContent =
                    users.length;
            }

        }

        catch (error) {

            console.warn(
                "Could not load user count.",
                error
            );
        }


    }

    catch (error) {

        console.error(
            "ADMIN STATS ERROR:",
            error
        );
    }
}


/* ============================================================
   LOAD APPLICATION DATA
============================================================ */

async function loadApplicationData() {

    if (!currentUser) {
        return;
    }


    try {

        await loadReports();

    }

    catch (error) {

        console.error(
            "APPLICATION REPORT LOAD ERROR:",
            error
        );
    }


    try {

        await loadNotifications();

    }

    catch (error) {

        console.error(
            "APPLICATION NOTIFICATION LOAD ERROR:",
            error
        );
    }


    if (isAdminUser()) {

        try {

            await refreshAdminStats();

        }

        catch (error) {

            console.error(
                "ADMIN DATA ERROR:",
                error
            );
        }
    }


    updateUserUI();
}


/* ============================================================
   FORM SETUP
============================================================ */

function setupForms() {

    const loginForm =
        $("loginForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }


    const registerForm =
        $("registerForm");


    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            handleRegister
        );
    }


    const reportForm =
        $("reportForm");


    if (reportForm) {

        reportForm.addEventListener(
            "submit",
            handleReportSubmit
        );
    }


    const claimForm =
        $("claimForm");


    if (claimForm) {

        claimForm.addEventListener(
            "submit",
            handleClaimSubmit
        );
    }


    const imageInput =
        $("image");


    if (imageInput) {

        imageInput.addEventListener(
            "change",
            previewImage
        );
    }
}


/* ============================================================
   MODAL CLICK HANDLER
============================================================ */

function setupModalHandlers() {

    document.querySelectorAll(".modal").forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    modal.classList.remove(
                        "active",
                        "show"
                    );

                    modal.style.display =
                        "none";
                }
            }
        );
    });
}


/* ============================================================
   ESC KEY
============================================================ */

function setupEscapeKey() {

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }


            document.querySelectorAll(
                ".modal.active, .modal.show"
            ).forEach(modal => {

                modal.classList.remove(
                    "active",
                    "show"
                );

                modal.style.display =
                    "none";
            });


            closeNotificationPanel();
        }
    );
}


/* ============================================================
   SIDEBAR FALLBACK CLICK SUPPORT
============================================================ */

function setupNavigation() {

    document.querySelectorAll(
        ".nav-item"
    ).forEach(button => {

        button.addEventListener(
            "click",
            function(event) {

                /*
                   This supports navigation even if
                   inline onclick is changed later.
                */

                const section =
                    this.dataset.section;


                if (section) {

                    event.preventDefault();

                    showSection(section);
                }

            }
        );
    });
}


/* ============================================================
   CLOSE BUTTONS
============================================================ */

function setupCloseButtons() {

    document.querySelectorAll(
        "[data-close-modal]"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const modalId =
                    button.dataset.closeModal;

                closeModal(modalId);
            }
        );
    });
}


/* ============================================================
   INITIALIZE
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "CampusFind JavaScript loaded."
        );


        /*
           Start with application hidden.
           checkCurrentUser() will decide whether
           the login screen or application should show.
        */

        setAppVisible(false);


        setupForms();

        setupModalHandlers();

        setupEscapeKey();

        setupNavigation();

        setupCloseButtons();


        /*
           Check Flask session.
        */

        await checkCurrentUser();


        /*
           Make sure user UI is updated.
        */

        if (currentUser) {

            updateUserUI();

        }

    }
);


/* ============================================================
   WINDOW EXPORTS
   Required because HTML uses onclick=""
============================================================ */

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

window.handleLogin =
    handleLogin;

window.handleRegister =
    handleRegister;

window.logoutUser =
    logoutUser;

window.showSection =
    showSection;

window.openReport =
    openReport;

window.previewImage =
    previewImage;

window.handleReportSubmit =
    handleReportSubmit;

window.loadReports =
    loadReports;

window.loadLostReports =
    loadLostReports;

window.loadFoundReports =
    loadFoundReports;

window.loadAIMatches =
    loadAIMatches;

window.openClaimModal =
    openClaimModal;

window.closeClaimModal =
    closeClaimModal;

window.handleClaimSubmit =
    handleClaimSubmit;

window.loadNotifications =
    loadNotifications;

window.openNotifications =
    openNotifications;

window.closeNotificationPanel =
    closeNotificationPanel;

window.clearNotifications =
    clearNotifications;

window.loadAdminPanel =
    loadAdminPanel;

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

window.isAdminUser =
    isAdminUser;


/* ============================================================
   FINAL DEBUG MESSAGE
============================================================ */

console.log(
    "CampusFind: script.js initialized successfully."
);