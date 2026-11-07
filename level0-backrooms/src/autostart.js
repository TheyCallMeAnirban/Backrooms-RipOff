window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('autostart')) {
    setTimeout(() => {
      const startBtn = document.querySelector('#start');
      if (startBtn) startBtn.click();
    }, 400);
  }
});

