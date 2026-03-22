/**
 * ═══════════════════════════════════════════════════════════════
 * Login Page — Production-Grade Logic
 * jQuery AJAX · Field-level validation · Lockout detection
 * Rate limit handling · localStorage token · Toast & Loader
 * ═══════════════════════════════════════════════════════════════
 */

$(document).ready(function () {

    // ─── If already logged in, redirect to profile ────────────
    if (localStorage.getItem('token')) {
        window.location.href = 'profile.html';
        return;
    }

    // ─── Password Toggle ──────────────────────────────────────
    $('#togglePassword').on('click', function () {
        const input = $('#loginPassword');
        const icon = $(this).find('i');
        if (input.attr('type') === 'password') {
            input.attr('type', 'text');
            icon.removeClass('bi-eye-slash').addClass('bi-eye');
        } else {
            input.attr('type', 'password');
            icon.removeClass('bi-eye').addClass('bi-eye-slash');
        }
    });

    // ─── Field Error Helpers ──────────────────────────────────
    function showFieldError(fieldId, errorId, message) {
        $(fieldId).addClass('input-error').removeClass('input-success');
        $(errorId).text(message).addClass('active');
    }

    function clearFieldError(fieldId, errorId) {
        $(fieldId).removeClass('input-error');
        $(errorId).text('').removeClass('active');
    }

    function clearAllErrors() {
        $('.field-error').text('').removeClass('active');
        $('.form-control').removeClass('input-error input-success');
    }

    // ─── Real-time Blur Validation ────────────────────────────
    $('#loginEmail').on('blur', function () {
        const val = $.trim($(this).val());
        if (!val) {
            showFieldError('#loginEmail', '#errorEmail', 'Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            showFieldError('#loginEmail', '#errorEmail', 'Enter a valid email address');
        } else {
            clearFieldError('#loginEmail', '#errorEmail');
        }
    });

    $('#loginPassword').on('blur', function () {
        if (!$(this).val()) {
            showFieldError('#loginPassword', '#errorPassword', 'Password is required');
        } else {
            clearFieldError('#loginPassword', '#errorPassword');
        }
    });

    // Clear error on focus
    $('#loginEmail').on('focus', function () {
        clearFieldError('#loginEmail', '#errorEmail');
    });
    $('#loginPassword').on('focus', function () {
        clearFieldError('#loginPassword', '#errorPassword');
    });

    // ─── Lockout Handling ─────────────────────────────────────
    function showLockout(message) {
        $('#lockoutMessage').text(message);
        $('#lockoutWarning').addClass('active');
        $('#btnLogin').prop('disabled', true);
    }

    function hideLockout() {
        $('#lockoutWarning').removeClass('active');
        $('#btnLogin').prop('disabled', false);
    }

    // ─── Form Submit ──────────────────────────────────────────
    $('#loginForm').on('submit', function (e) {
        e.preventDefault();

        clearAllErrors();
        hideLockout();

        const email = $.trim($('#loginEmail').val());
        const password = $('#loginPassword').val();

        // Client-side validation
        let hasErrors = false;

        if (!email) {
            showFieldError('#loginEmail', '#errorEmail', 'Email is required');
            hasErrors = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('#loginEmail', '#errorEmail', 'Enter a valid email address');
            hasErrors = true;
        }

        if (!password) {
            showFieldError('#loginPassword', '#errorPassword', 'Password is required');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Show loader & disable button
        showLoader();
        $('#btnLogin').prop('disabled', true);

        // AJAX POST
        $.ajax({
            url: 'php/login.php',
            type: 'POST',
            data: { email: email, password: password },
            success: function (res) {
                hideLoader();
                $('#btnLogin').prop('disabled', false);

                let data;
                try {
                    data = typeof res === 'object' ? res : JSON.parse(res);
                } catch (err) {
                    showToast('error', 'Unexpected server response.');
                    return;
                }

                if (data.status === 'success') {
                    // Store token and user info in localStorage
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user_id', data.user_id);
                    localStorage.setItem('user_name', data.name);

                    showToast('success', 'Login successful! Redirecting...');

                    setTimeout(function () {
                        window.location.href = 'profile.html';
                    }, 1000);
                } else {
                    // Check for lockout
                    if (data.locked) {
                        var minutes = Math.ceil((data.retry_after || 900) / 60);
                        showLockout('Account locked for ' + minutes + ' minute(s) due to too many failed attempts.');
                        showToast('error', data.message);
                    } else {
                        // Show field-level errors from server
                        if (data.field_errors) {
                            if (data.field_errors.email) {
                                showFieldError('#loginEmail', '#errorEmail', data.field_errors.email);
                            }
                            if (data.field_errors.password) {
                                showFieldError('#loginPassword', '#errorPassword', data.field_errors.password);
                            }
                        }

                        // Show remaining attempts warning
                        var msg = data.message || 'Login failed.';
                        if (data.attempts_remaining !== undefined && data.attempts_remaining <= 2) {
                            msg += ' (' + data.attempts_remaining + ' attempt(s) remaining)';
                        }
                        showToast('error', msg);
                    }
                }
            },
            error: function (xhr, status, error) {
                hideLoader();
                $('#btnLogin').prop('disabled', false);
                if (xhr.status === 429) {
                    var data = {};
                    try { data = JSON.parse(xhr.responseText); } catch(e) {}
                    var minutes = Math.ceil((data.retry_after || 900) / 60);
                    showLockout('Too many failed attempts. Try again in ' + minutes + ' minute(s).');
                    showToast('error', 'Account temporarily locked.');
                } else {
                    showToast('error', 'Server error. Please try again later.');
                }
                console.error('Login AJAX Error:', status, error);
            }
        });
    });

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
