const form = document.querySelector<HTMLFormElement>('#settings')!;
const endpointField = document.querySelector<HTMLInputElement>('#endpoint')!;
const tokenField = document.querySelector<HTMLInputElement>('#token')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;

void chrome.storage.local.get(['analysisEndpoint', 'analysisToken']).then(settings => {
  endpointField.value = typeof settings.analysisEndpoint === 'string' ? settings.analysisEndpoint : 'http://127.0.0.1:8787';
  tokenField.value = typeof settings.analysisToken === 'string' ? settings.analysisToken : '';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  void (async () => {
    try {
      const url = new URL(endpointField.value.trim());
      if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== ''))
        throw new Error('Укажите только адрес сервера без пути, параметров и пароля.');
      const loopback = url.hostname === 'localhost' || url.hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
        throw new Error('Для внутреннего сервера используйте HTTPS. HTTP разрешён только для localhost.');
      const origin = `${url.origin}/*`;
      if (!await chrome.permissions.request({ origins: [origin] })) {
        statusMessage.textContent = 'Chrome не предоставил расширению доступ к этому адресу.';
        return;
      }
      await chrome.storage.local.set({ analysisEndpoint: url.origin, analysisToken: tokenField.value.trim() });
      endpointField.value = url.origin;
      statusMessage.textContent = 'Настройки сохранены.';
    } catch (error) {
      statusMessage.textContent = error instanceof TypeError ? 'Введите корректный адрес сервера.' :
        error instanceof Error ? error.message : 'Не удалось сохранить настройки.';
    }
  })();
});
