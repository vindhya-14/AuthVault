/**
 * ═══════════════════════════════════════════════════════════════
 * Profile Page — Production-Grade Logic
 * jQuery AJAX · Field-level validation · Change detection
 * Token from localStorage · Toast & Loader
 * ═══════════════════════════════════════════════════════════════
 */

$(document).ready(function () {

    const token = localStorage.getItem('token');

    // ─── Auth Guard: Redirect if no token ─────────────────────
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // ─── Track original values for change detection ───────────
    var originalValues = { age: '', dob: '', contact: '' };

    // ─── Fetch Profile on Load ────────────────────────────────
    fetchProfile();

    function fetchProfile() {
        showLoader();

        $.ajax({
            url: 'php/profile.php',
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token },
            data: { token: token },
            success: function (res) {
                hideLoader();

                let data;
                try {
                    data = typeof res === 'object' ? res : JSON.parse(res);
                } catch (err) {
                    showToast('error', 'Failed to parse profile data.');
                    return;
                }

                if (data.status === 'success') {
                    const user = data.user;
                    const profile = data.profile;

                    $('#profileName').text(user.name);
                    $('#profileEmail').text(user.email);
                    $('#profileAvatar').text(user.name.charAt(0).toUpperCase());

                    // Populate profile fields
                    if (profile.age) $('#profileAge').val(profile.age);
                    if (profile.dob) $('#profileDob').val(profile.dob);
                    if (profile.contact) $('#profileContact').val(profile.contact);

                    // Store original values
                    originalValues.age = profile.age || '';
                    originalValues.dob = profile.dob || '';
                    originalValues.contact = profile.contact || '';

                    updateSaveButton();
                } else {
                    showToast('error', data.message || 'Failed to load profile.');
                    if (data.message && data.message.includes('Unauthorized')) {
                        handleExpiredToken();
                    }
                }
            },
            error: function (xhr, status, error) {
                hideLoader();
                if (xhr.status === 401) {
                    handleExpiredToken();
                } else {
                    showToast('error', 'Server error. Please try again.');
                    console.error('Profile Fetch Error:', status, error);
                }
            }
        });
    }

    // ─── Change Detection — disable Save if nothing changed ───
    function hasChanges() {
        return (
            $.trim($('#profileAge').val()) !== originalValues.age ||
            $.trim($('#profileDob').val()) !== originalValues.dob ||
            $.trim($('#profileContact').val()) !== originalValues.contact
        );
    }

    function updateSaveButton() {
        $('#btnUpdateProfile').prop('disabled', !hasChanges());
    }

    $('#profileAge, #profileDob, #profileContact').on('input change', function () {
        updateSaveButton();
        // Clear error on this field
        var id = '#' + this.id;
        var errorId = '#error' + this.id.replace('profile', '');
        $(id).removeClass('input-error');
        $(errorId).text('').removeClass('active');
    });

    // ─── Field Error Helpers ──────────────────────────────────
    function showFieldError(fieldId, errorId, message) {
        $(fieldId).addClass('input-error').removeClass('input-success');
        $(errorId).text(message).addClass('active');
    }

    function clearAllErrors() {
        $('.field-error').text('').removeClass('active');
        $('.form-control').removeClass('input-error input-success');
    }

    // ─── Update Profile ───────────────────────────────────────
    $('#profileForm').on('submit', function (e) {
        e.preventDefault();

        clearAllErrors();

        const age = $.trim($('#profileAge').val());
        const dob = $.trim($('#profileDob').val());
        const contact = $.trim($('#profileContact').val());

        // Client-side validation
        let hasErrors = false;

        if (age && (isNaN(age) || parseInt(age) < 1 || parseInt(age) > 150)) {
            showFieldError('#profileAge', '#errorAge', 'Age must be 1-150');
            hasErrors = true;
        }

        if (dob) {
            var dobDate = new Date(dob);
            if (isNaN(dobDate.getTime())) {
                showFieldError('#profileDob', '#errorDob', 'Invalid date');
                hasErrors = true;
            } else if (dobDate > new Date()) {
                showFieldError('#profileDob', '#errorDob', 'Cannot be in the future');
                hasErrors = true;
            }
        }

        if (contact && !/^\d{7,15}$/.test(contact)) {
            showFieldError('#profileContact', '#errorContact', '7-15 digits only');
            hasErrors = true;
        }

        if (hasErrors) return;

        showLoader();
        $('#btnUpdateProfile').prop('disabled', true);

        $.ajax({
            url: 'php/profile.php',
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            data: {
                token: token,
                age: age,
                dob: dob,
                contact: contact
            },
            success: function (res) {
                hideLoader();
                $('#btnUpdateProfile').prop('disabled', false);

                let data;
                try {
                    data = typeof res === 'object' ? res : JSON.parse(res);
                } catch (err) {
                    showToast('error', 'Unexpected server response.');
                    return;
                }

                if (data.status === 'success') {
                    showToast('success', data.message || 'Profile updated!');
                    // Update stored values
                    originalValues.age = age;
                    originalValues.dob = dob;
                    originalValues.contact = contact;
                    updateSaveButton();
                } else {
                    // Show field-level errors from server
                    if (data.field_errors) {
                        if (data.field_errors.age) {
                            showFieldError('#profileAge', '#errorAge', data.field_errors.age);
                        }
                        if (data.field_errors.dob) {
                            showFieldError('#profileDob', '#errorDob', data.field_errors.dob);
                        }
                        if (data.field_errors.contact) {
                            showFieldError('#profileContact', '#errorContact', data.field_errors.contact);
                        }
                    }
                    showToast('error', data.message || 'Update failed.');
                }
            },
            error: function (xhr, status, error) {
                hideLoader();
                $('#btnUpdateProfile').prop('disabled', false);
                if (xhr.status === 401) {
                    handleExpiredToken();
                } else {
                    showToast('error', 'Server error. Please try again.');
                    console.error('Profile Update Error:', status, error);
                }
            }
        });
    });

    // ─── Logout ───────────────────────────────────────────────
    function performLogout() {
        showLoader();

        $.ajax({
            url: 'php/profile.php',
            type: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token },
            data: { token: token },
            success: function () {
                hideLoader();
                clearSession();
                showToast('success', 'Logged out successfully!');
                setTimeout(function () {
                    window.location.href = 'login.html';
                }, 1000);
            },
            error: function () {
                hideLoader();
                clearSession();
                window.location.href = 'login.html';
            }
        });
    }

    $('#btnLogout').on('click', performLogout);
    $('#navLogout').on('click', function (e) {
        e.preventDefault();
        performLogout();
    });

    // ─── Handle Expired Token ─────────────────────────────────
    function handleExpiredToken() {
        showToast('warning', 'Session expired. Please login again.');
        clearSession();
        setTimeout(function () {
            window.location.href = 'login.html';
        }, 2000);
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
    }

    // ─── Utility Functions ────────────────────────────────────

    function showLoader() {
        $('#loader').addClass('active');
    }

    function hideLoader() {
        $('#loader').removeClass('active');
    }

    function showToast(type, message) {
        const icons = {
            success: '<i class="bi bi-check-circle-fill toast-icon"></i>',
            error: '<i class="bi bi-exclamation-triangle-fill toast-icon"></i>',
            warning: '<i class="bi bi-info-circle-fill toast-icon"></i>'
        };

        const toast = $(`
            <div class="custom-toast toast-${type}">
                ${icons[type] || icons.warning}
                <span>${message}</span>
                <button class="toast-close">&times;</button>
            </div>
        `);

        $('#toastContainer').append(toast);

        toast.find('.toast-close').on('click', function () {
            removeToast(toast);
        });

        setTimeout(function () {
            removeToast(toast);
        }, 4000);
    }

    function removeToast(toast) {
        toast.css('animation', 'toast-exit 0.3s ease-in forwards');
        setTimeout(function () {
            toast.remove();
        }, 300);
    }

});
