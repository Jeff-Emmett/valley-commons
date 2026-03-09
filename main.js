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

    // Scroll to position that shows the section title with proper spacing
    const scrollPosition = sectionTop - headerHeight - padding;

    window.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
    });
}

// Loading screen handler
function initLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;

    let isHiding = false;

    function hideLoadingScreen() {
        if (isHiding) return;
        isHiding = true;
        loadingScreen.classList.add('hidden');
        setTimeout(function() {
            loadingScreen.remove();
        }, 1200);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('wheel', onScroll);
        window.removeEventListener('touchmove', onScroll);
    }

    function onScroll() {
        hideLoadingScreen();
    }

    const skipButton = document.getElementById('skip-loading');
    if (skipButton) {
        skipButton.addEventListener('click', hideLoadingScreen);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });

    window.addEventListener('load', function() {
        setTimeout(function() {
            hideLoadingScreen();
        }, 6500);
    });
}

// Newsletter form submission handler
function initNewsletterForm() {
    const form = document.getElementById('newsletter-form');
    if (!form) return;

    const emailInput = document.getElementById('newsletter-email');
    const messageDiv = document.getElementById('newsletter-message');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        submitButton.disabled = true;
        submitButton.textContent = 'Subscribing...';
        messageDiv.textContent = '';
        messageDiv.className = 'newsletter-message';

        const email = emailInput.value.trim();

        if (!email || !email.includes('@')) {
            showMessage('Please enter a valid email address.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Subscribe';
            return;
        }

        try {
            const response = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('You\'re subscribed! We\'ll keep you updated.', 'success');
                form.reset();
            } else {
                showMessage(data.error || 'Something went wrong. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Subscribe';
        }
    });

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `newsletter-message ${type}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initLoadingScreen();

    // Set up scroll handlers for anchor links
    const registerLinks = document.querySelectorAll('a[href="#register"]');
    registerLinks.forEach(link => {
        link.addEventListener('click', (e) => scrollToSection('register', e));
    });

    const scheduleLinks = document.querySelectorAll('a[href="#schedule"]');
    scheduleLinks.forEach(link => {
        link.addEventListener('click', (e) => scrollToSection('schedule', e));
    });

    initNewsletterForm();
});
