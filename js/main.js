// Fade in on page load
document.body.style.opacity = '1';

// Fade in projects
const projectsTitle = document.querySelector('#projects .section-title');
const filmsCard = document.querySelector('.project-card:first-child')
const photosCard = document.querySelector('.project-card:nth-child(2)')
const XRCard = document.querySelector('.project-card:nth-child(3)')

function projectsFadeIn(e) {
    if (window.scrollY > 300) {
        projectsTitle.style.opacity = '1';
    }

    if (window.scrollY > 500) {
        filmsCard.style.opacity = '1';
            setTimeout(() => {
                photosCard.style.opacity = '1';
        }, 500);
            setTimeout(() => {
                XRCard.style.opacity = '1';
        }, 1000);
    }


}

window.addEventListener('scroll', projectsFadeIn);