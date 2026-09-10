// ============================================================
// SIGN IN
// ============================================================
// This is temporary frontend authentication for testing.
// Later, Amazon Cognito will handle the real sign-in process.

const signinForm = document.getElementById("login-form");

if (signinForm) {
    signinForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (email === "" || password === "") {
            return;
        }

        // TEMPORARY USER
        // All users currently use sample-user-1.
        // Cognito will provide the real user ID later.
        const currentUser = {
            id: "sample-user-1",
            name: "Team Member 1",
            email: email
        };

        localStorage.setItem(
            "currentUser",
            JSON.stringify(currentUser)
        );

        window.location.href = "dashboard.html";
    });
}

// ============================================================
// LOGOUT
// ============================================================
// Remove the temporary user information and return to sign in.

function logout() {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
}

// Connect the Logout button to the logout function.
const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        logout();
    });
}