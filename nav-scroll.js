(function () {

  // Hide the navbar buttons while scrolling down, show them again on scroll up or at the top
  const HIDE_AFTER = 120;
  let lastY = window.scrollY;

  window.addEventListener('scroll', () => {

    const y = window.scrollY;
    const goingDown = y > lastY;
    const hide = goingDown && y > HIDE_AFTER;

    // The buttons are rendered after the artists load, so look them up on each scroll
    document
      .querySelectorAll('.nav-cta, .nav-button')
      .forEach(button => button.classList.toggle('nav-cta-hidden', hide));

    lastY = y;

  }, { passive: true });

})();
