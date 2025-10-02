// Smooth scrolling untuk anchor link
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Text rotation with character animation
const textSets = document.querySelectorAll('.text-set');
let currentIndex = 0;
let isAnimating = false;

function animateTextIn(textSet) {
    const glitchText = textSet.querySelector('.glitch-text');
    const subtitle = textSet.querySelector('.subtitle');
    
    
    // Update data attribute for glitch effect
    glitchText.setAttribute('data-text', glitchText.textContent);
    
    // Show subtitle after main text
    setTimeout(() => {
        subtitle.classList.add('visible');
    }, 800);
}

function animateTextOut(textSet) {
    const chars = textSet.querySelectorAll('.char');
    const subtitle = textSet.querySelector('.subtitle');
    
    // Animate characters out
    chars.forEach((char, i) => {
        char.style.animationDelay = `${i * 0.02}s`;
        char.classList.add('out');
    });
    
    // Hide subtitle
    subtitle.classList.remove('visible');
}

function rotateText() {
    if (isAnimating) return;
    isAnimating = true;

    const currentSet = textSets[currentIndex];
    const nextIndex = (currentIndex + 1) % textSets.length;
    const nextSet = textSets[nextIndex];

    // Animate out current text
    animateTextOut(currentSet);

    // After out animation, switch sets
    setTimeout(() => {
        currentSet.classList.remove('active');
        nextSet.classList.add('active');
        animateTextIn(nextSet);
        
        currentIndex = nextIndex;
        isAnimating = false;
    }, 600);
}

// Initialize first text set
textSets[0].classList.add('active');
animateTextIn(textSets[0]);

// Start rotation after initial display
setTimeout(() => {
    setInterval(rotateText, 5000); // Change every 5 seconds
}, 4000);

// Add random glitch effect
setInterval(() => {
    const glitchTexts = document.querySelectorAll('.glitch-text');
    glitchTexts.forEach(text => {
        if (Math.random() > 0.95) {
            text.style.animation = 'none';
            setTimeout(() => {
                text.style.animation = '';
            }, 200);
        }
    });
}, 3000);