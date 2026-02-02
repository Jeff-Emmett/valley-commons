// Dynamically load community partners
document.addEventListener('DOMContentLoaded', function() {
    const partnersContainer = document.getElementById('partners-container');
    if (!partnersContainer) return;

    // Define partners with placeholder links
    // TODO: Replace placeholder URLs with actual partner websites
    const partners = [
        {
            name: 'Hubs Network',
            logo: 'hubs-network.jpg',
            url: 'https://www.hubsnetwork.org' 
        },
        {
            name: 'Invisible Garden',
            logo: 'invisible-garden.svg',
            url: 'https://invisible.garden' 
        },
        {
            name: 'Understories',
            logo: 'understories.png',
            url: 'https://understories.github.io' 
        },
        {
            name: 'P2P Foundation',
            logo: 'p2p.jpeg',
            url: 'https://p2pfoundation.net/'
        },
        {
            name: 'Crypto Commons Association',
            logo: 'cca-logo.png',
            url: 'https://www.crypto-commons.org'
        },
        {
            name: 'Collaborative Finance',
            logo: 'cofi_cropped.png',
            url: 'https://www.collaborative-finance.net'
        },
        {
            name: 'Akasha Hub',
            logo: 'akasha.png',
            url: 'https://akasha.barcelona'
        },
        {
            name: 'dOrg',
            logo: 'd0rg.png',
            url: 'https://www.dorg.tech'
        },
        {
            name: 'FarmLab',
            logo: 'farmlab.png',
            url: 'https://www.farmlab.at'
        }
    ];

    // Load each partner
    partners.forEach(partner => {
        loadPartner(partner);
    });

    function loadPartner(partner) {
        try {
            // Create partner link
            const partnerLink = document.createElement('a');
            partnerLink.href = partner.url;
            partnerLink.target = '_blank';
            partnerLink.rel = 'noopener noreferrer';
            partnerLink.className = 'partner-link';

            // Create logo image
            const img = document.createElement('img');
            img.src = `community-partners/${partner.logo}`;
            img.alt = partner.name;
            img.className = 'partner-logo';
            img.loading = 'lazy';

            // Assemble link
            partnerLink.appendChild(img);
            partnersContainer.appendChild(partnerLink);
        } catch (error) {
            console.error(`Error loading partner ${partner.name}:`, error);
        }
    }
});
