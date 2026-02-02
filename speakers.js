// Dynamically load featured speakers
document.addEventListener('DOMContentLoaded', function() {
    const speakersContainer = document.getElementById('speakers-container');
    if (!speakersContainer) return;

    // Define speakers based on folder structure
    const speakers = [
        {
            name: 'Adam Arvidsson',
            folder: 'Adam Arvidsson',
            image: 'Arvidsson.png'
        },
        {
            name: 'Charlie Fisher',
            folder: 'Charlie Fisher',
            image: 'charlie.jpeg'
        },
        {
            name: 'Daniel Figueiredo',
            folder: 'DANIEL RICHARD DE OLIVIERA FIGUEIREDO',
            image: 'daniel.webp'
        },
        {
            name: 'Emil Fritsch',
            folder: 'Emil Fritsch',
            image: 'emil.webp',
            imagePosition: 'top'
        },
        {
            name: 'Felix Fritsch',
            folder: 'Felix Fritsch',
            image: 'Fritsch.png'
        },
        {
            name: 'Clara Gromaches',
            folder: 'Clara Gromaches',
            image: 'clara.jpg'
        },
        {
            name: 'Koss',
            folder: 'Koss',
            image: 'koss.png'
        },
        {
            name: 'Lorenzo Patuzzo',
            folder: 'Lorenzo Patuzzo',
            image: 'lorenzo.jpg'
        },
        {
            name: 'Michel Bauwens',
            folder: 'Michel Bauwens',
            image: 'bauwens.jpeg'
        },
        {
            name: 'Rashmi Abbigeri',
            folder: 'Rashmi Abbigeri',
            image: 'Abbigeri.png'
        },
        {
            name: 'Una Wang',
            folder: 'Una Wang',
            image: 'una.jpg'
        },
        {
            name: 'Veronica',
            folder: 'Veronica',
            image: 'veronica.png'
        }
    ];

    // Sort by last name; single-name entries go last, sorted by first name
    const withLastName = speakers.filter((speaker) => speaker.name.trim().split(/\s+/).length > 1);
    const withoutLastName = speakers.filter((speaker) => speaker.name.trim().split(/\s+/).length === 1);

    withLastName.sort((a, b) => {
        const aParts = a.name.trim().split(/\s+/);
        const bParts = b.name.trim().split(/\s+/);
        const aLast = aParts[aParts.length - 1];
        const bLast = bParts[bParts.length - 1];
        const lastCompare = aLast.localeCompare(bLast, 'en', { sensitivity: 'base' });
        if (lastCompare !== 0) return lastCompare;
        return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });

    withoutLastName.sort((a, b) => {
        const aFirst = a.name.trim().split(/\s+/)[0];
        const bFirst = b.name.trim().split(/\s+/)[0];
        return aFirst.localeCompare(bFirst, 'en', { sensitivity: 'base' });
    });

    const sortedSpeakers = [...withLastName, ...withoutLastName];

    // Load each speaker
    sortedSpeakers.forEach(speaker => {
        loadSpeaker(speaker);
    });

    async function loadSpeaker(speaker) {
        // Create speaker card
        const speakerCard = document.createElement('div');
        speakerCard.className = 'speaker-card';

        // Create image
        const img = document.createElement('img');
        img.src = `speakers/${speaker.folder}/${speaker.image}`;
        img.alt = speaker.name;
        img.className = 'speaker-image';
        img.loading = 'lazy';
        if (speaker.imagePosition) {
            img.style.objectPosition = speaker.imagePosition;
        }

        // Create name
        const name = document.createElement('h3');
        name.className = 'speaker-name';
        name.textContent = speaker.name;

        // Create bio (filled after fetch to preserve order)
        const bio = document.createElement('p');
        bio.className = 'speaker-bio';

        // Create toggle text for mobile
        const toggleText = document.createElement('span');
        toggleText.className = 'speaker-toggle-text';
        toggleText.textContent = 'click to read more';

        // Create read more indicator for desktop
        const readMoreDesktop = document.createElement('span');
        readMoreDesktop.className = 'speaker-read-more-desktop';
        readMoreDesktop.textContent = 'read more v';

        // Assemble card
        speakerCard.appendChild(img);
        speakerCard.appendChild(name);
        speakerCard.appendChild(readMoreDesktop);
        speakerCard.appendChild(toggleText);
        speakerCard.appendChild(bio);

        // Add click handler for mobile
        speakerCard.addEventListener('click', function(e) {
            if (window.innerWidth < 769) {
                e.preventDefault();
                speakerCard.classList.toggle('expanded');
                // Update toggle text
                if (speakerCard.classList.contains('expanded')) {
                    toggleText.textContent = 'click to collapse';
                } else {
                    toggleText.textContent = 'click to read more';
                }
            }
        });

        // Append immediately to preserve sorted order
        speakersContainer.appendChild(speakerCard);

        try {
            // Fetch bio
            const bioResponse = await fetch(`speakers/${speaker.folder}/bio.md`);
            if (!bioResponse.ok) {
                console.error(`Failed to load bio for ${speaker.name}`);
                return;
            }
            const bioText = await bioResponse.text();
            bio.textContent = bioText.trim();
        } catch (error) {
            console.error(`Error loading speaker ${speaker.name}:`, error);
        }
    }
});
