let viewer = null;
export function closePhotoViewer() {
  if (viewer?.open) viewer.close();
}
export function bindPhotoViewer(root) {
  root.querySelectorAll('.photo-trigger').forEach(button => {
    button.addEventListener('click', () => {
      if (viewer) return;
      const thumbnail = button.querySelector('img');
      const dialog = document.createElement('dialog');
      dialog.className = 'photo-viewer';
      dialog.setAttribute('aria-label', 'Foto-Großansicht');
      const close = document.createElement('button');
      close.className = 'photo-viewer-close';
      close.textContent = '✕ Schließen';
      close.setAttribute('aria-label', 'Foto schließen');
      const image = document.createElement('img');
      image.className = 'photo-viewer-image';
      image.src = thumbnail.currentSrc || thumbnail.src;
      image.alt = thumbnail.alt;
      const caption = document.createElement('p');
      caption.className = 'photo-viewer-caption';
      caption.textContent = thumbnail.alt;
      dialog.append(close, image, caption);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      viewer = dialog;
      close.onclick = () => dialog.close();
      dialog.onclick = event => { if (event.target === dialog) dialog.close(); };
      dialog.addEventListener('close', () => {
        document.body.style.overflow = previousOverflow;
        dialog.remove();
        if (viewer === dialog) viewer = null;
        if (button.isConnected) button.focus({preventScroll:true});
      }, {once:true});
      document.body.append(dialog);
      dialog.showModal();
      close.focus();
    });
  });
}
