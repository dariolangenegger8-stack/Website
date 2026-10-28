// Short excerpts from the user-selected source. Keep the source credit visible.
const sayings = [
  { text: 'Lieber arm dran als Arm ab!', author: 'dk' },
  { text: 'Was früher meine Leber war ist heute meine Minibar', author: 'Chrizzyy' }
];
export function createSayings(escape) {
  let index = Math.floor(Math.random() * sayings.length);
  function content() {
    const saying = sayings[index];
    return `<div class="saying-heading"><span>Schnupfspruch</span><button type="button" id="next-saying" aria-label="Nächster Spruch" title="Nächster Spruch">↻</button></div><p id="saying-text">„${escape(saying.text)}“</p><div class="saying-credit"><span>— ${escape(saying.author)}</span><a href="https://schnupfspru.ch/" target="_blank" rel="noopener noreferrer">schnupfspru.ch ↗</a></div>`;
  }
  function html() { return `<aside class="saying-footer" aria-label="Schnupfspruch">${content()}</aside>`; }
  function bind(root) {
    const button = root.querySelector('#next-saying');
    if (!button) return;
    button.onclick = () => {
      index = (index + 1) % sayings.length;
      const footer = root.querySelector('.saying-footer');
      footer.innerHTML = content();
      bind(root);
      footer.querySelector('#next-saying').focus({ preventScroll: true });
    };
  }
  return { html, bind };
}
