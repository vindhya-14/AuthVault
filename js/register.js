/**
 * ═══════════════════════════════════════════════════════════════
 * Register Page — Production-Grade Logic
 * jQuery AJAX · Field-level validation · Password strength meter
 * Confirm password · Duplicate detection · Toast & Loader
 * ═══════════════════════════════════════════════════════════════
 */

$(document).ready(function () {

    // ─── Password Toggle ──────────────────────────────────────
    function setupToggle(toggleId, inputId) {
        $(toggleId).on('click', function () {
            const input = $(inputId);
            const icon = $(this).find('i');
            if (input.attr('type') === 'password') {
                input.attr('type', 'text');
                icon.removeClass('bi-eye-slash').addClass('bi-eye');
            } else {
                input.attr('type', 'password');
                icon.removeClass('bi-eye').addClass('bi-eye-slash');
            }
        });
    }

    setupToggle('#togglePassword', '#regPassword');
    setupToggle('#toggleConfirmPassword', '#regConfirmPassword');

    // ─── Password Strength Meter ──────────────────────────────
    $('#regPassword').on('input', function () {
        const pw = $(this).val();
        const container = $('#strengthContainer');
        const fill = $('#strengthFill');
        const text = $('#strengthText');

        if (pw.length === 0) {
            container.hide();
            return;
        }

        container.show();

        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) score++;

        const levels = ['', 'weak', 'fair', 'good', 'good', 'strong'];
        const labels = ['', 'Weak', 'Fair', 'Good', 'Good', 'Strong'];
        const level = levels[score] || 'weak';
        const label = labels[score] || 'Weak';

        fill.removeClass('weak fair good strong').addClass(level);
        text.removeClass('weak fair good strong').addClass(level).text(label);
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

    function markFieldSuccess(fieldId, errorId) {
        $(fieldId).addClass('input-success').removeClass('input-error');
        $(errorId).text('').removeClass('active');
    }

    function clearAllErrors() {
        $('.field-error').text('').removeClass('active');
        $('.form-control').removeClass('input-error input-success');
    }

    // ─── Real-time Blur Validation ────────────────────────────
    $('#regName').on('blur', function () {
        const val = $.trim($(this).val());
        if (!val) {
            showFieldError('#regName', '#errorName', 'Name is required');
        } else if (val.length < 2) {
            showFieldError('#regName', '#errorName', 'Name must be at least 2 characters');
        } else if (!/^[a-zA-Z\s'-]+$/.test(val)) {
            showFieldError('#regName', '#errorName', 'Letters, spaces, hyphens, apostrophes only');
        } else {
            markFieldSuccess('#regName', '#errorName');
        }
    });

    $('#regEmail').on('blur', function () {
        const val = $.trim($(this).val());
        if (!val) {
            showFieldError('#regEmail', '#errorEmail', 'Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            showFieldError('#regEmail', '#errorEmail', 'Enter a valid email address');
        } else {
            markFieldSuccess('#regEmail', '#errorEmail');
        }
    });

    $('#regPassword').on('blur', function () {
        const val = $(this).val();
        if (!val) {
            showFieldError('#regPassword', '#errorPassword', 'Password is required');
        } else if (val.length < 8) {
            showFieldError('#regPassword', '#errorPassword', 'At least 8 characters required');
        } else if (!/[A-Z]/.test(val)) {
            showFieldError('#regPassword', '#errorPassword', 'Must contain an uppercase letter');
        } else if (!/[a-z]/.test(val)) {
            showFieldError('#regPassword', '#errorPassword', 'Must contain a lowercase letter');
        } else if (!/[0-9]/.test(val)) {
            showFieldError('#regPassword', '#errorPassword', 'Must contain a number');
        } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)) {
            showFieldError('#regPassword', '#errorPassword', 'Must contain a special character');
        } else {
            markFieldSuccess('#regPassword', '#errorPassword');
        }
    });

    $('#regConfirmPassword').on('blur', function () {
        const pw = $('#regPassword').val();
        const cpw = $(this).val();
        if (!cpw) {
            showFieldError('#regConfirmPassword', '#errorConfirmPassword', 'Please confirm your password');
        } else if (pw !== cpw) {
            showFieldError('#regConfirmPassword', '#errorConfirmPassword', 'Passwords do not match');
        } else {
            markFieldSuccess('#regConfirmPassword', '#errorConfirmPassword');
        }
    });

    // Clear error on focus
    $('.form-control').on('focus', function () {
        const errorId = '#error' + this.id.replace('reg', '');
        clearFieldError('#' + this.id, errorId);
    });

    // ─── Form Submit ──────────────────────────────────────────
    $('#registerForm').on('submit', function (e) {
        e.preventDefault();

        clearAllErrors();

        const name     = $.trim($('#regName').val());
        const email    = $.trim($('#regEmail').val());
        const password = $('#regPassword').val();
        const confirm  = $('#regConfirmPassword').val();

        // Client-side validation
        let hasErrors = false;

        if (!name || name.length < 2) {
            showFieldError('#regName', '#errorName', 'Valid name is required (min 2 chars)');
            hasErrors = true;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('#regEmail', '#errorEmail', 'Valid email address is required');
            hasErrors = true;
        }

        if (!password || password.length < 8) {
            showFieldError('#regPassword', '#errorPassword', 'Password must be at least 8 characters');
            hasErrors = true;
        }

        if (password !== confirm) {
            showFieldError('#regConfirmPassword', '#errorConfirmPassword', 'Passwords do not match');
            hasErrors = true;
        }

        if (hasErrors) return;

        // Show loader & disable button
        showLoader();
        $('#btnRegister').prop('disabled', true);

        // AJAX POST
        $.ajax({
            url: 'php/register.php',
            type: 'POST',
            data: {
                name: name,
                email: email,
                password: password,
                confirm_password: confirm
            },
            success: function (res) {
                hideLoader();
                $('#btnRegister').prop('disabled', false);

                let data;
                try {
                    data = typeof res === 'object' ? res : JSON.parse(res);
                } catch (err) {
                    showToast('error', 'Unexpected server response.');
                    return;
                }

                if (data.status === 'success') {
                    showToast('success', data.message);
                    $('#registerForm')[0].reset();
                    $('#strengthContainer').hide();
                    clearAllErrors();
                    setTimeout(function () {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    // Show field-level errors from server
                    if (data.field_errors) {
                        if (data.field_errors.name) {
                            showFieldError('#regName', '#errorName', data.field_errors.name);
                        }
                        if (data.field_errors.email) {
                            showFieldError('#regEmail', '#errorEmail', data.field_errors.email);
                        }
                        if (data.field_errors.password) {
                            showFieldError('#regPassword', '#errorPassword', data.field_errors.password);
                        }
                        if (data.field_errors.confirm_password) {
                            showFieldError('#regConfirmPassword', '#errorConfirmPassword', data.field_errors.confirm_password);
                        }
                    }
                    showToast('error', data.message || 'Registration failed.');
                }
            },
            error: function (xhr, status, error) {
                hideLoader();
                $('#btnRegister').prop('disabled', false);
                if (xhr.status === 429) {
                    showToast('error', 'Too many attempts. Please wait a few minutes.');
                } else {
                    showToast('error', 'Server error. Please try again later.');
                }
                console.error('Register AJAX Error:', status, error);
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
