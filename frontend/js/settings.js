/* =========================================
   Settings Elements
========================================= */

const emailNotificationToggle = document.getElementById("email-notification-toggle");
const emailNotificationStatus = document.getElementById("email-notification-status");
const saveSettingsButton = document.getElementById("save-settings-button");
const settingsMessage = document.getElementById("settings-message");


/* =========================================
   Update Notification Status
========================================= */

function updateNotificationStatus() {

    if (emailNotificationToggle.checked) {
        emailNotificationStatus.textContent = "ON";
    } else {
        emailNotificationStatus.textContent = "OFF";
    }

}


/* =========================================
   Temporary Settings
========================================= */

// Temporary frontend value.
// Later, this will come from the backend / DynamoDB.

let emailNotificationsEnabled = true;


/* =========================================
   Load Settings
========================================= */

function loadSettings() {

    emailNotificationToggle.checked = emailNotificationsEnabled;

    updateNotificationStatus();

}


/* =========================================
   Toggle Change
========================================= */

emailNotificationToggle.addEventListener("change", function () {

    updateNotificationStatus();

    // Clear previous save message when the user changes the setting.
    settingsMessage.textContent = "";

});


/* =========================================
   Save Settings
========================================= */

saveSettingsButton.addEventListener("click", function () {

    emailNotificationsEnabled = emailNotificationToggle.checked;

    settingsMessage.textContent =
        "Notification preferences saved.";

});


/* =========================================
   Initial Setup
========================================= */

loadSettings();
