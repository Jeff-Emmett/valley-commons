// Smooth scroll to section, ensuring title is visible
function scrollToSection(sectionId, e) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    e.preventDefault();
    
    // Get header height for offset
    const header = document.querySelector('.header');
    const headerHeight = header ? header.offsetHeight : 0;
    const padding = 40; // Extra padding to ensure title is fully visible
    
    // Calculate position to show section with title visible
    const sectionRect = section.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.pageYOffset;
    const viewportHeight = window.innerHeight;
    
    // Scroll to position that shows the section title with proper spacing
    // Position section so it starts below header with padding
    const scrollPosition = sectionTop - headerHeight - padding;
    
    // Smooth scroll to position
    window.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
    });
}

// Smooth scroll to waitlist section, centered on page
function scrollToWaitlist(e) {
    scrollToSection('waitlist', e);
}

// Loading screen handler
function initLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    const skipButton = document.getElementById('skip-loading');
    if (skipButton) {
        skipButton.addEventListener('click', function() {
            loadingScreen.classList.add('hidden');
            setTimeout(function() {
                loadingScreen.remove();
            }, 1200);
        });
    }

    // Wait for page to fully load
    window.addEventListener('load', function() {
        // Add delay to allow title animation to complete (6s zoom + 4s title = ~6s total)
        setTimeout(function() {
            loadingScreen.classList.add('hidden');
            // Remove from DOM after transition completes
            setTimeout(function() {
                loadingScreen.remove();
            }, 1200);
        }, 6500); // Wait for animations to complete
    });
}

// Waitlist form submission handler and scroll setup
document.addEventListener('DOMContentLoaded', function() {
    // Initialize loading screen
    initLoadingScreen();
    
    // Set up scroll handlers for all anchor links
    const waitlistLinks = document.querySelectorAll('a[href="#waitlist"]');
    waitlistLinks.forEach(link => {
        link.addEventListener('click', scrollToWaitlist);
    });
    
    const scheduleLinks = document.querySelectorAll('a[href="#schedule"]');
    scheduleLinks.forEach(link => {
        link.addEventListener('click', (e) => scrollToSection('schedule', e));
    });
    
    const form = document.getElementById('waitlist-form');
    const emailInput = document.getElementById('waitlist-email');
    const nameInput = document.getElementById('waitlist-name');
    const involvementInput = document.getElementById('waitlist-involvement');
    const messageDiv = document.getElementById('waitlist-message');
    const submitButton = form.querySelector('button[type="submit"]');

    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Disable form during submission
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        messageDiv.textContent = '';
        messageDiv.className = 'waitlist-message';

        const email = emailInput.value.trim();
        const name = nameInput.value.trim();

        // Basic email validation
        if (!email || !email.includes('@')) {
            showMessage('Please enter a valid email address.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
            return;
        }

        // Name is now required
        if (!name || name.trim() === '') {
            showMessage('Please enter your name.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
            return;
        }

        const involvement = involvementInput.value.trim();

        // Involvement is required
        if (!involvement || involvement === '') {
            showMessage('Please describe your desired involvement.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
            return;
        }

        try {
            const response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, name, involvement }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('Thank you! Your information has been submitted.', 'success');
                form.reset();
            } else {
                showMessage(data.error || 'Something went wrong. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
        }
    });

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `waitlist-message ${type}`;
        
        // Scroll message into view if needed
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

