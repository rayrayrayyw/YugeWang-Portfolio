(function () {
  'use strict';

  /* ================================================================
     1. CURSOR GLOW — ambient amber glow following mouse
     ================================================================ */
  var glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  var glowActive = false;
  document.addEventListener('mousemove', function (e) {
    if (!glowActive) { glow.classList.add('active'); glowActive = true; }
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
  document.addEventListener('mouseleave', function () {
    glow.classList.remove('active');
    glowActive = false;
  });

  /* ================================================================
     2. IMAGE REVEAL WIPE — clip-path animation on scroll
     ================================================================ */
  var allImages = document.querySelectorAll(
    '.block-text .full-image img, .image-wrapper img, .block-text .full-image.two-images .image-pair img'
  );

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('img-wipe');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  allImages.forEach(function (img) { revealObserver.observe(img); });

  /* ================================================================
     3. LABEL TEXT SCRAMBLE — glitch text on scroll-in
     ================================================================ */
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|_-+=<>';

  function scrambleLabel(el) {
    var original = el.getAttribute('data-text');
    if (!original) return;
    var length = original.length;
    var iterations = 0;
    var maxIterations = length * 2.5;
    var interval = setInterval(function () {
      var result = '';
      for (var i = 0; i < length; i++) {
        if (original[i] === ' ') { result += ' '; continue; }
        if (i < iterations / 2.5) {
          result += original[i];
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      el.childNodes[el.childNodes.length - 1].textContent = result;
      iterations++;
      if (iterations > maxIterations) {
        clearInterval(interval);
        el.childNodes[el.childNodes.length - 1].textContent = original;
      }
    }, 30);
  }

  var labels = document.querySelectorAll('.block-label');
  labels.forEach(function (label) {
    var textNode = label.childNodes[label.childNodes.length - 1];
    if (textNode) {
      label.setAttribute('data-text', textNode.textContent.trim());
    }
  });

  var labelObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        scrambleLabel(entry.target);
        labelObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  labels.forEach(function (label) { labelObserver.observe(label); });

  /* ================================================================
     4. PARALLAX IMAGES — subtle vertical shift on scroll
     ================================================================ */
  var parallaxImages = document.querySelectorAll(
    '.block-text .full-image img, .media-highlight .image-wrapper img'
  );
  parallaxImages.forEach(function (img) { img.classList.add('parallax-img'); });

  function updateParallax() {
    var scrollY = window.scrollY;
    var vh = window.innerHeight;
    parallaxImages.forEach(function (img) {
      var rect = img.getBoundingClientRect();
      var center = rect.top + rect.height / 2;
      var offset = (center - vh / 2) / vh;
      img.style.transform = 'translateY(' + (offset * -18) + 'px)';
    });
  }

  var parallaxTicking = false;
  window.addEventListener('scroll', function () {
    if (!parallaxTicking) {
      requestAnimationFrame(function () {
        updateParallax();
        parallaxTicking = false;
      });
      parallaxTicking = true;
    }
  }, { passive: true });

  /* ================================================================
     5. LIGHTBOX — click image to view full-screen
     ================================================================ */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML =
    '<button class="lightbox-close">ESC · CLOSE</button>' +
    '<img src="" alt="">' +
    '<span class="lightbox-caption"></span>';
  document.body.appendChild(lightbox);

  var lbImg = lightbox.querySelector('img');
  var lbCaption = lightbox.querySelector('.lightbox-caption');
  var lbClose = lightbox.querySelector('.lightbox-close');

  function openLightbox(src, caption) {
    lbImg.src = src;
    lbCaption.textContent = caption || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  var clickableImgs = document.querySelectorAll(
    '.block-text .full-image img, .image-wrapper img'
  );
  clickableImgs.forEach(function (img) {
    img.addEventListener('click', function () {
      var caption = '';
      var captionEl = img.closest('.full-image');
      if (captionEl) {
        var cap = captionEl.querySelector('.caption');
        if (cap) caption = cap.textContent;
      }
      if (!caption) {
        var wrapper = img.closest('.image-wrapper');
        if (wrapper) {
          var sib = wrapper.nextElementSibling;
          if (sib && sib.classList.contains('caption')) caption = sib.textContent;
        }
      }
      openLightbox(img.src, caption);
    });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  /* ================================================================
     6. SPEC GRID 3D TILT — subtle perspective on mousemove
     ================================================================ */
  var specGrid = document.querySelector('.project-specs');
  if (specGrid) {
    specGrid.style.transition = 'transform .2s ease';
    specGrid.style.transformStyle = 'preserve-3d';
    specGrid.addEventListener('mousemove', function (e) {
      var rect = specGrid.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      specGrid.style.transform =
        'perspective(800px) rotateY(' + (x * 4) + 'deg) rotateX(' + (-y * 4) + 'deg)';
    });
    specGrid.addEventListener('mouseleave', function () {
      specGrid.style.transform = 'perspective(800px) rotateY(0) rotateX(0)';
    });
  }

})();
