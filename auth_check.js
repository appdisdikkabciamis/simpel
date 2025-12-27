/**
 * auth_check.js
 * Checks if the user is logged in via sessionStorage.
 * If not, redirects to index.html.
 */
(function () {
    const isLoggedIn = sessionStorage.getItem('is_logged_in');

    // Allow access if isLoggedIn is 'true'
    if (isLoggedIn !== 'true') {
        // Redirect to login page
        // Use window.location.replace to prevent back button history
        window.location.replace('index.html');
    }
})();

/**
 * Global function to handle logout
 * Clears session and redirects to index.html
 */
function logout() {
    localStorage.removeItem('simpel_access_code'); // Optional: specific requirement? Plan said session only, but let's keep consistent locally.
    sessionStorage.removeItem('is_logged_in');
    window.location.href = 'index.html';
}
