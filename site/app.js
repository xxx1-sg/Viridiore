/**
 * 官网交互：顶栏吸顶样式 + 滚动进场
 * 没有框架，全部原生
 */
(function () {
  'use strict';

  /* ---------- 顶栏 ---------- */
  const nav = document.getElementById('nav');
  let stuck = false;

  const onScroll = () => {
    const next = window.scrollY > 40;
    if (next !== stuck) {
      stuck = next;
      nav.classList.toggle('is-stuck', next);
    }
  };

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );
  onScroll();

  /* ---------- 滚动进场 ---------- */
  const items = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- 图片加载失败兜底 ---------- */
  document.querySelectorAll('img').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.style.opacity = '0.15';
        img.alt = '截图加载失败';
      },
      { once: true }
    );
  });

  /* ---------- 大图预览 ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');

  const closeLb = () => {
    lb.hidden = true;
    document.body.style.overflow = '';
  };

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-full]');
    if (!trigger) return;
    const src = trigger.getAttribute('data-full');
    if (!src) return;
    lbImg.src = src;
    lbImg.alt = trigger.querySelector('img')?.alt || '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  });

  lb.addEventListener('click', closeLb);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lb.hidden) closeLb();
  });
})();
